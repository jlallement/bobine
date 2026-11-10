/**
 * Gardes des envois assemblées comme dans l'app (fiche 196) : lecture seule, plafond de coût
 * (fiche 157), préparation des worktrees (fiche 175). Dans n'importe quel ordre de démarrage, un
 * envoi est refusé en lecture seule ; hors lecture seule, il part.
 */
import { describe, expect, it, vi } from 'vitest'
import type { ConversationEvent } from '@shared/agent'
import { connectWorktreePreparation } from './changes/worktree-setup-wiring'
import { WorktreePreparation } from './changes/worktree-setup'
import { CostCapGuard } from './conversations/cost-cap'
import { guardPrompts } from './read-only-guard'

type Gate = (id: string, text: string, attachments?: unknown[], options?: object) => boolean

/** Gestionnaire réduit : `prompt` passe par la garde comme le vrai, et note ce qui part. */
function manager() {
  const sent: string[] = []
  const m = {
    promptGate: undefined as Gate | undefined,
    subscribe: (_l: { event?: (payload: ConversationEvent) => void }) => () => {},
    post: vi.fn(),
    cancel: vi.fn(async () => {}),
    worktreeOf: vi.fn(() => undefined),
    view: vi.fn(() => ({ summary: {}, transcript: { items: [], nextId: 1 } })),
    prompt: async (id: string, text: string, attachments: unknown[] = [], options: object = {}) => {
      if (m.promptGate?.(id, text, attachments, options)) return
      sent.push(text)
    }
  }
  return { m, sent }
}

const ORDERS = [
  ['readOnly', 'cost', 'worktree'],
  ['readOnly', 'worktree', 'cost'],
  ['cost', 'readOnly', 'worktree'],
  ['cost', 'worktree', 'readOnly'],
  ['worktree', 'readOnly', 'cost'],
  ['worktree', 'cost', 'readOnly']
] as const

describe('gardes des envois, assemblage réel (fiches 157, 175, 196)', () => {
  it.each(ORDERS)('ordre %s, %s, %s : refusé en lecture seule, parti sinon', async (...order) => {
    const { m, sent } = manager()
    let readOnly = true
    const preparation = new WorktreePreparation({
      run: () => Promise.reject(new Error('git')),
      approvals: { approved: () => false, approve: () => {} },
      env: () => ({}),
      log: { info: () => {}, warn: () => {} },
      shell: () => Promise.resolve({ code: 0, timedOut: false }),
      throttleMs: 0
    })
    const install = {
      readOnly: () => guardPrompts(m as never, () => readOnly),
      cost: () =>
        new CostCapGuard(m as never, () => ({
          costCapEnabled: false,
          costCapAmount: 5,
          costCapTokens: 1_000_000
        })).start(),
      worktree: () => connectWorktreePreparation(m as never, preparation)
    }
    for (const step of order) install[step]()
    await expect(m.prompt('c1', 'envoi en lecture seule')).rejects.toThrow(
      /Lecture seule|Read-only/
    )
    expect(sent).toEqual([])
    readOnly = false
    await m.prompt('c1', 'envoi permis')
    expect(sent).toEqual(['envoi permis'])
  })

  it('le plafond de coût enchaîne la garde posée avant lui, et la remet en partant', () => {
    const { m } = manager()
    const before = vi.fn(() => true)
    m.promptGate = before
    const stop = new CostCapGuard(m as never, () => ({
      costCapEnabled: false,
      costCapAmount: 5,
      costCapTokens: 1_000_000
    })).start()
    expect(m.promptGate?.('c1', 'retenu avant')).toBe(true)
    expect(before).toHaveBeenCalledOnce()
    stop()
    expect(m.promptGate).toBe(before)
  })
})
