import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ConversationSummary } from '@shared/agent'
import { DeleteDialog } from './ConversationMenu'

const conversation = (extra: Partial<ConversationSummary> = {}) =>
  ({
    id: 'c1',
    title: 'Plan de migration',
    profileId: 'mock',
    profileLabel: 'Agent factice',
    workspace: '/w',
    project: '/w',
    updatedAt: '2026-11-07T00:00:00Z',
    status: 'stopped',
    draft: false,
    ...extra
  }) as ConversationSummary

describe('supprimer une conversation : vers la corbeille (fiche 196)', () => {
  it('« aussi chez l’agent » proposé seulement s’il sait le faire, jamais coché d’office', () => {
    const onConfirm = vi.fn()
    render(
      <DeleteDialog
        conversation={conversation({ agentDeletes: true })}
        onWorktreeStatus={async () => null}
        onClose={() => {}}
        onConfirm={onConfirm}
      />
    )
    const box = screen.getByTestId('delete-from-agent') as HTMLInputElement
    expect(box.checked).toBe(false)
    expect(screen.getByTestId('delete-confirm').textContent).toBe('Mettre à la corbeille')
    fireEvent.click(screen.getByTestId('delete-confirm'))
    expect(onConfirm).toHaveBeenCalledWith({ fromAgent: false, removeWorktree: false })
  })

  it('agent qui ne sait pas supprimer : pas de case, rien chez l’agent', () => {
    const onConfirm = vi.fn()
    render(
      <DeleteDialog
        conversation={conversation()}
        onWorktreeStatus={async () => null}
        onClose={() => {}}
        onConfirm={onConfirm}
      />
    )
    expect(screen.queryByTestId('delete-from-agent')).toBeNull()
    fireEvent.click(screen.getByTestId('delete-confirm'))
    expect(onConfirm).toHaveBeenCalledWith({ fromAgent: false, removeWorktree: false })
  })
})
