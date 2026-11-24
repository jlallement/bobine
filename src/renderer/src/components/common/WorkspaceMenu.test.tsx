import * as Tooltip from '@radix-ui/react-tooltip'
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { AgentSettingsView } from '@shared/agent'
import { ALL_FEATURES, type PlatformFeatures } from '@shared/platform'
import { WorkspaceMenu } from './Menus'

/**
 * Menu du dossier sous la saisie (fiche 158) : remplace les vérifications de composant de
 * `e2e/suites/command.mjs` (n° 1 à 5). L'effet réel (Finder, terminal de Bobine) reste au main
 * (`file-links.test.ts`, `ipc.test.ts`) et à `parcours-outils`.
 */

beforeAll(() => {
  // Le positionnement des menus (Radix) suit la taille de leur contenu ; jsdom ne la mesure pas.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
})

const app = (window.api as unknown as { app: Record<string, unknown> }).app
afterEach(() => {
  delete app.features
})

const settings = {
  workspace: '/Users/moi/projet',
  recentWorkspaces: ['/Users/moi/projet', '/Users/moi/autre'],
  inGitRepo: false
} as unknown as AgentSettingsView

function open(features?: Partial<PlatformFeatures>) {
  if (features) app.features = { ...ALL_FEATURES, ...features }
  const onReveal = vi.fn()
  const onOpenTerminal = vi.fn()
  const onConfigure = vi.fn()
  render(
    <Tooltip.Provider>
      <WorkspaceMenu
        settings={settings}
        disabled={false}
        onConfigure={onConfigure}
        onChooseWorkspace={vi.fn()}
        onReveal={onReveal}
        onOpenTerminal={onOpenTerminal}
      />
    </Tooltip.Provider>
  )
  fireEvent.keyDown(screen.getByTestId('workspace-menu'), { key: 'Enter' })
  return { onReveal, onOpenTerminal, onConfigure }
}

describe('menu du dossier (fiche 158)', () => {
  it('macOS : « Afficher dans le Finder », « Copier le chemin », « Ouvrir un terminal ici »', () => {
    open()
    expect(screen.getByTestId('workspace-reveal').textContent).toBe('Afficher dans le Finder')
    expect(screen.getByTestId('workspace-copy-path').textContent).toBe('Copier le chemin')
    expect(screen.getByTestId('workspace-terminal').textContent).toBe('Ouvrir un terminal ici')
  })

  it('Linux : « Afficher dans le gestionnaire de fichiers », mêmes autres entrées', () => {
    open({ finder: false, explorer: false })
    expect(screen.getByTestId('workspace-reveal').textContent).toBe(
      'Afficher dans le gestionnaire de fichiers'
    )
    expect(screen.getByTestId('workspace-copy-path')).toBeTruthy()
    expect(screen.getByTestId('workspace-terminal')).toBeTruthy()
  })

  it('« Afficher dans le Finder » et « Ouvrir un terminal ici » appellent leur action, sans changer de dossier', () => {
    const first = open()
    fireEvent.click(screen.getByTestId('workspace-reveal'))
    expect(first.onReveal).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(screen.getByTestId('workspace-menu'), { key: 'Enter' })
    fireEvent.click(screen.getByTestId('workspace-terminal'))
    expect(first.onOpenTerminal).toHaveBeenCalledTimes(1)
    expect(first.onConfigure).not.toHaveBeenCalled()
  })

  it('« Copier le chemin » copie le chemin complet du dossier', () => {
    const writeText = vi.fn(async () => {})
    const clipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    try {
      open()
      fireEvent.click(screen.getByTestId('workspace-copy-path'))
      expect(writeText).toHaveBeenCalledWith('/Users/moi/projet')
    } finally {
      if (clipboard) Object.defineProperty(navigator, 'clipboard', clipboard)
      else delete (navigator as unknown as Record<string, unknown>).clipboard
    }
  })

  it('sans dossier : ni « Afficher », ni « Copier le chemin », ni terminal', () => {
    const empty = { ...settings, workspace: '', recentWorkspaces: [] } as AgentSettingsView
    render(
      <Tooltip.Provider>
        <WorkspaceMenu
          settings={empty}
          disabled={false}
          onConfigure={vi.fn()}
          onChooseWorkspace={vi.fn()}
          onReveal={vi.fn()}
          onOpenTerminal={vi.fn()}
        />
      </Tooltip.Provider>
    )
    fireEvent.keyDown(screen.getByTestId('workspace-menu'), { key: 'Enter' })
    expect(screen.getByTestId('workspace-choose')).toBeTruthy()
    expect(screen.queryByTestId('workspace-reveal')).toBeNull()
    expect(screen.queryByTestId('workspace-copy-path')).toBeNull()
    expect(screen.queryByTestId('workspace-terminal')).toBeNull()
  })
})
