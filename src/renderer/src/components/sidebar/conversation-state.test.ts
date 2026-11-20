/**
 * État d'une conversation dans la barre latérale : bloquée par un modèle refusé (fiche 267) — une
 * alerte « quota épuisé » ou « modèle refusé », pas la main d'un accord à donner.
 */
import { describe, expect, it } from 'vitest'
import type { ConversationSummary } from '@shared/agent'
import { conversationState } from './conversation-state'

const conversation = (extra: Partial<ConversationSummary> = {}): ConversationSummary => ({
  id: 'f',
  title: 'Relis le stockage.',
  profileId: 'mock',
  profileLabel: 'Agent factice',
  workspace: '/tmp/projet',
  updatedAt: '2026-11-20T10:00:00.000Z',
  status: 'needs-action',
  draft: false,
  startedFrom: { id: 'm', title: 'Mère' },
  ...extra
})

describe('barre latérale : travail bloqué par un modèle refusé (fiche 267)', () => {
  it('quota épuisé, modèle refusé : l’état bloqué, même avec une demande en attente', () => {
    expect(
      conversationState(
        conversation({ modelRefused: { name: 'F', quota: true } }),
        'request',
        undefined
      )
    ).toEqual({ state: 'waiting', label: 'quota épuisé', reason: 'blocked' })
    expect(
      conversationState(conversation({ modelRefused: { name: 'F' } }), undefined, undefined)
    ).toMatchObject({ label: 'modèle refusé', reason: 'blocked' })
  })

  it('le refus levé (de nouveau au travail) : l’état ordinaire', () => {
    const state = conversationState(
      conversation({ status: 'busy', modelRefused: { name: 'F' } }),
      undefined,
      undefined
    )
    expect(state?.state).toBe('running')
    expect(state?.reason).toBeUndefined()
  })
})
