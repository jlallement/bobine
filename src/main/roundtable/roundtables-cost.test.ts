/**
 * Pied « Consommé » d'un tour de bout en bout (recette de la 1.2.0-beta.1, G-B1) : modèles
 * gratuits à 0 $ → « gratuit » ; arbitre en Bobcoins → « gratuit + … Bobcoins » ; 0 $ d'un modèle
 * qui ne se dit pas gratuit → « coût inconnu ». Le total est celui de la carte : la conversation de
 * chaque participant (son résumé), puis la synthèse ; chaque unité dite par `costText`, comme le
 * pied (`totalText` du renderer, essayé à part).
 */
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { roundtableTotal } from '@shared/roundtable'
import { costText } from '@shared/usage'
import { bobDbCosts } from '../agent/bob-costs'
import { choice, roundtableEnv, type EnvOptions, type RoundtableEnv } from './test-env'

const envs: RoundtableEnv[] = []
afterEach(() => {
  for (const env of envs.splice(0)) env.stop()
})

const FREE_MODELS = { MOCK_MODELS: 'fx-free=opencode/Fx Free,fy-free=opencode/Fy Free' }
const QUESTION = 'Quelle piste pour la moyenne de calc.js ?'

async function run(options: EnvOptions, motherModel: string | undefined, panel: string[]) {
  const env = await roundtableEnv({
    ...options,
    profiles: (mock) => [
      mock('gratuit', 'avis-participant', ['--cout-nul'], { env: FREE_MODELS }),
      mock('payant', 'avis-participant', ['--cout-nul'])
    ]
  })
  envs.push(env)
  const mother = env.manager.state().activeId
  await env.manager.startActive()
  // Toute la conversation sur un modèle gratuit, comme une conversation OpenCode sur Tidepool.
  if (motherModel) await env.manager.setControl(mother, 'model', motherModel)
  await env.manager.prompt(mother, 'Quelle moyenne pour calc.js ?')
  const participants = panel.map((p) => {
    const [profileId = '', model] = p.split(':')
    return choice(profileId, model)
  })
  await env.roundtables.start(mother, { question: QUESTION, participants })
  await env.waitFor(() => env.rt(mother).phase === 'synthesized', 'synthèse rendue')
  const footer = () => {
    const rt = env.rt(mother)
    const summary = (id?: string) => env.manager.state().conversations.find((c) => c.id === id)
    return roundtableTotal(
      rt.seats.map((s) => summary(s.childId)?.usage),
      [rt.synthesis?.usage, rt.verdict?.usage]
    )
  }
  return { env, mother, footer }
}

/** Les coûts du pied, comme `totalText` les écrit. */
const costsText = (total: ReturnType<typeof roundtableTotal>) =>
  total.costs.map((c) => costText(c, c.free === true)).join(' + ')

describe('pied « Consommé » de bout en bout (G-B1)', () => {
  it('arbitre et participants gratuits à 0 $ : « gratuit »', async () => {
    const { footer } = await run(
      { leadArgs: ['--cout-nul'], leadProfile: { env: FREE_MODELS } },
      'fx-free',
      ['gratuit:fx-free', 'gratuit:fy-free']
    )
    const total = footer()
    expect(total.costs).toEqual([{ amount: 0, currency: 'USD', free: true }])
    expect(costsText(total)).toBe('gratuit')
  })

  it('arbitre en Bobcoins, participants gratuits : « gratuit + … Bobcoins »', async () => {
    const bobDb = join(mkdtempSync(join(tmpdir(), 'tour-bob-')), 'bob.db')
    const { env, mother, footer } = await run(
      {
        leadArgs: ['--bob-db', bobDb, '--cout-bob'],
        leadProfile: { costSource: bobDbCosts(bobDb) }
      },
      undefined,
      ['gratuit:fx-free', 'gratuit:fy-free']
    )
    await env.waitFor(
      () => env.rt(mother).synthesis?.usage?.cost?.amount === 0.0125,
      'coût de la synthèse relu',
      15_000
    )
    const text = costsText(footer())
    expect(text).toMatch(/^gratuit \+ .*Bobcoins$/)
  }, 30_000)

  it('un participant à 0 $ dont le modèle ne se dit pas gratuit : « coût inconnu »', async () => {
    const { footer } = await run(
      { leadArgs: ['--cout-nul'], leadProfile: { env: FREE_MODELS } },
      'fx-free',
      ['gratuit:fx-free', 'payant:factice-rapide']
    )
    const total = footer()
    expect(total.costs).toEqual([{ amount: 0, currency: 'USD' }])
    expect(costsText(total)).toBe('coût inconnu')
  })
})
