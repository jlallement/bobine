import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { methods } from '../shared/acp-sdk.mts'
import { SHOWCASE_PROJECT } from './scenarios-vitrine.mts'
import { agentText, initialize, playTurn, withMockAgent, type MockAgentRun } from './testing.mts'

/** Projet de démonstration écrit dans un dossier jetable. */
function demoProject(lang: 'fr' | 'en'): string {
  const dir = mkdtempSync(join(tmpdir(), 'vitrine-demo-'))
  for (const [path, content] of Object.entries(SHOWCASE_PROJECT[lang])) {
    writeFileSync(join(dir, path), content)
  }
  return dir
}

function turn(lang: 'fr' | 'en', prompt: string, run: Partial<MockAgentRun> = {}, dir = '/tmp/x') {
  return withMockAgent(
    { scenario: 'vitrine', args: ['--vitrine', '--langue', lang], ...run },
    async (ctx) => {
      await initialize(ctx)
      return ctx.buildSession(dir).withSession((session) => playTurn(session, prompt))
    }
  )
}

/** Tout le texte d'un tour (messages, titres et sorties d'outils) : rien ne doit trahir l'essai. */
const everything = (updates: unknown[]) => JSON.stringify(updates)

describe('vitrine (fiche 225)', () => {
  it('--vitrine : « Demo agent » et modèles « Demo … », sans « factice » ni « mock » affichés', async () => {
    const [info, session] = await withMockAgent(
      { scenario: 'vitrine', args: ['--vitrine', '--langue', 'en'] },
      async (ctx) => [
        await initialize(ctx),
        await ctx.request(methods.agent.session.new, { cwd: '/tmp/x', mcpServers: [] })
      ]
    )
    expect(info.agentInfo?.title).toBe('Demo agent')
    // Les noms affichés (les identifiants des modèles ne sont pas montrés).
    const names = JSON.stringify(session.configOptions, (key, value: unknown) =>
      key === 'value' || key === 'currentValue' ? undefined : value
    )
    expect(names).toContain('Demo fast')
    expect(names).not.toMatch(/factice|mock/i)
  })

  it.each(['en', 'fr'] as const)(
    '%s : test qui échoue, correction autorisée avec son diff, fichier corrigé, tests verts',
    async (lang) => {
      const dir = demoProject(lang)
      const file = lang === 'en' ? 'cart.py' : 'panier.py'
      const asked: string[] = []
      const result = await turn(
        lang,
        lang === 'en' ? 'The discount test fails. Can you fix it?' : 'Le test échoue',
        {
          onPermission: (req) => {
            asked.push(...req.options.map((o) => o.optionId))
            return { outcome: { outcome: 'selected', optionId: 'allow' } }
          }
        },
        dir
      )
      expect(asked).toEqual(['allow', 'allow_always', 'reject'])
      expect(readFileSync(join(dir, file), 'utf8')).toContain('>= ')
      expect(agentText(result.updates)).toContain(
        lang === 'en' ? 'All 5 tests pass.' : 'Les 5 tests passent.'
      )
      expect(everything(result.updates)).not.toMatch(/factice|mock|\/scenario/i)
    }
  )

  it('consigne d’un rôle : compte rendu de l’expert sécurité ou du relecteur', async () => {
    const security = await turn(
      'en',
      'You are an application security expert doing an audit.\n\nreview the cart'
    )
    expect(agentText(security.updates)).toContain('Security review of the cart')
    const review = await turn(
      'fr',
      'Tu es un relecteur de code attentif.\n\nrelisez le panier avant la mise en ligne'
    )
    expect(agentText(review.updates)).toContain('Relecture')
  })

  it('« export » : question à choix avant d’agir, la réponse est reprise', async () => {
    const result = await turn('en', 'Add an export of the orders', {
      onElicitation: (req) => {
        expect(JSON.stringify(req)).toContain('Which format')
        return { action: 'accept', content: { question_0: 'CSV' } }
      }
    })
    expect(agentText(result.updates)).toContain('CSV it is')
  })
})
