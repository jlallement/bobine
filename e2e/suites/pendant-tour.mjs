import { L, MAIN_PORT, check, mainProcess, withApp } from '../lib.mjs'
import { rgb, tokensOf } from '../palette.mjs'

const lastTool = `[...document.querySelectorAll('[data-testid=tool]')].at(-1)`

/** Réglages de l'app, changés comme le ferait Réglages › Conversations. */
const setPreferences = (ui, change) =>
  ui.ev(`window.api.settings.setPreferences(${JSON.stringify(change)}).then(() => true)`)

/**
 * Pendant le tour (fiche 157) : commande sans sortie signalée et interrompue, « Compacter » à côté
 * de la puce orange, plafond de coût en dollars (tour interrompu à la fin de l'outil, « Continuer »),
 * puis en jetons pour un agent sans coût. Seuil de commande bloquée raccourci à 2 s
 * (`BOBINE_STALLED_COMMAND_MS`).
 */
export async function turnGuardsSuite(scheme) {
  console.log(`\n— Pendant le tour (${scheme})`)
  const own = tokensOf(scheme)
  await withApp(
    scheme,
    async (ui) => {
      await ui.ready()
      const main = await mainProcess()
      try {
        // 1. Commande sans sortie : l'avis, puis « Interrompre » arrête la réponse (comme ■).
        await ui.send('/scenario commande-silencieuse')
        await ui.waitFor(`!!${ui.$('stalled-notice')}`, 15000)
        await ui.shot('157-commande-sans-sortie')
        await ui.click(ui.$('stalled-interrupt'))
        await ui.ready()
        check(
          (await ui.ev(`${lastTool}.dataset.status`)) === 'cancelled' &&
            !(await ui.ev(`!!${ui.$('stalled-notice')}`)),
          'Interrompre : la commande est interrompue, l’avis disparaît'
        )

        // 2. Contexte presque plein : puce orange, « Compacter » en un clic.
        await ui.send('/scenario contexte-80')
        await ui.ready()
        await ui.waitFor(`!!${ui.$('usage-compact')}`)
        const colors = await ui.ev(
          `[getComputedStyle(${ui.$('usage-meter')}).color, getComputedStyle(${ui.$('usage-compact')}).color]`
        )
        check(
          colors.every((c) => c === rgb(own.warn)),
          `contexte à 85 % : puce et « Compacter » en orange (jeton warn, ${colors.join(', ')})`
        )
        await ui.shot('157-compacter')
        await ui.click(ui.$('usage-compact'))
        await ui.waitFor(`${ui.$('compaction')}?.dataset.status === 'completed'`, 15000)
        await ui.ready()
        check(
          !(await ui.ev(`!!${ui.$('usage-compact')}`)),
          'Compacter : la conversation est résumée, le bouton disparaît'
        )

        // 3. Plafond de 1 $ : franchi pendant la troisième lecture, tour interrompu à sa fin.
        // Le réglage vaut pour les nouvelles conversations : celle-ci le reçoit par « Par défaut ».
        await setPreferences(ui, { costCapEnabled: true, costCapAmount: 1 })
        await ui.click(ui.$('usage-meter'))
        await ui.waitFor(`!!${ui.$('usage-cap-default')}`)
        await ui.click(ui.$('usage-cap-default'))
        await ui.waitFor(`${ui.$('usage-cap-default')}?.getAttribute('aria-pressed') === 'true'`)
        await ui.key('Escape')
        await ui.send('/scenario cout-qui-monte')
        await ui.waitFor(`!!${ui.$('cost-cap-card')}`, 20000)
        await ui.ready()
        await ui.shot('157-plafond-atteint')
        await ui.click(ui.$('cost-cap-continue'))
        await ui.waitFor(`!!${ui.$('cost-cap-answer')}`)
        await ui.ready()
        await ui.click(ui.$('usage-meter'))
        await ui.waitFor(`!!${ui.$('usage-cap-value')}`)
        await ui.shot('157-plafond-detail')
        await ui.click(ui.$('usage-cap-none'))
        await ui.waitFor(
          `${ui.$('usage-cap-value')}?.innerText === ${JSON.stringify(L('turnGuards.cap.none'))}`
        )
        await ui.key('Escape')

        // 4. Réglages › Conversations : seuil et plafond par défaut.
        await main.evaluate(
          `(require('electron').Menu.getApplicationMenu().getMenuItemById('settings').click(), true)`
        )
        await ui.waitFor(`!!${ui.$('settings')}`)
        await ui.click(ui.$('settings-conversation'))
        await ui.waitFor(`!!${ui.$('settings-cost-cap')}`)
        await ui.ev(`${ui.$('settings-cost-cap')}.scrollIntoView({ block: 'center' }), true`)
        await ui.shot('157-reglages')
      } finally {
        main.close()
      }
    },
    undefined,
    'streaming-texte',
    { BOBINE_STALLED_COMMAND_MS: '2000' },
    [`--inspect=${MAIN_PORT}`]
  )
}
