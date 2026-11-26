import { describe, expect, it } from 'vitest'
import type { ConversationSummary } from '@shared/agent'
import { inTurn, turnInFolder } from './folder-turn'

const conversation = (patch: Partial<ConversationSummary>): ConversationSummary => ({
  id: 'c',
  title: 'C',
  profileId: 'mock',
  profileLabel: 'Factice',
  workspace: '/repo',
  updatedAt: '2026-11-26T10:00:00.000Z',
  status: 'ready',
  draft: false,
  ...patch
})

describe('tour en cours dans un dossier (fiche 287)', () => {
  it('au travail, au démarrage ou en attente d’un accord ; pas finie, arrêtée ni en erreur', () => {
    expect(inTurn(conversation({ status: 'busy' }))).toBe(true)
    expect(inTurn(conversation({ status: 'starting' }))).toBe(true)
    expect(inTurn(conversation({ status: 'needs-action' }))).toBe(true)
    expect(inTurn(conversation({ status: 'ready' }), { c: 'request' })).toBe(true)
    expect(inTurn(conversation({ status: 'ready' }))).toBe(false)
    expect(inTurn(conversation({ status: 'stopped' }))).toBe(false)
    expect(inTurn(conversation({ status: 'error' }))).toBe(false)
  })

  it('dans le dossier principal ou un sous-dossier ; ni worktree, ni archivée, ni ailleurs', () => {
    const list = [
      conversation({ id: 'w', status: 'busy', workspace: '/repo/.wt/x', branch: 'bobine/x' }),
      conversation({ id: 'a', status: 'busy', archived: true }),
      conversation({ id: 'o', status: 'busy', workspace: '/repo-voisin' }),
      conversation({ id: 'r', status: 'ready' })
    ]
    expect(turnInFolder(list, '/repo')).toBeUndefined()
    const sub = conversation({ id: 's', title: 'Sous', status: 'busy', workspace: '/repo/app' })
    expect(turnInFolder([...list, sub], '/repo')?.title).toBe('Sous')
    expect(turnInFolder([conversation({ id: 'd', status: 'busy', workspace: '' })], '/repo')).toBe(
      undefined
    )
  })
})
