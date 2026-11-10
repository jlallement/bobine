import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { createRequire } from 'node:module'
import { L, MAIN_PORT, check, mainProcess, root, sleep, withApp } from '../lib.mjs'

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
  await folderMenu(scheme, project, base)
  await launchArguments(scheme, project, other)
  await installCommand(scheme, base)
}

async function folderMenu(scheme, project, base) {
  const log = join(base, 'open.log')
  for (const platform of ['darwin', 'linux']) {
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        await ui.click(ui.$('workspace-menu'))
        await ui.waitFor(`!!${ui.$('workspace-menu-content')}`)
        const mac = platform === 'darwin'
        const reveal = L(mac ? 'workspaceMenu.revealFinder' : 'workspaceMenu.revealFiles')
        check(
          (await ui.ev(`${ui.$('workspace-reveal')}.innerText.trim()`)) === reveal,
          `${platform} : « ${reveal} » dans le menu du dossier`
        )
        check(
          (await ui.ev(`${ui.$('workspace-copy-path')}.innerText.trim()`)) ===
            L('workspaceMenu.copyPath') &&
            (await ui.ev(`${ui.$('workspace-terminal')}.innerText.trim()`)) ===
              L('workspaceMenu.openTerminal'),
          `${platform} : « Copier le chemin » et « Ouvrir un terminal ici »`
        )
        if (!mac) return
        await ui.shot('158-menu-dossier')
        await ui.click(ui.$('workspace-reveal'))
        await sleep(500)
        const revealed = existsSync(log) ? readFileSync(log, 'utf8') : ''
        check(
          revealed.includes(`reveal ${project}`),
          `« Afficher dans le Finder » montre le dossier lui-même (${revealed.trim()})`
        )
        await ui.click(ui.$('workspace-menu'))
        await ui.waitFor(`!!${ui.$('workspace-menu-content')}`)
        await ui.click(ui.$('workspace-copy-path'))
        const main = await mainProcess()
        try {
          // La copie passe par l'IPC : le presse-papiers est relu jusqu'à ce qu'elle arrive.
          let copied = ''
          for (let i = 0; i < 30 && copied !== project; i++) {
            copied = await main.evaluate(`require('electron').clipboard.readText()`)
            if (copied !== project) await sleep(100)
          }
          check(copied === project, `« Copier le chemin » copie le chemin du dossier (${copied})`)
        } finally {
          main.close()
        }
        await ui.click(ui.$('workspace-menu'))
        await ui.waitFor(`!!${ui.$('workspace-menu-content')}`)
        await ui.click(ui.$('workspace-terminal'))
        await ui.waitFor(`!!${ui.$('terminal-tab')}`)
        check(true, '« Ouvrir un terminal ici » ouvre le terminal de Bobine')
        await ui.shot('158-terminal-ici')
      },
      undefined,
      'demo',
      { BOBINE_WORKSPACE: project, BOBINE_OPEN_LOG: log, BOBINE_PLATFORM: platform },
      [`--inspect=${MAIN_PORT}`]
    )
  }
}

async function launchArguments(scheme, project, other) {
  const userData = mkdtempSync(join(tmpdir(), 'bob-e2e-cmd-'))
  const userMessages = `document.querySelectorAll('.msg-user').length`
  await withApp(
    scheme,
    async (ui) => {
      await ui.ready()
      await ui.waitFor(`${ui.$('composer-input')}.value === 'corrige le bug'`)
      check(
        (await ui.ev(`${ui.$('workspace-menu')}.innerText.trim()`)) === basename(project),
        'premier lancement : nouvelle conversation dans le dossier demandé'
      )
      check(
        (await ui.ev(userMessages)) === 0,
        'le premier message est posé dans la saisie, pas envoyé'
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
      check((await ui.ev(userMessages)) === 0, 'toujours rien d’envoyé')
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
        existsSync(script) && (statSync(script).mode & 0o111) !== 0,
        'installer : le script bobine est écrit et exécutable'
      )
      check(
        readFileSync(script, 'utf8').includes('# bobine-command'),
        'script reconnu à son marqueur'
      )
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
      check(!existsSync(script), 'désinstaller : le script est retiré')
    },
    undefined,
    'demo',
    { BOBINE_INSTALL_ROOT: installRoot }
  )
}
