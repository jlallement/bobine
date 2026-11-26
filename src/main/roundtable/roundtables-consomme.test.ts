/**
 * « Consommé » : un seul total juste (fiche 292). Le pied de la carte du tour de table compte, au
 * jeton près, les jetons traités (entrée + sortie) que le journal de consommation écrit pour les
 * tours lancés par le tour de table : avis et réplique de chaque participant, synthèse, décision.
 * « Demander de l'appliquer » est un message ordinaire de la conversation : hors du total.
 *
 * Agent factice réel (consommation simulée : entrée, sortie, réflexion et cache distincts) ; le
 * journal (`UsageJournal`) suit les évènements du gestionnaire, comme dans l'app, sur une base en
 * mémoire. Le total est calculé comme le pied (`roundtableTotal` sur le résumé de chaque
 * participant, puis la synthèse et la décision).
 */
import { afterEach, describe, expect, it } from 'vitest'
import { roundtableTotal } from '@shared/roundtable'
import { processedTokens } from '@shared/usage'
import { UsageJournal } from '../usage/journal'
import type { TurnRow } from '../usage/usage-db'
import { choice, roundtableEnv, type RoundtableEnv } from './test-env'

const envs: RoundtableEnv[] = []
afterEach(() => {
  for (const env of envs.splice(0)) env.stop()
})

/** Journal de consommation branché sur le gestionnaire, lignes gardées en mémoire. */
function journalOf(env: RoundtableEnv) {
  const rows = new Map<string, TurnRow>()
  const journal = new UsageJournal({
    db: { upsert: (row) => rows.set(row.id, row) },
    describe: () => ({ profileId: 'essai' })
  })
  env.manager.subscribe({ event: (payload) => journal.onEvent(payload) })
  /** Jetons traités journalisés (entrée + sortie), comme Mon activité. */
  const processed = () =>
    [...rows.values()].reduce((sum, row) => sum + processedTokens(row.tokens), 0)
  return { rows, processed }
}

describe('« Consommé » = jetons traités journalisés (fiche 292)', () => {
  it('participants, synthèse, réplique et décision ; « Appliquer » hors total', async () => {
    const env = await roundtableEnv()
    envs.push(env)
    const { rows, processed } = journalOf(env)
    const mother = env.manager.state().activeId
    await env.manager.startActive()
    await env.roundtables.start(mother, {
      question: 'Quelle piste pour la moyenne de calc.js ?',
      participants: [choice('panel', 'factice-rapide'), choice('panel', 'factice-precis')]
    })
    await env.waitFor(() => env.rt(mother).phase === 'synthesized', 'synthèse rendue')
    const footer = () => {
      const rt = env.rt(mother)
      const summary = (id?: string) => env.manager.state().conversations.find((c) => c.id === id)
      return roundtableTotal([
        ...rt.seats.map((s) => summary(s.childId)?.usage),
        rt.synthesis?.usage,
        rt.verdict?.usage
      ])
    }
    // Deux avis et la synthèse : trois tours journalisés, tous comptés.
    await env.waitFor(() => rows.size === 3, 'trois tours journalisés')
    expect(processed()).toBeGreaterThan(0)
    expect(footer().tokens).toBe(processed())

    // Réplique des deux participants, puis décision : trois tours de plus, toujours au jeton près.
    env.roundtables.rebuttal(mother, env.rt(mother).roundtableId)
    await env.waitFor(() => env.rt(mother).phase === 'decided', 'décision rendue', 20_000)
    await env.waitFor(() => rows.size === 6, 'six tours journalisés')
    expect(footer().tokens).toBe(processed())

    // « Demander de l'appliquer » : un message ordinaire, compté avec la conversation seulement.
    const before = footer().tokens
    await env.manager.prompt(mother, 'Applique la recommandation de la décision.')
    await env.waitFor(() => rows.size === 7, 'tour d’« Appliquer » journalisé')
    expect(footer().tokens).toBe(before)
    expect(processed()).toBeGreaterThan(before ?? 0)
  }, 40_000)
})
