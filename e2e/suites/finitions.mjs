import { L, check, sleep, withApp } from '../lib.mjs'

/**
 * Finitions de la 0.9.1 (fiche 185) : le bilan sous la dernière réponse (P4), devenu son pied
 * (fiche 261), jamais sous un tour arrêté ; « ↓ N nouveaux » quand on relit plus
 * haut pendant que l'agent écrit (P8) ; à 900 px, onglets et puce de l'agent jamais coupés (D25,
 * D26).
 */
export async function finitionsSuite(scheme) {
  console.log(`\n— Finitions 0.9.1 (${scheme})`)
  await withApp(scheme, async (ui) => {
    await ui.ready()
    await ui.closePanel()
    const summary = `[...document.querySelectorAll('[data-testid=turn-summary]')].at(-1)`

    // Tour arrêté : son avis le dit, pas de « Terminé ✓ » dessous.
    await ui.send('/scenario attend-stop')
    await ui.waitFor(`!!${ui.$('stop')}`)
    await ui.click(ui.$('stop'))
    await ui.ready()
    await ui.waitFor(
      `[...document.querySelectorAll('.thread *')].some((e) => e.textContent === ${JSON.stringify(L('transcript.notice.cancelled'))})`
    )

    // Tour fini qui modifie un fichier : le bilan est le pied de la réponse (fiche 261), un seul,
    // toujours visible, sans « Terminé » ; la durée n'y est qu'une fois.
    await ui.send('/scenario diff')
    await ui.ready()
    await ui.waitFor(`!!${summary}`)
    const group = `[...document.querySelectorAll('.msg-agent-group')].at(-1)`
    // Toujours visible, sans survol (plus de rangée qui apparaît au survol pour cette réponse). Le
    // pied arrive en fondu (200 ms, `motion.css`) : on attend sa fin, puis il doit rester visible
    // sans survol ; une rangée qui n'apparaîtrait qu'au survol resterait à 0 et ferait échouer.
    await ui.hover({ x: 5, y: 400 })
    const faded = await ui.waitFor(`getComputedStyle(${summary}).opacity === '1'`, 2000).then(
      () => true,
      () => false
    )
    await sleep(300)
    const shown = await ui.ev(`({
      opacity: getComputedStyle(${summary}).opacity,
      rows: ${group}.querySelectorAll('.msg-agent-actions').length,
      hovered: ${group}.matches(':hover')
    })`)
    check(
      faded && shown.opacity === '1' && shown.rows === 1 && !shown.hovered,
      `pied de la réponse visible sans survol, une seule rangée sous la réponse (${JSON.stringify(shown)})`
    )
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
    await ui.shot('185-nouveaux')
    await ui.click(ui.$('scroll-to-bottom'))
    await ui.waitFor(`!${ui.$('scroll-to-bottom')}`)

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

    // Pied du tour à 900 px, panneau ouvert (revue UX, fiche 261) : il passe à la ligne entre ses
    // éléments, jamais au milieu d'un, et ne déborde pas du fil.
    await ui.ev(`${summary}.scrollIntoView({ block: 'center' }), true`)
    const narrow = await ui.ev(`(() => {
      const foot = ${summary}
      const column = foot.closest('.thread').getBoundingClientRect()
      const box = foot.getBoundingClientRect()
      const cut = [...foot.querySelectorAll('.reply-foot-facts > *')].filter(
        (e) => e.getClientRects().length > 1
      ).length
      return { inside: box.right <= column.right + 1, cut }
    })()`)
    check(
      narrow.inside && narrow.cut === 0,
      `900 px : pied du tour dans le fil, aucun élément coupé (${JSON.stringify(narrow)})`
    )
    await ui.shot('261-pied-900')
    await ui.viewport()
  })
}
