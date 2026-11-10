import { describe, expect, it, vi } from 'vitest'
import { worktreeSetupHandlers } from './worktree-setup-ipc'

describe('canaux de la préparation des worktrees (fiche 175)', () => {
  it('autoriser (avec l’empreinte), continuer sans, arrêter, retirer l’accord', () => {
    const control = { approve: vi.fn(), skip: vi.fn(), stop: vi.fn() }
    const forget = vi.fn()
    const view = { approvals: { worktreeSetups: [] } }
    const h = worktreeSetupHandlers({ control, forget, settingsView: () => view as never })
    h['conversation:approveWorktreeSetup']('c1', 'empreinte')
    h['conversation:skipWorktreeSetup']('c1')
    h['conversation:stopWorktreeSetup']('c1')
    expect(h['settings:forgetWorktreeSetup']('/depot')).toBe(view)
    expect(control.approve).toHaveBeenCalledWith('c1', 'empreinte')
    expect(control.skip).toHaveBeenCalledWith('c1')
    expect(control.stop).toHaveBeenCalledWith('c1')
    expect(forget).toHaveBeenCalledWith('/depot')
  })

  it('paramètre invalide ou préparation absente : refusé', () => {
    const h = worktreeSetupHandlers({ control: undefined, forget: vi.fn(), settingsView: vi.fn() })
    expect(() => h['conversation:approveWorktreeSetup']('c1', 'empreinte')).toThrow()
    const ok = worktreeSetupHandlers({
      control: { approve: vi.fn(), skip: vi.fn(), stop: vi.fn() },
      forget: vi.fn(),
      settingsView: vi.fn()
    })
    expect(() => ok['conversation:skipWorktreeSetup']('' as never)).toThrow()
    // Sans l'empreinte montrée, pas d'accord.
    expect(() => ok['conversation:approveWorktreeSetup']('c1', '' as never)).toThrow()
  })
})
