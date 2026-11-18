import { describe, expect, it } from 'vitest'
import { methods, type SessionUpdate } from '../shared/acp-sdk.mts'
import { initialize, withMockAgent } from './testing.mts'

/**
 * Forme réelle de la consommation et des modèles d'OpenCode 2.3.0 (recette du 2026-11-17,
 * fiche 245) : ce que rejoue l'agent factice.
 */

const CWD = '/tmp/projet'

/** Un tour : ses mises à jour et la réponse à `session/prompt` (jetons du tour). */
async function turnOf(scenario: string) {
  return withMockAgent({ scenario, args: ['--delay', '0'] }, async (ctx) => {
    await initialize(ctx)
    return ctx.buildSession(CWD).withSession(async (session) => {
      const response = session.prompt('Exécute ce plan.')
      const updates: SessionUpdate[] = []
      for (;;) {
        const message = await session.nextUpdate()
        if (message.kind === 'stop') break
        updates.push(message.update)
      }
      return { updates, response: await response }
    })
  })
}

describe('consommation comme OpenCode 2.3.0 (fiche 245)', () => {
  it('jetons du tour : entrée hors cache, cache et réflexion à part, total = leur somme', async () => {
    const { response } = await turnOf('jetons-opencode')
    expect(response.usage).toEqual({
      inputTokens: 28_149,
      outputTokens: 6_906,
      cachedReadTokens: 96_384,
      thoughtTokens: 447,
      totalTokens: 131_886
    })
    const u = response.usage
    expect(
      (u?.inputTokens ?? 0) +
        (u?.outputTokens ?? 0) +
        (u?.cachedReadTokens ?? 0) +
        (u?.thoughtTokens ?? 0)
    ).toBe(u?.totalTokens)
  })

  it('coût en dollars annoncé par usage_update, avec le remplissage du contexte', async () => {
    const { updates } = await turnOf('jetons-opencode')
    expect(updates.filter((u) => u.sessionUpdate === 'usage_update')).toEqual([
      {
        sessionUpdate: 'usage_update',
        used: 19_711,
        size: 1_050_000,
        cost: { amount: 0.007455, currency: 'USD' }
      }
    ])
  })

  it('fille : coût annoncé, mais nul', async () => {
    const { updates } = await turnOf('jetons-opencode-fille')
    expect(updates.find((u) => u.sessionUpdate === 'usage_update')).toMatchObject({
      used: 7_377,
      size: 400_000,
      cost: { amount: 0, currency: 'USD' }
    })
  })

  it('session neuve : un autre modèle courant, liste plate « fournisseur/Nom »', async () => {
    const opened = await withMockAgent(
      { scenario: 'essai-autre-modele', args: ['--delay', '0'] },
      async (ctx) => {
        await initialize(ctx)
        return ctx.request(methods.agent.session.new, { cwd: CWD, mcpServers: [] })
      }
    )
    const model = opened.configOptions?.find((o) => o.category === 'model')
    expect(model).toMatchObject({
      type: 'select',
      currentValue: 'opencode/hy4-flash-free',
      options: [
        { value: 'openai/gpt-6.2-astra', name: 'openai/GPT-6.2 Astra' },
        { value: 'openai/gpt-6-luna', name: 'openai/GPT-6 Luna' },
        { value: 'opencode/hy4-flash-free', name: 'opencode/Hy4 flash Free' }
      ]
    })
  })
})
