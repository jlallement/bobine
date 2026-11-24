import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Lpart, MAIN_PORT, check, mainProcess, withApp } from '../lib.mjs'

/**
 * Pannes (fiche 041) : agent qui plante en plein tour puis relancé, agent figé qui ignore Stop,
 * historique abîmé au démarrage, journal de l'app.
 */
export async function failuresSuite(scheme) {
  console.log(`\n— Pannes (${scheme})`)
  const userData = mkdtempSync(join(tmpdir(), 'bob-e2e-pannes-'))
  try {
    await withApp(
      scheme,
      async (ui) => {
        await ui.send('/scenario plantage')
        await ui.waitFor(`!!${ui.$('restart')}`)
        await ui.shot('41-plantage')
        await ui.click(ui.$('restart'))
        await ui.ready()
        await ui.send('/scenario streaming-texte')
        await ui.ready()

        await ui.send('/scenario muet')
        // Le texte fini, l'agent ne répond plus (« Stop » plus tôt interromprait le texte).
        await ui.waitFor(
          `[...document.querySelectorAll('.msg-agent')].at(-1)?.innerText.includes('Je commence')`
        )
        await ui.click(ui.$('stop'))
        await ui.waitFor(`!!${ui.$('restart')}`, 20000)
        await ui.shot('42-agent-fige')
        await ui.send('/scenario streaming-texte')
        await ui.ready()

        const main = await mainProcess()
        try {
        } finally {
          main.close()
        }
      },
      userData,
      'demo',
      {},
      [`--inspect=${MAIN_PORT}`]
    )

    // Historique abîmé : l'app démarre, reprend la dernière bonne copie et le dit.
    const conversations = join(userData, 'conversations')
    writeFileSync(join(conversations, 'index.json'), '[{"id": "tronqu')
    await withApp(
      scheme,
      async (ui) => {
        await ui.waitFor(
          `document.body.innerText.includes(${JSON.stringify(Lpart('profile.notice.historyDamaged', { count: 1 }))})`
        )
        check(true, 'historique abîmé : l’app démarre et prévient')
        await ui.shot('43-historique-abime')
      },
      userData
    )
  } finally {
    rmSync(userData, { recursive: true, force: true })
  }
}
