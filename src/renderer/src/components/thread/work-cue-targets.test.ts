import { describe, expect, it } from 'vitest'
import type { ConversationSummary } from '@shared/agent'
import type { TranscriptItem } from '@shared/transcript'
import { delegatedWorkTargets } from './work-cue-targets'

type Child = Pick<ConversationSummary, 'id' | 'status' | 'turnStopped'>
const child = (id: string, status: ConversationSummary['status']): Child => ({ id, status })
const role = { name: 'ux', label: 'Expert UX/UI', icon: 'palette', color: 'violet' as const }

const items: TranscriptItem[] = [
  { kind: 'user', id: 1, text: 'Demande' },
  {
    kind: 'child-started',
    id: 2,
    childId: 'c-ux',
    title: 'Direction visuelle',
    prompt: 'Propose une direction',
    at: 1,
    role
  },
  {
    kind: 'child-started',
    id: 3,
    childId: 'c-front',
    title: 'Bouton vider',
    prompt: 'Ajoute',
    at: 2
  }
]

describe('cibles du repère : le travail délégué d’aujourd’hui (fiche 261)', () => {
  it('un rôle : son nom ; sans rôle : le titre ; carte de lancement sans compte rendu', () => {
    const targets = delegatedWorkTargets(
      items,
      [child('c-ux', 'busy'), child('c-front', 'busy')],
      {}
    )
    expect(targets).toEqual([
      { key: 'c-ux', itemId: 2, label: 'Expert UX/UI', role, state: 'working' },
      { key: 'c-front', itemId: 3, label: 'Bouton vider', state: 'working' }
    ])
  })

  it('compte rendu : la carte est le plus récent ; un rôle « a répondu », une autre fille « a fini »', () => {
    const report = (id: number, childId: string): TranscriptItem =>
      ({
        kind: 'child-report',
        id,
        childId,
        title: 't',
        outcome: 'done',
        fileCount: 0,
        added: 0,
        removed: 0
      }) as TranscriptItem
    const withReports = [...items, report(4, 'c-ux'), report(5, 'c-front'), report(6, 'c-ux')]
    const targets = delegatedWorkTargets(
      withReports,
      [child('c-ux', 'ready'), child('c-front', 'ready')],
      { 'c-front': 'done' }
    )
    expect(targets.map((t) => [t.key, t.itemId, t.state])).toEqual([
      ['c-ux', 6, 'replied'],
      ['c-front', 5, 'finished']
    ])
  })

  it('en attente de l’utilisateur : travaille encore ; en erreur : rien à dire', () => {
    const targets = delegatedWorkTargets(
      items,
      [child('c-ux', 'needs-action'), child('c-front', 'error')],
      {}
    )
    expect(targets.map((t) => t.state)).toEqual(['working', 'idle'])
  })

  it('fille sans carte dans ce fil : pas de cible', () => {
    expect(delegatedWorkTargets(items, [child('autre', 'busy')], {})).toEqual([])
  })
})
