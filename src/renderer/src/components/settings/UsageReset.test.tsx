import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ResetCard } from './UsageReset'

const original = window.api
let reset: ReturnType<typeof vi.fn>

beforeEach(() => {
  reset = vi.fn(async () => undefined)
  window.api = { ...original, usage: { reset } } as unknown as Window['api']
})
afterEach(() => {
  window.api = original
})

describe('Réglages › Données › Remettre à zéro (fiches 137 et 144)', () => {
  it('confirmation dans l’app ; « Garder » n’efface rien ; confirmé, le journal est vidé', async () => {
    const onReset = vi.fn()
    render(<ResetCard onReset={onReset} />)
    expect(screen.getByText(/Mon activité › Exporter… › Tout l’historique/)).toBeTruthy()
    fireEvent.click(screen.getByTestId('usage-reset'))
    fireEvent.click(screen.getByTestId('confirm-row-keep'))
    expect(screen.queryByTestId('confirm-row')).toBeNull()
    expect(reset).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('usage-reset'))
    await act(async () => {
      fireEvent.click(screen.getByTestId('confirm-row-confirm'))
    })
    expect(reset).toHaveBeenCalledTimes(1)
    expect(onReset).toHaveBeenCalledOnce()
    expect(screen.getByTestId('usage-reset-note').textContent).toContain('remise à zéro')
  })
})
