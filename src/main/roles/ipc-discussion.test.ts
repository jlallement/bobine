import { describe, expect, it, vi } from 'vitest'
import type { RoleLibrary } from './library'
import type { RoleInvokeHost } from './invoke'
import { rolesHandlers } from './ipc'

describe('rôles et espace Discussion (fiche 224)', () => {
  it('`@rôle` refusé depuis une discussion, avant toute fille ou tout brouillon gardé', () => {
    const keepDraft = vi.fn()
    const children = vi.fn(() => ({}) as RoleInvokeHost)
    const handlers = rolesHandlers({
      library: {} as RoleLibrary,
      folderOf: () => '/d/discussions/x',
      children,
      keepDraft,
      inDiscussion: (id) => id === 'chat'
    })
    expect(() =>
      handlers['roles:startChildren']('chat', { roles: ['tech-lead'], text: 'Relis' })
    ).toThrow()
    expect(keepDraft).not.toHaveBeenCalled()
  })
})
