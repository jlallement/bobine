/**
 * Recommencer à neuf (fiche 148) : les options de lancement et le profil temporaire.
 *
 * - `--profil-temporaire` : dossier de données neuf dans les fichiers temporaires, supprimé à la
 *   fermeture ; Bobine s'y comporte comme une vraie première installation (pas comme un essai).
 * - `--agents-neufs` (avec le précédent) : les agents reçoivent un dossier personnel vide (`HOME`,
 *   `XDG_*`), posé après la lecture du shell, pour que le `PATH` reste celui de l'utilisateur.
 * - `--reinitialiser` : l'interface ouvre Réglages › Données sur la confirmation.
 *
 * Sans Electron ici (testé) : `fresh-start-app.ts` le branche.
 */
import { spawn as nodeSpawn, type SpawnOptions } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { helperEnv } from './reset'

export const TEMPORARY_SWITCH = 'profil-temporaire'
export const FRESH_AGENTS_SWITCH = 'agents-neufs'
export const RESET_SWITCH = 'reinitialiser'
/** Préfixe des dossiers des profils temporaires, dans les fichiers temporaires. */
export const TEMPORARY_PREFIX = 'bobine-profil-'

/** Dossiers des agents sous un dossier personnel vide (spécification XDG). */
const XDG_DIRS = {
  XDG_CONFIG_HOME: '.config',
  XDG_DATA_HOME: '.local/share',
  XDG_STATE_HOME: '.local/state',
  XDG_CACHE_HOME: '.cache'
} as const

export interface FreshStartApp {
  hasSwitch: (name: string) => boolean
  onWillQuit: (listener: () => void) => void
  isPackaged: boolean
  execPath: string
  /** Dossier de l'app (développement : celui du `package.json`). */
  appPath: () => string
}

export interface FreshStartIo {
  spawn: (command: string, args: string[], options: SpawnOptions) => { unref: () => void }
  tmp: string
  env: NodeJS.ProcessEnv
  pid: number
}

/**
 * Ménage d'un profil temporaire, en `sh` : `/bin/sh -c TEMPORARY_CLEANUP bobine-cleanup <dossier>
 * <pid> <dixièmes>`. Pas de mode Node : le fusible RunAsNode de l'app packagée est coupé (fiche
 * 187, R2). Chromium et le registre des processus écrivent encore après `will-quit` : le dossier
 * n'est supprimé pour de bon qu'une fois l'app finie ; jamais un dossier qui n'est pas un profil
 * temporaire, ni tant que l'app tourne.
 */
export const TEMPORARY_CLEANUP = String.raw`
dir=$1 pid=$2 tenths=$3
case "$(basename "$dir")" in ${TEMPORARY_PREFIX}*) ;; *) exit 2 ;; esac
waited=0
while kill -0 "$pid" 2>/dev/null; do
  [ "$waited" -ge "$tenths" ] && exit 1
  sleep 0.1
  waited=$((waited + 1))
done
sleep 0.5
rm -rf -- "$dir"
`

/**
 * Commande qui rouvre Bobine après une réinitialisation (fiche 187, D24) : `open -n <app>`, avec
 * le dossier de données imposé de ce lancement s'il y en a un — sinon la relance ouvrirait le vrai
 * profil de l'utilisateur. Un profil temporaire ne se réinitialise pas (il part à la fermeture) :
 * rien à rouvrir. `--agents-neufs` ne vaut qu'avec lui, il n'a donc rien à suivre ici.
 */
export function resetRelaunch(launch: {
  /** `/usr/bin/open`, ou l'enregistreur d'un essai (`BOBINE_RESET_RELAUNCH`). */
  opener: string
  bundle: string
  temporary: boolean
  /** Dossier de données imposé (`--user-data-dir`), en chemin absolu. */
  userDataDir?: string
}): string[] | undefined {
  if (launch.temporary) return undefined
  const isolation = launch.userDataDir ? ['--args', `--user-data-dir=${launch.userDataDir}`] : []
  return [launch.opener, '-n', launch.bundle, ...isolation]
}

export interface FreshStart {
  /** Profil temporaire : dossier de données neuf, supprimé à la fermeture. */
  readonly temporary: boolean
  /** Agents avec un dossier personnel vide (profil temporaire seulement). */
  readonly freshAgents: boolean
  /** `--reinitialiser` : l'interface ouvre la confirmation. */
  readonly askReset: boolean
  /** Dossier de données imposé : essais (`--user-data-dir`) ou profil temporaire. */
  readonly isolated: boolean
  /** Dossier de données de ce lancement (le temporaire, créé au premier appel). */
  userData: (defaultPath: string) => string
  /** Dossier personnel vide pour les agents, s'il est demandé ; sinon rien. */
  isolateAgents: (env: NodeJS.ProcessEnv) => string | undefined
  /** Lance une seconde Bobine sur un profil temporaire, détachée de celle-ci. */
  openTemporary: (freshAgents: boolean) => void
}

const defaultIo = (): FreshStartIo => ({
  spawn: (command, args, options) => nodeSpawn(command, args, options),
  tmp: tmpdir(),
  env: process.env,
  pid: process.pid
})

export function createFreshStart(app: FreshStartApp, io: FreshStartIo = defaultIo()): FreshStart {
  const temporary = app.hasSwitch(TEMPORARY_SWITCH)
  let folder: string | undefined
  return {
    temporary,
    freshAgents: temporary && app.hasSwitch(FRESH_AGENTS_SWITCH),
    askReset: app.hasSwitch(RESET_SWITCH),
    isolated: temporary || app.hasSwitch('user-data-dir'),
    userData(defaultPath) {
      if (!temporary) return defaultPath
      if (!folder) {
        const created = mkdtempSync(join(io.tmp, TEMPORARY_PREFIX))
        folder = created
        // Rien n'en est gardé : le dossier part avec la fermeture, et ce qui s'y écrit encore
        // ensuite, avec l'assistant qui attend la fin de l'app.
        // Une fois : `will-quit` revient quand l'app attend la fin de ses processus (fiche 195).
        let cleaned = false
        app.onWillQuit(() => {
          if (cleaned) return
          cleaned = true
          rmSync(created, { recursive: true, force: true })
          io.spawn(
            '/bin/sh',
            ['-c', TEMPORARY_CLEANUP, 'bobine-cleanup', created, String(io.pid), '600'],
            { detached: true, stdio: 'ignore', env: helperEnv(io.env) }
          ).unref()
        })
      }
      return folder
    },
    isolateAgents(env) {
      if (!this.freshAgents || !folder) return undefined
      const home = join(folder, 'maison')
      env['HOME'] = home
      for (const [name, dir] of Object.entries(XDG_DIRS)) {
        env[name] = join(home, dir)
        mkdirSync(env[name] as string, { recursive: true })
      }
      return home
    },
    openTemporary(freshAgents) {
      // Jamais en mode Node, même si l'environnement de cette Bobine le demandait.
      const env = helperEnv(io.env)
      const args = [
        ...(app.isPackaged ? [] : [app.appPath()]),
        `--${TEMPORARY_SWITCH}`,
        ...(freshAgents ? [`--${FRESH_AGENTS_SWITCH}`] : [])
      ]
      io.spawn(app.execPath, args, { detached: true, stdio: 'ignore', env }).unref()
    }
  }
}
