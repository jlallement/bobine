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
 *   sont marqués « connexion sans doute à faire », sauf le modèle gratuit.
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
        const cost = await ui.ev(`${ui.$('usage-cost')}.innerText`)
        check(
          cost === L('usage.costNotReported'),
          `coût nul d’un modèle payant : « ${cost} », ni « gratuit » ni « 0,00 »`
        )
        check(
          (await ui.ev(`${ui.$('usage-cost-hint')}.innerText`)).includes(
            L('usage.costNotReportedHint', { agent: L('profiles.mock.label') }).slice(0, 20)
          ),
          'le détail dit pourquoi le coût est inconnu'
        )
        const details = await ui.ev(`${ui.$('usage-details')}.innerText`)
        check(
          !/0[,.]00/.test(details) && !details.includes(L('usage.free')),
          'ni moyenne ni ligne d’échange à « ≈ 0,00 $US »'
        )
        await ui.shot('266-cout-non-communique')
      },
      undefined,
      'cout-nul-payant',
      { BOBINE_WORKSPACE: workspace }
    )

    rmSync(join(workspace, '.mock-agent-logged-in'), { force: true })
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        await ui.send('Ajoute un test pour la fonction de calcul')
        await ui.waitFor(`!!${ui.$('blocker-auth')}`)
        await ui.click(ui.$('auth-choose-model'))
        await ui.waitFor(`!!${ui.$('model-menu-content')}`)
        const tag = (value) =>
          ui.ev(
            `(() => { const o = ${ui.$(`control-model-${value}`)}; return o?.querySelector('[data-testid=model-auth-required]') ? 'refusé' : o?.querySelector('[data-testid=model-auth-likely]') ? 'sans doute' : '—' })()`
          )
        const tags = {
          refused: await tag('openai/gpt-6.2-sol'),
          sibling: await tag('openai/gpt-6.1-sol'),
          mini: await tag('openai/gpt-6-mini'),
          free: await tag('opencode/tidepool-alpha-free')
        }
        check(
          tags.refused === 'refusé' &&
            tags.sibling === 'sans doute' &&
            tags.mini === 'sans doute' &&
            tags.free === '—',
          `menu des modèles : refusé, même fournisseur « ${L('modelMenu.authLikely')} », gratuit sans marque (${JSON.stringify(tags)})`
        )
        await ui.shot('266-connexion-a-faire')
      },
      undefined,
      'connexion-a-faire-fournisseur',
      { BOBINE_WORKSPACE: workspace }
    )
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
}
