import { createEvent, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { DropOverlay } from './components/composer/DropOverlay'
import { ComposerInbox, useFileDrop } from './useFileDrop'

/**
 * Fichiers glissés sur la conversation (fiche 026) : remplace la vérification de composant de
 * `e2e/suites/attachments.mjs` (n° 7). La conversation (App, volet d'à côté) rend l'indication
 * comme ici ; le vrai glisser du Finder reste à l'e2e.
 */

function Conversation({ inbox }: { inbox: ComposerInbox }) {
  const [box] = useState(inbox)
  const drop = useFileDrop(box)
  return (
    <section data-testid="conversation" {...drop.handlers}>
      {drop.dragging && <DropOverlay />}
      <p>Fil</p>
    </section>
  )
}

/**
 * Évènement de glisser avec le type « Files », comme depuis le Finder : aucun jeton de l'arbre de
 * l'onglet Fichiers (`getData` rend une chaîne vide pour un type absent, comme Chromium).
 */
function drag(type: 'dragEnter' | 'dragLeave' | 'drop', target: Element, files: File[] = []) {
  const event = createEvent[type](target)
  Object.defineProperty(event, 'dataTransfer', {
    value: { types: ['Files'], files, dropEffect: 'none', getData: () => '' }
  })
  fireEvent(target, event)
}

describe('fichiers glissés sur la conversation', () => {
  it('au survol : l’indication sur toute la conversation ; partie à la sortie (attachments n° 7)', () => {
    render(<Conversation inbox={new ComposerInbox()} />)
    const conversation = screen.getByTestId('conversation')
    drag('dragEnter', conversation)
    const overlay = screen.getByTestId('drop-overlay')
    expect(conversation.contains(overlay)).toBe(true)
    expect(overlay.textContent?.trim()).not.toBe('')
    drag('dragLeave', conversation)
    expect(screen.queryByTestId('drop-overlay')).toBeNull()
  })

  it('déposés : l’indication part, les fichiers vont à la zone de saisie', () => {
    const inbox = new ComposerInbox()
    const deliver = vi.spyOn(inbox, 'deliver')
    render(<Conversation inbox={inbox} />)
    const conversation = screen.getByTestId('conversation')
    const file = new File(['x'], 'notes.md', { type: 'text/markdown' })
    drag('dragEnter', conversation)
    drag('drop', conversation, [file])
    expect(screen.queryByTestId('drop-overlay')).toBeNull()
    expect(deliver).toHaveBeenCalledWith([file])
  })
})
