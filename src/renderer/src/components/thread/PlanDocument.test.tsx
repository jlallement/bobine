import { fireEvent, render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { PlanVersion } from '@shared/plan-doc'
import styles from '../../styles.css?raw'
import { PlanDocument } from './PlanDocument'

const plan: PlanVersion = {
  series: 'plan.md',
  source: 'file',
  path: '/depot/plan.md',
  text: '# Plan\n\n1. Écrire un script Node maison.\n2. Vérifier.',
  version: 1,
  anchorId: 1,
  replyIds: [],
  latest: true
}

beforeAll(() => {
  // La vraie feuille de style de l'app : jsdom applique la cascade (pas la mise en page).
  const style = document.createElement('style')
  style.textContent = styles
  document.head.append(style)
  // jsdom ne mesure pas les passages sélectionnés.
  Range.prototype.getBoundingClientRect = () => new DOMRect(10, 10, 80, 16)
})

/** Sélectionne un passage du plan, le commente, puis « Ajouter la remarque ». */
function addNote(quote: string, comment: string) {
  const body = screen.getByTestId('plan-body')
  const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT)
  let node = walker.nextNode()
  while (node && !node.nodeValue?.includes(quote)) node = walker.nextNode()
  if (!node) throw new Error(`passage introuvable : ${quote}`)
  const at = node.nodeValue?.indexOf(quote) ?? 0
  const range = document.createRange()
  range.setStart(node, at)
  range.setEnd(node, at + quote.length)
  window.getSelection()?.removeAllRanges()
  window.getSelection()?.addRange(range)
  fireEvent.mouseUp(body)
  fireEvent.click(screen.getByTestId('plan-comment'))
  fireEvent.change(screen.getByTestId('plan-note-input'), { target: { value: comment } })
  fireEvent.click(screen.getByTestId('plan-note-add'))
}

describe('barre du plan (fiches 040, 124)', () => {
  it('boutons ancrés à droite : ni leur place ni leur ordre ne suivent le texte d’aide', () => {
    const actions = {
      busy: false,
      conversationId: 'c-barre',
      onSendNotes: vi.fn(),
      onExecute: vi.fn()
    }
    render(<PlanDocument plan={plan} actions={actions} />)
    const bar = () => screen.getByTestId('plan-actions')
    const buttons = () => screen.getByTestId('plan-buttons')
    const before = {
      group: buttons(),
      send: screen.getByTestId('plan-send-notes'),
      execute: screen.getByTestId('plan-execute')
    }
    expect(screen.getByTestId('plan-document-hint').textContent).toBe(
      'Sélectionnez un passage pour le commenter.'
    )

    addNote('script Node maison', 'Utilise Vitest.')

    expect(screen.getByTestId('plan-document-hint').textContent).toBe('1 remarque')
    // Mêmes boutons, dans le même groupe, à la même place : dernier élément de la barre.
    expect(buttons()).toBe(before.group)
    expect(bar().lastElementChild).toBe(before.group)
    expect([...before.group.children]).toEqual([before.send, before.execute])
    // Le groupe est poussé au bord droit et ne rétrécit pas ; le texte d'aide prend le reste.
    const group = getComputedStyle(before.group)
    expect(group.marginLeft).toBe('auto')
    expect(group.flexShrink).toBe('0')
    for (const button of [before.send, before.execute]) {
      expect(getComputedStyle(button).whiteSpace).toBe('nowrap')
    }
    expect(getComputedStyle(screen.getByTestId('plan-document-hint')).minWidth).toBe('0px')
    // « Exécuter le plan » reste tout à droite : un clic au même endroit n'exécute pas.
    fireEvent.click(before.send)
    expect(actions.onSendNotes).toHaveBeenCalledOnce()
    expect(actions.onExecute).not.toHaveBeenCalled()
  })

  it('formulaire replié, remarque retirée : la barre ne remonte pas sous le pointeur (D27)', () => {
    const actions = {
      busy: false,
      conversationId: 'c-pied',
      onSendNotes: vi.fn(),
      onExecute: vi.fn()
    }
    // jsdom ne mesure rien : hauteur de la zone des remarques au moment où elle est gardée.
    const height = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(180)
    render(<PlanDocument plan={plan} actions={actions} />)
    const card = screen.getByTestId('plan-document')
    const bar = screen.getByTestId('plan-actions')
    /** Ce qui précède la barre dans la carte : sa hauteur fait la place de la barre. */
    const above = () => [...card.children].slice(0, [...card.children].indexOf(bar))
    const kept = () => screen.queryByTestId('plan-review')?.style.minHeight
    fireEvent.pointerEnter(card)

    // Formulaire ouvert au-dessus de la barre, puis replié par « Ajouter la remarque » : la zone
    // qui le contenait garde sa hauteur, la barre reste où elle était.
    const body = screen.getByTestId('plan-body')
    const select = (quote: string) => {
      const range = document.createRange()
      const node = [...body.querySelectorAll('li')].find((li) => li.textContent?.includes(quote))
      range.selectNodeContents(node ?? body)
      window.getSelection()?.removeAllRanges()
      window.getSelection()?.addRange(range)
      fireEvent.mouseUp(body)
      fireEvent.click(screen.getByTestId('plan-comment'))
    }
    select('script Node maison')
    const withEditor = above()
    const review = screen.getByTestId('plan-review')
    expect(withEditor.at(-1)).toBe(review)
    expect(review.contains(screen.getByTestId('plan-note-editor'))).toBe(true)
    expect(kept()).toBe('')
    fireEvent.change(screen.getByTestId('plan-note-input'), {
      target: { value: 'Utilise Vitest.' }
    })
    fireEvent.click(screen.getByTestId('plan-note-add'))
    expect(screen.queryByTestId('plan-note-editor')).toBeNull()
    expect(above()).toEqual(withEditor)
    expect(kept()).toBe('180px')
    // La remarque prend la place du haut du formulaire, pas celle du bouton sous le pointeur.
    expect(review.firstElementChild).toBe(screen.getByTestId('plan-notes'))
    // Pointeur sorti de la carte : la zone se resserre.
    fireEvent.pointerLeave(card)
    expect(kept()).toBe('')

    // Échap ou « Annuler » : pareil.
    fireEvent.pointerEnter(card)
    select('Vérifier')
    fireEvent.keyDown(screen.getByTestId('plan-note-input'), { key: 'Escape' })
    expect(above()).toEqual(withEditor)
    expect(kept()).toBe('180px')
    fireEvent.pointerLeave(card)

    // Remarque retirée, pointeur sur la carte : même hauteur gardée, même sans remarque.
    fireEvent.pointerEnter(card)
    fireEvent.click(screen.getByRole('button', { name: /1/ }))
    expect(screen.queryByTestId('plan-notes')).toBeNull()
    expect(above()).toEqual(withEditor)
    expect(kept()).toBe('180px')
    fireEvent.pointerLeave(card)
    expect(screen.queryByTestId('plan-review')).toBeNull()

    // Remarque ajoutée au clavier, pointeur ailleurs : rien n'est gardé.
    select('script Node maison')
    fireEvent.change(screen.getByTestId('plan-note-input'), { target: { value: 'Vitest.' } })
    fireEvent.keyDown(screen.getByTestId('plan-note-input'), { key: 'Enter' })
    expect(kept()).toBe('')
    height.mockRestore()
  })
})
