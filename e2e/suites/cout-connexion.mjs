import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { L, check, withApp } from '../lib.mjs'

/**
 * Coût et connexion avec des modèles nommés par fournisseur (fiche 266) :
 * - D12 : un modèle payant connecté par abonnement annonce un coût nul ; l'app dit « coût
 *   inconnu », jamais « gratuit » ni « ≈ 0,00 $US », et le plafond dit qu'il ne peut pas se
 *   déclencher ;
 * - D31 : après le refus d'un modèle faute de connexion, les autres modèles du même fournisseur
 *   sont marqués « sans doute » (infobulle), sauf le modèle gratuit.
 * - Fiche 267 (recette N10) : Mon activité, la tuile du coût compte ces échanges « sans coût
 *   communiqué » comme le tableau les dit « coût inconnu » (capture `267-activite-cout-inconnu`).
 */
export async function coutConnexionSuite(scheme) {
  console.log(`\n— Coût inconnu et connexion à faire (${scheme})`)
  const workspace = mkdtempSync(join(tmpdir(), 'bob-e2e-cout-'))
  try {
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        await ui.send('Range le carnet par rayon')
        await ui.ready()
        await ui.waitFor(`!!${ui.$('usage-meter')}`)
        await ui.click(ui.$('usage-meter'))
        await ui.waitFor(`!!${ui.$('usage-details')}`)
        await ui.shot('266-cout-non-communique')
        await ui.press('Escape')

        // Mon activité (fiche 267, N10) : la tuile et le tableau disent le même compte.
        await ui.send('Et range les surgelés à part')
        await ui.ready()
        await ui.click(ui.$('open-activity'))
        await ui.waitFor(`!!${ui.$('usage-kpi-cost')} && !!${ui.$('usage-model-row')}`, 30000)
        await ui.waitFor(
          `${ui.$('usage-kpi-cost')}.innerText.includes(${JSON.stringify(L('usage.costNotReported'))})`
        )
        await ui.shot('267-activite-cout-inconnu')
        // 720 px (revue UX) : pas de barre de défilement permanente sous la grille, rien ne déborde.
        await ui.viewport(720, 760)
        const narrow = await ui.ev(`(() => {
          const scroller = document.querySelector('.activity-heat-scroll')
          const page = document.querySelector('[data-testid=activity-title]')?.closest('.scroll') ?? document.body
          return {
            bar: getComputedStyle(scroller).scrollbarWidth,
            overflow: page.scrollWidth - page.clientWidth
          }
        })()`)
        check(
          narrow.bar === 'none' && narrow.overflow <= 0,
          `Mon activité à 720 px : pas de barre permanente, rien ne déborde (${JSON.stringify(narrow)})`
        )
        await ui.shot('267-activite-720')
        await ui.viewport()
      },
      undefined,
      'cout-nul-payant',
      { BOBINE_WORKSPACE: workspace }
    )
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
}
