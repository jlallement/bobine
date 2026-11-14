import { describe, expect, it, vi } from 'vitest'
import type { ConversationListeners } from './manager'
import { until } from './manager-until'

function fakeManager() {
  const listeners = new Set<ConversationListeners>()
  return {
    subscribe: (l: ConversationListeners) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    fire: () => {
      for (const l of listeners) l.list?.({ conversations: [], activeId: 'a' })
    },
    count: () => listeners.size
  }
}

describe('until : attente sur évènement (essais contre l’agent factice)', () => {
  it('déjà vraie : tout de suite ; sinon au premier évènement qui la rend vraie, puis désabonnée', async () => {
    const manager = fakeManager()
    await until(manager, () => true, 'rien')
    let ready = false
    const waiting = until(manager, () => ready, 'prêt')
    expect(manager.count()).toBe(1)
    ready = true
    manager.fire()
    await waiting
    expect(manager.count()).toBe(0)
  })

  it('délai dépassé : le message dit ce qui était attendu', async () => {
    vi.useFakeTimers()
    try {
      const manager = fakeManager()
      const waiting = until(manager, () => false, 'la fille a fini', 1_000)
      const failed = expect(waiting).rejects.toThrow('la fille a fini')
      await vi.advanceTimersByTimeAsync(1_000)
      await failed
      expect(manager.count()).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('une condition qui change sans évènement est rattrapée par le contrôle lent', async () => {
    vi.useFakeTimers()
    try {
      const manager = fakeManager()
      let ready = false
      const waiting = until(manager, () => ready, 'prêt')
      ready = true
      await vi.advanceTimersByTimeAsync(300)
      await waiting
    } finally {
      vi.useRealTimers()
    }
  })
})
