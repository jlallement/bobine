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
const plain = (text) => (text ?? '').replace(/[\u00a0\u202f]/g, ' ')
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
          !/0[,.]00/.test(details) &&
            !(await ui.ev(
              `[...document.querySelectorAll('[data-testid=usage-turn] .cost-turn-cost')].some((c) => c.innerText === ${JSON.stringify(L('usage.free'))})`
            )),
          'ni moyenne ni ligne d’échange à « ≈ 0,00 $US »'
        )
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
        const tile = plain(await ui.ev(`${ui.$('usage-kpi-cost')}.innerText`))
        const row = plain(await ui.ev(`${ui.$('usage-model-row')}.innerText`))
        check(
          tile.includes(plain(L('usage.board.kpi.withoutCost', { count: 2 }))) &&
            row.includes(L('usage.costNotReported')) &&
            /\b2\b/.test(row),
          `Mon activité : la tuile compte 2 échanges sans coût communiqué, comme le tableau (${tile.replace(/\n/g, ' · ')} | ${row.replace(/\n/g, ' · ')})`
        )
        await ui.shot('267-activite-cout-inconnu')
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
