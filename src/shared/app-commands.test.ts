import { describe, expect, it } from 'vitest'
import type { SessionControl } from './agent'
import {
  appCommandOf,
  contextReport,
  costReport,
  mergeCommands,
  pickOption,
  usageSummary,
  withCompactCommand
} from './app-commands'

const AGENT = [{ name: 'review', description: 'Revue façon agent' }]

describe('commandes de l’app', () => {
  it('fusionnées avec celles de l’agent ; l’agent gagne à nom égal', () => {
    const merged = mergeCommands(AGENT)
    expect(merged.filter((c) => c.name === 'review')).toEqual([AGENT[0]])
    expect(merged.find((c) => c.name === 'clear')?.source).toBe('app')
  })

  it('commandes d’OpenCode 2.2.5 (relevé de la sonde, fiche 172) : `goal` passe telle quelle', () => {
    // Annoncées à `session/new`, dans cet ordre, sans `input`.
    const opencode = [
      { name: 'init', description: 'guided AGENTS.md setup' },
      { name: 'review', description: 'review changes [commit|branch|pr], defaults to uncommitted' },
      { name: 'goal', description: 'keep working until an objective is met [pause|resume|clear]' },
      { name: 'compact', description: 'Compact the session' }
    ]
    const merged = mergeCommands(
      withCompactCommand(opencode, '/compact', 'OpenCode'),
      [],
      '/compact'
    )
    expect(merged.slice(0, 4)).toEqual(opencode)
    expect(merged.filter((c) => c.name === 'goal')).toHaveLength(1)
    // Celles de l’app qu’OpenCode n’a pas restent proposées ; aucune n’est en double.
    expect(merged.find((c) => c.name === 'clear')?.source).toBe('app')
    expect(new Set(merged.map((c) => c.name)).size).toBe(merged.length)
    // `/goal …` part à l’agent tel quel : ce n’est pas une commande de l’app.
    expect(appCommandOf('/goal finir la fiche 172', opencode)).toBeUndefined()
  })

  it('saisie reconnue avec ses arguments, sauf si l’agent a la même commande', () => {
    expect(appCommandOf('/model  sonnet 4 ', AGENT)).toEqual({ name: 'model', args: 'sonnet 4' })
    expect(appCommandOf('/clear', AGENT)).toEqual({ name: 'clear', args: '' })
    expect(appCommandOf('/review', AGENT)).toBeUndefined()
    expect(appCommandOf('/inconnue', AGENT)).toBeUndefined()
    expect(appCommandOf('bonjour /clear', AGENT)).toBeUndefined()
  })

  it('bilan de consommation lisible, ou rien à dire', () => {
    expect(
      usageSummary(
        {
          context: { used: 12_000, size: 200_000 },
          tokens: {
            input: 9000,
            output: 3000,
            cachedRead: 0,
            cachedWrite: 0,
            thought: 0,
            total: 12_000,
            turns: 2
          },
          cost: { amount: 0.0632, currency: 'bobcoins' }
        },
        'Bob'
      ).split('\n')
    ).toEqual([
      expect.stringMatching(/^Contexte\u00a0: 12.* \/ 200.* jetons \(6\u00a0%\)$/),
      expect.stringMatching(/^Jetons traités\u00a0: 12.* sur 2 échanges/),
      expect.stringMatching(/^Coût\u00a0: .*0,0632.*Bobcoins/)
    ])
    expect(usageSummary(undefined, 'Bob')).toContain('Bob n’a encore rien indiqué')
  })

  it('/context : le remplissage, ou ce que l’agent ne dit pas (fiche 126)', () => {
    expect(contextReport({ context: { used: 12_000, size: 200_000 } }, 'Bob')).toMatch(
      /^Contexte\u00a0: 12.* \/ 200.* jetons \(6\u00a0%\)$/
    )
    const unknown = contextReport({ cost: { amount: 2, currency: 'bobcoins' } }, 'Bob', '/compress')
    expect(unknown).toContain('Bob ne transmet pas le remplissage de son contexte')
    expect(unknown).toContain('/compress')
    expect(unknown).not.toContain('Coût')
  })

  it('/cost : jetons traités et coût, sans le contexte (fiche 126)', () => {
    const report = costReport(
      {
        context: { used: 12_000, size: 200_000 },
        tokens: {
          input: 9000,
          output: 3000,
          cachedRead: 0,
          cachedWrite: 0,
          thought: 0,
          total: 15_000,
          turns: 2
        },
        cost: { amount: 0.0632, currency: 'bobcoins' }
      },
      'Bob'
    ).split('\n')
    expect(report).toEqual([
      expect.stringMatching(/^Jetons traités\u00a0: 15.* sur 2 échanges/),
      expect.stringMatching(/^Coût\u00a0: .*0,0632.*Bobcoins/)
    ])
    expect(costReport(undefined, 'Bob')).toContain('Bob n’a encore rien indiqué')
  })

  it('commande de compaction de l’agent dans la liste, à la place de /compact (fiche 126)', () => {
    const withCompress = withCompactCommand([], '/compress', 'Bob')
    expect(withCompress).toEqual([
      { name: 'compress', description: expect.stringContaining('/compact') }
    ])
    const names = mergeCommands(withCompress, [], '/compress').map((c) => c.name)
    expect(names).toContain('compress')
    expect(names).not.toContain('compact')
    // Même nom que la commande de l'app, ou déjà annoncée : rien à ajouter.
    expect(withCompactCommand([], '/compact', 'X')).toEqual([])
    expect(withCompactCommand(AGENT, undefined, 'X')).toBe(AGENT)
    expect(mergeCommands([]).map((c) => c.name)).toContain('compact')
  })

  it('option choisie par son nom, exact ou unique', () => {
    const control: SessionControl = {
      id: 'model',
      name: 'Modèle',
      category: 'model',
      type: 'select',
      currentValue: 'a',
      options: [
        { value: 'claude-sonnet', name: 'Claude Sonnet' },
        { value: 'claude-opus', name: 'Claude Opus' },
        { value: 'gpt', name: 'GPT' }
      ]
    }
    expect(pickOption(control, 'gpt')?.value).toBe('gpt')
    expect(pickOption(control, 'opus')?.value).toBe('claude-opus')
    expect(pickOption(control, 'claude')).toBeUndefined()
  })
})
