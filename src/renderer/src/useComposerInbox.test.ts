import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useComposerInbox, type ComposerArrivals } from './useComposerInbox'
import { ComposerInbox } from './useFileDrop'

// Le terminal (xterm.js) n'a rien à faire ici : seule sa constante d'évènement est utilisée.
vi.mock('./components/panel/TerminalTab', () => ({ INSERT_TEXT_EVENT: 'bob:insert-text' }))

const arrivals = (): ComposerArrivals => ({
  files: vi.fn(),
  text: vi.fn(),
  restore: vi.fn(),
  insert: vi.fn()
})

describe('ce qui arrive dans la zone de saisie (fiche 089)', () => {
  it('message repris de la fenêtre rapide pour cette conversation, extrait du terminal', () => {
    const inbox = new ComposerInbox()
    const first = arrivals()
    const { rerender, unmount } = renderHook(
      ({ handlers }) => useComposerInbox(inbox, 'c1', handlers),
      {
        initialProps: { handlers: first }
      }
    )
    // Les fonctions les plus récentes sont appelées, sans nouvel abonnement.
    const latest = arrivals()
    rerender({ handlers: latest })
    inbox.prefill({ id: 'c1', text: 'Bonjour', attachments: [] })
    expect(latest.restore).toHaveBeenCalledWith('Bonjour', [])
    expect(first.restore).not.toHaveBeenCalled()
    window.dispatchEvent(new CustomEvent('bob:insert-text', { detail: '$ ls' }))
    expect(latest.insert).toHaveBeenCalledWith('$ ls')
    unmount()
    window.dispatchEvent(new CustomEvent('bob:insert-text', { detail: '$ pwd' }))
    expect(latest.insert).toHaveBeenCalledTimes(1)
  })
})
