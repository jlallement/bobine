import { act, renderHook } from '@testing-library/react'
import { StrictMode, createElement, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FileContent, FileListing, FileRoot } from '@shared/files'
import { EMPTY_FILES_STATE, loadFilesState, openFile, saveFilesState } from '../../files-state'
import type { TranscriptItem } from '@shared/transcript'
import {
  RELOAD_DELAY_MS,
  useFileRootPaths,
  useFilesTab,
  useFilesWork,
  type FilesRequest
} from './useFilesTab'

const ROOTS: FileRoot[] = [
  { index: 0, name: 'app', path: '/p/app' },
  { index: 1, name: 'lib', path: '/p/lib' }
]

type Many = [string, FileListing | { error: string }][]

/** Réponses du main rendues à la main, dans l'ordre choisi par l'essai. */
function fakeApi(roots: FileRoot[] = ROOTS) {
  const lists: {
    root: number
    dirs: string[]
    resolve: (l: Record<string, FileListing | { error: string }> | Many) => void
    reject: (e: Error) => void
  }[] = []
  const reads: {
    path: string
    known: { modified: number; size: number } | undefined
    resolve: (c: FileContent) => void
  }[] = []
  const api = {
    // Un tableau neuf à chaque appel, comme par l'IPC.
    roots: vi.fn(async () => roots.map((r) => ({ ...r }))),
    listMany: vi.fn(
      (_id: string, root: number, dirs: string[]) =>
        new Promise<Many>((resolve, reject) =>
          lists.push({
            root,
            dirs,
            // Les essais donnent un objet par commodité ; le main rend des paires.
            resolve: (l) => resolve(Array.isArray(l) ? l : Object.entries(l)),
            reject
          })
        )
    ),
    read: vi.fn(
      (_id: string, _root: number, path: string, known?: { modified: number; size: number }) =>
        new Promise<FileContent>((resolve) => reads.push({ path, known, resolve }))
    ),
    search: vi.fn(async () => []),
    reveal: vi.fn(async () => undefined),
    open: vi.fn()
  }
  return { api, lists, reads }
}

const originalApi = window.api
let fake: ReturnType<typeof fakeApi>
beforeEach(() => {
  localStorage.clear()
  fake = fakeApi()
  window.api = { ...originalApi, fileTree: fake.api } as unknown as typeof window.api
})
afterEach(() => {
  window.api = originalApi
  vi.useRealTimers()
})

const listing = (...names: string[]): FileListing => ({
  entries: names.map((name) => ({ name, path: name, kind: 'file' as const })),
  more: 0
})
const text = (body: string, modified = 1): FileContent => ({
  kind: 'text',
  text: body,
  size: body.length,
  truncated: false,
  modified
})

/** Laisse passer les promesses déjà résolues (racines…). */
const settle = () => act(async () => {})

