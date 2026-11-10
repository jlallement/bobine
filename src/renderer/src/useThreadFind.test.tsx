import { act, fireEvent, render, screen } from '@testing-library/react'
import { useRef, useState } from 'react'
import { describe, expect, it } from 'vitest'
import { useThreadFind } from './useThreadFind'

// jsdom n'a pas la géométrie des plages : le défilement vers le résultat n'a rien à mesurer.
Range.prototype.getBoundingClientRect = () => new DOMRect()

/** Un fil d'une carte : son contenu change sans que le fil change (contenu masqué montré). */
function Thread({ query }: { query: string }) {
  const container = useRef<HTMLDivElement>(null)
  const [card, setCard] = useState('début masqué')
  const find = useThreadFind({
    container,
    query,
    active: true,
    content: 'fil inchangé',
    conversation: 'c1'
  })
  return (
    <>
      <div ref={container}>
        <p>première réponse avec un jeton</p>
        <pre>{card}</pre>
      </div>
      <button
        data-testid="reveal"
        onClick={() => setCard('ligne masquée avec un jeton\nun autre jeton')}
      />
      <output data-testid="count">{find.pending ? '…' : find.count}</output>
    </>
  )
}

const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 400)))

describe('useThreadFind (relecture fiche 192)', () => {
  it('le contenu d’une carte change pendant la recherche : le compte suit', async () => {
    render(<Thread query="jeton" />)
    await settle()
    expect(screen.getByTestId('count').textContent).toBe('1')
    // Le fil n'a pas changé (`content` identique) : seule la page a bougé.
    fireEvent.click(screen.getByTestId('reveal'))
    // Deux pauses : le changement de la page est rendu à la fin de la première (`act`), le
    // recalcul arrive après la pause de la recherche.
    await settle()
    await settle()
    expect(screen.getByTestId('count').textContent).toBe('3')
  })
})
