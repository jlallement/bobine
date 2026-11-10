import { L, MAIN_PORT, check, mainProcess, withApp } from '../lib.mjs'
import { rgb, tokensOf } from '../palette.mjs'

/** Texte sans espaces insécables (Intl en français). */
const plain = (text) => (text ?? '').replace(/[  ]/g, ' ')

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
        check(
          plain(await ui.ev(`${ui.$('stalled-notice')}.innerText`)).includes(
            plain(L('turnGuards.stalled.notice', { count: 1 }))
          ),
          'commande sans sortie : « Aucune sortie depuis 1 min » sur sa carte'
        )
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
        const statuses = await ui.ev(
          `[...document.querySelectorAll('[data-testid=tool]')].slice(-3).map((t) => t.dataset.status)`
        )
        const card = plain(await ui.ev(`${ui.$('cost-cap-card')}.innerText`))
        check(
          card.includes(plain(L('turnGuards.cap.title'))) &&
            statuses.every((s) => s === 'completed') &&
            !(await ui.ev(`document.body.innerText.includes('src/module-4.ts')`)),
          'plafond franchi en plein outil : il finit, le suivant ne part pas, carte « Plafond atteint »'
        )
        await ui.shot('157-plafond-atteint')
        await ui.click(ui.$('cost-cap-continue'))
        await ui.waitFor(`!!${ui.$('cost-cap-answer')}`)
        await ui.ready()
        await ui.click(ui.$('usage-meter'))
        await ui.waitFor(`!!${ui.$('usage-cap-value')}`)
        check(
          plain(await ui.ev(`${ui.$('usage-cap-value')}.innerText`)).includes('2'),
          'Continuer : plafond de la conversation relevé à 2 $, agent relancé'
        )
        await ui.shot('157-plafond-detail')
        await ui.click(ui.$('usage-cap-none'))
        await ui.waitFor(
          `${ui.$('usage-cap-value')}?.innerText === ${JSON.stringify(L('turnGuards.cap.none'))}`
        )
        check(true, 'détail de la consommation : « Aucun » plafond pour cette conversation')
        await ui.key('Escape')

        // 4. Réglages › Conversations : seuil et plafond par défaut.
        await main.evaluate(
          `(require('electron').Menu.getApplicationMenu().getMenuItemById('settings').click(), true)`
        )
        await ui.waitFor(`!!${ui.$('settings')}`)
        await ui.click(ui.$('settings-conversation'))
        await ui.waitFor(`!!${ui.$('settings-cost-cap')}`)
        await ui.ev(`${ui.$('settings-cost-cap')}.scrollIntoView({ block: 'center' }), true`)
        check(
          (await ui.ev(`${ui.$('settings-cost-cap')}.checked`)) &&
            (await ui.ev(`${ui.$('settings-cost-cap-amount')}.value`)) === '1',
          'réglages : plafond par conversation activé, 1 dans l’unité de l’agent'
        )
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

  // 5. Agent sans coût : plafond en jetons, carte à la fin du tour, sans interruption.
  await withApp(
    scheme,
    async (ui) => {
      await ui.ready()
      await setPreferences(ui, { costCapEnabled: true, costCapTokens: 1000 })
      await ui.send('/scenario jetons-sans-cout')
      await ui.waitFor(`!!${ui.$('cost-cap-card')}`, 15000)
      const card = plain(await ui.ev(`${ui.$('cost-cap-card')}.innerText`))
      // Dépense et plafond en jetons (« 1 000 jetons ») ; le tour n'a pas été interrompu.
      const unit = plain(L('usage.tokensValue', { tokens: '' })).trim()
      const cancelled = JSON.stringify(L('transcript.notice.cancelled'))
      check(
        card.includes(unit) &&
          /1[ ,]?000/.test(card) &&
          !(await ui.ev(`document.body.innerText.includes(${cancelled})`)),
        'sans coût connu : plafond de 1 000 jetons, carte à la fin du tour, sans interruption'
      )
      await ui.shot('157-plafond-jetons')
    },
    undefined,
    'streaming-texte',
    { MOCK_AGENT_USAGE: 'tokens' }
  )
}
