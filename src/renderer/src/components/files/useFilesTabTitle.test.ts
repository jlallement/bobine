import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { EMPTY_FILES_STATE, loadFilesState, openFile, saveFilesState } from '../../files-state'
import { useFilesTabTitle } from './useFilesTabTitle'

beforeEach(() => localStorage.clear())

describe('titre et ✕ de l’onglet Fichiers', () => {
  it('nom du fichier ouvert ; le ✕ ramène d’abord à l’arbre, puis laisse fermer', () => {
    saveFilesState('c1', openFile(EMPTY_FILES_STATE, { root: 0, path: 'src/app.ts' }))
    const { result } = renderHook(() => useFilesTabTitle('c1'))
    expect(result.current.name).toBe('app.ts')
    expect(result.current.icon).toBeDefined()
    let handled = false
    act(() => {
      handled = result.current.backToTree()
    })
    expect(handled).toBe(true)
    expect(loadFilesState('c1').open).toBeUndefined()
    expect(result.current.name).toBeUndefined()
    act(() => {
      handled = result.current.backToTree()
    })
    expect(handled).toBe(false)
  })

  it('onglet monté : son propre ✕ décide', () => {
    const { result } = renderHook(() => useFilesTabTitle('c1'))
    result.current.close.current = () => true
    expect(result.current.backToTree()).toBe(true)
  })
})