describe('demandes venues d’ailleurs (C1, M8, C3)', () => {
  it('une demande pour une autre conversation est ignorée et laissée à sa conversation', async () => {
    const done = vi.fn()
    const request: FilesRequest = {
      seq: 1,
      conversationId: 'c2',
      target: { root: 0, path: 'x.ts' }
    }
    const { result } = renderHook(() => useFilesTab('c1', 0, { request, onRequestDone: done }))
    await settle()
    expect(result.current.state.open).toBeUndefined()
    expect(done).not.toHaveBeenCalled()
  })

  it('une demande pour cette conversation ouvre le fichier, puis est consommée', async () => {
    const done = vi.fn()
    const request: FilesRequest = {
      seq: 4,
      conversationId: 'c1',
      target: { root: 0, path: 'x.ts' }
    }
    const { result } = renderHook(() => useFilesTab('c1', 0, { request, onRequestDone: done }))
    await settle()
    expect(result.current.state.open).toEqual({ root: 0, path: 'x.ts' })
    expect(result.current.view).toBe('file')
    expect(done).toHaveBeenCalledWith(4)
  })

  it('un lien vers une racine dont le rang a changé : traité après la réconciliation (C3)', async () => {
    saveFilesState('c1', { ...EMPTY_FILES_STATE, roots: ['/p/app', '/p/ancienne'] })
    const request: FilesRequest = {
      seq: 2,
      conversationId: 'c1',
      target: { root: 1, path: 'b.ts', line: 3 }
    }
    const { result } = renderHook(() => useFilesTab('c1', 0, { request, onRequestDone: vi.fn() }))
    await settle()
    expect(result.current.state.open).toMatchObject({ root: 1, path: 'b.ts' })
  })

  it('l’état retenu s’écrit une fois par changement, hors du rendu (StrictMode)', async () => {
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(StrictMode, null, children)
    const { result } = renderHook(() => useFilesTab('c1', 0), { wrapper })
    await settle()
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    act(() => result.current.show({ root: 0, path: 'a.ts' }))
    const writes = setItem.mock.calls.filter(([key]) => key === 'bobine.files')
    setItem.mockRestore()
    expect(writes).toHaveLength(1)
    expect(loadFilesState('c1').open).toEqual({ root: 0, path: 'a.ts' })
  })
})

describe('racines désignées par leur rang (M2)', () => {
  it('une racine qui a changé de chemin : le fichier retenu n’est ni ouvert ni lu', async () => {
    saveFilesState('c1', {
      ...openFile(EMPTY_FILES_STATE, { root: 1, path: 'b.ts' }),
      roots: ['/p/app', '/p/ancienne']
    })
    const { result } = renderHook(() => useFilesTab('c1', 0))
    await settle()
    expect(result.current.state.open).toBeUndefined()
    expect(fake.api.read).not.toHaveBeenCalled()
    expect(loadFilesState('c1').roots).toEqual(['/p/app', '/p/lib'])
  })
})

