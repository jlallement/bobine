/**
 * Étiquette de la synthèse après un modèle refusé (testeur de la fiche 292, T10) : la demande est
 * refusée sur le modèle de la conversation, l'utilisateur en choisit un autre, le message repart
 * (`resent`) ; l'étiquette « Synthèse du tour de table · <modèle> » dit le modèle qui a répondu.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { FAST, PRECISE, roundtableEnv, type RoundtableEnv } from './test-env'

const envs: RoundtableEnv[] = []
afterEach(() => {
  for (const env of envs.splice(0)) env.stop()
})

describe('synthèse repartie sur un autre modèle', () => {
  it('l’étiquette dit le modèle qui a répondu, pas celui qui a été refusé', async () => {
    const env = await roundtableEnv({
      lead: 'connexion-expiree-modele',
      leadProfile: { authAtTurn: { pattern: /authentication required/i } }
    })
    envs.push(env)
    const mother = env.manager.state().activeId
    await env.manager.startActive()
    await env.roundtables.start(mother, {
      question: 'Quelle piste pour la moyenne de calc.js ?',
      participants: [FAST, PRECISE]
    })
    const summary = () => env.manager.state().conversations.find((c) => c.id === mother)
    await env.waitFor(() => summary()?.status === 'needs-action', 'synthèse refusée (connexion)')
    const refused = env.rt(mother).synthesis?.by?.model
    await env.manager.setControl(mother, 'model', 'factice-precis')
    await env.waitFor(() => env.rt(mother).synthesis?.state === 'answered', 'synthèse rendue')
    const by = env.rt(mother).synthesis?.by?.model
    expect(by).toBeDefined()
    expect(by).not.toBe(refused)
    expect(by).toBe('Factice précis')
  }, 30_000)
})
