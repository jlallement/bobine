import { L, check, withApp } from '../lib.mjs'

/** Commandes « / » annoncées par l'agent (fiche 017). */
export async function commandsSuite(scheme) {
  console.log(`\n— Commandes « / » (${scheme})`)
  await withApp(scheme, async (ui) => {
    await ui.ready()
    await ui.ev(`${ui.$('composer-input')}.focus()`)
    await ui.type('/')
    await ui.waitFor(`!!${ui.$('command-menu')}`)
    const badge = await ui.ev(
      `(() => { const b = document.querySelector('.command-source.from-app').getBoundingClientRect(); const row = b && document.querySelector('.command-source.from-app').closest('.command-item').getBoundingClientRect(); return { width: b.width, row: row.width } })()`
    )
    check(
      badge.width < badge.row / 3,
      'pastilles des commandes de l’app compactes, pas une barre sur toute la ligne'
    )
    // Écran d'accueil : zone de saisie centrée, le menu s'ouvre du côté où il a la place, sans sortir
    // de la fenêtre ni recouvrir l'en-tête.
    const box = await ui.ev(
      `(() => { const m = ${ui.$('command-menu')}.getBoundingClientRect(); const h = document.querySelector('.main-header').getBoundingClientRect(); return { top: m.top, bottom: m.bottom, header: h.bottom, inner: innerHeight, side: ${ui.$('command-menu')}.dataset.placement } })()`
    )
    check(
      box.top >= box.header && box.bottom <= box.inner && box.side === 'below',
      `menu entier dans la fenêtre, sous la zone de saisie sur l’accueil (${Math.round(box.top)}–${Math.round(box.bottom)} px sur ${box.inner})`
    )
    await ui.shot('16-commandes')
    await ui.type('sce')
    // En anglais, « sce » trouve aussi /aide par sa description (« Lists the available scenarios ») :
    // /scenario, trouvé par son nom, vient en premier et Tab le complète.
    await ui.waitFor(
      `document.querySelector('[data-testid=command-item]')?.innerText.startsWith('/scenario')`
    )
    await ui.press('Tab')
    await ui.waitFor(`${ui.$('composer-input')}.value === '/scenario '`)
    await ui.type('refus')
    await ui.press('Enter')
    await ui.waitFor(
      `[...document.querySelectorAll('.msg-user')].at(-1)?.innerText === '/scenario refus'`
    )
    await ui.ready()
    await ui.ev(`${ui.$('composer-input')}.focus()`)
    await ui.type('/de')
    await ui.waitFor(`!!${ui.$('command-menu')}`)
    await ui.press('Enter')
    await ui.waitFor(`!!${ui.$('permission')}`)
    await ui.ev(`${ui.$('permission')}.querySelector('[data-kind=allow_once]').click()`)
    await ui.ready()
    await ui.ev(`${ui.$('composer-input')}.focus()`)
    await ui.type('/zz')
    await ui.waitFor(`!!${ui.$('command-menu')}`)
    await ui.press('Escape')
    await ui.waitFor(`!${ui.$('command-menu')}`)

    // Commandes de l'app (fiche 039) : traitées par l'app, rien d'envoyé à l'agent.
    const users = () => ui.ev(`document.querySelectorAll('.msg-user').length`)
    const run = async (command) => {
      await ui.ev(
        `(() => { const t = ${ui.$('composer-input')}; t.focus(); t.select(); return true })()`
      )
      await ui.type(command)
      await ui.press('Escape')
      await ui.press('Enter')
    }
    const before = await users()
    await run('/context')
    await ui.waitFor(
      `[...document.querySelectorAll('.notice')].at(-1)?.innerText.includes(${JSON.stringify(L('appCommands.report.context'))})`
    )
    await run('/cost')
    await ui.waitFor(`document.querySelectorAll('[data-testid=notice-report]').length === 2`)
    await ui.shot('30-context-cost')
    await run('/mode')
    await ui.waitFor(`[...document.querySelectorAll('.notice')].at(-1)?.innerText.includes('Plan')`)
    await run('/mode plan')
    await ui.waitFor(
      `/\\s?: Plan$/.test([...document.querySelectorAll('.notice')].at(-1)?.innerText ?? '')`
    )
    // Le réglage est appliqué par l'agent : la puce suit un peu après la notice.
    await ui.waitFor(`${ui.$('mode-chip')}?.innerText.includes('Plan')`)
    await run('/help')
    await ui.waitFor(
      `[...document.querySelectorAll('.notice')].at(-1)?.innerText.includes('/compact')`
    )
    await run('/compact')
    await ui.waitFor(`document.querySelectorAll('.msg-user').length > ${before}`)
    await ui.ready()
    await ui.shot('30-commandes-app')
    // Commande de compaction à réponse texte (Bob) : carte « Conversation résumée » (fiche 126).
    await run('/compress')
    await ui.waitFor(`document.querySelectorAll('[data-testid=compaction]').length === 2`)
    await ui.ready()
    await run('/clear')
    await ui.waitFor(`!!${ui.$('welcome')}`)
  })
}
