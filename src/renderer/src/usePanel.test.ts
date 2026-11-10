import { act, fireEvent, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import type { MarkdownDocument } from '@shared/file-links'
import type { PanelTab } from '@shared/panel'
import type { TranscriptItem } from '@shared/transcript'
import { usePanel } from './usePanel'

interface Props {
  conversationId: string | null
  request: { tab: PanelTab; seq: number } | null
  items: readonly TranscriptItem[]
  hasChanges: boolean
  autoOpen?: { eligible: boolean; sidebarOpen: boolean }
}

const NO_ITEMS: readonly TranscriptItem[] = []
const initialProps: Props = {
  conversationId: 'c1',
  request: null,
  items: NO_ITEMS,
  hasChanges: false
}

function setup(props: Partial<Props> = {}) {
  const hook = renderHook((p: Props) => usePanel(p), {
    initialProps: { ...initialProps, ...props }
  })
  const run = (action: () => void) => act(action)
  return { ...hook, run }
}

const saved = () => JSON.parse(localStorage.getItem('bobine.panel') ?? 'null') as unknown
const savedClosed = () =>
  JSON.parse(localStorage.getItem('bobine.panel.closedTabs') ?? '{}') as unknown

const doc = (title: string) => ({ title }) as unknown as MarkdownDocument

beforeEach(() => localStorage.clear())

describe('panneau de droite : état mémorisé (fiche 029)', () => {
  it('par défaut : fermé, sur « Session » ; chaque changement est mémorisé', () => {
    const { result, run } = setup()
    expect(result.current).toMatchObject({ open: false, tab: 'session', width: 380 })
    run(() => result.current.update({ open: true, tab: 'browser', width: 500 }))
    expect(saved()).toEqual({ open: true, tab: 'browser', width: 500 })
  })

  it('relu au lancement, sans l’aperçu d’un document et pas plus étroit que le minimum', () => {
    localStorage.setItem('bobine.panel', JSON.stringify({ open: true, tab: 'document', width: 10 }))
    const { result } = setup()
    expect(result.current).toMatchObject({ open: true, tab: 'session', width: 280 })
  })
})

describe('demande de l’agent (fiche 029)', () => {
  it('ouvre l’onglet demandé, une fois par demande', () => {
    const { result, rerender, run } = setup()
    rerender({ ...initialProps, request: { tab: 'browser', seq: 1 } })
    expect(result.current).toMatchObject({ open: true, tab: 'browser' })
    run(() => result.current.update({ open: false }))
    rerender({ ...initialProps, request: { tab: 'browser', seq: 1 } })
    expect(result.current.open).toBe(false)
    rerender({ ...initialProps, request: { tab: 'browser', seq: 2 } })
    expect(result.current.open).toBe(true)
  })
})

describe('panneau agrandi (fiche 082)', () => {
  it('réduit en fermant le panneau', () => {
    const { result, run } = setup()
    run(() => {
      result.current.update({ open: true })
      result.current.setMaximized(true)
    })
    expect(result.current.maximized).toBe(true)
    run(() => result.current.update({ open: false }))
    expect(result.current.maximized).toBe(false)
    // Rouvert : il n'est plus agrandi.
    run(() => result.current.update({ open: true }))
    expect(result.current.maximized).toBe(false)
  })

  it('réduit en changeant de conversation', () => {
    const { result, rerender, run } = setup()
    run(() => {
      result.current.update({ open: true })
      result.current.setMaximized(true)
    })
    rerender({ ...initialProps, conversationId: 'c2' })
    expect(result.current.maximized).toBe(false)
  })
})

describe('onglets ouverts et fermés (fiche 082)', () => {
  it('un onglet affiché garde sa place dans la conversation', () => {
    const { result, run } = setup()
    run(() => result.current.update({ open: true, tab: 'browser' }))
    run(() => result.current.update({ tab: 'tasks' }))
    expect(result.current.tabs).toEqual(['session', 'browser', 'tasks'])
  })

  it('✕ : l’onglet disparaît, le voisin s’affiche, et c’est mémorisé', () => {
    const { result, run } = setup()
    run(() => result.current.update({ open: true, tab: 'browser' }))
    run(() => result.current.update({ tab: 'terminal' }))
    run(() => result.current.closeTab('terminal'))
    expect(result.current).toMatchObject({ open: true, tab: 'browser' })
    expect(result.current.tabs).toEqual(['session', 'browser'])
    expect(savedClosed()).toEqual({ c1: ['terminal'] })
  })

  it('le dernier onglet fermé ferme le panneau ; rouvert, il n’est plus caché', () => {
    const { result, run } = setup()
    run(() => result.current.update({ open: true, tab: 'session' }))
    run(() => result.current.closeTab('session'))
    expect(result.current.open).toBe(false)
    run(() => result.current.update({ open: true, tab: 'session' }))
    expect(savedClosed()).toEqual({})
  })

  it('les onglets fermés sont ceux de la conversation active', () => {
    const { result, rerender, run } = setup()
    run(() => result.current.update({ open: true, tab: 'browser' }))
    run(() => result.current.update({ tab: 'tasks' }))
    run(() => result.current.closeTab('browser'))
    rerender({ ...initialProps, conversationId: 'c2' })
    run(() => result.current.update({ tab: 'browser' }))
    run(() => result.current.update({ tab: 'tasks' }))
    expect(result.current.tabs).toEqual(['session', 'browser', 'tasks'])
    rerender({ ...initialProps, conversationId: 'c1' })
    expect(result.current.tabs).toEqual(['session', 'tasks'])
  })
})

describe('terminal (⌃`, fiche 034)', () => {
  it('⌃` ouvre le terminal avec le clavier, puis le referme', () => {
    const { result, run } = setup()
    fireEvent.keyDown(window, { code: 'Backquote', ctrlKey: true })
    expect(result.current).toMatchObject({ open: true, tab: 'terminal', focusTerminal: true })
    run(() => result.current.terminalFocused())
    expect(result.current.focusTerminal).toBe(false)
    run(() => result.current.toggleTerminal())
    expect(result.current.open).toBe(false)
  })

  it('⌘` ou ⌥⌃` ne sont pas le raccourci', () => {
    const { result } = setup()
    fireEvent.keyDown(window, { code: 'Backquote', ctrlKey: true, metaKey: true })
    fireEvent.keyDown(window, { code: 'Backquote', ctrlKey: true, altKey: true })
    expect(result.current.open).toBe(false)
  })
})

describe('modifications (fiche 021) et aperçu (fiche 052)', () => {
  it('« Modifications » sur une vue : l’onglet s’ouvre, chaque demande est nouvelle', () => {
    const { result, run } = setup({ hasChanges: true })
    run(() => result.current.openChanges('git'))
    expect(result.current.changesOpen).toBe(true)
    expect(result.current.changesRequest).toEqual({ view: 'git', seq: 1 })
    run(() => result.current.openChanges('git'))
    expect(result.current.changesRequest).toEqual({ view: 'git', seq: 2 })
  })

  it('document en aperçu : onglet ouvert, document remplacé, fermé par ✕', () => {
    const { result, run } = setup()
    run(() => result.current.showDocument('c1', doc('a')))
    expect(result.current).toMatchObject({ open: true, tab: 'document' })
    expect(result.current.preview).toEqual({ conversationId: 'c1', document: doc('a') })
    expect(result.current.tabs).toContain('document')
    run(() => result.current.updateDocument(doc('b')))
    expect(result.current.preview?.document).toEqual(doc('b'))
    run(() => result.current.closeTab('document'))
    expect(result.current.preview).toBeNull()
    expect(result.current.tabs).not.toContain('document')
  })

  it('fonctions stables pour les liens : `update`, `showDocument`, `updateDocument`', () => {
    const { result, rerender } = setup()
    const first = result.current
    rerender({ ...initialProps, conversationId: 'c2' })
    expect(result.current.update).toBe(first.update)
    expect(result.current.showDocument).toBe(first.showDocument)
    expect(result.current.updateDocument).toBe(first.updateDocument)
  })
})

describe('ouverture d’office sur « Session » (fiche 166)', () => {
  const eligible = { eligible: true, sidebarOpen: true }
  const withRoom = (width: number) =>
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })

  it('à l’ouverture d’une conversation non vide, s’il reste 500 px ; pas en fenêtre étroite', () => {
    withRoom(1280)
    const { result, rerender } = setup({ autoOpen: { eligible: false, sidebarOpen: true } })
    expect(result.current.open).toBe(false)
    // Premier message : la conversation n'est plus vide.
    rerender({ ...initialProps, autoOpen: eligible })
    expect(result.current).toMatchObject({ open: true, tab: 'session' })
    withRoom(900)
    localStorage.clear()
    const narrow = setup({ conversationId: 'c2', autoOpen: eligible })
    expect(narrow.result.current.open).toBe(false)
  })

  it('fermé par l’utilisateur : ne se rouvre plus de lui-même pour cette conversation', () => {
    withRoom(1280)
    const { result, rerender, run } = setup({ autoOpen: eligible })
    expect(result.current.open).toBe(true)
    run(() => result.current.update({ open: false }))
    rerender({ ...initialProps, conversationId: 'c2', autoOpen: eligible })
    expect(result.current).toMatchObject({ open: true, tab: 'session' })
    // Fermé dans c2 aussi ; retour dans c1 : il reste fermé.
    run(() => result.current.update({ open: false }))
    rerender({ ...initialProps, conversationId: 'c1', autoOpen: eligible })
    expect(result.current.open).toBe(false)
    // Une conversation jamais refusée l'ouvre toujours.
    rerender({ ...initialProps, conversationId: 'c3', autoOpen: eligible })
    expect(result.current.open).toBe(true)
  })

  it('panneau déjà ouvert : il garde son onglet', () => {
    withRoom(1280)
    localStorage.setItem('bobine.panel', JSON.stringify({ open: true, tab: 'browser', width: 380 }))
    const { result, rerender } = setup()
    rerender({ ...initialProps, conversationId: 'c2', autoOpen: eligible })
    expect(result.current).toMatchObject({ open: true, tab: 'browser' })
  })
})
