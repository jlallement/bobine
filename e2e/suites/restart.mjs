import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { check, withApp } from '../lib.mjs'

/** Redémarrage de l'app sur les mêmes données : la conversation est rechargée puis continuée. */
export async function restartSuite() {
  console.log('\n— Redémarrage de l’app')
  const userData = mkdtempSync(join(tmpdir(), 'bob-e2e-restart-'))
  try {
    await withApp(
      'light',
      async (ui) => {
        await ui.send('/scenario streaming-texte')
        await ui.ready()
      },
      userData
    )
    await withApp(
      'light',
      async (ui) => {
        const item = `document.querySelector('[data-testid=history-item] .history-open')`
        await ui.waitFor(`!!${item}`)
        check(
          (await ui.ev(`${item}.innerText`)).includes('/scenario streaming-texte'),
          'après redémarrage : la conversation est dans « Récents »'
        )
        await ui.click(item)
        await ui.waitFor(`document.querySelectorAll('.msg-agent').length === 1`)
        await ui.ready()
        check(
          await ui.ev(`!!${ui.$('usage-meter')}`),
          'après redémarrage : la consommation de la conversation est conservée'
        )
        await ui.send('/scenario refus')
        await ui.ready()
        check(
          (await ui.ev(`document.querySelectorAll('.msg-user').length`)) === 2,
          'conversation rechargée (session/load) puis continuée'
        )
        await ui.shot('6-reprise')
        await ui.click(`document.querySelector('[data-testid=history-more]')`)
        await ui.waitFor(`!!${ui.$('history-delete')}`)
        await ui.click(ui.$('history-delete'))
        // Confirmation intégrée (fiche 026), plus de boîte du navigateur.
        await ui.waitFor(`!!${ui.$('delete-dialog')}`)
        await ui.shot('7-suppression')
        await ui.click(ui.$('delete-confirm'))
        await ui.waitFor(`document.querySelectorAll('[data-testid=history-item]').length === 0`)
        await ui.waitFor(`!!${ui.$('welcome')}`)
        check(
          ui.dialogs.length === 0,
          'suppression confirmée dans l’app : historique vide, nouvelle conversation'
        )
      },
      userData
    )
    await foldsSurviveRestart()
  } finally {
    rmSync(userData, { recursive: true, force: true })
  }
}

/**
 * Repli de la barre latérale gardé au redémarrage (fiche 131) : une section (Épinglées) et un
 * dossier du mode « Dossiers », repliés avant ⌘Q, le sont encore après.
 */
async function foldsSurviveRestart() {
  const userData = mkdtempSync(join(tmpdir(), 'bob-e2e-replis-'))
  const items = `document.querySelectorAll('[data-testid=history-item]')`
  try {
    await withApp(
      'light',
      async (ui) => {
        await ui.send('/scenario streaming-texte')
        await ui.ready()
        await ui.click(ui.$('new-conversation'))
        await ui.waitFor(`!document.querySelector('.history-item.active')`)
        await ui.send('/scenario echo')
        await ui.ready()
        await ui.waitFor(`${items}.length === 2`)
        await ui.click(`document.querySelector('[data-testid=history-more]')`)
        await ui.waitFor(`!!${ui.$('history-pin')}`)
        await ui.click(ui.$('history-pin'))
        await ui.waitFor(`!!${ui.$('section-toggle-pinned')}`)
        await ui.click(ui.$('section-toggle-pinned'))
        await ui.click(ui.$('history-grouping'))
        await ui.waitFor(`!!${ui.$('grouping-folder')}`)
        await ui.click(ui.$('grouping-folder'))
        await ui.waitFor(`!!${ui.$('folder-head')}`)
        await ui.click(ui.$('folder-head'))
        await ui.waitFor(`${items}.length === 0`)
      },
      userData
    )
    await withApp(
      'light',
      async (ui) => {
        await ui.waitFor(`!!${ui.$('folder-head')}`)
        check(
          (await ui.ev(`${ui.$('section-toggle-pinned')}.getAttribute('aria-expanded')`)) ===
            'false' &&
            (await ui.ev(`${ui.$('folder-head')}.getAttribute('aria-expanded')`)) === 'false' &&
            (await ui.ev(`${items}.length`)) === 0,
          'après redémarrage : section « Épinglées » et dossier toujours repliés, mode Dossiers gardé'
        )
      },
      userData
    )
  } finally {
    rmSync(userData, { recursive: true, force: true })
  }
}
