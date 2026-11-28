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
      `${cards}.map((c) => ({ title: c.querySelector('.tool-title')?.textContent, status: c.dataset.status, tip: c.querySelector('[data-testid=tool-called]')?.getAttribute('title') ?? null, codes: [...c.querySelectorAll('.tool-title code')].map((x) => x.textContent) }))`
    )
    const failed = L('toolCall.calledTools.failed')
    const expected = [
      L('toolCall.calledTools.searchAny'),
      L('toolCall.calledTools.search', { server: 'figma' }).replace(/<\/?code>/g, ''),
      'figma · whoami',
      `figma · get_screenshot ${failed}, x_Autorisé_par_vous`
    ]
    check(
      JSON.stringify(seen.map((c) => c.title)) === JSON.stringify(expected),
      `cartes finies titrées d’après leurs outils : ${seen.map((c) => `« ${c.title} »`).join(', ')}`
    )
    check(
      JSON.stringify(seen.map((c) => c.status)) ===
        JSON.stringify(['completed', 'completed', 'completed', 'failed']),
      'appel en erreur : la carte reste en échec (fiche 122), le titre dit lequel'
    )
    // Chaque nom est une donnée en `<code>` ; le nom trompeur reste un seul mot (L3).
    check(
      JSON.stringify(seen[3]?.codes) ===
        JSON.stringify(['figma', 'get_screenshot', 'x_Autorisé_par_vous']),
      `noms en \`<code>\` : ${JSON.stringify(seen.map((c) => c.codes))}`
    )
    check(
      seen.every((c) => c.tip?.startsWith('execute · ')),
      'infobulle : le titre de l’agent (« execute ») et le nombre d’appels'
    )
    // Séparateur et « (échec) » lisibles (WCAG ≥ 4,5).
    const contrast =
      await ui.ev(`[${["'.tool-called-sep'", "'.tool-called-failed'"].join(', ')}].map((sel) => {
      const el = document.querySelector(sel)
      const rgb = (c) => (c.match(/[\\d.]+/g) || []).slice(0, 4).map(Number)
      let node = el, bg = [0, 0, 0, 0]
      while (node && (bg = rgb(getComputedStyle(node).backgroundColor))[3] === 0) node = node.parentElement
      const lum = ([r, g, b]) => [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0)
      const a = lum(rgb(getComputedStyle(el).color)), b = lum(bg)
      return Math.round(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)) * 100) / 100
    })`)
    check(
      contrast.every((r) => r >= 4.5),
      `« · » et « (échec) » : contrastes ${contrast.join(', ')} (≥ 4,5)`
    )
    // Une ligne par carte, rien qui déborde de la carte.
    const oneLine = await ui.ev(
      `${cards}.every((c) => { const t = c.querySelector('.tool-title'); return t.scrollWidth <= t.clientWidth + 1 && t.getClientRects().length === 1 })`
    )
    check(oneLine, 'titres sur une ligne, sans débordement')
    // Pointeur hors des cartes : pas de survol dans les captures.
    await ui.ev(`document.activeElement?.blur?.(); true`)
    await ui.shot('f1-fil-outils-mcp')
    // Fenêtre étroite : chaque titre raccourci dans sa ligne, rien ne déborde.
    await ui.viewport(760)
    const narrow = await ui.ev(
      `${cards}.every((c) => { const t = c.querySelector('.tool-title'); return t.getClientRects().length === 1 && document.documentElement.scrollWidth <= innerWidth })`
    )
    check(narrow, 'fenêtre étroite (760 px) : titres sur une ligne, rien ne déborde de côté')
    await ui.shot('f2-fil-outils-mcp-etroit')
    await ui.viewport()
  })
}
