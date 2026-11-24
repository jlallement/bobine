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
      },
      userData
    )
  } finally {
    rmSync(userData, { recursive: true, force: true })
  }
}
