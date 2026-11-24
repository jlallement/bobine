/**
 * Puce de l'agent de la barre de saisie (fiches 092, 185 D26) : remplaçant de la partie composant
 * de la vérification n° 10 de la suite e2e `onglets-etroits` (inventaire C). Le passage en icône
 * est décidé par `useBarFold` (testé à part) et dessiné par le CSS ; ici, ce que la puce garde pour
 * les lecteurs d'écran quand seule l'icône se voit : son nom, l'icône décorative.
 */
import * as Tooltip from '@radix-ui/react-tooltip'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { AgentSettingsView } from '@shared/agent'
import { AgentMenu } from './AgentMenu'

const settings = {
  profiles: [{ id: 'mock', label: 'Agent factice', available: true }],
  profileId: 'mock'
} as unknown as AgentSettingsView

describe('puce de l’agent (fiche 185, D26)', () => {
  it('nom gardé dans la puce et dans son infobulle ; l’icône est décorative', async () => {
    render(
      <Tooltip.Provider>
        <AgentMenu
          settings={settings}
          label="Agent factice"
          disabled={false}
          onConfigure={() => {}}
        />
      </Tooltip.Provider>
    )
    const chip = screen.getByTestId('agent-menu')
    expect(chip.textContent?.trim()).toBe('Agent factice')
    expect(chip.querySelector('.agent-chip-icon')?.getAttribute('aria-hidden')).toBe('true')
    fireEvent.focus(chip)
    await waitFor(() =>
      expect(screen.getAllByRole('tooltip')[0]?.textContent).toContain('Agent factice')
    )
  })
})
