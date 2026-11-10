import { check, withApp } from '../lib.mjs'

/**
 * Débordements horizontaux du fil (fiche 173) : un message de l'utilisateur et une réponse de
 * l'agent pleins de contenus trop larges (`/scenario debordements`). Le fil ne défile jamais de
 * côté : seuls les blocs qui en ont besoin (code, diff, tableau, terminal) défilent dans leur cadre.
 * Mesuré à 1440 px et dans une conversation étroite (500 px).
 */
export async function overflowSuite(scheme) {
  console.log(`\n— Débordements du fil (${scheme})`)
  await withApp(
    scheme,
    async (ui) => {
      await ui.ready()
      const word = 'Anticonstitutionnellement'.repeat(16)
      await ui.send(
        `Mot sans espace : ${word}\nChemin : /Users/dev/${'dossier-tres-profond/'.repeat(14)}x.ts\nLien : https://exemple.test/${'chemin/'.repeat(30)}`
      )
      await ui.ready()
      await ui.send('/scenario debordements')
      await ui.ready()
      await ui.waitFor(
        `[...document.querySelectorAll('.msg-agent')].at(-1)?.innerText.includes('Fin des débordements')`
      )
      // Mermaid se dessine après coup : on attend le diagramme, plus large que la colonne.
      await ui.waitFor(`!!document.querySelector('.msg-agent svg[id^=mermaid], .mermaid svg')`)
      check(
        (await ui.ev(`document.querySelectorAll('[data-testid=subagent]').length`)) === 1,
        'carte de sous-agent dans le fil'
      )
      // Groupes d'outils et sous-agent dépliés : leur contenu compte aussi.
      await ui.ev(
        `(() => { for (const b of document.querySelectorAll('[data-testid=subagent-toggle]')) b.click(); return true })()`
      )
      await ui.ev(
        `(() => { for (const d of document.querySelectorAll('.thread details')) d.open = true; return true })()`
      )
      await roomForConversation(ui)
      // Le fil mesuré seul : le panneau fermé, la conversation a toute la place.
      await ui.closePanel()
      for (const [width, label] of [
        [1440, '1440 px'],
        // Fenêtre de 720 px : la conversation, à côté de la barre latérale, fait environ 500 px.
        [720, 'conversation étroite']
      ]) {
        await ui.viewport(width, 900)
        await ui.ev(`new Promise((r) => setTimeout(r, 300))`)
        const m = await ui.ev(MEASURE)
        console.log(`    ${label} : conversation de ${m.scroll.clientWidth} px`)
        check(
          m.scroll.scrollWidth <= m.scroll.clientWidth && m.offenders.length === 0,
          `${label} : le fil ne défile pas de côté (${m.scroll.scrollWidth} ≤ ${m.scroll.clientWidth} px)${
            m.offenders.length ? ` — dépassent : ${m.offenders.join(' ; ')}` : ''
          }`
        )
        check(
          m.ancestors.every((a) => a.scrollWidth <= a.clientWidth),
          `${label} : ni la fenêtre ni ses cadres ne défilent de côté${m.ancestors
            .filter((a) => a.scrollWidth > a.clientWidth)
            .map((a) => ` — ${a.name} ${a.scrollWidth} > ${a.clientWidth}`)
            .join('')}`
        )
        check(
          m.framed >= 3,
          `${label} : les blocs larges défilent dans leur propre cadre (${m.framed} cadres)`
        )
        // Un défilement de côté forcé (scrollIntoView d'un élément, sélection) ne décale rien.
        const left = await ui.ev(
          `(() => { const s = document.querySelector('.scroll'); s.scrollLeft = 200; return s.scrollLeft })()`
        )
        check(left === 0, `${label} : le fil ne se laisse pas décaler de côté (scrollLeft ${left})`)
        await ui.ev(
          `document.querySelector('[data-testid=user-message]').scrollIntoView({ block: 'start' })`
        )
        await ui.shot(`173-debordements-${width}`)
        await ui.ev(
          `[...document.querySelectorAll('.msg-agent')].at(-1).scrollIntoView({ block: 'start' })`
        )
        await ui.shot(`173-debordements-${width}-reponse`)
        await ui.ev(
          `document.querySelector('[data-testid=tool-group], [data-testid=tool]').scrollIntoView({ block: 'start' })`
        )
        await ui.shot(`173-debordements-${width}-outils`)
        await ui.ev(
          `document.querySelector('[data-testid=subagent]').scrollIntoView({ block: 'start' })`
        )
        await ui.shot(`173-debordements-${width}-sous-agent`)
        await ui.ev(
          `document.querySelector('.msg-agent table').scrollIntoView({ block: 'center' })`
        )
        await ui.shot(`173-debordements-${width}-blocs`)
      }
      // Largeur extrême : panneau rouvert à la main dans la fenêtre étroite (choix de
      // l'utilisateur, il reste ouvert). La conversation est écrasée, mais ne défile pas de côté.
      await ui.viewport(720, 900)
      await ui.click(ui.$('panel-toggle'))
      await ui.waitFor(`!!${ui.$('side-panel')}`)
      await ui.ev(`new Promise((r) => setTimeout(r, 300))`)
      await ui.ev(
        `document.querySelector('[data-testid=user-message]').scrollIntoView({ block: 'start' })`
      )
      const squeezed = await ui.ev(MEASURE)
      check(
        squeezed.scroll.scrollWidth <= squeezed.scroll.clientWidth &&
          squeezed.offenders.length === 0,
        `panneau ouvert à la main, conversation de ${squeezed.scroll.clientWidth} px : rien ne dépasse${
          squeezed.offenders.length ? ` — dépassent : ${squeezed.offenders.join(' ; ')}` : ''
        }`
      )
      await ui.shot('173-debordements-extreme')
      await ui.viewport()
    },
    undefined,
    'echo'
  )
}

