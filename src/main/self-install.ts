/**
 * Bobine s'installe elle-même (fiche 073). Ouverte depuis le .dmg (ou depuis Téléchargements), elle
 * propose de se copier pour tous les utilisateurs (/Applications, si on peut y écrire) ou pour soi
 * seulement (~/Applications, sans droits d'administrateur). La copie se fait sans l'attribut de
 * quarantaine (l'app a déjà été autorisée à s'ouvrir), puis l'app se relance depuis là et éjecte le
 * disque image.
 *
 * Les entrées-sorties sont injectées : la logique se teste sans Electron.
 */
import { execFile } from 'node:child_process'
import { accessSync, constants, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import {
  INSTALL_SCOPES,
  type InstallChoice,
  type InstallOffer,
  type InstallScope
} from '@shared/install'
import { t } from 'i18next'
import { delay } from './delay'

/** Dossier `.app` de l'exécutable (`…/Bobine.app/Contents/MacOS/Bobine` → `…/Bobine.app`). */
export function bundleOf(execPath: string): string | undefined {
  return /^(.+?\.app)\/Contents\/MacOS\/[^/]+$/.exec(execPath)?.[1]
}

/** Les deux dossiers Applications : celui du Mac et celui du dossier personnel. */
export type InstallDirs = Record<InstallScope, string>

/**
 * `/Applications` et `~/Applications` ; sous une racine imposée pour les essais
 * (`<racine>/Applications` et `<racine>/<dossier personnel>/Applications`).
 */
export function installDirs(home: string, root?: string): InstallDirs {
  return root
    ? { everyone: join(root, 'Applications'), me: join(root, home, 'Applications') }
    : { everyone: '/Applications', me: join(home, 'Applications') }
}

/** Déjà dans un dossier Applications (celui du Mac ou celui du dossier personnel). */
export function isInstalled(bundle: string, dirs: InstallDirs): boolean {
  return INSTALL_SCOPES.some((scope) => bundle.startsWith(`${dirs[scope]}/`))
}

/** Disque image monté qui contient l'app (`/Volumes/Bobine`), s'il y en a un. */
export function diskImageOf(bundle: string): string | undefined {
  return /^(\/Volumes\/[^/]+)\//.exec(bundle)?.[1]
}

/** Lancée depuis un dossier en quarantaine, macOS la fait tourner depuis une copie isolée. */
const translocated = (bundle: string) => bundle.includes('/AppTranslocation/')

export interface InstallerIo {
  canWrite: (dir: string) => boolean
  exists: (path: string) => boolean
  ensureDir: (dir: string) => void
  /** Copie de l'app, sans l'attribut de quarantaine (`ditto --noqtn`). */
  copy: (from: string, to: string) => Promise<void>
  trash: (path: string) => Promise<void>
  /** Relance depuis la copie installée (l'app en cours s'arrête) ; éjecte ensuite ce volume. */
  relaunch: (bundle: string, ejectVolume?: string) => void
}

/**
 * Entrées-sorties de l'installation par Node (fiche 089, sorti de `index.ts`) ; la corbeille et la
 * relance viennent d'Electron.
 */
export function nodeInstallerIo(electron: Pick<InstallerIo, 'trash' | 'relaunch'>): InstallerIo {
  return {
    canWrite: (dir) => {
      try {
        accessSync(dir, constants.W_OK)
        return true
      } catch {
        return false
      }
    },
    exists: existsSync,
    ensureDir: (dir) => mkdirSync(dir, { recursive: true }),
    copy: (from, to) =>
      new Promise((resolve, reject) =>
        execFile('ditto', ['--noqtn', from, to], (error) => (error ? reject(error) : resolve()))
      ),
    ...electron
  }
}

/** « Ne plus proposer », retenu par la présence d'un fichier (sa date dedans). */
export function refusalMarker(file: string): Pick<SelfInstallerOptions, 'dismissed' | 'dismiss'> {
  return {
    dismissed: () => existsSync(file),
    dismiss: () => writeFileSync(file, `${new Date().toISOString()}\n`)
  }
}

export interface SelfInstallerOptions {
  /** App en cours (`undefined` : pas une app macOS, ex. en développement). */
  bundle: string | undefined
  dirs: InstallDirs
  /** App packagée, macOS, pas un dossier de données d'essai. */
  enabled: boolean
  /** « Ne plus proposer » choisi un jour. */
  dismissed: () => boolean
  dismiss: () => void
  io: InstallerIo
}

export class SelfInstaller {
  private readonly options: SelfInstallerOptions

  constructor(options: SelfInstallerOptions) {
    this.options = options
  }

  /** Ce qui serait fait, ou `null` s'il n'y a rien à proposer. */
  offer(): InstallOffer | null {
    const { bundle, dirs, enabled, io } = this.options
    if (!enabled || !bundle || this.options.dismissed() || isInstalled(bundle, dirs)) return null
    const choices = INSTALL_SCOPES.map((scope): InstallChoice => {
      const target = join(dirs[scope], basename(bundle))
      return {
        scope,
        target,
        // ~/Applications est créé au besoin ; /Applications demande d'ordinaire d'être administrateur.
        allowed: io.canWrite(dirs[scope]) || (scope === 'me' && !io.exists(dirs[scope])),
        replacing: io.exists(target)
      }
    })
    const possible = choices.filter((c) => c.allowed)
    return {
      choices,
      suggested: (possible.find((c) => c.replacing) ?? possible[0])?.scope ?? 'me',
      fromDiskImage: diskImageOf(bundle) !== undefined || translocated(bundle)
    }
  }

  /** Installe et relance ; l'app en cours s'arrête si tout s'est bien passé. */
  async install(scope: InstallScope): Promise<void> {
    const { bundle, io } = this.options
    if (!INSTALL_SCOPES.includes(scope)) throw new Error(`Installation inconnue : ${String(scope)}`)
    const choice = this.offer()?.choices.find((c) => c.scope === scope)
    if (!bundle || !choice) throw new Error(t('install.error.alreadyInstalled'))
    if (!choice.allowed) {
      throw new Error(t('install.error.needsAdmin'))
    }
    if (choice.replacing) await io.trash(choice.target)
    io.ensureDir(dirname(choice.target))
    await io.copy(bundle, choice.target)
    io.relaunch(choice.target, diskImageOf(bundle))
  }

  dismiss(): void {
    this.options.dismiss()
  }
}

/**
 * Éjecte le disque image d'où l'app a été installée (lancement suivant). Le volume peut rester
 * occupé un instant après l'arrêt de l'ancienne app : quelques essais, puis on laisse tomber.
 */
export async function ejectDiskImage(
  volume: string,
  detach: (volume: string) => Promise<void>,
  wait: (ms: number) => Promise<void> = delay
): Promise<boolean> {
  if (!/^\/Volumes\/[^/]+$/.test(volume)) return false
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await detach(volume)
      return true
    } catch {
      await wait(1000)
    }
  }
  return false
}
