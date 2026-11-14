import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ConversationSummary } from '@shared/agent'
import { resetRolesUi, rolesChanged } from './roles/roles-store'
import { useComposerRoles } from './useComposerRoles'

afterEach(() => {
  resetRolesUi()
  vi.unstubAllGlobals()
})

describe('rôles de la saisie (fiche 223, relecture phase 3)', () => {
  it('relus après un rôle enregistré dans l’app et au retour du focus', async () => {
    const list = vi.fn(async () => ({ roles: [], problems: [] }))
    vi.stubGlobal('window', Object.assign(window, { api: { roles: { list } } }))
    const conversation = { id: 'c1' } as ConversationSummary
    renderHook(() => useComposerRoles(conversation, [], vi.fn()))
    await waitFor(() => expect(list).toHaveBeenCalledTimes(1))
    act(() => rolesChanged())
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2))
    act(() => {
      window.dispatchEvent(new Event('focus'))
    })
    await waitFor(() => expect(list).toHaveBeenCalledTimes(3))
  })
})
