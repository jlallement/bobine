import { L, check, withApp } from '../lib.mjs'
import { rgb, tokensOf, variantOf, withPalette } from '../palette.mjs'

/** Sortie des commandes de l'agent (fiche 018). */
export async function terminalSuite(scheme) {
  console.log(`\n— Sortie des commandes (${scheme})`)
  await withApp(scheme, async (ui) => {
    await ui.ready()
    await ui.send('/scenario commande')
    await ui.ready()
    const lastTool = `[...document.querySelectorAll('[data-testid=tool]')].at(-1)`
    await ui.ev(`${lastTool}.querySelector('details').open = true`)
    await ui.waitFor(`!!${lastTool}.querySelector('[data-testid=terminal]')`)
    const terminal = `${lastTool}.querySelector('[data-testid=terminal]')`
    check(
      (await ui.ev(`${terminal}.innerText`)).includes('2 réussis') &&
        (await ui.ev(`!!${terminal}.querySelector('.ansi-green')`)),
      'sortie reçue en morceaux, couleurs ANSI rendues'
    )
    check(
      (await ui.ev(`${terminal}.querySelector('[data-testid=terminal-exit]').innerText`)) ===
        L('terminalView.exitCode', { code: 0 }),
      'code de sortie affiché'
    )
    await ui.shot('20-commande')
    // Fond et couleurs ANSI des jetons de la palette (fiche 134), variante du mode comprise.
    const colors = () =>
      ui.ev(`(() => {
        const t = ${terminal}
        return [getComputedStyle(t).backgroundColor, getComputedStyle(t.querySelector('.ansi-green')).color]
      })()`)
    const own = tokensOf(scheme)
    check(
      (await colors()).join() === [rgb(own.codeBg), rgb(own.ansi[2])].join(),
      'sortie de commande : fond et vert ANSI de la palette'
    )
    const variant = variantOf(scheme)
    await withPalette(ui, variant, async () => {
      const t = tokensOf(variant)
      check(
        (await colors()).join() === [rgb(t.codeBg), rgb(t.ansi[2])].join(),
        `sortie de commande en ${variant} : ses propres couleurs`
      )
      await ui.shot(`20-commande-${variant}`)
    })
    await ui.send('/scenario commande-echec')
    await ui.ready()
    await ui.ev(`${lastTool}.querySelector('details').open = true`)
    check(
      (await ui.ev(`${lastTool}.dataset.status`)) === 'failed' &&
        (await ui.ev(
          `${lastTool}.querySelector('[data-testid=terminal-exit]').classList.contains('failed')`
        )),
      'commande en échec : code de sortie 2 signalé'
    )
  })
}
