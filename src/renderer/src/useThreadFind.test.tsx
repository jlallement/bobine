import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useRef, useState } from 'react'
import * as Tooltip from '@radix-ui/react-tooltip'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FindBar } from './components/thread/FindBar'
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

/**
 * La barre ⌘F branchée sur le fil comme dans `App` : remplace les vérifications de composant de
 * `e2e/suites/history.mjs` (n° 3, 5, 7). Le passage réel de ⌘K à ⌘F (conversation chargée puis
 * barre ouverte) reste dans `App` ; ici, la barre ouverte avec la recherche reprise.
 */
describe('barre de recherche du fil (fiche 086)', () => {
  // jsdom n'a pas la CSS Custom Highlight API : une doublure qui garde les passages surlignés.
  const highlights = new Map<string, { ranges: Range[] }>()
  const css = globalThis.CSS as unknown as Record<string, unknown>
  const saved = {
    highlights: css.highlights,
    Highlight: (globalThis as Record<string, unknown>).Highlight
  }
  beforeEach(() => {
    // jsdom ne fait pas défiler : amener le résultat au centre n'a rien à faire.
    Element.prototype.scrollBy ??= () => {}
    highlights.clear()
    css.highlights = highlights
    ;(globalThis as Record<string, unknown>).Highlight = class {
      ranges: Range[]
      constructor(...ranges: Range[]) {
        this.ranges = ranges
      }
    }
  })
  afterEach(() => {
    css.highlights = saved.highlights
    ;(globalThis as Record<string, unknown>).Highlight = saved.Highlight
  })

  function Host() {
    const container = useRef<HTMLDivElement>(null)
    const [find, setFind] = useState({ open: false, query: '', focus: 0 })
    const threadFind = useThreadFind({
      container,
      query: find.query,
      active: find.open,
      content: 'fil',
      conversation: 'c1'
    })
    return (
      <Tooltip.Provider>
        <button
          data-testid="search-then-find"
          onClick={() => setFind((f) => ({ open: true, query: 'jeton', focus: f.focus + 1 }))}
        />
        {find.open && (
          <FindBar
            query={find.query}
            count={threadFind.count}
            pending={threadFind.pending}
            current={threadFind.current}
            focus={find.focus}
            onQuery={(query) => setFind((f) => ({ ...f, query }))}
            onNext={threadFind.next}
            onPrevious={threadFind.previous}
            onClose={() => setFind((f) => ({ ...f, open: false }))}
          />
        )}
        <div ref={container}>
          <p>un jeton</p>
          <p>deux jeton</p>
          <p>trois jeton</p>
        </div>
      </Tooltip.Provider>
    )
  }

  const current = () => highlights.get('thread-find-current')?.ranges[0]?.startContainer.textContent
  const findCount = () => screen.getByTestId('find-count').textContent

  async function openWithQuery() {
    render(<Host />)
    await act(async () => fireEvent.click(screen.getByTestId('search-then-find')))
    // Le compte paraît au rendu qui suit le calcul (minuterie de `SETTLE_MS`, hors d'`act`) ; le
    // résultat courant est surligné par l'effet de ce rendu, un peu après. `waitFor` repart sur la
    // mutation du compte : attendre les deux états, sinon le test lisait le surlignage avant son
    // effet (sous charge : « expected undefined to be 'un jeton' »).
    await waitFor(() => {
      expect(findCount()).toBe('1 / 3')
      expect(current()).toBe('un jeton')
    })
  }

  it('recherche reprise : premier résultat surligné, le champ a le focus (history n° 3)', async () => {
    await openWithQuery()
    const input = screen.getByTestId('find-input') as HTMLInputElement
    expect(input.value).toBe('jeton')
    expect(document.activeElement).toBe(input)
    expect(highlights.get('thread-find')?.ranges).toHaveLength(3)
    expect(current()).toBe('un jeton')
  })

  it('plusieurs résultats : Entrée suivant, ⇧Entrée précédent, en boucle (history n° 7)', async () => {
    await openWithQuery()
    const input = screen.getByTestId('find-input')
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(findCount()).toBe('2 / 3'))
    expect(current()).toBe('deux jeton')
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true })
    await waitFor(() => expect(findCount()).toBe('1 / 3'))
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true })
    await waitFor(() => expect(findCount()).toBe('3 / 3'))
    expect(current()).toBe('trois jeton')
  })

  it('Échap : barre fermée, surlignage retiré (history n° 5)', async () => {
    await openWithQuery()
    fireEvent.keyDown(screen.getByTestId('find-input'), { key: 'Escape' })
    expect(screen.queryByTestId('find-bar')).toBeNull()
    await waitFor(() => expect(highlights.size).toBe(0))
  })
})
