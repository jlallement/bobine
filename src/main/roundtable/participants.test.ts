import { describe, expect, it } from 'vitest'
import type { RequestPermissionRequest } from '../../shared/acp-sdk.mts'
import type { TranscriptItem } from '@shared/transcript'
import { automaticAnswer } from '../agent/permission-answers'
import { roleToolModules } from '../conversations/host-options'
import type { AppToolModule } from '../mcp/tools'
import { roundtableChildIds } from './participants'

const tour = (childIds: string[]): TranscriptItem =>
  ({
    kind: 'roundtable',
    id: 2,
    roundtableId: 'rt',
    question: 'Q',
    synthesizer: { profileId: 'p', label: 'P' },
    seats: childIds.map((childId, i) => ({
      profileId: 'p',
      label: 'P',
      agentLabel: 'P',
      letter: (['A', 'B', 'C'] as const)[i],
      childId,
      state: 'answered'
    })),
    phase: 'collecting',
    at: 1
  }) as TranscriptItem

const started = (childId: string, id: number, card?: string): TranscriptItem => ({
  kind: 'child-started',
  id,
  childId,
  title: childId,
  prompt: 'consigne',
  ...(card ? { card } : {}),
  at: id
})

describe('participants d’un tour de table (fiche 285, décision 4)', () => {
  it('reconnus par leur place, ou par la clé de carte du tour avant que la place ne les nomme', () => {
    const items = [
      started('fille', 1),
      tour(['a']),
      started('a', 3, 'rt'),
      started('b', 4, 'rt'),
      started('proposee', 5, 'autre-carte')
    ]
    expect([...roundtableChildIds(items)].sort()).toEqual(['a', 'b'])
    expect(roundtableChildIds([started('fille', 1, 'rt')]).size).toBe(0)
  })

  it('un rôle personnel nommé « participant » garde ses outils (le tour de table se reconnaît à sa fiche)', () => {
    const modules = ['children', 'ask-user', 'memory', 'terminal'].map(
      (id) => ({ id }) as AppToolModule
    )
    const stamp = { name: 'participant', label: 'P', icon: 'users', color: 'graphite' as const }
    expect(
      roleToolModules(modules, { ...stamp, readOnly: true, mcp: ['memory'] })?.map((m) => m.id)
    ).toEqual(['children', 'ask-user', 'memory'])
  })

  it('participant d’un tour de table : les commandes aussi sont refusées d’office', () => {
    const request: RequestPermissionRequest = {
      sessionId: 's',
      toolCall: { toolCallId: 't', title: 'npm test', kind: 'execute' },
      options: [
        { optionId: 'yes', name: 'Allow', kind: 'allow_once' },
        { optionId: 'no', name: 'Reject', kind: 'reject_once' }
      ]
    }
    const rules = { autoAllowed: () => false, place: { workspace: '/p', home: '/h' } }
    expect(automaticAnswer(request, { ...rules, readOnly: 'participant' })).toEqual({
      outcome: { outcome: 'selected', optionId: 'no' }
    })
    // Un rôle de conseil ordinaire : la commande est demandée à l'utilisateur.
    expect(automaticAnswer(request, { ...rules, readOnly: true })).toBeUndefined()
  })

  it('lecture seule : écrire, supprimer, déplacer, changer de mode sont refusés d’office', () => {
    for (const kind of ['edit', 'delete', 'move', 'switch_mode'] as const) {
      const request: RequestPermissionRequest = {
        sessionId: 's',
        toolCall: { toolCallId: 't', title: kind, kind },
        options: [
          { optionId: 'yes', name: 'Allow', kind: 'allow_once' },
          { optionId: 'no', name: 'Reject', kind: 'reject_once' }
        ]
      }
      const answer = automaticAnswer(request, {
        autoAllowed: () => true,
        place: { workspace: '/projet', home: '/maison' },
        readOnly: true
      })
      expect([kind, answer]).toEqual([kind, { outcome: { outcome: 'selected', optionId: 'no' } }])
    }
  })
})
