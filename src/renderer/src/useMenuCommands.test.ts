import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MenuCommand } from '@shared/shortcuts'
import { useMenuCommands } from './useMenuCommands'

const originalApi = window.api
let listener: ((command: MenuCommand) => void) | undefined
const unsubscribe = vi.fn()
const onCommand = vi.fn((l: (command: MenuCommand) => void) => {
  listener = l
  return unsubscribe
})

beforeEach(() => {
  listener = undefined
  onCommand.mockClear()
  unsubscribe.mockClear()
  window.api = { ...originalApi, app: { onCommand } } as unknown as Window['api']
})
afterEach(() => {
  window.api = originalApi
})

/** Table des commandes : seulement celles qui servent à l'essai. */
const commands = (some: Partial<Record<MenuCommand, () => void>>) =>
  some as Record<MenuCommand, () => void>

describe('commandes du menu (fiche 027)', () => {
  it('un seul abonnement, quel que soit le nombre de rendus ; défait au démontage', () => {
    const { rerender, unmount } = renderHook(
      (c: Record<MenuCommand, () => void>) => useMenuCommands(c),
      { initialProps: commands({}) }
    )
    rerender(commands({}))
    rerender(commands({}))
    expect(onCommand).toHaveBeenCalledTimes(1)
    unmount()
    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('la commande faite est celle du dernier rendu', () => {
    const first = vi.fn()
    const second = vi.fn()
    const { rerender } = renderHook((c: Record<MenuCommand, () => void>) => useMenuCommands(c), {
      initialProps: commands({ search: first })
    })
    rerender(commands({ search: second }))
    act(() => listener?.('search'))
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('une commande inconnue ne fait rien', () => {
    renderHook(() => useMenuCommands(commands({})))
    expect(() => listener?.('search')).not.toThrow()
  })
})
