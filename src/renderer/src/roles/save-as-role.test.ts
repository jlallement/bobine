import { afterEach, describe, expect, it, vi } from 'vitest'
import { childRolePrefill, saveAsRoleAction } from './save-as-role'
import { resetRolesUi, useRolesUi } from './roles-store'
import { renderHook } from '@testing-library/react'

const report = { childId: 'f1', outcome: 'done', fileCount: 0 }
const launch = { prompt: '  Relis le diff de l’auth. Ne modifie rien.  ' }
const children = [{ id: 'f1', profileId: 'opencode' }]

afterEach(() => {
  resetRolesUi()
  vi.unstubAllGlobals()
})

describe('« Enregistrer comme rôle » (fiche 223, maquette 01-C2)', () => {
  it('seulement pour une fille sans rôle, finie avec succès, dont la consigne est connue', () => {
    expect(saveAsRoleAction(report, launch, children)).toBeTypeOf('function')
    expect(saveAsRoleAction(report, { ...launch, role: { name: 'x' } }, children)).toBeUndefined()
    expect(saveAsRoleAction({ ...report, outcome: 'error' }, launch, children)).toBeUndefined()
    expect(saveAsRoleAction({ ...report, outcome: 'stopped' }, launch, children)).toBeUndefined()
    expect(saveAsRoleAction(report, undefined, children)).toBeUndefined()
    expect(saveAsRoleAction(report, { prompt: '  ' }, children)).toBeUndefined()
  })

  it('préremplissage : consigne de la fille, son agent, son modèle, lecture seule si rien modifié', () => {
    const child = { id: 'f1', profileId: 'opencode', prompt: launch.prompt, fileCount: 0 }
    expect(childRolePrefill(child, 'glm-free')).toEqual({
      prompt: 'Relis le diff de l’auth. Ne modifie rien.',
      agent: 'opencode',
      model: 'glm-free',
      readOnly: true
    })
    expect(childRolePrefill({ ...child, profileId: undefined, fileCount: 3 })).toEqual({
      prompt: 'Relis le diff de l’auth. Ne modifie rien.',
      readOnly: false
    })
  })

  it('ouvre l’assistant avec le modèle lu dans la session de la fille', async () => {
    const view = vi.fn(async () => ({
      snapshot: {
        controls: [
          { id: 'm', name: 'Modèle', category: 'model', type: 'select', currentValue: 'glm-free' }
        ]
      }
    }))
    vi.stubGlobal('window', Object.assign(window, { api: { conversations: { view } } }))
    const { result } = renderHook(() => useRolesUi())
    saveAsRoleAction(report, launch, children)?.()
    await vi.waitFor(() => expect(result.current.wizard).not.toBeNull())
    expect(view).toHaveBeenCalledWith('f1')
    expect(result.current.wizard?.prefill).toMatchObject({
      agent: 'opencode',
      model: 'glm-free',
      readOnly: true
    })
  })
})
