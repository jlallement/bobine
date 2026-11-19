import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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

/** Compte affiché, relu jusqu'à ce qu'il vaille `expected` (fiche 250 : pas de pause devinée). */
const countIs = (expected: string) =>
  waitFor(() => expect(screen.getByTestId('count').textContent).toBe(expected), {
    timeout: 5000
  })

describe('useThreadFind (relecture fiche 192)', () => {
  it('le contenu d’une carte change pendant la recherche : le compte suit', async () => {
    render(<Thread query="jeton" />)
    await countIs('1')
    // Le fil n'a pas changé (`content` identique) : seule la page a bougé, le compte suit.
    fireEvent.click(screen.getByTestId('reveal'))
    await countIs('3')
  })
})
