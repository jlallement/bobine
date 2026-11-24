import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TipsRow } from './TipsRow'

/**
 * Réglages › Général › « Astuces de Bobine » (fiche 191) : remplace les vérifications de composant
 * de l'e2e `astuces` (n° 7, 8). Le quota et les astuces masquées gardés sur le disque sont dans
 * `settings-store.test.ts` (main).
 */

const api = window.api
let reset: ReturnType<typeof vi.fn>

beforeEach(() => {
  reset = vi.fn(async () => ({ hidden: [], quietMs: 0 }))
  Object.assign(window, {
    api: { ...api, tips: { state: async () => ({ hidden: ['context'], quietMs: 0 }), reset } }
  })
})
afterEach(() => {
  Object.assign(window, { api })
})

describe('Réglages › Général : astuces (fiche 191)', () => {
  it('activées : case cochée et « 1 astuce masquée » ; décochées, la préférence part', async () => {
    const onChange = vi.fn()
    render(<TipsRow enabled onChange={onChange} />)
    expect((screen.getByTestId('settings-tips') as HTMLInputElement).checked).toBe(true)
    await waitFor(() =>
      expect(screen.getByTestId('settings-tips-hidden').textContent).toBe('1 astuce masquée')
    )
    fireEvent.click(screen.getByTestId('settings-tips'))
    expect(onChange).toHaveBeenCalledWith(false)
  })

  it('« Tout réafficher » : plus rien de masqué, le compte et le lien s’en vont', async () => {
    render(<TipsRow enabled onChange={vi.fn()} />)
    await screen.findByTestId('settings-tips-reset')
    await act(async () => {
      fireEvent.click(screen.getByTestId('settings-tips-reset'))
    })
    expect(reset).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('settings-tips-hidden')).toBeNull()
    expect(screen.queryByTestId('settings-tips-reset')).toBeNull()
  })
})