describe('relectures (C2, C4, M3)', () => {
  it('une réponse de listage périmée ne remplace pas une plus récente (M3)', async () => {
    const { result } = renderHook(() => useFilesTab('c1', 0))
    await settle()
    expect(fake.lists).toHaveLength(1)
    act(() => result.current.reload())
    await settle()
    expect(fake.lists).toHaveLength(2)
    await act(async () => fake.lists[1]?.resolve({ '': listing('neuf.ts') }))
    await act(async () => fake.lists[0]?.resolve({ '': listing('ancien.ts') }))
    const top = result.current.listings['0:']
    expect(top && 'listing' in top && top.listing.entries.map((e) => e.name)).toEqual(['neuf.ts'])
  })

  it('un appel par racine ; jamais un dossier sous un parent replié (C2)', async () => {
    saveFilesState('c1', {
      ...EMPTY_FILES_STATE,
      expanded: ['0:', '0:src', '0:src/ui', '0:docs/vieux', '1:', '1:lib']
    })
    renderHook(() => useFilesTab('c1', 0))
    await settle()
    expect(fake.lists.map((l) => [l.root, l.dirs])).toEqual([
      [0, ['', 'src', 'src/ui']],
      [1, ['', 'lib']]
    ])
  })

  it('un dossier `__proto__` déplié : lu comme un autre (3e revue, 1)', async () => {
    saveFilesState('c1', { ...EMPTY_FILES_STATE, expanded: ['0:', '0:__proto__'] })
    const { result } = renderHook(() => useFilesTab('c1', 0))
    await settle()
    await act(async () =>
      fake.lists[0]?.resolve([
        ['', listing('a.ts')],
        ['__proto__', listing('x.ts')]
      ])
    )
    const proto = result.current.listings['0:__proto__']
    expect(proto && 'listing' in proto && proto.listing.entries.map((e) => e.name)).toEqual([
      'x.ts'
    ])
  })

  it('un dossier déplié qui a disparu est oublié (C4)', async () => {
    saveFilesState('c1', { ...EMPTY_FILES_STATE, expanded: ['0:', '0:parti', '0:parti/sous'] })
    const { result } = renderHook(() => useFilesTab('c1', 0))
    await settle()
    await act(async () =>
      fake.lists[0]?.resolve({
        '': listing('a.ts'),
        parti: { error: "ENOENT: no such file or directory, stat 'parti'" },
        'parti/sous': { error: "ENOENT: no such file or directory, stat 'parti/sous'" }
      })
    )
    expect(result.current.state.expanded).toEqual(['0:'])
  })

  it('le fichier ouvert n’est relu que s’il a changé ; les relectures sont regroupées (C4)', async () => {
    vi.useFakeTimers()
    saveFilesState('c1', openFile(EMPTY_FILES_STATE, { root: 0, path: 'a.ts' }))
    let done = 0
    const { result, rerender } = renderHook(() => useFilesTab('c1', done))
    await settle()
    await act(async () => fake.reads[0]?.resolve(text('un', 10)))
    const shown = result.current.content
    expect(fake.reads[0]?.known).toBeUndefined()
    // Trois outils finis coup sur coup, et un retour sur la fenêtre : une seule relecture.
    for (let i = 0; i < 3; i++) {
      done++
      rerender()
    }
    act(() => {
      window.dispatchEvent(new Event('focus'))
    })
    await act(async () => vi.advanceTimersByTime(RELOAD_DELAY_MS))
    expect(fake.reads).toHaveLength(2)
    expect(fake.reads[1]?.known).toEqual({ modified: 10, size: 2 })
    await act(async () => fake.reads[1]?.resolve({ kind: 'unchanged', modified: 10, size: 2 }))
    expect(result.current.content).toBe(shown)
  })

  it('le défilement d’un fichier n’est pas rangé sur le suivant', async () => {
    vi.useFakeTimers()
    saveFilesState('c1', openFile(EMPTY_FILES_STATE, { root: 0, path: 'a.ts' }))
    const { result } = renderHook(() => useFilesTab('c1', 0))
    await settle()
    act(() => result.current.saveScroll(240))
    act(() => result.current.show({ root: 0, path: 'b.ts' }))
    await act(async () => vi.advanceTimersByTime(1000))
    expect(result.current.state.open).toEqual({ root: 0, path: 'b.ts' })
    expect(result.current.state.scroll).toBeUndefined()
  })

  it('la ligne d’un lien est oubliée une fois montrée (C4)', async () => {
    const { result } = renderHook(() => useFilesTab('c1', 0))
    await settle()
    act(() => result.current.show({ root: 0, path: 'a.ts', line: 42 }))
    expect(result.current.state.open?.line).toBe(42)
    act(() => result.current.lineShown())
    expect(result.current.state.open).toEqual({ root: 0, path: 'a.ts' })
    expect(loadFilesState('c1').open?.line).toBeUndefined()
  })
})

describe('ce que l’onglet retient du fil (C7)', () => {
  const edit = (id: string, path: string, status = 'completed') =>
    ({
      kind: 'tool',
      id,
      status,
      content: [{ type: 'diff', path, oldText: 'a', newText: 'b' }]
    }) as unknown as TranscriptItem
  const say = (id: number, text: string) =>
    ({ kind: 'agent', id, text }) as unknown as TranscriptItem

  it('chemins stables tant qu’aucun outil ne finit ; un outil en échec compte comme une fin', () => {
    let items: TranscriptItem[] = [edit('t1', '/p/app/a.ts')]
    const { result, rerender } = renderHook(() => useFilesWork(items))
    const first = result.current.changes
    expect(first).toEqual(['/p/app/a.ts'])
    // Un morceau de réponse de l'agent : rien ne change pour l'onglet.
    items = [...items, say(2, 'Je regarde…')]
    rerender()
    expect(result.current.changes).toBe(first)
    expect(result.current.done).toBe(1)
    items = [...items, edit('t2', '/p/app/b.ts', 'failed')]
    rerender()
    expect(result.current.done).toBe(2)
    expect(result.current.changes).toBe(first)
  })
})

