import { L, check, withApp, M } from '../lib.mjs'

/** Commandes « / » annoncées par l'agent (fiche 017). */
export async function commandsSuite(scheme) {
  console.log(`\n— Commandes « / » (${scheme})`)
  await withApp(scheme, async (ui) => {
    await ui.ready()
    const items = () =>
      ui.ev(
        `[...document.querySelectorAll('[data-testid=command-item]')].map((i) => i.innerText.split('\\n')[0])`
      )
    const input = () => ui.ev(`${ui.$('composer-input')}.value`)
    await ui.ev(`${ui.$('composer-input')}.focus()`)
    await ui.type('/')
    await ui.waitFor(`!!${ui.$('command-menu')}`)
    check(
      (await items()).length === 14 &&
        (await ui.ev(
          `[...document.querySelectorAll('[data-testid=command-item]')].filter((i) => i.querySelector('.from-app')).length`
        )) === 11,
      '« / » : commandes de l’agent (3) et de l’app (11, avec /btw), origine affichée'
    )
    // Commande de l'app : un badge par agent installé (valable avec chacun), pas « Bobine ».
    const appBadges = await ui.ev(
      `[...document.querySelector('.command-sources').querySelectorAll('.command-source')].map((b) => b.innerText)`
    )
    check(
      appBadges.includes(M('Agent factice')) && !appBadges.includes('Bobine'),
      `commande de l’app : badges des agents installés (${appBadges.join(', ')})`
    )
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
    check(
      !(await ui.ev(`!!${ui.$('command-menu')}`)) &&
        (await ui.ev(`${ui.$('command-hint')}?.innerText`))?.includes(
          M('nom du scénario (vide = liste)')
        ),
      'Tab complète « /scenario » et rappelle l’argument attendu'
    )
    await ui.type('refus')
    await ui.press('Enter')
    await ui.waitFor(
      `[...document.querySelectorAll('.msg-user')].at(-1)?.innerText === '/scenario refus'`
    )
    await ui.ready()
    await ui.ev(`${ui.$('composer-input')}.focus()`)
    check(
      (await ui.ev(`[...document.querySelectorAll('.msg-user')].at(-1).innerText`)) ===
        '/scenario refus' && (await input()) === '',
      'commande envoyée avec son argument'
    )
    await ui.type('/de')
    await ui.waitFor(`!!${ui.$('command-menu')}`)
    await ui.press('Enter')
    await ui.waitFor(`!!${ui.$('permission')}`)
    check(
      (await ui.ev(`[...document.querySelectorAll('.msg-user')].at(-1).innerText`)) === '/demo',
      'Entrée sur une commande sans argument : envoyée directement'
    )
    await ui.ev(`${ui.$('permission')}.querySelector('[data-kind=allow_once]').click()`)
    await ui.ready()
    await ui.ev(`${ui.$('composer-input')}.focus()`)
    await ui.type('/zz')
    await ui.waitFor(`!!${ui.$('command-menu')}`)
    check(
      (await ui.ev(`${ui.$('command-menu')}.innerText`)).includes(L('commandMenu.empty')),
      'aucune correspondance : message dans le menu'
    )
    await ui.press('Escape')
    await ui.waitFor(`!${ui.$('command-menu')}`)
    check((await input()) === '/zz', 'Échap ferme le menu sans effacer la saisie')

    // Commandes de l'app (fiche 039) : traitées par l'app, rien d'envoyé à l'agent.
    const users = () => ui.ev(`document.querySelectorAll('.msg-user').length`)
    const notices = () => ui.ev(`[...document.querySelectorAll('.notice')].at(-1)?.innerText ?? ''`)
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
    check((await users()) === before, '/context : bilan dans le fil, rien envoyé à l’agent')
    await run('/cost')
    await ui.waitFor(`document.querySelectorAll('[data-testid=notice-report]').length === 2`)
    const reports = await ui.ev(
      `[...document.querySelectorAll('[data-testid=notice-report] .notice-title')].map((t) => t.innerText)`
    )
    check(
      reports[0] === L('appCommands.report.context') && reports[1] === L('appCommands.report.cost'),
      `/context et /cost : deux encadrés, chacun son titre (${reports.join(' · ')})`
    )
    await ui.shot('30-context-cost')
    await run('/mode')
    await ui.waitFor(`[...document.querySelectorAll('.notice')].at(-1)?.innerText.includes('Plan')`)
    check((await notices()).includes('•'), '/mode : liste des modes, l’actuel marqué')
    await run('/mode plan')
    await ui.waitFor(
      `/\\s?: Plan$/.test([...document.querySelectorAll('.notice')].at(-1)?.innerText ?? '')`
    )
    // Le réglage est appliqué par l'agent : la puce suit un peu après la notice.
    await ui.waitFor(`${ui.$('mode-chip')}?.innerText.includes('Plan')`)
    check(true, '/mode plan : mode changé par son nom')
    await run('/help')
    await ui.waitFor(
      `[...document.querySelectorAll('.notice')].at(-1)?.innerText.includes('/compact')`
    )
    check((await notices()).includes('/scenario'), '/help : commandes de l’agent et de l’app')
    await run('/compact')
    await ui.waitFor(`document.querySelectorAll('.msg-user').length > ${before}`)
    await ui.ready()
    check(
      (await ui.ev(`[...document.querySelectorAll('.msg-user')].at(-1).innerText`)) ===
        '/compact' && (await ui.ev(`!!document.querySelector('[data-testid=compaction]')`)),
      '/compact : commande de compaction de l’agent, compaction affichée'
    )
    await ui.shot('30-commandes-app')
    // Commande de compaction à réponse texte (Bob) : carte « Conversation résumée » (fiche 126).
    await run('/compress')
    await ui.waitFor(`document.querySelectorAll('[data-testid=compaction]').length === 2`)
    await ui.ready()
    check(
      (
        await ui.ev(`[...document.querySelectorAll('[data-testid=compaction]')].at(-1).innerText`)
      ).includes(L('transcript.compaction.done')),
      '/compress répondu en texte : carte « Conversation résumée », pas un message'
    )
    await run('/clear')
    await ui.waitFor(`!!${ui.$('welcome')}`)
    check(true, '/clear : nouvelle conversation vide, même agent et même dossier')
  })
}
