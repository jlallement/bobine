import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  findInOpenFile,
  FILE_FIND_EVENT,
  closeFile,
  collapseAll,
  dirKey,
  EMPTY_FILES_STATE,
  forgetDir,
  forgetFilesState,
  FILES_OPEN_KEY,
  loadFilesPreferences,
  MAX_EXPANDED,
  reconcileRoots,
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

describe('borne et purge des dossiers dépliés (C4)', () => {
  it('garde les plus récents, au plus `MAX_EXPANDED`', () => {
    let s = EMPTY_FILES_STATE
    for (let i = 0; i < MAX_EXPANDED + 20; i++) s = toggleDir(s, dirKey(0, `d${i}`), true)
    expect(s.expanded).toHaveLength(MAX_EXPANDED)
    expect(s.expanded.at(-1)).toBe(dirKey(0, `d${MAX_EXPANDED + 19}`))
    s = revealIn(s, 1, ['x', 'x/y'])
    expect(s.expanded).toHaveLength(MAX_EXPANDED)
    expect(s.expanded.slice(-3)).toEqual(['1:', '1:x', '1:x/y'])
  })

  it('la borne ne replie jamais un parent d’un dossier gardé (mineur)', () => {
    // `src` déplié il y a longtemps (le plus ancien), d'autres ensuite, puis `src/ui` en dernier :
    // la borne est dépassée, mais c'est un autre dossier qui part, pas le parent de `src/ui`.
    let s = toggleDir(EMPTY_FILES_STATE, dirKey(0, 'src'), true)
    for (let i = 0; i < MAX_EXPANDED - 1; i++) s = toggleDir(s, dirKey(0, `d${i}`), true)
    s = toggleDir(s, dirKey(0, 'src/ui'), true)
    expect(s.expanded).toContain('0:src/ui')
    expect(s.expanded.length).toBeLessThanOrEqual(MAX_EXPANDED)
    // Tout dossier gardé a ses parents gardés : rien de déplié sous un parent replié.
    for (const key of s.expanded) {
      const path = key.slice(2)
      const parts = path.split('/')
      for (let i = 1; i < parts.length; i++) {
        expect(s.expanded).toContain(`0:${parts.slice(0, i).join('/')}`)
      }
    }
  })

  it('un dossier disparu est oublié, avec ses sous-dossiers', () => {
    const s = { ...EMPTY_FILES_STATE, expanded: ['0:', '0:a', '0:a/b', '0:ab', '1:a'] }
    expect(forgetDir(s, '0:a').expanded).toEqual(['0:', '0:ab', '1:a'])
    expect(forgetDir(s, '0:zz')).toBe(s)
  })

  it('relu du stockage : borné aussi', () => {
    const expanded = Array.from({ length: MAX_EXPANDED + 5 }, (_, i) => `0:d${i}`)
    expect(parseFilesState({ expanded }).expanded).toHaveLength(MAX_EXPANDED)
  })
})

describe('racines désignées par leur rang (M2)', () => {
  const saved = {
    expanded: ['0:', '0:src', '1:', '1:lib', '2:x'],
    open: { root: 1, path: 'lib/a.ts' },
    back: [a, c],
    forward: [{ root: 2, path: 'y' }],
    scroll: 40,
    roots: ['/p/app', '/p/lib', '/p/docs']
  }

  it('mêmes racines : rien ne change', () => {
    const s = parseFilesState(saved)
    expect(reconcileRoots(s, ['/p/app', '/p/lib', '/p/docs'])).toBe(s)
  })

  it('une racine a changé de chemin (ou disparu) : ce qui la désigne est oublié', () => {
    const s = reconcileRoots(parseFilesState(saved), ['/p/app', '/p/autre'])
    expect(s.expanded).toEqual(['0:', '0:src'])
    expect(s.open).toBeUndefined()
    expect(s.scroll).toBeUndefined()
    expect(s.back).toEqual([a])
    expect(s.forward).toEqual([])
    expect(s.roots).toEqual(['/p/app', '/p/autre'])
  })

  it('état d’avant cette correction (sans racines) : retenu, puis daté des racines actuelles', () => {
    const { roots: _roots, ...old } = saved
    const s = reconcileRoots(parseFilesState(old), ['/p/app', '/p/lib', '/p/docs'])
    expect(s.open).toEqual({ root: 1, path: 'lib/a.ts' })
    expect(s.roots).toEqual(['/p/app', '/p/lib', '/p/docs'])
  })
})

describe('conversation supprimée (M9)', () => {
  it('son état et son onglet ouvert sont purgés, les autres gardés', () => {
    saveFilesState('c1', openFile(EMPTY_FILES_STATE, a))
    saveFilesState('c2', openFile(EMPTY_FILES_STATE, b))
    localStorage.setItem(FILES_OPEN_KEY, JSON.stringify(['c1', 'c2']))
    const heard: string[] = []
    const listener = (event: Event) => heard.push(String((event as CustomEvent).detail))
    window.addEventListener('bobine:files-forget', listener)
    forgetFilesState('c1')
    window.removeEventListener('bobine:files-forget', listener)
    expect(loadFilesState('c1')).toEqual(EMPTY_FILES_STATE)
    expect(loadFilesState('c2').open).toEqual(b)
    expect(JSON.parse(localStorage.getItem(FILES_OPEN_KEY) ?? '[]')).toEqual(['c2'])
    expect(heard).toEqual(['c1'])
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
