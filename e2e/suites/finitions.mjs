import { L, check, withApp } from '../lib.mjs'

/**
 * Finitions de la 0.9.1 (fiche 185) : la ligne de bilan sous la dernière réponse (P4), jamais sous
 * un tour arrêté, jamais sous la rangée d'actions du survol ; « ↓ N nouveaux » quand on relit plus
 * haut pendant que l'agent écrit (P8) ; à 900 px, onglets et puce de l'agent jamais coupés (D25,
 * D26).
 */
export async function finitionsSuite(scheme) {
  console.log(`\n— Finitions 0.9.1 (${scheme})`)
  await withApp(scheme, async (ui) => {
    await ui.ready()
    await ui.closePanel()
    const summary = `document.querySelector('[data-testid=turn-summary]')`

    // Tour arrêté : son avis le dit, pas de « Terminé ✓ » dessous.
    await ui.send('/scenario attend-stop')
    await ui.waitFor(`!!${ui.$('stop')}`)
    await ui.click(ui.$('stop'))
    await ui.ready()
    await ui.waitFor(
      `[...document.querySelectorAll('.thread *')].some((e) => e.textContent === ${JSON.stringify(L('transcript.notice.cancelled'))})`
    )
    check(!(await ui.ev(`!!${summary}`)), 'tour arrêté : pas de ligne de bilan sous « Interrompu »')

    // Tour fini qui modifie un fichier : la ligne de bilan, sous la rangée d'actions du survol.
    await ui.send('/scenario diff')
    await ui.ready()
    await ui.waitFor(`!!${summary}`)
    const text = await ui.ev(`${summary}.innerText`)
    check(
      text.startsWith(L('turnSummary.doneQuick')) &&
        text.includes(L('turnSummary.files', { count: 1, added: 1, removed: 1 })),
      `bilan du tour : « ${text} »`
    )
    const group = `[...document.querySelectorAll('.msg-agent-group')].at(-1)`
    await ui.hover(await ui.center(group))
    // La rangée d'actions apparaît au survol (fondu) : on l'attend affichée.
    await ui.waitFor(
      `getComputedStyle(${group}.querySelector('.msg-agent-actions')).opacity === '1'`
    )
    const overlap = await ui.ev(`(() => {
      const a = ${group}.querySelector('.msg-agent-actions')?.getBoundingClientRect()
      const b = ${summary}.getBoundingClientRect()
      return !!a && a.bottom > b.top + 1
    })()`)
    check(!overlap, 'la rangée d’actions du survol ne chevauche pas le bilan')
    await ui.shot('185-bilan-du-tour')

    // Relire plus haut pendant que l'agent écrit : le bouton dit combien de réponses sont arrivées.
    await ui.send('/scenario fil-long')
    // Relire en haut du fil pendant que l'agent écrit : chaque tentative le garde en haut, jusqu'à
    // ce que le bouton dise combien de réponses sont arrivées (attente sur condition, sans pause).
    await ui.waitFor(
      `(() => {
        const scroll = document.querySelector('.thread').closest('.scroll')
        if (scroll.scrollHeight > scroll.clientHeight + 120) scroll.scrollTop = 0
        return /\\d/.test(${ui.$('scroll-to-bottom')}?.innerText ?? '')
      })()`,
      20_000
    )
    await ui.ready()
    const pill = await ui.ev(`${ui.$('scroll-to-bottom')}.innerText`)
    const count = Number.parseInt(pill, 10)
    check(
      (await ui.ev(`${ui.$('scroll-to-bottom')}.classList.contains('with-count')`)) &&
        (pill === L('app.scrollDownMany') || pill === L('app.scrollDownNew', { count })),
      `« ↓ N nouveaux » sur le bouton (« ${pill} »)`
    )
    await ui.shot('185-nouveaux')
    await ui.click(ui.$('scroll-to-bottom'))
    await ui.waitFor(`!${ui.$('scroll-to-bottom')}`)
    check(true, 'en bas du fil : plus de bouton')

    // Fenêtre de 900 px, panneau ouvert à la main (fiche 185, D25, D26) : un onglet a son nom
    // entier ou son icône seule, l'actif garde son ✕ ; la puce de l'agent a son nom entier ou son
    // icône, jamais un bout de nom ni un chevron seul.
    await ui.viewport(900, 760)
    await ui.waitFor(`!${ui.$('side-panel')}`)
    await ui.click(ui.$('panel-toggle'))
    await ui.waitFor(`!!${ui.$('side-panel')}`)
    for (const tab of ['changes', 'tasks']) {
      const shown = `document.querySelector('.side-panel-tab[data-tab=${tab}] .side-panel-tab-main')`
      if (await ui.ev(`!!${shown}`)) await ui.click(shown)
      else {
        await ui.click(ui.$('panel-more'))
        await ui.click(`${ui.$('panel-more-menu')}.querySelector('[data-tab=${tab}]')`)
      }
      await ui.waitFor(`!!document.querySelector('.side-panel-tab.active[data-tab=${tab}]')`)
      const tabs = await ui.ev(`(() => {
        const list = document.querySelector('.side-panel-tabs').getBoundingClientRect()
        const inside = (b) => b.left >= list.left - 1 && b.right <= list.right + 1
        const tabs = [...document.querySelectorAll('.side-panel-tab')]
        const cut = tabs.filter((t) => !inside(t.getBoundingClientRect())).map((t) => t.dataset.tab)
        const partial = [...document.querySelectorAll('.side-panel-tab-label')]
          .filter((l) => l.offsetWidth > 0 && l.scrollWidth > l.clientWidth + 1)
          .map((l) => l.textContent)
        const close = document.querySelector('.side-panel-tab.active .side-panel-tab-close')
        const b = close?.getBoundingClientRect()
        return { cut, partial, close: !!b && b.width > 0 && inside(b) && getComputedStyle(close).opacity === '1' }
      })()`)
      check(
        tabs.cut.length === 0 && tabs.partial.length === 0 && tabs.close,
        `900 px, onglet ${tab} actif : noms entiers ou icônes, aucun onglet coupé, ✕ de l’actif visible (${JSON.stringify(tabs)})`
      )
    }
    await ui.shot('185-900-onglets')
    // Au cran serré, un clic sur l'icône d'un inactif l'ouvre : le ✕ invisible posé par-dessus ne
    // prend pas le clic, aucun onglet n'est fermé (relecture de 90d5db8).
    check(
      await ui.ev(`document.querySelector('.side-panel-tabs').classList.contains('tight')`),
      '900 px : la rangée est au cran serré'
    )
    for (const id of await ui.ev(
      `[...document.querySelectorAll('.side-panel-tab:not([data-overflow]):not(.active)')].map((t) => t.dataset.tab)`
    )) {
      const before = await ui.ev(`document.querySelectorAll('.side-panel-tab').length`)
      // Au milieu de l'onglet entier (pas de son seul bouton) : là où le ✕ invisible est posé.
      await ui.click(`document.querySelector('.side-panel-tab[data-tab=${id}]')`)
      await ui.waitFor(`!!document.querySelector('.side-panel-tab.active[data-tab=${id}]')`)
      const after = await ui.ev(`document.querySelectorAll('.side-panel-tab').length`)
      check(
        after === before,
        `900 px, cran serré : un clic sur l’icône de ${id} l’ouvre, rien n’est fermé (${before} → ${after})`
      )
    }
    const chip = await ui.ev(`(() => {
      const chip = document.querySelector('.agent-chip')
      const label = chip.querySelector('.chip-label')
      const icon = chip.querySelector('.agent-chip-icon')
      const iconMode = !!chip.closest('[data-agent-icon]')
      return {
        whole: !iconMode && label.offsetWidth > 0 && label.scrollWidth <= label.clientWidth + 1,
        icon: iconMode && icon.getBoundingClientRect().width > 0
      }
    })()`)
    check(
      chip.whole !== chip.icon,
      `900 px : la puce de l’agent a son nom entier ou son icône, jamais un bout ni un chevron seul (${JSON.stringify(chip)})`
    )
    await ui.viewport()
  })
}
