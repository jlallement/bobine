import { describe, expect, it } from 'vitest'
import { methods, type SessionUpdate } from '../shared/acp-sdk.mts'
import { mockLanguage, say, sayAll } from './langue.mts'
import { agentText, initialize, playTurn, withMockAgent, type MockAgentRun } from './testing.mts'

const CWD = '/tmp/projet'
const EN = ['--langue', 'en']

function runScenario(run: MockAgentRun, prompt = 'Bonjour') {
  return withMockAgent(run, async (ctx) => {
    await initialize(ctx)
    return ctx.buildSession(CWD).withSession((session) => playTurn(session, prompt))
  })
}

const titles = (updates: SessionUpdate[]) =>
  updates.flatMap((u) => (u.sessionUpdate === 'tool_call' ? [u.title] : []))

describe('langue de l’agent factice (fiche 167)', () => {
  it('anglais pour en, en-US… ; français sinon', () => {
    expect(mockLanguage('en')).toBe('en')
    expect(mockLanguage('en-US')).toBe('en')
    expect(mockLanguage('fr')).toBe('fr')
    expect(mockLanguage(undefined)).toBe('fr')
    expect(mockLanguage('de')).toBe('fr')
  })

  it('les mots courts ne changent que seuls, les phrases aussi au milieu d’un texte', () => {
    expect(say('Refuser', 'en')).toBe('Reject')
    expect(say('Refuser ce fichier', 'en')).toBe('Refuser ce fichier')
    expect(say('Je réfléchis longuement… '.repeat(3), 'en')).toBe(
      'Thinking it over at length… '.repeat(3)
    )
    expect(say('\n\nTerminé. Tapez `/scenario` pour voir les autres scénarios.', 'en')).toBe(
      '\n\nDone. Type `/scenario` to see the other scenarios.'
    )
    expect(say('Phrase inconnue du dictionnaire', 'en')).toBe('Phrase inconnue du dictionnaire')
    expect(say('Refuser', 'fr')).toBe('Refuser')
  })

  it('sayAll : les textes d’une valeur, sans toucher aux identifiants ni au reste', () => {
    const option = { optionId: 'reject', name: 'Refuser', kind: 'reject_once', n: 2, ok: true }
    expect(sayAll([option], 'en')).toEqual([{ ...option, name: 'Reject' }])
    expect(sayAll([option], 'fr')[0]).toBe(option)
  })

  it('français par défaut : nom, modes, réglages', async () => {
    await withMockAgent({ scenario: 'demo' }, async (ctx) => {
      expect((await initialize(ctx)).agentInfo?.title).toBe('Agent factice')
      const session = await ctx.buildSession(CWD).start()
      expect(session.modes?.availableModes.map((m) => m.name)).toEqual(['Code', 'Question', 'Plan'])
      session.dispose()
    })
  })

  it('--langue en : nom, modes, options et modèles, commandes en anglais', async () => {
    await withMockAgent({ scenario: 'demo', args: EN }, async (ctx) => {
      expect((await initialize(ctx)).agentInfo?.title).toBe('Mock agent')
      const session = await ctx.request(methods.agent.session.new, { cwd: CWD, mcpServers: [] })
      expect(session.modes?.availableModes.map((m) => m.name)).toEqual(['Code', 'Ask', 'Plan'])
      expect(session.modes?.currentModeId).toBe('code')
      const json = JSON.stringify(session.configOptions)
      expect(json).toContain('"Model"')
      expect(json).toContain('"Mock fast"')
      expect(json).toContain('"Detailed answers"')
      expect(json).toContain('"factice-rapide"')
    })
  })

  it('--langue en : permission (libellés, outil) et réponse en anglais', async () => {
    const names: string[] = []
    const turn = await runScenario({
      scenario: 'permission',
      args: EN,
      onPermission: (req) => {
        names.push(req.toolCall.title ?? '', ...req.options.map((o) => o.name))
        return { outcome: { outcome: 'selected', optionId: 'allow' } }
      }
    })
    expect(names).toEqual(['Editing config.json', 'Allow', 'Always allow', 'Reject'])
    expect(titles(turn.updates)).toEqual(['Editing config.json'])
    expect(agentText(turn.updates)).toBe(
      'I need to change the configuration. Configuration updated.'
    )
  })

  it('--langue en : l’écho décrit réglages et blocs en anglais', async () => {
    const turn = await runScenario({ scenario: 'echo', args: EN }, 'Hello')
    const text = agentText(turn.updates)
    expect(text).toContain('Mode: code · Model: factice-rapide · Detailed: no')
    expect(text).toContain('I received 1 block(s):')
    expect(text).toContain('- text: “Hello”')
  })
})
