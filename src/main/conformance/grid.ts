/**
 * Grille de conformité ACP (fiche 139) : les quatorze parcours joués contre une persona, chacun dans
 * son propre environnement (dossiers, gestionnaire, agents), en parallèle ; à la fin de chacun, les
 * quatre invariants. Un fichier d'essai par persona (`conformance-*.test.ts`), pour que vitest les
 * joue en même temps.
 */
import { describe, expect, it } from 'vitest'
import { environment } from './harness'
import { agentConsistent, durableMatchesLive, noDuplicates, nothingRunning } from './invariants'
import { JOURNEYS } from './journeys'
import { PERSONAS, type PersonaId } from './personas'

export function conformanceGrid(personaId: PersonaId): void {
  const persona = PERSONAS[personaId]
  describe.concurrent(`grille de conformité — ${persona.label} (${persona.shape})`, () => {
    for (const journey of JOURNEYS) {
      it(journey.label, { timeout: 20_000 }, async () => {
        const env = environment(persona, { delayMs: journey.delayMs ?? 0 })
        const { app, id, issues, status } = await journey.run(env)
        try {
          await app.idle(id, persona.settleMs)
          const view = app.view(id)
          const live = {
            running: nothingRunning(view.transcript.items),
            duplicates: noDuplicates(view.transcript.items, app.sent.get(id) ?? 0),
            agent: agentConsistent(view, status)
          }
          // Arrêt de l'app : le fil en attente est écrit, puis relu comme au lancement.
          app.manager.stopAll()
          await app.manager.settled()
          const durable = durableMatchesLive(app.view(id).transcript, env.durable(id))
          expect({ journey: issues, ...live, durable }).toEqual({
            journey: [],
            running: [],
            duplicates: [],
            agent: [],
            durable: []
          })
        } finally {
          app.manager.stopAll()
        }
      })
    }
  })
}
