import * as Tooltip from '@radix-ui/react-tooltip'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { AgentSettingsView, ProfileSummary } from '@shared/agent'
import type { HandoverTarget } from '@shared/handover'
import { AgentMenu } from './AgentMenu'

/**
 * Menu de l'agent de la barre de saisie (fiche 108) : remplace les vérifications de composant de
 * `e2e/suites/handover.mjs` (n° 1, 8) et `base.mjs` (n° 15). La bascule réelle (nouvelle session,
 * contexte joint) reste au main (`handover.test.ts`) et à l'e2e `handover`.
 *
 * Puce de l'agent (fiches 092, 185 D26) : remplaçant de la partie composant de la vérification
 * n° 10 de la suite e2e `onglets-etroits` (inventaire C). Le passage en icône est décidé par
 * `useBarFold` (testé à part) et dessiné par le CSS ; ici, ce que la puce garde pour les lecteurs
 * d'écran quand seule l'icône se voit : son nom, l'icône décorative.
 */

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
})

const api = window.api as unknown as Record<string, unknown>
afterEach(() => {
  delete api.conversations
})

const profile = (id: string, label: string, available = true): ProfileSummary =>
  ({ id, label, available, command: id, capabilities: {} }) as unknown as ProfileSummary

const settings = {
  profileId: 'mock',
  profiles: [profile('mock', 'Agent factice'), profile('opencode', 'OpenCode')],
  workspace: '/tmp/projet',
  recentWorkspaces: []
} as unknown as AgentSettingsView

const opencode: HandoverTarget = {
  profileId: 'opencode',
  label: 'OpenCode',
  models: [
    {
      value: 'maison/qwen3',
      name: 'maison/Qwen3 32B',
      featured: 'provider',
      destination: { kind: 'provider', name: 'Maison', url: 'http://127.0.0.1:9/v1' }
    },
    { value: 'autre/x', name: 'autre/X', destination: { kind: 'unknown' } }
  ],
  destination: { kind: 'unknown' }
}

function setup(conversationId?: string) {
  const handoverTargets = vi.fn(async () => [opencode])
  api.conversations = {
    handoverTargets,
    view: async () => ({ transcript: { items: [] } }),
    continueWith: vi.fn(async () => {})
  }
  const onConfigure = vi.fn()
  render(
    <Tooltip.Provider>
      <AgentMenu
        settings={settings}
        label="Agent factice"
        disabled={false}
        {...(conversationId ? { conversationId } : {})}
        onConfigure={onConfigure}
      />
    </Tooltip.Provider>
  )
  return { onConfigure, handoverTargets }
}

const openMenu = async () => {
  fireEvent.keyDown(screen.getByTestId('agent-menu'), { key: 'Enter' })
  await act(async () => {})
}

describe('menu de l’agent (fiche 108)', () => {
  it('conversation commencée : l’autre agent avec le modèle de son fournisseur déclaré, puis « autre modèle… »', async () => {
    setup('c1')
    await openMenu()
    const content = screen.getByTestId('agent-menu-content')
    expect(content.textContent).toContain('Continuer avec')
    const featured = screen.getByTestId('handover-opencode-maison/qwen3')
    expect(featured.textContent).toContain('OpenCode · Qwen3 32B')
    expect(featured.textContent).toContain('Maison')
    expect(screen.getByTestId('handover-opencode').textContent).toBe('OpenCode — autre modèle…')
    // Le modèle non mis en avant n'a pas sa ligne.
    expect(screen.queryByTestId('handover-opencode-autre/x')).toBeNull()
    // Les lignes « Continuer avec » viennent avant « Nouvelle conversation avec ».
    const text = content.textContent ?? ''
    expect(text.indexOf('Continuer avec')).toBeLessThan(text.indexOf('Nouvelle conversation avec'))
  })

  it('conversation vide : pas de « Continuer avec », seulement le choix de l’agent', async () => {
    const { handoverTargets } = setup()
    await openMenu()
    expect(screen.getByTestId('agent-menu-content').textContent).not.toContain('Continuer avec')
    expect(screen.queryByTestId('handover-opencode')).toBeNull()
    expect(handoverTargets).not.toHaveBeenCalled()
    expect(screen.getByTestId('agent-option-opencode')).toBeTruthy()
  })

  it('menu consulté puis fermé : l’agent de la conversation reste choisi, rien n’est reconfiguré', async () => {
    const { onConfigure } = setup()
    await openMenu()
    const current = screen.getByTestId('agent-option-mock')
    expect(current.querySelector('.menu-check')).toBeTruthy()
    expect(screen.getByTestId('agent-option-opencode').querySelector('.menu-check')).toBeNull()
    // Choisir l'agent déjà en place ne relance rien.
    fireEvent.click(screen.getByTestId('agent-option-mock'))
    expect(onConfigure).not.toHaveBeenCalled()
    expect(screen.queryByTestId('agent-menu-content')).toBeNull()
    expect(screen.getByTestId('agent-menu').textContent).toContain('Agent factice')
  })
})

describe('puce de l’agent (fiche 185, D26)', () => {
  it('nom gardé dans la puce et dans son infobulle ; l’icône est décorative', async () => {
    setup()
    const chip = screen.getByTestId('agent-menu')
    expect(chip.textContent?.trim()).toBe('Agent factice')
    expect(chip.querySelector('.agent-chip-icon')?.getAttribute('aria-hidden')).toBe('true')
    fireEvent.focus(chip)
    await waitFor(() =>
      expect(screen.getAllByRole('tooltip')[0]?.textContent).toContain('Agent factice')
    )
  })
})
