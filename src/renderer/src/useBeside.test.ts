import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ConversationSummary } from '@shared/agent'
import { useBeside } from './useBeside'
import type { Conversation, Conversations } from './useConversations'

const summary = (id: string) => ({ id, title: id, draft: false }) as ConversationSummary
const loaded = (id: string) => ({ snapshot: null, transcript: { id } }) as unknown as Conversation

type Fake = Parameters<typeof useBeside>[0]['conversations']

function fakeConversations(activeId: string, ids: string[]): Fake {
  return {
    list: ids.map(summary),
    activeId,
    loaded: Object.fromEntries(ids.map((id) => [id, loaded(id)])),
    openBeside: vi.fn(),
    releaseBeside: vi.fn(),
    select: vi.fn()
  } satisfies Pick<Conversations, keyof Fake>
}

function setup(conversations = fakeConversations('a', ['a', 'b', 'c'])) {
  const openFileLink = vi.fn()
  const hook = renderHook((c: Fake) => useBeside({ conversations: c, openFileLink }), {
    initialProps: conversations
  })
  return { ...hook, c: conversations, openFileLink }
}

describe('vue côte à côte (fiche 036)', () => {
  it('rien à côté au départ', () => {
    const { result } = setup()
    expect(result.current.summary).toBeUndefined()
    expect(result.current.view).toBeUndefined()
  })

  it('ouverte : chargée à part, affichée avec son fil', () => {
    const { result, c } = setup()
    act(() => result.current.open('b'))
    expect(c.openBeside).toHaveBeenCalledWith('b')
    expect(result.current.summary?.id).toBe('b')
    expect(result.current.view).toBe(c.loaded['b'])
  })

  it('une autre à la place : la précédente est relâchée, pas celle qu’on rouvre', () => {
    const { result, c } = setup()
    act(() => result.current.open('b'))
    act(() => result.current.open('b'))
    expect(c.releaseBeside).not.toHaveBeenCalled()
    act(() => result.current.open('c'))
    expect(c.releaseBeside).toHaveBeenCalledWith('b')
    expect(result.current.summary?.id).toBe('c')
  })

  it('fermée : relâchée', () => {
    const { result, c } = setup()
    act(() => result.current.open('b'))
    act(() => result.current.close())
    expect(c.releaseBeside).toHaveBeenCalledWith('b')
    expect(result.current.summary).toBeUndefined()
  })

  it('devenue l’active : plus affichée à côté', () => {
    const { result, rerender, c } = setup()
    act(() => result.current.open('b'))
    rerender({ ...c, activeId: 'b' })
    expect(result.current.summary).toBeUndefined()
  })

  it('« au premier plan » : fermée à côté, puis choisie', () => {
    const { result, c } = setup()
    act(() => result.current.open('b'))
    act(() => result.current.focus())
    expect(c.releaseBeside).toHaveBeenCalledWith('b')
    expect(c.select).toHaveBeenCalledWith('b')
    expect(result.current.summary).toBeUndefined()
  })

  it('ses liens s’ouvrent dans son dossier ; sans elle, pas de travail de sous-agent', async () => {
    const { result, openFileLink } = setup()
    await expect(result.current.loadSubagentWork('t1')).rejects.toThrow(
      'Aucune conversation à côté.'
    )
    act(() => result.current.open('b'))
    act(() => result.current.openLink('notes.md', { reveal: false }))
    expect(openFileLink).toHaveBeenCalledWith('b', 'notes.md', { reveal: false })
  })
})