describe('capacité de l’agent connue après coup (3e revue, mineur)', () => {
  it('les racines sont relues quand elle arrive', async () => {
    let known = 'unknown'
    const { rerender } = renderHook(() => useFilesTab('c1', 0, {}, known))
    await settle()
    expect(fake.api.roots).toHaveBeenCalledTimes(1)
    known = 'yes'
    rerender()
    await settle()
    expect(fake.api.roots).toHaveBeenCalledTimes(2)
  })

  it('mêmes racines relues : le même tableau (l’arbre et le filtre ne repartent pas)', async () => {
    const { result } = renderHook(() => useFilesTab('c1', 0))
    await settle()
    const first = result.current.roots
    act(() => result.current.reload())
    await settle()
    expect(fake.api.roots).toHaveBeenCalledTimes(2)
    expect(result.current.roots).toBe(first)
  })

  it('agent qui redémarre (état inconnu) : « non transmis » garde sa dernière valeur connue', async () => {
    let notSent: boolean | undefined = true
    fake.api.roots.mockImplementation(async () =>
      ROOTS.map((r) => (r.index > 0 && notSent !== undefined ? { ...r, notSent } : { ...r }))
    )
    const { result } = renderHook(() => useFilesTab('c1', 0))
    await settle()
    expect(result.current.roots?.[1]?.notSent).toBe(true)
    notSent = undefined
    act(() => result.current.reload())
    await settle()
    expect(result.current.roots?.[1]?.notSent).toBe(true)
    notSent = false
    act(() => result.current.reload())
    await settle()
    expect(result.current.roots?.[1]?.notSent).toBe(false)
  })
})

describe('dossiers de la conversation vus de Modifications (4e revue, G1, G2)', () => {
  it('un dossier retiré pendant que l’onglet est ouvert : les racines sont relues', async () => {
    let paths = ['/p/a', '/p/b', '/p/c']
    fake.api.roots.mockImplementation(async () =>
      paths.map((path, index) => ({ index, name: path, path }))
    )
    let key = 'a b c'
    const { result, rerender } = renderHook(() => useFileRootPaths('c1', true, key, 0))
    await settle()
    expect(result.current).toEqual(['/p/a', '/p/b', '/p/c'])
    paths = ['/p/a', '/p/c']
    key = 'a c'
    rerender()
    await settle()
    expect(result.current).toEqual(['/p/a', '/p/c'])
  })

  it('relues aussi à chaque fin d’outil et au retour sur la fenêtre', async () => {
    vi.useFakeTimers()
    let done = 0
    const { rerender } = renderHook(() => useFileRootPaths('c1', true, '', done))
    await act(async () => {})
    expect(fake.api.roots).toHaveBeenCalledTimes(1)
    done = 1
    rerender()
    await act(async () => vi.advanceTimersByTime(RELOAD_DELAY_MS))
    expect(fake.api.roots).toHaveBeenCalledTimes(2)
    window.dispatchEvent(new Event('focus'))
    await act(async () => vi.advanceTimersByTime(RELOAD_DELAY_MS))
    expect(fake.api.roots).toHaveBeenCalledTimes(3)
    vi.useRealTimers()
  })

  it('lecture en échec : relue au prochain événement, la précédente réponse oubliée', async () => {
    fake.api.roots.mockRejectedValueOnce(new Error('boom'))
    let key = 'x'
    const { result, rerender } = renderHook(() => useFileRootPaths('c1', true, key, 0))
    await settle()
    expect(result.current).toBeNull()
    key = 'y'
    rerender()
    await settle()
    expect(result.current).toEqual(['/p/app', '/p/lib'])
  })
})
