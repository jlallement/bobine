import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { TranscriptItem } from '@shared/transcript'
import type { WorktreeSetup } from '@shared/worktree-setup'
import { Transcript } from './Transcript'
import type { WorktreeSetupActions } from './WorktreeSetup'

const item = (setup: WorktreeSetup) =>
  ({ kind: 'worktree-setup', id: 2, ...setup }) as TranscriptItem

const view = (setup: WorktreeSetup, actions?: WorktreeSetupActions) =>
  render(
    <Transcript
      items={[item(setup)]}
      onRespondPermission={vi.fn()}
      onRespondElicitation={vi.fn()}
      {...(actions ? { worktreeSetup: actions } : {})}
    />
  )

describe('Préparation du worktree (fiche 175)', () => {
  it('à autoriser : « Autoriser et lancer » en action principale, « Continuer sans préparer », message en attente', () => {
    const actions = { onApprove: vi.fn(), onSkip: vi.fn() }
    view({ command: 'pnpm install', state: 'approval', held: 1, signature: 'sig' }, actions)
    expect(screen.getByTestId('worktree-setup').dataset['state']).toBe('approval')
    expect(screen.getByTestId('worktree-setup-command').textContent).toBe('pnpm install')
    // Espaces fines insécables de la typographie française ramenées à des espaces.
    expect(screen.getByTestId('worktree-setup-held').textContent?.replace(/\s/g, ' ')).toBe(
      'Votre message attend : autorisez la préparation, ou continuez sans elle.'
    )
    const approve = screen.getByTestId('worktree-setup-approve')
    expect(approve.className).toContain('primary')
    fireEvent.click(approve)
    // L'empreinte des commandes montrées repart avec l'accord (D2).
    expect(actions.onApprove).toHaveBeenCalledWith('sig')
    fireEvent.click(screen.getByTestId('worktree-setup-skip'))
    expect(actions.onSkip).toHaveBeenCalledOnce()
  })

  it('les deux commandes que l’accord couvre, chacune avec son moment (D1)', () => {
    view(
      {
        command: 'pnpm install',
        archive: 'docker compose down',
        state: 'approval',
        signature: 's'
      },
      { onApprove: vi.fn(), onSkip: vi.fn() }
    )
    const rows = [...document.querySelectorAll('.worktree-setup-command-row')].map((row) =>
      row.textContent?.replace(/\s/g, ' ')
    )
    expect(rows).toEqual(['À la créationpnpm install', 'À la suppressiondocker compose down'])
    expect(screen.getByText(/qui couvre les deux/)).toBeTruthy()
  })

  it('fichier changé : dit, nouvelles commandes à autoriser (D2)', () => {
    view(
      { command: 'echo SWAPPED', state: 'approval', signature: 's2', changed: true },
      { onApprove: vi.fn(), onSkip: vi.fn() }
    )
    expect(screen.getByTestId('worktree-setup-changed').textContent).toContain('a changé')
    expect(screen.getByTestId('worktree-setup-command').textContent).toBe('echo SWAPPED')
  })

  it('`archive` seule : « Autoriser » ou « Ne pas autoriser », rien ne tourne maintenant (D6)', () => {
    const actions = { onApprove: vi.fn(), onSkip: vi.fn() }
    view({ archive: 'make clean', state: 'approval', signature: 's' }, actions)
    expect(screen.queryByTestId('worktree-setup-command')).toBeNull()
    expect(screen.getByTestId('worktree-setup-archive').textContent).toBe('make clean')
    expect(screen.getByTestId('worktree-setup-approve').textContent).toBe('Autoriser')
    expect(screen.getByTestId('worktree-setup-skip').textContent).toBe('Ne pas autoriser')
    expect(screen.getByText(/rien ne tourne maintenant/)).toBeTruthy()
  })

  it('commande en cours : message qui attend, « Arrêter », « Continuer sans attendre » (D4)', () => {
    const actions = { onSkip: vi.fn(), onStop: vi.fn() }
    const running = {
      command: 'pnpm i',
      state: 'running' as const,
      startedAt: '2026-11-06T10:00:00.000Z'
    }
    const { unmount } = view({ ...running, held: 1 }, actions)
    expect(screen.getByTestId('worktree-setup-held').textContent).toBe(
      'Votre message attend la fin de la préparation.'
    )
    fireEvent.click(screen.getByTestId('worktree-setup-stop'))
    expect(actions.onStop).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByTestId('worktree-setup-proceed'))
    expect(actions.onSkip).toHaveBeenCalledOnce()
    unmount()
    // Sans message en attente : « Arrêter » seul.
    const second = view(running, actions)
    expect(screen.getByTestId('worktree-setup-stop')).toBeTruthy()
    expect(screen.queryByTestId('worktree-setup-proceed')).toBeNull()
    second.unmount()
    // Messages partis sans attendre : plus de bouton, une phrase.
    view({ ...running, proceeded: true }, actions)
    expect(screen.queryByTestId('worktree-setup-stop')).toBeNull()
    expect(screen.getByText(/sans attendre la fin/)).toBeTruthy()
  })

  it('arrêtée par l’utilisateur ; exécution planifiée non autorisée', () => {
    const { unmount } = view({ command: 'pnpm i', state: 'failed', stopped: true })
    expect(screen.getByTestId('worktree-setup-state').textContent).toBe('Arrêtée')
    unmount()
    view({ command: 'pnpm i', state: 'skipped', unattended: true })
    expect(screen.getByText(/Exécution planifiée/)).toBeTruthy()
  })

  it('fichiers copiés : liste dépliable bornée, « et N autres », ignorés et plafond', () => {
    view({
      state: 'done',
      copy: { count: 52, files: ['.env', '.env.local'], skipped: 1, truncated: 3 }
    })
    expect(screen.getByTestId('worktree-setup-copy-summary').textContent).toBe(
      '52 fichiers copiés depuis le dossier d’origine'
    )
    const list = screen.getByRole('list', { name: 'Fichiers copiés' })
    expect([...list.querySelectorAll('li')].map((li) => li.textContent)).toEqual([
      '.env',
      '.env.local',
      'et 50 autres'
    ])
    expect(screen.getByTestId('worktree-setup-copy-extra').textContent?.replace(/\s/g, ' ')).toBe(
      '1 ignoré (lien, hors du dépôt ou déjà présent) · 3 non copiés (plafond de 5 000 fichiers ou 500 Mo)'
    )
  })

  it('échec : code, phrase, sortie dépliée ; sans bouton', () => {
    view({
      command: 'pnpm install',
      state: 'failed',
      exitCode: 1,
      output: 'ERR_PNPM_NO_LOCKFILE',
      startedAt: '2026-11-06T10:00:00.000Z',
      endedAt: '2026-11-06T10:00:03.000Z'
    })
    expect(screen.getByTestId('worktree-setup-state').textContent).toBe('Échec (code 1)')
    expect(screen.getByTestId('worktree-setup-output').textContent).toBe('ERR_PNPM_NO_LOCKFILE')
    expect(screen.getByTestId('worktree-setup-output').closest('details')?.open).toBe(true)
    expect(screen.queryByTestId('worktree-setup-approve')).toBeNull()
  })

  it('réussie : durée ; non lancée : dite', () => {
    const { unmount } = view({
      command: 'make',
      state: 'done',
      startedAt: '2026-11-06T10:00:00.000Z',
      endedAt: '2026-11-06T10:00:07.000Z'
    })
    expect(screen.getByTestId('worktree-setup-state').textContent).toBe('Réussie en 7 s')
    unmount()
    view({ command: 'make', state: 'skipped' })
    expect(screen.getByTestId('worktree-setup-state').textContent).toBe('Non lancée')
    expect(screen.queryByTestId('worktree-setup-skip')).toBeNull()
  })

  it('copie seule, sans fichier : une phrase, pas de liste', () => {
    view({ state: 'done', copy: { count: 0, files: [], skipped: 0, truncated: 0 } })
    expect(screen.queryByTestId('worktree-setup-command')).toBeNull()
    expect(screen.queryByRole('list')).toBeNull()
  })
})
