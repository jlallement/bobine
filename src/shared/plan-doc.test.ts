import { describe, expect, it } from 'vitest'
import type { TranscriptItem } from './transcript'
import { executionMode, isPlanMode, planExecution, planFeedback, planVersions } from './plan-doc'

const PLAN = 'plan'
let next = 1
const user = (text: string, mode = PLAN): TranscriptItem => ({
  kind: 'user',
  id: next++,
  text,
  mode: { id: mode, name: mode === PLAN ? 'Plan' : 'Agent' }
})
const agent = (text: string): TranscriptItem => ({ kind: 'agent', id: next++, text })
const write = (path: string, newText: string, status: 'completed' | 'failed' = 'completed') =>
  ({
    kind: 'tool',
    id: next++,
    toolCallId: `t${next}`,
    title: `Writing file ${path}`,
    toolKind: 'edit',
    status,
    content: [{ type: 'diff', path, oldText: null, newText }],
    locations: []
  }) as TranscriptItem
const long = (label: string) => `## ${label}\n\n${'Étape détaillée du plan. '.repeat(12)}`

describe('planVersions', () => {
  it('Bob : fichier Markdown écrit en mode plan, versions successives du même fichier', () => {
    const items = [
      user('Propose un plan'),
      agent('Je regarde le projet.'),
      write('/p/goodbye-plan.md', '# Plan v1'),
      agent('Le plan est dans goodbye-plan.md. Des questions ?'),
      user('Remarques…'),
      write('/p/goodbye-plan.md', '# Plan v2'),
      agent(long('Plan complet'))
    ]
    const plans = planVersions(items)
    expect(plans.map((p) => [p.source, p.version, p.text, p.latest])).toEqual([
      ['file', 1, '# Plan v1', false],
      ['file', 2, '# Plan v2', true]
    ])
    expect(plans[1]?.previous).toBe('# Plan v1')
    // Carte à la fin du tour, la réponse reste affichée.
    expect(plans[0]?.anchorId).toBe(items[3]?.id)
    expect(plans[0]?.replyIds).toEqual([])
  })

  it('OpenCode : plan dans la réponse après le dernier outil ; trop court ou hors mode plan : rien', () => {
    const reply = agent(long('Plan proposé'))
    const items = [
      user('Propose un plan'),
      agent('Voici le contexte.'),
      { ...write('/p/src/a.js', 'lu'), toolKind: 'read' as const },
      reply,
      user('Et ça ?'),
      agent('Oui.'),
      user('Fais-le', 'agent'),
      agent(long('Pas un plan : mode agent'))
    ]
    const plans = planVersions(items)
    expect(plans).toHaveLength(1)
    expect(plans[0]).toMatchObject({ source: 'reply', anchorId: reply.id, replyIds: [reply.id] })
    expect(plans[0]?.text.startsWith('## Plan proposé')).toBe(true)
  })

  it('écriture refusée : pas un plan de fichier', () => {
    const plans = planVersions([
      user('Plan'),
      write('/p/plan.md', '# x', 'failed'),
      agent('Refusé.')
    ])
    expect(plans).toEqual([])
  })
})

describe('remarques et exécution', () => {
  it('message de remarques : passages cités, demande de mise à jour en restant en mode plan', () => {
    const text = planFeedback(
      [
        { quote: 'Créer un  test\nnatif', comment: 'Utilise vitest.' },
        { quote: 'README', comment: 'Ajoute un exemple.' }
      ],
      '/p/goodbye-plan.md'
    )
    expect(text).toContain('Remarques sur le plan (goodbye-plan.md)')
    expect(text).toContain('1. Passage : « Créer un test natif »\n   Remarque : Utilise vitest.')
    expect(text).toContain('Mets à jour le plan dans goodbye-plan.md')
    expect(text).toContain('Reste en mode plan')
    expect(planExecution('/p/goodbye-plan.md')).toBe('Exécute le plan de goodbye-plan.md.')
  })

  it('mode d’exécution : celui d’avant le plan, sinon ni plan ni ask', () => {
    const options = [
      { value: 'agent', name: 'Agent' },
      { value: 'plan', name: 'Plan' },
      { value: 'ask', name: 'Ask' }
    ]
    expect(executionMode([user('x', 'plan')], options)).toBe('agent')
    expect(executionMode([user('x', 'ask'), user('y', 'plan')], options)).toBe('ask')
    expect(
      executionMode(
        [user('x', 'plan')],
        [
          { value: 'plan', name: 'plan' },
          { value: 'build', name: 'build' }
        ]
      )
    ).toBe('build')
    expect(isPlanMode({ id: 'default', name: 'Default' })).toBe(false)
    expect(isPlanMode({ id: 'plan', name: 'Plan' })).toBe(true)
  })
})
