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
        await ui.click(item)
        await ui.waitFor(`document.querySelectorAll('.msg-agent').length === 1`)
        await ui.ready()
        check(
          await ui.ev(`!!${ui.$('usage-meter')}`),
          'après redémarrage : la consommation de la conversation est conservée'
        )
        await ui.send('/scenario refus')
        await ui.ready()
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
  } finally {
    rmSync(userData, { recursive: true, force: true })
  }
}
