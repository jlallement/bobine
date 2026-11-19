import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { useConversations } from './useConversations'

const originalApi = window.api

/**
 * `window.api` factice : chaque appel rend une promesse qui n'aboutit jamais, chaque abonnement
 * (`on…`) un désabonnement vide. Le hook se monte sans rien recevoir du main.
 */
function silentApi(): Window['api'] {
  const namespace = new Proxy(
    {},
    {
      get: (_target, name) =>
        typeof name === 'string' && /^on[A-Z]/.test(name)
          ? () => () => {}
          : () => new Promise(() => {})
    }
  )
  return new Proxy({}, { get: () => namespace }) as Window['api']
}

beforeEach(() => {
  window.api = silentApi()
})
afterEach(() => {
  window.api = originalApi
})

it('fonctions en dépendances d’effets : les mêmes d’un rendu à l’autre (fiche 253)', () => {
  const { result, rerender } = renderHook(() => useConversations())
  const before = result.current
  const beside = before.actionsFor('c2')
  rerender()
  // Volet côte à côte : recherche `@` (useMentions) ; dialogue de suppression : ses lectures.
  expect(result.current.actionsFor('c2')).toBe(beside)
  expect(result.current.actionsFor('c2').searchFiles).toBe(beside.searchFiles)
  expect(result.current.worktreeStatus).toBe(before.worktreeStatus)
  expect(result.current.family).toBe(before.family)
  expect(result.current.searchFiles).toBe(before.searchFiles)
})
