import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { TranscriptItem } from '@shared/transcript'
import { Transcript } from './Transcript'

const start = (extra: Partial<Extract<TranscriptItem, { kind: 'worktree-start' }>> = {}) =>
  ({
    kind: 'worktree-start',
    id: 1,
    branch: 'main',
    commit: 'e6ee04c1234567890abcdef1234567890abcdef',
    date: new Date(2026, 9, 22, 10, 17).toISOString(),
    subject: 'Merge fiche 114',
    ...extra
  }) as TranscriptItem

const view = (items: TranscriptItem[], onOpenGitView?: () => void) =>
  render(
    <Transcript
      items={items}
      onRespondPermission={vi.fn()}
      onRespondElicitation={vi.fn()}
      {...(onOpenGitView ? { onOpenGitView } : {})}
    />
  )

describe('Départ d’un worktree (fiche 117)', () => {
  it('branche et commit en code, date, sujet, modifications non commitées, « Vue Git »', () => {
    const open = vi.fn()
    view([start({ dirty: 4 })], open)
    const from = screen.getByTestId('worktree-origin-from')
    expect([...from.querySelectorAll('code')].map((c) => c.textContent)).toEqual([
      'main',
      'e6ee04c'
    ])
    expect(from.textContent?.replace(/\s/g, ' ')).toBe(
      'Parti de main · e6ee04c · 22 oct. 2026, 10:17'
    )
    expect(screen.getByTestId('worktree-origin-subject').textContent).toBe(
      '«\u00a0Merge fiche 114\u00a0»'
    )
    expect(screen.getByTestId('worktree-origin-dirty').textContent).toBe(
      '4 modifications non commitées du dossier d’origine ne sont pas ici.'
    )
    fireEvent.click(screen.getByTestId('worktree-origin-git'))
    expect(open).toHaveBeenCalledOnce()
  })

  it('HEAD détachée, sans modification ni sujet : « Parti du commit … », rien de plus', () => {
    view([start({ branch: undefined, subject: undefined })])
    expect(screen.getByTestId('worktree-origin-from').textContent).toMatch(
      /^Parti du commit e6ee04c/
    )
    expect(screen.queryByTestId('worktree-origin-subject')).toBeNull()
    expect(screen.queryByTestId('worktree-origin-dirty')).toBeNull()
    expect(screen.queryByTestId('worktree-origin-git')).toBeNull()
  })
})
