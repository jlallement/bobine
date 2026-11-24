import { execFileSync } from 'node:child_process'
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { L, check, withApp } from '../lib.mjs'

/**
 * Tour de table (fiche 285) — SQUELETTE, PAS ENCORE LANCÉ.
 *
 * ⚠ Cette suite n'est pas dans `e2e/catalog.mjs` : elle attend le moteur côté main (orchestrateur
 * `src/main/roundtable/`, canaux `roundtable:*` branchés, scénarios de l'agent factice
 * `avis-participant`, `avis-hors-format`, `avis-erreur`, `synthese-tour-de-table`, `replique`,
 * `MOCK_AGENT_SCENARIO_BY_MODEL`, `MOCK_AGENT_REFUSE_MODEL`). Une fois les deux branches fusionnées :
 * l'ajouter au catalogue (`name: 'tour-de-table'`, ses `sources`, `themes: BOTH`), vérifier les
 * noms de scénarios et de variables avec `docs/mock-agent.md`, la jouer en clair, en sombre et en
 * `--lang en`, et comparer ses captures aux maquettes `docs/maquettes/1.2-tour-de-table-v2/`.
 *
 * Parcours (critères d'acceptation de la fiche) : premier usage (Entrée ouvre le menu), menu à
 * cases, lancement en deux gestes, ligne en saisie étroite, carte en cours, avis, synthèse
 * automatique malgré un participant en erreur, carte repliée et total, lettres de la synthèse,
 * réplique, décision, « Appliquer ». Les textes de l'app sont comparés par `L('clé')`.
 */
export async function roundtableSuite(scheme) {
  console.log(`\n— Tour de table (${scheme}) — squelette, pas encore lancé`)
  const workspace = realpathSync(mkdtempSync(join(tmpdir(), 'bob-e2e-tour-de-table-')))
  const git = (...args) =>
    execFileSync('git', ['-c', 'user.name=e2e', '-c', 'user.email=e2e@example.invalid', ...args], {
      cwd: workspace,
      encoding: 'utf8'
    })
  writeFileSync(join(workspace, 'README.md'), '# File de tâches\n')
  git('init', '-q', '-b', 'main')
  git('add', '.')
  git('commit', '-q', '-m', 'init')
  // À confirmer avec le moteur (fiche 285, « Essais ») : deux agents factices, des modèles déclarés,
  // un modèle refusé, un scénario par modèle.
  const env = {
    BOBINE_WORKSPACE: workspace,
    BOBINE_MOCK_PEER: '1',
    MOCK_MODELS: 'mock/alpha,mock/beta,mock/gamma',
    MOCK_AGENT_REFUSE_MODEL: 'mock/gamma',
    MOCK_AGENT_SCENARIO_BY_MODEL: 'mock/alpha=avis-participant,mock/beta=avis-hors-format'
  }
  try {
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        await ui.closePanel()
        const line = ui.$('roundtable-line')

        // 1. Premier usage : `/roundtable question`, personne de retenu ; Entrée ouvre le menu.
        await ui.ev(`${ui.$('composer-input')}.focus()`)
        await ui.type('/roundtable Postgres seul, Redis ou un service géré ?')
        await ui.waitFor(`!!${line}`)
        check(
          (await ui.ev(`${line}.textContent`)).includes(L('roundtable.line.choose')),
          'premier usage : « Choisir les participants »'
        )
        await ui.shot('285-premier-usage')
        await ui.enter()
        await ui.waitFor(`!!${ui.$('roundtable-menu')}`)

        // 2. Menu à cases : trois participants cochés (dont le modèle refusé), retenus aussitôt.
        for (const name of ['alpha', 'beta', 'gamma']) {
          await ui.click(
            `[...document.querySelectorAll('[data-testid=roundtable-option]')].find((o) => o.textContent.includes('${name}'))`
          )
        }
        await ui.shot('285-participants')
        check(
          (await ui.ev(`${line}.textContent`)).includes(
            L('roundtable.line.participants', { count: 3 })
          ),
          'menu : « 3 participants »'
        )
        await ui.key('Escape')

        // 3. Ligne prête : surcoût en jetons ; Entrée envoie.
        check(
          (await ui.ev(`${ui.$('roundtable-cost-full')}.textContent`)) ===
            L('roundtable.cost.full', { n: 4 }),
          'ligne : « ≈ 4 fois les jetons d’une question simple »'
        )
        await ui.shot('285-lancement-pret')
        await ui.enter()

        // 4. Carte en cours, puis avis ; le modèle refusé est dit, sans substitution.
        const card = ui.$('roundtable-card')
        await ui.waitFor(`!!${card}`, 30_000)
        await ui.shot('285-carte-en-cours')
        await ui.waitFor(`!!document.querySelector('[data-testid=roundtable-other-model]')`, 30_000)
        check(
          (await ui.ev(`${card}.textContent`)).includes(
            L('roundtable.state.modelNotOffered', { agent: 'Agent factice' })
          ),
          'modèle refusé : dit sur sa ligne'
        )

        // 5. Synthèse automatique avec les avis présents ; la carte se replie ; total au pied.
        await ui.waitFor(`!!${ui.$('roundtable-answer-label')}`, 60_000)
        await ui.waitFor(`${card}.dataset.collapsed === 'true'`, 60_000)
        check(
          (await ui.ev(`${ui.$('roundtable-request')}.textContent`)).includes(
            L('roundtable.synthesis.requested', { count: 2 })
          ),
          'synthèse : ligne de l’app « Synthèse demandée · 2 avis »'
        )
        await ui.shot('285-apres-synthese')

        // 6. Lettres : le vrai nom au survol.
        await ui.hover(await ui.center(ui.$('roundtable-letter')))
        await ui.shot('285-synthese-lettre')

        // 7. Réplique, puis décision.
        await ui.click(ui.$('roundtable-rebut'))
        await ui.waitFor(`!!${ui.$('roundtable-rebuttal')}`, 30_000)
        await ui.waitFor(
          `document.querySelectorAll('[data-testid=roundtable-answer-label]').length === 2`,
          60_000
        )
        await ui.shot('285-replique-decision')

        // 8. « Demander à … de l'appliquer » : un message ordinaire à la conversation.
        await ui.click(ui.$('roundtable-apply'))
        await ui.waitFor(
          `[...document.querySelectorAll('[data-testid=user-message]')].some((m) => m.textContent.includes(${JSON.stringify(L('roundtable.synthesis.applyDraft'))}))`
        )

        // 9. Saisie étroite : la forme courte du surcoût, « jetons » gardé, rien de coupé.
        // À écrire : fenêtre à 560 px, `/roundtable …`, capture `285-fenetre-etroite`.
      },
      undefined,
      'demo',
      env
    )
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
}
