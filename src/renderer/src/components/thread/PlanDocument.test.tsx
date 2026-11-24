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

/**
 * Remplaçants des vérifications de composant de `e2e/suites/plan.mjs` (n° 1, 5, 9, 11). Le plan
 * lu dans `plan.md` reste à `plan-doc.test.ts` ; la couleur réelle du surlignage, à la capture.
 */
describe('plan annoté — remplaçants des e2e', () => {
  const actions = (conversationId: string) => ({
    busy: false,
    conversationId,
    onSendNotes: vi.fn(),
    onExecute: vi.fn()
  })

  it('mode plan : `plan.md` affiché comme document, version 1, Markdown rendu (plan n° 1)', () => {
    render(<PlanDocument plan={plan} actions={actions('c-doc')} />)
    const card = screen.getByTestId('plan-document')
    expect(card.getAttribute('data-version')).toBe('1')
    expect(card.querySelector('.plan-document-title')?.textContent).toBe('plan.md')
    expect(card.querySelector('.plan-document-version')?.textContent).toBe('version 1')
    const body = screen.getByTestId('plan-body')
    expect(body.querySelector('h1')?.textContent).toBe('Plan')
    expect([...body.querySelectorAll('ol > li')].map((li) => li.textContent)).toEqual([
      'Écrire un script Node maison.',
      'Vérifier.'
    ])
  })

  it('passage commenté : la remarque listée, le passage surligné (plan n° 5)', () => {
    // jsdom n'a pas la CSS Custom Highlight API : une doublure qui garde les passages.
    const registry = new Map<string, { ranges: Range[] }>()
    const css = globalThis.CSS as unknown as Record<string, unknown> | undefined
    const before = {
      highlights: css?.highlights,
      Highlight: (globalThis as Record<string, unknown>).Highlight
    }
    if (css) css.highlights = registry
    ;(globalThis as Record<string, unknown>).Highlight = class {
      ranges: Range[]
      constructor(...ranges: Range[]) {
        this.ranges = ranges
      }
    }
    try {
      render(<PlanDocument plan={plan} actions={actions('c-surligne')} />)
      addNote('script Node maison', 'Plutôt un outil existant')
      const notes = screen.getByTestId('plan-notes')
      expect(notes.querySelector('blockquote')?.textContent).toBe('script Node maison')
      expect((notes.querySelector('textarea') as HTMLTextAreaElement).value).toBe(
        'Plutôt un outil existant'
      )
      const ranges = registry.get('plan-notes')?.ranges ?? []
      expect(ranges.map((r) => r.toString())).toEqual(['script Node maison'])
      expect(screen.getByTestId('plan-document-hint').textContent).toBe('1 remarque')
    } finally {
      if (css) css.highlights = before.highlights
      ;(globalThis as Record<string, unknown>).Highlight = before.Highlight
    }
  })

  it('version 2 : « Voir ce qui a changé » montre le diff, puis revient au plan (plan n° 9)', () => {
    render(
      <PlanDocument
        plan={{
          ...plan,
          version: 2,
          previous: plan.text,
          text: '# Plan\n\n1. Utiliser un outil existant.\n2. Vérifier.'
        }}
        actions={actions('c-diff')}
      />
    )
    const toggle = screen.getByTestId('plan-diff-toggle')
    expect(toggle.textContent?.trim()).toBe('Voir ce qui a changé')
    fireEvent.click(toggle)
    const diff = screen.getByTestId('plan-diff')
    expect(diff.querySelector('.diff-del')?.textContent).toContain('Écrire un script Node maison.')
    expect(diff.querySelector('.diff-add')?.textContent).toContain('Utiliser un outil existant.')
    expect(screen.queryByTestId('plan-body')).toBeNull()
    fireEvent.click(screen.getByTestId('plan-diff-toggle'))
    expect(screen.getByTestId('plan-body')).toBeTruthy()
  })

  it('plan exécuté : « Exécuter » désactivé, « Plan déjà exécuté » (plan n° 11)', () => {
    const a = actions('c-execute')
    render(<PlanDocument plan={{ ...plan, executed: true }} actions={a} />)
    const execute = screen.getByTestId('plan-execute') as HTMLButtonElement
    expect(execute.disabled).toBe(true)
    expect((screen.getByTestId('plan-send-notes') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByTestId('plan-document-hint').textContent).toBe('Plan déjà exécuté')
    fireEvent.click(execute)
    expect(a.onExecute).not.toHaveBeenCalled()
  })
})
