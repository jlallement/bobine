import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { ConversationSummary } from '@shared/agent'
import { DeleteDialog } from './DeleteDialog'

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

// Remplace `e2e/suites/parallel.mjs` n° 4 : rien à perdre, la suppression du worktree est cochée.
describe('supprimer une conversation en worktree (fiche 036)', () => {
  const open = (status: { dirty: number; ahead: number }) => {
    const onConfirm = vi.fn()
    render(
      <DeleteDialog
        conversation={conversation({ branch: 'bobine/essai' })}
        onWorktreeStatus={async () => ({ branch: 'bobine/essai', path: '/w/.wt', ...status })}
        onClose={() => {}}
        onConfirm={onConfirm}
      />
    )
    return onConfirm
  }

  it('rien à perdre : « supprimer le worktree » coché d’office, et part avec la conversation', async () => {
    const onConfirm = open({ dirty: 0, ahead: 0 })
    const box = screen.getByTestId('delete-worktree') as HTMLInputElement
    await waitFor(() => expect(box.checked).toBe(true))
    expect(box.disabled).toBe(false)
    expect(screen.queryByTestId('delete-worktree-losses')).toBeNull()
    fireEvent.click(screen.getByTestId('delete-confirm'))
    expect(onConfirm).toHaveBeenCalledWith({ fromAgent: false, removeWorktree: true })
  })

  it('travail non commité : pas coché, ce qui serait perdu est dit', async () => {
    const onConfirm = open({ dirty: 2, ahead: 1 })
    await screen.findByTestId('delete-worktree-losses')
    expect((screen.getByTestId('delete-worktree') as HTMLInputElement).checked).toBe(false)
    fireEvent.click(screen.getByTestId('delete-confirm'))
    expect(onConfirm).toHaveBeenCalledWith({ fromAgent: false, removeWorktree: false })
  })
})

describe('supprimer une mère : ses filles (fiche 228)', () => {
  const family = [
    { id: 'pf', title: 'Relire les tests', motherId: 'f2', profileLabel: 'Agent factice' },
    {
      id: 'f1',
      title: 'Importer les données',
      motherId: 'c1',
      busy: true,
      profileLabel: 'OpenCode',
      agentDeletes: true
    },
    { id: 'f2', title: 'Corriger les tests', motherId: 'c1', profileLabel: 'Agent factice' }
  ]
  const open = (extra: Partial<ConversationSummary> = {}) => {
    const onConfirm = vi.fn()
    render(
      <DeleteDialog
        conversation={conversation(extra)}
        onWorktreeStatus={async () => null}
        onFamily={async () => family}
        onClose={() => {}}
        onConfirm={onConfirm}
      />
    )
    return onConfirm
  }

  it('nomme la descendance sous ses mères, case cochée : la famille part avec la mère', async () => {
    const onConfirm = open()
    const box = (await screen.findByTestId('delete-children')) as HTMLInputElement
    expect(box.checked).toBe(true)
    expect(box.parentElement?.textContent).toContain('Supprimer aussi ses 3 travaux')
    const rows = [...screen.getByTestId('delete-children-list').querySelectorAll('li')]
    expect(rows.map((r) => r.textContent)).toEqual([
      'Importer les donnéesen cours, sera arrêté',
      'Corriger les tests',
      '↳Relire les tests'
    ])
    expect(screen.getByTestId('delete-children-note').textContent).toContain('corbeille')
    fireEvent.click(screen.getByTestId('delete-confirm'))
    expect(onConfirm).toHaveBeenCalledWith({
      fromAgent: false,
      removeWorktree: false,
      children: 'delete'
    })
  })

  it('participants d’un tour de table : aucun worktree annoncé (fiche 285, M8)', async () => {
    render(
      <DeleteDialog
        conversation={conversation()}
        onWorktreeStatus={async () => null}
        onFamily={async () => family}
        participant={() => true}
        onClose={() => {}}
        onConfirm={() => {}}
      />
    )
    await screen.findByTestId('delete-children')
    const note = screen.getByTestId('delete-children-note').textContent ?? ''
    expect(note).toContain('corbeille')
    expect(note).not.toContain('worktree')
  })

  it('case décochée : les filles restent, la note le dit', async () => {
    const onConfirm = open()
    fireEvent.click(await screen.findByTestId('delete-children'))
    expect(screen.getByTestId('delete-children-note').textContent).toContain(
      'conversations ordinaires'
    )
    expect(screen.getByTestId('delete-child-busy').textContent).toBe('en cours')
    fireEvent.click(screen.getByTestId('delete-confirm'))
    expect(onConfirm).toHaveBeenCalledWith({
      fromAgent: false,
      removeWorktree: false,
      children: 'keep'
    })
  })

  it('« aussi chez… » : l’agent de chaque conversation, et ceux qui ne savent pas le faire', async () => {
    const onConfirm = open({ agentDeletes: true })
    await screen.findByTestId('delete-children')
    const label = screen.getByTestId('delete-from-agent').parentElement?.textContent ?? ''
    expect(label).toContain('Supprimer aussi chez Agent factice et OpenCode')
    expect(label).toContain('ces conversations')
    // Une fille sur Agent factice, qui sait supprimer pour la mère : personne n'est laissé de côté.
    expect(screen.queryByTestId('delete-from-agent-keeping')).toBeNull()
    fireEvent.click(screen.getByTestId('delete-from-agent'))
    fireEvent.click(screen.getByTestId('delete-confirm'))
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ fromAgent: true }))
  })

  it('mère sur un agent qui ne sait pas supprimer : la case vient de la fille, et le dit', async () => {
    open()
    await screen.findByTestId('delete-children')
    const label = screen.getByTestId('delete-from-agent').parentElement?.textContent ?? ''
    expect(label).toContain('Supprimer aussi chez OpenCode')
    expect(screen.getByTestId('delete-from-agent-keeping').textContent).toMatch(
      /^Agent factice ne sait pas supprimer une session\s:\scelles de ses conversations y restent\.$/
    )
    // Filles gardées : seule la mère est supprimée, et son agent ne sait pas le faire.
    fireEvent.click(screen.getByTestId('delete-children'))
    expect(screen.queryByTestId('delete-from-agent')).toBeNull()
  })

  it('confirmée : le focus va à la zone de saisie, pas sur la page (recette rc.4)', async () => {
    const composer = document.createElement('textarea')
    composer.dataset.testid = 'composer-input'
    document.body.append(composer)
    /** Le bouton « ⋯ » de la ligne, puis la boîte ; confirmer ou annuler la ferme. */
    function Host() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button data-testid="opener" onClick={() => setOpen(true)} />
          {open && (
            <DeleteDialog
              conversation={conversation()}
              onWorktreeStatus={async () => null}
              onClose={() => setOpen(false)}
              onConfirm={() => setOpen(false)}
            />
          )}
        </>
      )
    }
    render(<Host />)
    const opener = screen.getByTestId('opener')
    opener.focus()
    fireEvent.click(opener)
    fireEvent.click(await screen.findByTestId('delete-confirm'))
    await waitFor(() => expect(document.activeElement).toBe(composer))

    // Annulée : rien n'est imposé (Radix le rend au bouton qui l'a ouverte, toujours là).
    composer.blur()
    opener.focus()
    fireEvent.click(opener)
    fireEvent.keyDown(await screen.findByTestId('delete-dialog'), { key: 'Escape' })
    await waitFor(() => expect(screen.queryByTestId('delete-dialog')).toBeNull())
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(document.activeElement).not.toBe(composer)
    composer.remove()
  })
})
