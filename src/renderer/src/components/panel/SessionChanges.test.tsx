import * as Tooltip from '@radix-ui/react-tooltip'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { TranscriptItem } from '@shared/transcript'
import { SessionChanges } from './SessionChanges'

const edit = (
  id: number,
  path: string,
  oldText: string | null,
  newText: string
): TranscriptItem => ({
  kind: 'tool',
  id,
  toolCallId: `t${id}`,
  title: 'Edit',
  status: 'completed',
  content: [{ type: 'diff', path, oldText, newText }],
  locations: []
})

const show = (
  items: TranscriptItem[],
  folder?: { files: number; added: number; removed: number }
) => {
  const onOpenConversation = vi.fn()
  const onOpenGit = vi.fn()
  render(
    <Tooltip.Provider>
      <SessionChanges
        items={items}
        folder={folder}
        onOpenConversation={onOpenConversation}
        onOpenGit={onOpenGit}
      />
    </Tooltip.Provider>
  )
  return { onOpenConversation, onOpenGit }
}

const text = (id: string) => screen.getByTestId(id).textContent

describe('onglet « Session » : Modifications (fiche 207)', () => {
  it('conversation neuve dans un dossier au fichier non commité : « Aucune » / « 1 fichier non commité »', () => {
    const { onOpenGit } = show([], { files: 1, added: 1, removed: 0 })
    expect(text('session-changes-conversation')).toBe('Aucune')
    // « Aucune » n'est pas un lien.
    expect(screen.getByTestId('session-changes-conversation').tagName).toBe('SPAN')
    expect(text('session-changes-line')).toBe('1 fichier non commité+1−0')
    fireEvent.click(screen.getByTestId('session-changes-line'))
    expect(onOpenGit).toHaveBeenCalledTimes(1)
  })

  it('après travail : ce que la conversation a modifié, qui ouvre la vue Conversation', () => {
    const items = [
      edit(1, '/p/a.md', 'un\ndeux\n', 'un\n2\ntrois\n'),
      edit(2, '/p/b.md', null, 'x\n')
    ]
    const { onOpenConversation, onOpenGit } = show(items, { files: 3, added: 5, removed: 1 })
    expect(text('session-changes-conversation')).toBe('2 fichiers+3−1')
    expect(text('session-changes-line')).toBe('3 fichiers non commités+5−1')
    fireEvent.click(screen.getByTestId('session-changes-conversation'))
    expect(onOpenConversation).toHaveBeenCalledTimes(1)
    expect(onOpenGit).not.toHaveBeenCalled()
  })

  it('dossier propre : « Aucune » ; hors dépôt git : pas de ligne « Dossier »', () => {
    show([], { files: 0, added: 0, removed: 0 })
    expect(text('session-changes-line')).toBe('Aucune')
    cleanup()
    show([])
    expect(screen.queryByTestId('session-changes-line')).toBeNull()
    expect(text('session-changes-conversation')).toBe('Aucune')
  })
})
