import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it } from 'vitest'
import type { ConversationSummary, ConversationsState } from '@shared/agent'
import { useConversations } from './useConversations'

const originalApi = window.api

const mother = { id: 'm', title: 'Mère' } as ConversationSummary
const child = {
  id: 'f',
  title: 'Fille',
  startedFrom: { id: 'm', title: 'Mère' }
} as ConversationSummary
const other = { id: 'o', title: 'Autre' } as ConversationSummary

/** Suppression en attente, finie par le test. */
let settle: { resolve: (state: ConversationsState) => void; reject: (error: Error) => void }
/** Appels de `conversations.removing` (porte du preload). */
let gated: [string[], boolean][] = []
/** Liste poussée par le main (`conversations:changed`). */
let pushList: (state: ConversationsState) => void = () => {}

/**
 * `window.api` factice : la liste (mère active, sa fille, une autre), une vue vide pour chacune, et
 * une suppression qui attend le test ; tout le reste ne répond jamais.
 */
function fakeApi(list: ConversationsState): Window['api'] {
  const never = () => new Promise(() => {})
  const namespace = (own: Record<string, unknown> = {}) =>
    new Proxy(own, {
      get: (target, name) =>
        typeof name === 'string' && name in target
          ? target[name]
          : typeof name === 'string' && /^on[A-Z]/.test(name)
            ? () => () => {}
            : never
    })
  const conversations = namespace({
    get: async () => list,
    onChanged: (listener: (state: ConversationsState) => void) => {
      pushList = listener
      return () => {}
    },
    view: async (id: string) => ({
      summary: { id },
      snapshot: null,
      transcript: { items: [] }
    }),
    removing: (ids: readonly string[], on: boolean) => gated.push([[...ids], on]),
    delete: () =>
      new Promise<ConversationsState>((resolve, reject) => {
        settle = { resolve, reject }
      })
  })
  return new Proxy(
    {},
    {
      get: (_target, name) => (name === 'conversations' ? conversations : namespace())
    }
  ) as Window['api']
}

beforeEach(() => {
  gated = []
  window.api = fakeApi({
    conversations: [mother, child, other],
    activeId: 'm'
  } as ConversationsState)
})
afterEach(() => {
  window.api = originalApi
})

it('conversation en cours de suppression : plus interrogée en tâche de fond (recette rc.4)', async () => {
  const { result } = renderHook(() => useConversations())
  await waitFor(() => expect(result.current.activeId).toBe('m'))
  expect(result.current.queryId).toBe('m')

  // Mère supprimée avec ses filles : ni elle, ni sa fille, le temps que le main finisse.
  act(() => result.current.remove('m', { children: 'delete' }))
  expect(result.current.queryId).toBeNull()
  // Toutes les lectures, pas seulement git et commandes : la porte du preload les refuse.
  expect(gated).toEqual([[['m', 'f'], true]])

  // Suppression refusée : la conversation est de nouveau interrogée.
  await act(async () => settle.reject(new Error('refusée')))
  await waitFor(() => expect(result.current.queryId).toBe('m'))
  expect(gated).toEqual([
    [['m', 'f'], true],
    [['m', 'f'], false]
  ])
})

it('suppression finie : la nouvelle conversation active est interrogée', async () => {
  const { result } = renderHook(() => useConversations())
  await waitFor(() => expect(result.current.activeId).toBe('m'))
  act(() => result.current.remove('m', { children: 'delete' }))
  // Le main a retiré la mère, la liste n'a pas encore changé d'active : rien n'est demandé.
  expect(result.current.queryId).toBeNull()
  act(() => pushList({ conversations: [other], activeId: 'o' } as ConversationsState))
  expect(result.current.queryId).toBe('o')
  await act(async () =>
    settle.resolve({ conversations: [other], activeId: 'o' } as ConversationsState)
  )
  expect(result.current.queryId).toBe('o')
})

it('fille affichée, mère supprimée avec ses filles : la fille non plus n’est plus interrogée', async () => {
  window.api = fakeApi({
    conversations: [mother, child, other],
    activeId: 'f'
  } as ConversationsState)
  const { result } = renderHook(() => useConversations())
  await waitFor(() => expect(result.current.activeId).toBe('f'))
  act(() => result.current.remove('m', { children: 'delete' }))
  expect(result.current.queryId).toBeNull()
  await act(async () => settle.reject(new Error('refusée')))
  await waitFor(() => expect(result.current.queryId).toBe('f'))

  // Filles gardées : la fille affichée reste interrogée.
  act(() => result.current.remove('m', { children: 'keep' }))
  expect(result.current.queryId).toBe('f')
})

it('réponse de la suppression arrivée avant la liste sans elle : toujours tue jusqu’à la liste (fiche 277)', async () => {
  const { result } = renderHook(() => useConversations())
  await waitFor(() => expect(result.current.activeId).toBe('m'))
  act(() => result.current.remove('m', { children: 'delete' }))
  // Voies distinctes : la réponse du main arrive, sa liste (et l'arrêt de l'agent) pas encore.
  await act(async () =>
    settle.resolve({ conversations: [other], activeId: 'o' } as ConversationsState)
  )
  // La mère est encore l'active du renderer : rien ne doit partir vers elle.
  expect(result.current.activeId).toBe('m')
  expect(result.current.queryId).toBeNull()
  expect(gated).toEqual([[['m', 'f'], true]])

  act(() => pushList({ conversations: [other], activeId: 'o' } as ConversationsState))
  await waitFor(() => expect(result.current.queryId).toBe('o'))
  expect(gated).toEqual([
    [['m', 'f'], true],
    [['m', 'f'], false]
  ])
})

it('liste sans la supprimée reçue : la porte ne se rouvre qu’après le rendu suivant (effets en attente, fiche 277)', async () => {
  const { result } = renderHook(() => useConversations())
  await waitFor(() => expect(result.current.activeId).toBe('m'))
  act(() => result.current.remove('m', { children: 'delete' }))
  await act(async () =>
    settle.resolve({ conversations: [other], activeId: 'o' } as ConversationsState)
  )
  // Reçue hors de `act` comme dans l'app : React n'a encore ni rendu, ni exécuté les effets du
  // rendu d'avant (qui affichait la mère). La porte doit rester fermée à cet instant.
  pushList({ conversations: [other], activeId: 'o' } as ConversationsState)
  expect(gated).toEqual([[['m', 'f'], true]])
  await waitFor(() => expect(result.current.queryId).toBe('o'))
  await waitFor(() =>
    expect(gated).toEqual([
      [['m', 'f'], true],
      [['m', 'f'], false]
    ])
  )
})
