/**
 * Installation par l'app elle-même (fiche 073), sortie d'`index.ts` (fiche 145) : l'installateur
 * branché sur Electron, et l'éjection du disque image quand l'app relancée vient de s'y copier.
 * Seulement là où la plateforme la permet (capacité `selfInstall`, macOS).
 */
import { realpathSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { app, shell } from 'electron'
import { log } from './log'
import { endRunMark } from './crash-marker'
import {
  bundleOf,
  ejectDiskImage,
  installDirs,
  nodeInstallerIo,
  refusalMarker,
  SelfInstaller
} from './self-install'
import { runCommand } from './simulator/run'

/** Chemin réel d'un dossier (`/var` → `/private/var`), comparable à `process.execPath`. */
function realDir(path: string | undefined): string | undefined {
  if (!path) return undefined
  try {
    return realpathSync(path)
  } catch {
    return path
  }
}

export function setupSelfInstall(options: {
  /** La plateforme permet l'installation par l'app (fiche 145). */
  enabled: boolean
  /** Profil isolé (dossier de données d'essai ou profil temporaire, fiche 148). */
  isolated: boolean
  userData: string
}): SelfInstaller {
  // BOBINE_INSTALL_ROOT : racine imposée aux deux dossiers Applications, pour les essais (même
  // avec un dossier de données d'essai).
  const installRoot = realDir(process.env['BOBINE_INSTALL_ROOT'])
  const installer = new SelfInstaller({
    bundle: bundleOf(process.execPath),
    dirs: installDirs(homedir(), installRoot),
    enabled: app.isPackaged && options.enabled && (!options.isolated || installRoot !== undefined),
    ...refusalMarker(join(options.userData, 'installation-refusee')),
    io: nodeInstallerIo({
      trash: (path) => shell.trashItem(path),
      relaunch: (bundle, ejectVolume) => {
        log.info(`Installée dans ${bundle} : relance depuis là`)
        app.relaunch({
          execPath: join(bundle, 'Contents', 'MacOS', 'Bobine'),
          args: [
            ...process.argv.slice(1).filter((a) => !a.startsWith('--ejecter-volume=')),
            ...(ejectVolume ? [`--ejecter-volume=${ejectVolume}`] : [])
          ]
        })
        // Sortie sans `quit` : la marque « en cours » part d'abord (pas un plantage, fiche 194).
        endRunMark(options.userData)
        app.exit(0)
      }
    })
  })
  // Lancée depuis la copie installée : le disque image d'où elle vient est éjecté.
  const ejectVolume = app.commandLine.getSwitchValue('ejecter-volume')
  if (ejectVolume) {
    void ejectDiskImage(ejectVolume, (volume) =>
      runCommand('hdiutil', ['detach', volume]).then(() => undefined)
    ).then((ejected) =>
      log.info(`Disque image ${ejectVolume} ${ejected ? 'éjecté' : 'non éjecté (occupé)'}`)
    )
  }
  return installer
}
