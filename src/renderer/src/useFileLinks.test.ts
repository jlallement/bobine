import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FileLinkOutcome, MarkdownDocument } from '@shared/file-links'
import type { RuleFileView } from '@shared/rules'
import { useConversationScope, useFileLinks, type LinkNotices } from './useFileLinks'

const doc = {
  path: '/w/plan.md',
  relative: 'plan.md',
  dir: '/w',
  text: '# Plan'
} as MarkdownDocument

const open = vi.fn<(id: string, href: string, options?: object) => Promise<FileLinkOutcome>>()
const readMarkdown = vi.fn<(id: string, path: string) => Promise<MarkdownDocument>>()
const subagentWork = vi.fn<(id: string, toolCallId: string) => Promise<unknown[]>>()
const originalApi = window.api

beforeEach(() => {
  open.mockReset()
  readMarkdown.mockReset()
  subagentWork.mockReset().mockResolvedValue([])
  window.api = {
    ...originalApi,
    fileLinks: { open, readMarkdown },
    conversations: { subagentWork }
  } as unknown as Window['api']
})
afterEach(() => {
  window.api = originalApi
})

interface Props {
  conversationId: string | null
  previewConversation: string | undefined
  notices: LinkNotices
}

function setup(props: Partial<Props> = {}) {
  const panel = { showDocument: vi.fn(), update: vi.fn() }
  const notices = { info: vi.fn(), warn: vi.fn() }
  const initialProps: Props = {
    conversationId: 'c1',
    previewConversation: undefined,
    notices,
    ...props
  }
  const hook = renderHook((p: Props) => useFileLinks({ ...p, panel }), { initialProps })
  return { ...hook, panel, notices, initialProps }
}

const reveal = { reveal: false }

describe('liens de fichiers du fil (fiche 052)', () => {
  it('un .md s’ouvre en aperçu dans le panneau, avec sa conversation', async () => {
    open.mockResolvedValue({ kind: 'preview', document: doc })
    const { result, panel } = setup()
    act(() => result.current.openActiveLink('plan.md', reveal))
    expect(open).toHaveBeenCalledWith('c1', 'plan.md', reveal)
    await waitFor(() => expect(panel.showDocument).toHaveBeenCalledWith('c1', doc))
  })

  it('une page HTML s’ouvre dans le navigateur de la conversation (fiche 064)', async () => {
    open.mockResolvedValue({ kind: 'browser', path: '/w/a.html', url: 'file:///w/a.html' })
    const { result, panel } = setup()
    act(() => result.current.openActiveLink('a.html', reveal))
    await waitFor(() => expect(panel.update).toHaveBeenCalledWith({ open: true, tab: 'browser' }))
  })

  it('fichier absent : avertissement ; montré dans le Finder hors du dossier : information', async () => {
    open.mockResolvedValueOnce({ kind: 'missing', path: '/w/x.md' })
    open.mockResolvedValueOnce({ kind: 'revealed', path: '/etc/hosts', reason: 'outside' })
    const { result, notices } = setup()
    act(() => result.current.openActiveLink('x.md', reveal))
    await waitFor(() => expect(notices.warn).toHaveBeenCalledTimes(1))
    act(() => result.current.openActiveLink('/etc/hosts', reveal))
    await waitFor(() => expect(notices.info).toHaveBeenCalledTimes(1))
  })

  it('ouvert par le système : rien à dire ; erreur : avertissement', async () => {
    open.mockResolvedValueOnce({ kind: 'opened', path: '/w/a.ts' })
    open.mockRejectedValueOnce(new Error('refusé'))
    const { result, notices } = setup()
    act(() => result.current.openActiveLink('a.ts', reveal))
    act(() => result.current.openActiveLink('b.ts', reveal))
    await waitFor(() => expect(notices.warn).toHaveBeenCalledWith('refusé'))
    expect(notices.info).not.toHaveBeenCalled()
  })

  it('les avis vont à la conversation de maintenant, sans changer la fonction', async () => {
    open.mockResolvedValue({ kind: 'missing', path: '/w/x.md' })
    const { result, rerender, initialProps, notices } = setup()
    const before = result.current
    const later = { info: vi.fn(), warn: vi.fn() }
    rerender({ ...initialProps, notices: later })
    expect(result.current.openFileLink).toBe(before.openFileLink)
    expect(result.current.openActiveLink).toBe(before.openActiveLink)
    expect(result.current.loadActiveSubagentWork).toBe(before.loadActiveSubagentWork)
    act(() => result.current.openActiveLink('x.md', reveal))
    await waitFor(() => expect(later.warn).toHaveBeenCalledTimes(1))
    expect(notices.warn).not.toHaveBeenCalled()
  })

  it('autre conversation : nouvelles fonctions ; sans conversation, rien ne s’ouvre', () => {
    const { result, rerender, initialProps } = setup()
    const before = result.current
    rerender({ ...initialProps, conversationId: 'c2' })
    expect(result.current.openActiveLink).not.toBe(before.openActiveLink)
    rerender({ ...initialProps, conversationId: null })
    act(() => result.current.openActiveLink('a.md', reveal))
    expect(open).not.toHaveBeenCalled()
  })

  it('les liens du document en aperçu s’ouvrent dans sa conversation', () => {
    open.mockResolvedValue({ kind: 'opened', path: '/w/b.ts' })
    const { result } = setup({ previewConversation: 'c9' })
    act(() => result.current.openPreviewLink('b.ts', { reveal: false, base: '/w/docs' }))
    expect(open).toHaveBeenCalledWith('c9', 'b.ts', { reveal: false, base: '/w/docs' })
  })
})

