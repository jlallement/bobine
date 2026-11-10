import { describe, expect, it, vi } from 'vitest'
import { IPC_CHANNELS, type IpcHandlers } from '@shared/ipc'
import { guardReadOnly, PROFILE_CHANGING, READ_ONLY_SAFE } from './read-only-guard'

describe('lecture seule : refus par défaut des canaux IPC (fiche 196)', () => {
  it('chaque canal déclaré est classé, une seule fois : sûr, ou il change le profil', () => {
    const safe = new Set<string>(READ_ONLY_SAFE)
    const changing = new Set<string>(PROFILE_CHANGING)
    const unclassified = IPC_CHANNELS.filter((c) => !safe.has(c) && !changing.has(c))
    const both = IPC_CHANNELS.filter((c) => safe.has(c) && changing.has(c))
    // Un canal nouveau : à ranger dans `READ_ONLY_SAFE` ou `PROFILE_CHANGING` (read-only-guard.ts).
    expect(unclassified).toEqual([])
    expect(both).toEqual([])
    const declared = new Set<string>(IPC_CHANNELS)
    expect([...safe, ...changing].filter((c) => !declared.has(c))).toEqual([])
  })

  it('en lecture seule, un canal hors de la liste sûre est refusé, même inconnu', () => {
    let readOnly = true
    const rename = vi.fn(() => undefined)
    const view = vi.fn(() => 'vue')
    const future = vi.fn(() => 'écrit')
    const handlers = guardReadOnly(
      {
        'conversation:rename': rename,
        'conversation:view': view,
        'canal:deDemain': future
      } as unknown as IpcHandlers,
      () => readOnly
    )
    const call = (channel: string, ...args: unknown[]) =>
      (handlers as unknown as Record<string, (...a: unknown[]) => unknown>)[channel]?.(...args)
    expect(() => call('conversation:rename', 'id', 'titre')).toThrow(/Lecture seule|Read-only/)
    expect(() => call('canal:deDemain')).toThrow(/Lecture seule|Read-only/)
    expect(rename).not.toHaveBeenCalled()
    expect(future).not.toHaveBeenCalled()
    expect(call('conversation:view', 'id')).toBe('vue')
    readOnly = false
    call('conversation:rename', 'id', 'titre')
    expect(rename).toHaveBeenCalledOnce()
  })

  it('l’essai de l’accueil, qui envoie un vrai message, est refusé en lecture seule', () => {
    expect(READ_ONLY_SAFE).not.toContain('onboarding:check')
    const check = vi.fn()
    const handlers = guardReadOnly(
      { 'onboarding:check': check } as unknown as IpcHandlers,
      () => true
    )
    expect(() =>
      (handlers as unknown as Record<string, () => unknown>)['onboarding:check']?.()
    ).toThrow(/Lecture seule|Read-only/)
    expect(check).not.toHaveBeenCalled()
  })

  it('options de la PR (correction et fusion automatiques) : refusées en lecture seule', () => {
    expect(READ_ONLY_SAFE).not.toContain('pr:options')
    expect(PROFILE_CHANGING).toContain('pr:options')
  })
})
