import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  findInOpenFile,
  FILE_FIND_EVENT,
  closeFile,
  collapseAll,
  dirKey,
  EMPTY_FILES_STATE,
  loadFilesPreferences,
  loadFilesState,
  openFile,
  parseFilesState,
  revealIn,
  saveFilesPreferences,
  saveFilesState,
  stepFile,
  toggleDir
} from './files-state'

beforeEach(() => localStorage.clear())

const a = { root: 0, path: 'a.ts' }
const b = { root: 0, path: 'b.ts' }
const c = { root: 1, path: 'c.md' }

describe('historique des fichiers ouverts', () => {
  it('ouvre, revient en arrière, repart en avant', () => {
    let s = openFile(EMPTY_FILES_STATE, a)
    s = openFile(s, b)
    s = openFile(s, c)
    expect(s.open).toEqual(c)
    expect(s.back).toEqual([a, b])
    s = stepFile(s, -1)
    expect(s.open).toEqual(b)
    expect(s.forward).toEqual([c])
    s = stepFile(s, 1)
    expect(s.open).toEqual(c)
    expect(s.back).toEqual([a, b])
    expect(stepFile(s, 1)).toBe(s)
  })

  it('rouvrir le même fichier change seulement la ligne', () => {
    const s = openFile(openFile(EMPTY_FILES_STATE, a), { ...a, line: 4 })
    expect(s.open).toEqual({ ...a, line: 4 })
    expect(s.back).toEqual([])
  })

  it('fermer garde le fichier dans l’historique', () => {
    const s = closeFile(openFile(EMPTY_FILES_STATE, { ...a, line: 3 }))
    expect(s.open).toBeUndefined()
    expect(s.back).toEqual([a])
  })
})

describe('dossiers dépliés', () => {
  it('déplie, replie, révèle, réduit tout', () => {
    let s = toggleDir(EMPTY_FILES_STATE, dirKey(0, 'src'))
    expect(s.expanded).toEqual(['0:src'])
    s = toggleDir(s, '0:src')
    expect(s.expanded).toEqual([])
    s = revealIn(s, 0, ['src', 'src/ui'])
    expect(s.expanded).toEqual(['0:', '0:src', '0:src/ui'])
    expect(collapseAll(s).expanded).toEqual(['0:'])
  })
})

describe('stockage', () => {
  it('garde l’état par conversation, et le vérifie en le relisant', () => {
    saveFilesState('c1', openFile(toggleDir(EMPTY_FILES_STATE, '0:src'), a))
    expect(loadFilesState('c1')).toMatchObject({ expanded: ['0:src'], open: a })
    expect(loadFilesState('autre')).toEqual(EMPTY_FILES_STATE)
    expect(parseFilesState({ open: { root: -1, path: 'x' }, expanded: [3, 'ok'] })).toEqual({
      expanded: ['ok'],
      back: [],
      forward: []
    })
  })

  it('réglages de lecture', () => {
    expect(loadFilesPreferences()).toEqual({ wrap: true, side: 'auto', tree: true })
    saveFilesPreferences({ wrap: false, side: 'left', tree: false })
    expect(loadFilesPreferences()).toEqual({ wrap: false, side: 'left', tree: false })
  })
})

describe('⌘F dans le fichier ouvert', () => {
  it('seulement le focus dans une vue de fichier qui montre du code', () => {
    const heard = vi.fn()
    window.addEventListener(FILE_FIND_EVENT, heard)
    document.body.innerHTML =
      '<div data-testid="file-view"><button id="b">x</button><div id="md"></div></div>'
    document.getElementById('b')?.focus()
    expect(findInOpenFile()).toBe(false)
    document.getElementById('md')?.setAttribute('data-testid', 'file-code')
    expect(findInOpenFile()).toBe(true)
    expect(heard).toHaveBeenCalledTimes(1)
    document.body.innerHTML = '<button id="c">y</button>'
    document.getElementById('c')?.focus()
    expect(findInOpenFile()).toBe(false)
    window.removeEventListener(FILE_FIND_EVENT, heard)
  })
})