/**
 * Panneau ouvert d'office sur « Session » (fiche 166), puis fenêtre réduite : il cède sa largeur
 * pour garder 500 px à la conversation, se replie quand même 280 px ne tiennent plus, et revient
 * quand la fenêtre s'élargit (fiche 173).
 */
async function roomForConversation(ui) {
  const layout = () =>
    ui.ev(
      `(() => ({ panel: document.querySelector('[data-testid=side-panel]')?.getBoundingClientRect().width ?? 0, conversation: document.querySelector('.scroll').clientWidth, tab: document.querySelector('.side-panel-tab.active')?.dataset.tab ?? null }))()`
    )
  await ui.viewport(1440, 900)
  await ui.waitFor(`!!${ui.$('side-panel')}`)
  const wide = await layout()
  check(wide.tab === 'session', `1440 px : panneau ouvert d'office sur « Session » (${wide.tab})`)
  await ui.viewport(1100, 900)
  const half = await layout()
  check(
    half.panel > 0 && half.conversation >= 500,
    `1100 px : le panneau cède (${Math.round(half.panel)} px), la conversation garde ${half.conversation} px`
  )
  await ui.viewport(720, 900)
  await ui.waitFor(`!${ui.$('side-panel')}`)
  const narrow = await layout()
  check(
    narrow.conversation >= 500,
    `720 px : panneau replié, la conversation garde ${narrow.conversation} px`
  )
  await ui.shot('173-panneau-replie')
  await ui.viewport(1440, 900)
  await ui.waitFor(`!!${ui.$('side-panel')}`)
  const back = await layout()
  check(back.tab === 'session', `fenêtre élargie : le panneau revient sur « ${back.tab} »`)
}

/**
 * Ce qui dépasse : le cadre du fil et ses ancêtres (`scrollWidth > clientWidth`), et les éléments
 * du fil qui sortent de la colonne sans être dans un cadre qui les coupe ou les fait défiler (les
 * plus profonds seulement : leurs parents dépassent forcément aussi).
 */
const MEASURE = `(() => {
  const scroll = document.querySelector('.scroll')
  const column = scroll.querySelector('.column').getBoundingClientRect()
  const columnEl = scroll.querySelector('.column')
  // Un cadre qui coupe ou fait défiler son contenu (sauf la colonne elle-même, filet de sécurité).
  const clipped = (el) => {
    for (let p = el.parentElement; p && p !== columnEl; p = p.parentElement) {
      if (getComputedStyle(p).overflowX !== 'visible') return true
    }
    return false
  }
  // Sort de la colonne : la boîte de l'élément, ou son texte qui dépasse de sa boîte.
  const out = (el) => {
    const r = el.getBoundingClientRect()
    if (r.width === 0) return false
    const text = getComputedStyle(el).overflowX === 'visible' && el.clientWidth > 0 ? r.left + el.scrollWidth : r.right
    return Math.max(r.right, text) > column.right + 1 || r.left < column.left - 1
  }
  const name = (el) => el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).join('.') : '') + (el.dataset.testid ? '[' + el.dataset.testid + ']' : '')
  const offenders = []
  for (const el of scroll.querySelectorAll('.thread *')) {
    if (!out(el) || clipped(el)) continue
    if ([...el.children].some(out)) continue
    const r = el.getBoundingClientRect()
    const right = Math.max(r.right, r.left + el.scrollWidth)
    offenders.push(name(el) + ' (' + Math.round(r.left - column.left) + '…' + Math.round(right - column.left) + ' / ' + Math.round(column.width) + ')')
  }
  const ancestors = []
  for (let p = scroll.parentElement; p; p = p.parentElement) {
    ancestors.push({ name: name(p), scrollWidth: p.scrollWidth, clientWidth: p.clientWidth })
  }
  const framed = [...scroll.querySelectorAll('.thread *')].filter((el) => {
    const o = getComputedStyle(el).overflowX
    return (o === 'auto' || o === 'scroll') && el.scrollWidth > el.clientWidth
  }).length
  return {
    scroll: { scrollWidth: scroll.scrollWidth, clientWidth: scroll.clientWidth },
    offenders: offenders.slice(0, 20),
    ancestors,
    framed
  }
})()`
