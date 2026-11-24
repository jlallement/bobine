import { fireEvent, render, screen } from '@testing-library/react'
import i18next from 'i18next'
import { describe, expect, it, vi } from 'vitest'
import type { BranchPreview } from '@shared/agent'
import { BranchDialog } from './BranchDialog'

/**
 * Repartir d'un message (fiche 023) : remplace la vérification de composant de
 * `e2e/suites/branch.mjs` (n° 3). L'aperçu (fichiers à remettre, commandes) et la remise en état
 * restent au main (`branching.test.ts`).
 */

const preview: BranchPreview = {
  files: [
    { path: '/projet/README.md', status: 'restore', created: false },
    { path: '/projet/notes.txt', status: 'restore', created: true },
    { path: '/projet/package.json', status: 'conflict', created: false },
    { path: '/projet/stable.ts', status: 'unchanged', created: false }
  ],
  commands: 1
}

function setup(change: Partial<BranchPreview> = {}) {
  const onConfirm = vi.fn()
  render(
    <BranchDialog preview={{ ...preview, ...change }} onClose={vi.fn()} onConfirm={onConfirm} />
  )
  return { onConfirm }
}

describe('repartir d’un message (fiche 023)', () => {
  it('fichiers modifiés depuis : proposés à la remise en état, case cochée (branch n° 3)', () => {
    const { onConfirm } = setup()
    const box = screen.getByTestId('branch-restore') as HTMLInputElement
    expect(box.checked).toBe(true)
    expect(box.closest('label')?.textContent).toContain(
      i18next.t('branchDialog.restore', { count: 2 })
    )
    const files = [...screen.getByTestId('branch-files').querySelectorAll('li')]
    expect(files.map((li) => li.querySelector('code')?.textContent)).toEqual([
      'README.md',
      'notes.txt'
    ])
    expect(files[1]?.textContent).toContain(i18next.t('branchDialog.createdSince'))
    // Un fichier modifié depuis par quelqu'un d'autre n'est pas proposé : il est nommé à part.
    expect(screen.getByTestId('branch-conflicts').textContent).toContain('package.json')
    expect(screen.getByTestId('branch-commands').textContent).toBe(
      i18next.t('branchDialog.commands', { count: 1 })
    )
    fireEvent.click(screen.getByTestId('branch-confirm'))
    expect(onConfirm).toHaveBeenCalledWith({ restoreFiles: true })
  })

  it('case décochée : on repart sans rien remettre', () => {
    const { onConfirm } = setup()
    fireEvent.click(screen.getByTestId('branch-restore'))
    fireEvent.click(screen.getByTestId('branch-confirm'))
    expect(onConfirm).toHaveBeenCalledWith({ restoreFiles: false })
  })

  it('rien à remettre : pas de case, rien de remis', () => {
    const { onConfirm } = setup({ files: [], commands: 0 })
    expect(screen.queryByTestId('branch-restore')).toBeNull()
    expect(screen.queryByTestId('branch-commands')).toBeNull()
    fireEvent.click(screen.getByTestId('branch-confirm'))
    expect(onConfirm).toHaveBeenCalledWith({ restoreFiles: false })
  })
})
