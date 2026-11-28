import { L, check, withApp } from '../lib.mjs'

/**
 * Nom des outils d'un serveur MCP tiers appelés par du code (fiche 293, lot 3) : l'agent factice
 * rejoue la forme relevée d'OpenCode 2.3.0 connecté à Figma (`outils-mcp-execute`) ; la fin de
 * chaque carte `execute` nomme ses outils, le fil les titre (« figma · whoami »). Captures du fil
 * comparées à la planche « fil après » de la maquette (`docs/maquettes/293/fil-apres-640-*.png`).
 */
export async function filOutilsMcpSuite(scheme) {
  console.log(`\n— Fil : outils MCP appelés par du code (${scheme})`)
  await withApp(scheme, async (ui) => {
    await ui.send('/scenario outils-mcp-execute')
    await ui.ready()
    const cards = `[...document.querySelectorAll('[data-testid=tool]')]`
    const seen = await ui.ev(
      `${cards}.map((c) => ({ title: c.querySelector('.tool-title')?.textContent, status: c.dataset.status, tip: c.querySelector('[data-testid=tool-called]')?.getAttribute('title') ?? null }))`
    )
    const expected = [
      L('toolCall.calledTools.searchAny'),
      L('toolCall.calledTools.search', { server: 'figma' }),
      'figma · whoami'
    ]
    check(
      JSON.stringify(seen.map((c) => c.title)) === JSON.stringify(expected) &&
        seen.every((c) => c.status === 'completed'),
      `cartes finies titrées d’après leurs outils : ${seen.map((c) => `« ${c.title} »`).join(', ')}`
    )
    check(
      seen.every((c) => c.tip?.startsWith('execute · ')),
      'infobulle : le titre de l’agent (« execute ») et le nombre d’appels'
    )
    // Serveur en retrait, mais lisible (WCAG ≥ 4,5).
    const server = `document.querySelector('.tool-called-server')`
    const contrast = await ui.ev(`(() => {
      const el = ${server}
      const rgb = (c) => (c.match(/[\\d.]+/g) || []).slice(0, 4).map(Number)
      let node = el, bg = [0, 0, 0, 0]
      while (node && (bg = rgb(getComputedStyle(node).backgroundColor))[3] === 0) node = node.parentElement
      const lum = ([r, g, b]) => [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0)
      const a = lum(rgb(getComputedStyle(el).color)), b = lum(bg)
      return { text: el.textContent, ratio: Math.round(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)) * 100) / 100 }
    })()`)
    check(
      contrast.text === 'figma ·' && contrast.ratio >= 4.5,
      `« figma · » en retrait, contraste ${contrast.ratio} (≥ 4,5)`
    )
    // Une ligne par carte, rien qui déborde de la carte.
    const oneLine = await ui.ev(
      `${cards}.every((c) => { const t = c.querySelector('.tool-title'); return t.scrollWidth <= t.clientWidth + 1 && t.getClientRects().length === 1 })`
    )
    check(oneLine, 'titres sur une ligne, sans débordement')
    // Cartes regroupées (fiche 047), s'il y en a : dépliées pour la capture.
    await ui.ev(
      `document.querySelectorAll('[data-testid=tool-group] details').forEach((d) => (d.open = true)); true`
    )
    await ui.shot('f1-fil-outils-mcp')
  })
}
