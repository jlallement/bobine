/**
 * « Committer d'abord » avec les fichiers à cocher (fiche 244) : la liste complète, toutes les
 * cases cochées au départ ; un fichier décoché ne part pas et le message ne le cite pas ; rien de
 * coché, rien ne part, et la raison est écrite.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { CommitFile } from '@shared/worktree-cycle'
import { looksSecret } from '@shared/worktree-cycle'
import { CommitChooser } from './CommitChooser'

/** Texte affiché, espaces insécables (typographie française de l'app) rendues ordinaires. */
const plain = (text: string | null | undefined) => (text ?? '').replace(/[  ]/g, ' ')

/** Quarante fichiers, le `.env` (non suivi, non ignoré) vers la fin, comme sur la maquette. */
const FORTY: CommitFile[] = Array.from({ length: 40 }, (_, i) =>
  i === 35
    ? { path: '.env', status: 'untracked' as const }
    : { path: `src/f${String(i).padStart(2, '0')}.js`, status: 'modified' as const }
)

function setup(files: readonly CommitFile[]) {
  const onCommit = vi.fn()
  render(
    <CommitChooser
      files={files}
      conversationId="c1"
      busy={false}
      testid="t"
      confirmLabel="Committer puis fusionner"
      leftNote={(n) => `${n} laissé(s)`}
      onCommit={onCommit}
      onCancel={vi.fn()}
    />
  )
  const box = (path: string) =>
    screen
      .getAllByTestId('t-file')
      .find((li) => li.dataset.path === path)
      ?.querySelector('input') as HTMLInputElement
  const message = () => (screen.getByTestId('t-message') as HTMLTextAreaElement).value
  const confirm = () => screen.getByTestId('t-confirm') as HTMLButtonElement
  /** Fiche 246 : la proposition arrive du main (ici le repli) ; le champ s'ouvre. */
  const settled = () =>
    waitFor(() =>
      expect((screen.getByTestId('t-message') as HTMLTextAreaElement).disabled).toBe(false)
    )
  return { onCommit, box, message, confirm, settled }
}

describe('« Committer d’abord » : fichiers à cocher (fiche 244)', () => {
  it('la liste complète, toutes cochées ; longue, elle défile et se déplie', () => {
    const { box } = setup(FORTY)
    expect(screen.getAllByTestId('t-file')).toHaveLength(40)
    expect(screen.getAllByTestId('t-check').every((c) => (c as HTMLInputElement).checked)).toBe(
      true
    )
    expect(plain(screen.getByTestId('t-count').textContent)).toBe('40 fichiers · tous cochés')
    const list = screen.getByRole('list', { name: 'Fichiers à committer' })
    expect(list.classList.contains('scroll')).toBe(true)
    fireEvent.click(screen.getByTestId('t-expand'))
    expect(list.classList.contains('scroll')).toBe(false)
    // Le `.env` est montré, coché, avec l'étiquette « secret ? ».
    expect(box('.env').checked).toBe(true)
    expect(screen.getAllByTestId('t-secret')).toHaveLength(1)
    expect(screen.getByTestId('t-secret').closest('li')?.dataset.path).toBe('.env')
  })

  it('un fichier décoché ne part pas, et le message ne le cite pas', async () => {
    const files: CommitFile[] = [
      { path: 'plan.md', status: 'modified' },
      { path: '.env', status: 'untracked' },
      { path: 'server/index.js', status: 'untracked' }
    ]
    const { onCommit, box, message, confirm, settled } = setup(files)
    await settled()
    expect(message()).toContain('- .env (new)')
    fireEvent.click(box('.env'))
    expect(box('.env').checked).toBe(false)
    expect(plain(screen.getByTestId('t-count').textContent)).toBe('3 fichiers · 2 sur 3 cochés')
    expect((screen.getByTestId('t-check-all') as HTMLInputElement).indeterminate).toBe(true)
    expect(message()).not.toContain('.env')
    expect(message()).toContain('- plan.md')
    expect(screen.getByTestId('t-left').textContent).toBe('1 laissé(s)')
    fireEvent.click(confirm())
    expect(onCommit).toHaveBeenCalledWith(message(), ['plan.md', 'server/index.js'], 1)
  })

  it('tout décoché : bouton désactivé, la raison est écrite ; la case de tête recoche tout', async () => {
    const { onCommit, confirm, message, settled } = setup(FORTY)
    await settled()
    fireEvent.click(screen.getByTestId('t-check-all'))
    expect(screen.getAllByTestId('t-check').some((c) => (c as HTMLInputElement).checked)).toBe(
      false
    )
    expect(plain(screen.getByTestId('t-count').textContent)).toBe('40 fichiers · aucun coché')
    expect(confirm().disabled).toBe(true)
    expect(screen.getByTestId('t-blocked').textContent).toBe(
      'Cochez au moins un fichier à committer.'
    )
    expect(message()).toBe('')
    fireEvent.click(confirm())
    expect(onCommit).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('t-check-all'))
    expect(confirm().disabled).toBe(false)
    expect(screen.queryByTestId('t-blocked')).toBeNull()
  })

  it('« secret ? » : .env*, *.pem, *.key, id_rsa*, *.p12, pas les autres', () => {
    for (const path of [
      '.env',
      'app/.env.local',
      'certs/server.pem',
      'a.key',
      'id_rsa.pub',
      'x.p12'
    ]) {
      expect(looksSecret(path)).toBe(true)
    }
    for (const path of ['env.md', 'src/keyboard.ts', 'docs/.envoi.md.bak/x', 'README.md']) {
      expect(looksSecret(path)).toBe(false)
    }
  })
})
