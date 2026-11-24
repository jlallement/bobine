import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, realpathSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { createRequire } from 'node:module'
import { L, check, root, sleep, withApp } from '../lib.mjs'

const electron = createRequire(import.meta.url)('electron')

/**
 * Dossier et lancement (fiche 158) : le menu du dossier sous la zone de saisie (Finder, chemin,
 * terminal de Bobine ; gestionnaire de fichiers sous Linux), `bobine <dossier> "message"` au
 * premier lancement et par une seconde instance (le message est posé dans la saisie, jamais
 * envoyé), et l'installation de la commande dans Réglages › Général (sous une racine d'essai).
 */
export async function commandSuite(scheme) {
  console.log(`\n— Dossier et commande bobine (${scheme})`)
  const base = realpathSync(mkdtempSync(join(tmpdir(), 'bobine-cmd-e2e-')))
  const project = join(base, 'projet-un')
  const other = join(base, 'projet-deux')
  mkdirSync(project)
  mkdirSync(other)
  await launchArguments(scheme, project, other)
  await installCommand(scheme, base)
}

async function launchArguments(scheme, project, other) {
  const userData = mkdtempSync(join(tmpdir(), 'bob-e2e-cmd-'))
  await withApp(
    scheme,
    async (ui) => {
      await ui.ready()
      await ui.waitFor(`${ui.$('composer-input')}.value === 'corrige le bug'`)
      check(
        (await ui.ev(`${ui.$('workspace-menu')}.innerText.trim()`)) === basename(project),
        'premier lancement : nouvelle conversation dans le dossier demandé'
      )
      await ui.shot('158-bobine-premier-lancement')
      // Seconde instance : la relance de `open -n -a Bobine --args …` s'y rattache et s'arrête.
      const second = spawn(
        electron,
        [root, `--user-data-dir=${userData}`, '--use-mock-keychain', other, 'deuxième', 'message'],
        { env: { ...process.env, BOBINE_AGENT_PROFILE: 'mock' }, stdio: 'ignore' }
      )
      const exited = new Promise((resolve) => second.once('exit', resolve))
      await ui.waitFor(`${ui.$('composer-input')}.value === 'deuxième message'`, 30_000)
      check(
        (await ui.ev(`${ui.$('workspace-menu')}.innerText.trim()`)) === basename(other),
        'seconde instance : la conversation s’ouvre dans l’autre dossier'
      )
      await Promise.race([exited, sleep(15_000)])
      second.kill()
    },
    userData,
    'demo',
    {},
    [project, 'corrige le bug']
  )
}

async function installCommand(scheme, base) {
  const installRoot = join(base, 'racine')
  mkdirSync(installRoot)
  await withApp(
    scheme,
    async (ui) => {
      await ui.ready()
      await ui.click(ui.$('open-settings'))
      await ui.waitFor(`!!${ui.$('settings')}`)
      await ui.waitFor(`!!${ui.$('settings-command-install')}`)
      const note = () => ui.ev(`${ui.$('settings-command-note')}.innerText`)
      check(
        (await note()).includes(join(installRoot, homedir(), '.local', 'bin')),
        'avant : le réglage dit où la commande s’installera'
      )
      await ui.ev(`${ui.$('settings-command-install')}.scrollIntoView({ block: 'center' })`)
      await ui.shot('158-commande-installer')
      await ui.click(ui.$('settings-command-install'))
      const script = join(installRoot, homedir(), '.local', 'bin', 'bobine')
      await ui.waitFor(`!!${ui.$('settings-command-uninstall')}`)
      check(
        (await note()).includes(script) &&
          (await note()).includes(
            L('settings.general.command.notInPath', {
              dir: join(installRoot, homedir(), '.local', 'bin')
            })
          ),
        'après : le chemin du script, et l’avertissement PATH'
      )
      await ui.shot('158-commande-installee')
      await ui.click(ui.$('settings-command-uninstall'))
      await ui.waitFor(`!!${ui.$('settings-command-install')}`)
    },
    undefined,
    'demo',
    { BOBINE_INSTALL_ROOT: installRoot }
  )
}
