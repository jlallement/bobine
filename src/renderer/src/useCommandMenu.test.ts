import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { AgentCommand } from '@shared/agent'
import { useCommandMenu } from './useCommandMenu'

const commands: AgentCommand[] = [
  { name: 'scenario', description: 'Joue un scénario', hint: '<nom>' },
  { name: 'compact', description: 'Résume la conversation' }
]

describe('menu des commandes « / » (fiche 089)', () => {
  it('ouvert pendant la saisie du nom, filtré ; Échap le referme jusqu’au texte suivant', () => {
    const { result, rerender } = renderHook(({ text }) => useCommandMenu(text, commands), {
      initialProps: { text: '/sc' }
    })
    expect(result.current.open).toBe(true)
    expect(result.current.matches.map((c) => c.name)).toEqual(['scenario'])
    act(() => result.current.dismiss())
    expect(result.current.open).toBe(false)
    // Toujours une commande : le menu reste fermé.
    act(() => result.current.textChanged('/s'))
    rerender({ text: '/s' })
    expect(result.current.open).toBe(false)
    // Plus une commande, puis de nouveau : il se rouvre.
    act(() => result.current.textChanged('bonjour'))
    rerender({ text: '/c' })
    expect(result.current.open).toBe(true)
  })

  it('commande complétée : rappel de l’argument attendu ; surlignage remis en tête', () => {
    const { result, rerender } = renderHook(({ text }) => useCommandMenu(text, commands), {
      initialProps: { text: '/' }
    })
    act(() => result.current.setActive(1))
    expect(result.current.active).toBe(1)
    act(() => result.current.textChanged('/scenario '))
    rerender({ text: '/scenario ' })
    expect(result.current.active).toBe(0)
    expect(result.current.open).toBe(false)
    expect(result.current.typed).toBe('scenario')
    expect(result.current.pendingHint).toBe('<nom>')
  })
})
