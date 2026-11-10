/**
 * `bobine <dossier> ["message"]` branché sur Electron (fiche 158) : les arguments du premier
 * lancement et ceux d'une seconde instance (`open -n -a Bobine --args …`) arrivent au même
 * contrôleur (sorti d'`index.ts`, au plafond de taille).
 */
import { homedir } from 'node:os'
import { join } from 'node:path'
import { app, dialog } from 'electron'
import { t } from 'i18next'
import { messageOf } from '@shared/errors'
import type { ConversationView } from '@shared/agent'
import { CommandLine } from './command-line'
import { isDirectory } from './is-directory'
import { LaunchController, parseLaunchArgs, userArguments, type LaunchDeps } from './launch-request'
import { log } from './log'
import { bundleOf } from './self-install'

export const launch = new LaunchController()

/** Arguments propres à ce processus (lancé depuis les sources, `argv` commence par le chemin de l'app). */
const argumentsOf = (argv: readonly string[]) => userArguments(argv, process.defaultApp === true)

/** Premier lancement : les arguments du processus. Seconde instance : ceux de la relance. */
export function readLaunchArguments(argv: readonly string[], cwd: string): void {
  const request = parseLaunchArgs(argumentsOf(argv), cwd)
  if (request) launch.request(request)
}

/** L'app est montée : les demandes en attente (et les suivantes) ouvrent leur conversation. */
export function attachLaunch(
  conversations: { create: (request: { workspace: string }) => Promise<ConversationView> },
  deps: Pick<LaunchDeps, 'focus' | 'show'>
): void {
  launch.attach({
    ...deps,
    isFolder: isDirectory,
    openConversation: async (workspace) => (await conversations.create({ workspace })).summary.id,
    fail: (folder, error) => {
      log.warn(`bobine : ${folder} — ${error === undefined ? 'dossier absent' : messageOf(error)}`)
      dialog.showErrorBox('Bobine', t('launch.folderMissing', { folder }))
    }
  })
}

/**
 * La commande `bobine` du terminal. Seulement dans l'app installable (le script rouvre ce binaire),
 * ou sous une racine imposée pour les essais (`BOBINE_INSTALL_ROOT`, comme l'auto-installation).
 */
export function commandLineDeps(): { commandLine?: CommandLine } {
  const root = process.env['BOBINE_INSTALL_ROOT']
  if (!app.isPackaged && !root) return {}
  const bundle = bundleOf(process.execPath)
  const commandLine = new CommandLine({
    launcher: () => (bundle ? { bundle } : { binary: process.env['APPIMAGE'] ?? process.execPath }),
    ...(root ? { home: join(root, homedir()), systemBin: join(root, 'usr', 'local', 'bin') } : {})
  })
  return { commandLine }
}
