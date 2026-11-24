/**
 * Remarques sur les lignes d'un diff de l'onglet Modifications (fiche 085), du clic sur une ligne
 * à l'envoi à l'agent : remplaçant des vérifications de composant de la suite e2e `changes`
 * (inventaire B, #12 à #14). jsdom simule le Maj-clic par l'évènement (`shiftKey`), pas une vraie
 * sélection : la plage est celle que `DiffView` calcule.
 */
import * as Tooltip from '@radix-ui/react-tooltip'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TranscriptItem } from '@shared/transcript'
import { ChangesTab } from './ChangesTab'

const api = window.api
beforeEach(() => {
  localStorage.clear()
  window.api = {
    ...api,
    changes: { git: async () => null, gitFile: vi.fn() },
    settings: { get: async () => ({ preferences: {} }), onChanged: () => () => {} }
  } as unknown as Window['api']
})
afterEach(() => {
  cleanup()
  window.api = api
  localStorage.clear()
})

const created: TranscriptItem = {
  kind: 'tool',
  id: 1,
  toolCallId: 't1',
  title: 'Edit',
  toolKind: 'edit',
  status: 'completed',
  content: [
    {
      type: 'diff',
      path: '/depot/src/app.js',
      oldText: null,
      newText: 'function f() {}\nconst x = 1\nexport { f }\n'
    }
  ],
  locations: []
}

function show(conversationId: string) {
  const onSendNotes = vi.fn()
  const view = render(
    <Tooltip.Provider>
      <ChangesTab
        conversationId={conversationId}
        workspace="/depot"
        items={[created]}
        onSendNotes={onSendNotes}
      />
    </Tooltip.Provider>
  )
  return { onSendNotes, ...view }
}
const line = (n: number) =>
  document.querySelector<HTMLElement>(
    `tr[data-side=new][data-line="${n}"] [data-testid=diff-note-add]`
  ) as HTMLElement
const notes = () => screen.queryAllByTestId('diff-note')
const type = (text: string) =>
  fireEvent.change(screen.getByTestId('diff-note-input'), { target: { value: text } })

async function openDiff() {
  fireEvent.click(await screen.findByTitle('src/app.js'))
  await waitFor(() => expect(line(3)).toBeTruthy())
}

describe('remarques sur les lignes des modifications (fiche 085)', () => {
  it('une ligne, puis une plage (Maj-clic, ⌘↩), comptées et gardées pour la conversation', async () => {
    const { unmount } = show('notes-1')
    await openDiff()
    fireEvent.click(line(1))
    type('Nommer la fonction')
    fireEvent.click(screen.getByTestId('diff-note-save'))
    expect(notes()).toHaveLength(1)

    fireEvent.click(line(2))
    fireEvent.click(line(3), { shiftKey: true })
    expect(document.querySelectorAll('tr.diff-selected')).toHaveLength(2)
    type('Ajouter un test')
    fireEvent.keyDown(screen.getByTestId('diff-note-input'), { key: 'Enter', metaKey: true })
    expect(notes()).toHaveLength(2)
    expect(notes()[1]?.textContent).toContain('Lignes 2 à 3')
    expect(screen.getByTestId('diff-notes-bar').textContent).toContain('2 remarques')
    expect(
      Object.values(JSON.parse(localStorage.getItem('bobine:remarques-diff') ?? '{}')).flat()
    ).toHaveLength(2)

    // Gardées pour la conversation : retrouvées en rouvrant l'onglet.
    unmount()
    show('notes-1')
    await openDiff()
    expect(notes()).toHaveLength(2)
  })

  it('remarque supprimée puis modifiée : la liste et le compteur suivent', async () => {
    show('notes-2')
    await openDiff()
    fireEvent.click(line(1))
    type('Nommer la fonction')
    fireEvent.click(screen.getByTestId('diff-note-save'))
    fireEvent.click(line(2))
    fireEvent.click(line(3), { shiftKey: true })
    type('Ajouter un test')
    fireEvent.click(screen.getByTestId('diff-note-save'))
    expect(notes()).toHaveLength(2)

    fireEvent.click(notes()[0]?.querySelector('[data-testid=diff-note-delete]') as HTMLElement)
    expect(notes()).toHaveLength(1)
    fireEvent.click(notes()[0]?.querySelector('[data-testid=diff-note-edit]') as HTMLElement)
    expect((screen.getByTestId('diff-note-input') as HTMLTextAreaElement).value).toBe(
      'Ajouter un test'
    )
    type('Ajouter deux tests')
    fireEvent.click(screen.getByTestId('diff-note-save'))
    expect(notes()).toHaveLength(1)
    expect(notes()[0]?.textContent).toContain('Ajouter deux tests')
    expect(screen.getByTestId('diff-notes-bar').textContent).toContain('1 remarque')
  })

  it('Envoyer : un message avec chaque remarque, son fichier et ses lignes ; remarques effacées', async () => {
    const { onSendNotes } = show('notes-3')
    await openDiff()
    fireEvent.click(line(2))
    fireEvent.click(line(3), { shiftKey: true })
    type('Ajouter deux tests')
    fireEvent.click(screen.getByTestId('diff-note-save'))

    fireEvent.click(screen.getByTestId('diff-notes-send'))
    expect(onSendNotes).toHaveBeenCalledTimes(1)
    const sent = String(onSendNotes.mock.calls[0]?.[0])
    expect(sent).toContain('Remarques sur les modifications')
    expect(sent).toContain('1. src/app.js, lignes 2 à 3 :')
    expect(sent).toContain('Remarque : Ajouter deux tests')
    expect(screen.queryByTestId('diff-notes-bar')).toBeNull()
    expect(notes()).toHaveLength(0)
  })
})
