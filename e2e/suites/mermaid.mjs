import { check, sleep, withApp } from '../lib.mjs'
import { tokensOf, variantOf, withPalette } from '../palette.mjs'

/**
 * Diagrammes Mermaid (fiche 063) : Mermaid chargé à l'arrivée d'un diagramme, redessiné aux
 * couleurs de la variante ; code / diagramme, agrandir (leurs vérifications sont en Vitest et dans
 * `parcours-longue`).
 */
export async function mermaidSuite(scheme) {
  console.log(`\n— Diagrammes Mermaid (${scheme})`)
  await withApp(
    scheme,
    async (ui) => {
      await ui.ready()
      // Morceaux de Mermaid importés : Vite les annonce par des liens `modulepreload`.
      const loaded = `[...document.querySelectorAll('link[rel=modulepreload]')].some((l) => /Diagram/.test(l.href))`
      await ui.send('Dessine l’architecture')
      await ui.ready()
      const blocks = `[...document.querySelectorAll('[data-testid=mermaid-block]')]`
      await ui.waitFor(
        `${blocks}.length === 3 && ${blocks}.every((b) => b.dataset.state !== 'pending')`,
        15_000
      )
      check(await ui.ev(loaded), 'Mermaid chargé à l’arrivée du diagramme')
      await ui.ev(`${blocks}[0].scrollIntoView({ block: 'center' })`)
      await ui.shot('m0-mermaid')
      // Redessiné dans les couleurs de la variante du mode (fiche 134).
      const variant = variantOf(scheme)
      await withPalette(ui, variant, async () => {
        const fill = tokensOf(variant).surface2
        await ui.waitFor(
          `${blocks}[0].querySelector('.mermaid-diagram svg')?.outerHTML.includes('${fill}')`,
          5000
        )
        check(true, `diagramme redessiné en ${variant}, à ses couleurs`)
        await sleep(200)
        await ui.shot(`m0-mermaid-${variant}`)
      })
      await ui.waitFor(
        `${blocks}[0].querySelector('.mermaid-diagram svg')?.outerHTML.includes('${tokensOf(scheme).surface2}')`,
        5000
      )

      // Code ↔ diagramme.
      await ui.click(`${blocks}[0].querySelector('[data-testid=mermaid-toggle]')`)
      await ui.waitFor(
        `!${blocks}[0].querySelector('.mermaid-diagram') && ${blocks}[0].innerText.includes('flowchart LR')`
      )
      await ui.click(`${blocks}[0].querySelector('[data-testid=mermaid-toggle]')`)
      await ui.waitFor(`!!${blocks}[0].querySelector('.mermaid-diagram svg')`)

      // Agrandir.
      await ui.click(`${blocks}[1].querySelector('[data-testid=mermaid-zoom]')`)
      await ui.waitFor(
        `!!document.querySelector('[data-testid=mermaid-zoom-dialog] .mermaid-zoom-body svg')`
      )
      await ui.shot('m1-mermaid-agrandi')
      await ui.key('Escape')
      await ui.waitFor(`!${ui.$('mermaid-zoom-dialog')}`)
    },
    undefined,
    'mermaid'
  )
}
