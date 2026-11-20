import { act, renderHook } from '@testing-library/react'
import { StrictMode, createElement, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FileContent, FileListing, FileRoot } from '@shared/files'
import type { TranscriptItem } from '@shared/transcript'
import { EMPTY_FILES_STATE, loadFilesState, openFile, saveFilesState } from '../../files-state'
import { RELOAD_DELAY_MS, useFilesTab, type FilesRequest } from './useFilesTab'

const ROOTS: FileRoot[] = [
  { index: 0, name: 'app', path: '/p/app' },
  { index: 1, name: 'lib', path: '/p/lib' }
]

/** Réponses du main rendues à la main, dans l'ordre choisi par l'essai. */
function fakeApi(roots: FileRoot[] = ROOTS) {
  const lists: { dir: string; resolve: (l: FileListing) => void; reject: (e: Error) => void }[] = []
  const reads: {
    path: string
    known: { modified: number; size: number } | undefined
    resolve: (c: FileContent) => void
  }[] = []
  const api = {
    roots: vi.fn(async () => roots),
    list: vi.fn(
      (_id: string, _root: number, dir: string) =>
        new Promise<FileListing>((resolve, reject) => lists.push({ dir, resolve, reject }))
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

const NO_ITEMS: TranscriptItem[] = []
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
const tool = (id: string): TranscriptItem =>
  ({ kind: 'tool', id, status: 'completed' }) as unknown as TranscriptItem

/** Laisse passer les promesses déjà résolues (racines…). */
const settle = () => act(async () => {})

describe('demandes venues d’ailleurs (C1, M8)', () => {
  it('une demande pour une autre conversation est ignorée et laissée à sa conversation', async () => {
    const done = vi.fn()
    const request: FilesRequest = {
      seq: 1,
      conversationId: 'c2',
      target: { root: 0, path: 'x.ts' }
    }
    const { result } = renderHook(() =>
      useFilesTab('c1', NO_ITEMS, { request, onRequestDone: done })
    )
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
    const { result } = renderHook(() =>
      useFilesTab('c1', NO_ITEMS, { request, onRequestDone: done })
    )
    await settle()
    expect(result.current.state.open).toEqual({ root: 0, path: 'x.ts' })
    expect(result.current.view).toBe('file')
    expect(done).toHaveBeenCalledWith(4)
  })

  it('l’état retenu s’écrit une fois par changement, hors du rendu (StrictMode)', async () => {
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(StrictMode, null, children)
    const { result } = renderHook(() => useFilesTab('c1', NO_ITEMS), { wrapper })
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
    const { result } = renderHook(() => useFilesTab('c1', NO_ITEMS))
    await settle()
    expect(result.current.state.open).toBeUndefined()
    expect(fake.api.read).not.toHaveBeenCalled()
    expect(loadFilesState('c1').roots).toEqual(['/p/app', '/p/lib'])
  })
})

describe('relectures (C4, M3)', () => {
  it('une réponse de listage périmée ne remplace pas une plus récente (M3)', async () => {
    const { result } = renderHook(() => useFilesTab('c1', NO_ITEMS))
    await settle()
    expect(fake.lists).toHaveLength(1)
    act(() => result.current.reload())
    await settle()
    expect(fake.lists).toHaveLength(2)
    await act(async () => fake.lists[1]?.resolve(listing('neuf.ts')))
    await act(async () => fake.lists[0]?.resolve(listing('ancien.ts')))
    const top = result.current.listings['0:']
    expect(top && 'listing' in top && top.listing.entries.map((e) => e.name)).toEqual(['neuf.ts'])
  })

  it('un dossier déplié qui a disparu est oublié (C4)', async () => {
    saveFilesState('c1', { ...EMPTY_FILES_STATE, expanded: ['0:', '0:parti', '0:parti/sous'] })
    const { result } = renderHook(() => useFilesTab('c1', NO_ITEMS))
    await settle()
    const gone = fake.lists.find((l) => l.dir === 'parti')
    await act(async () =>
      gone?.reject(new Error("ENOENT: no such file or directory, stat 'parti'"))
    )
    expect(result.current.state.expanded).toEqual(['0:'])
  })

  it('le fichier ouvert n’est relu que s’il a changé ; les relectures sont regroupées (C4)', async () => {
    vi.useFakeTimers()
    saveFilesState('c1', openFile(EMPTY_FILES_STATE, { root: 0, path: 'a.ts' }))
    let items: TranscriptItem[] = []
    const { result, rerender } = renderHook(() => useFilesTab('c1', items))
    await settle()
    await act(async () => fake.reads[0]?.resolve(text('un', 10)))
    const shown = result.current.content
    expect(fake.reads[0]?.known).toBeUndefined()
    // Trois outils finis coup sur coup, et un retour sur la fenêtre : une seule relecture.
    for (const id of ['t1', 't2', 't3']) {
      items = [...items, tool(id)]
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
})