describe('travail des sous-agents (fiche 053)', () => {
  it('relu pour la conversation active ; sans elle, une erreur', async () => {
    const { result, rerender, initialProps } = setup()
    await result.current.loadActiveSubagentWork('t1')
    expect(subagentWork).toHaveBeenCalledWith('c1', 't1')
    rerender({ ...initialProps, conversationId: null })
    await expect(result.current.loadActiveSubagentWork('t1')).rejects.toThrow(
      'Aucune conversation affichée.'
    )
  })

  it('d’une conversation d’à côté : son erreur à elle', async () => {
    const openFileLink = vi.fn()
    const { result } = renderHook(() => useConversationScope(null, openFileLink, 'app.noBeside'))
    await expect(result.current.loadSubagentWork('t1')).rejects.toThrow(
      'Aucune conversation à côté.'
    )
  })
})

describe('règles actives (fiche 056)', () => {
  const rule = (change: Partial<RuleFileView> = {}): RuleFileView => ({
    path: '/w/AGENTS.md',
    label: 'AGENTS.md',
    scope: 'project',
    ...change
  })

  it('une règle du dossier s’ouvre en aperçu', async () => {
    readMarkdown.mockResolvedValue(doc)
    const { result, panel } = setup()
    act(() => result.current.openRule(rule()))
    expect(readMarkdown).toHaveBeenCalledWith('c1', '/w/AGENTS.md')
    await waitFor(() => expect(panel.showDocument).toHaveBeenCalledWith('c1', doc))
  })

  it('une consigne en ligne s’ouvre dans le navigateur ; une erreur avertit', async () => {
    const windowOpen = vi.spyOn(window, 'open').mockReturnValue(null)
    readMarkdown.mockRejectedValue(new Error('illisible'))
    const { result, notices } = setup()
    act(() => result.current.openRule(rule({ path: 'https://x.test/r.md', url: true })))
    expect(windowOpen).toHaveBeenCalledWith('https://x.test/r.md')
    act(() => result.current.openRule(rule()))
    await waitFor(() => expect(notices.warn).toHaveBeenCalledWith('illisible'))
    windowOpen.mockRestore()
  })
})
