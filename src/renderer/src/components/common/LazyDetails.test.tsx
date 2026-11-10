import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { LazyDetails } from './LazyDetails'

const toggle = (details: HTMLDetailsElement, open: boolean) => {
  details.open = open
  fireEvent(details, new Event('toggle'))
}

describe('LazyDetails (fiche 192)', () => {
  it('contenu rendu au premier dépliage seulement, gardé quand on replie', () => {
    const { container } = render(
      <LazyDetails summary={<summary>Résumé</summary>}>
        <p data-testid="body">Détail</p>
      </LazyDetails>
    )
    const details = container.querySelector('details')
    if (!details) throw new Error('details absent')
    expect(screen.getByText('Résumé')).toBeTruthy()
    expect(screen.queryByTestId('body')).toBeNull()
    toggle(details, true)
    expect(screen.getByTestId('body').textContent).toBe('Détail')
    toggle(details, false)
    expect(screen.getByTestId('body')).toBeTruthy()
  })
})
