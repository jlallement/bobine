import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AgentSettingsView } from '@shared/agent'
import { setLanguage } from '../../i18n'
import { RememberedApprovals } from './RememberedApprovals'

const view = (tools: string[]): AgentSettingsView =>
  ({
    rememberedTools: [{ profileId: 'bob', profileLabel: 'IBM Bob', tools }],
    approvals: { sites: [], commands: [], worktreeSetups: [] }
  }) as unknown as AgentSettingsView

afterEach(() => setLanguage('fr'))

describe('RememberedApprovals : titres d’outils (fiche 214)', () => {
  it.each([
    ['fr', 'Mise à jour de la liste de tâches'],
    ['en', 'Task list update']
  ] as const)(
    '« Updating todo list » est dit en %s, le titre de l’agent reste en infobulle',
    (language, text) => {
      setLanguage(language)
      render(
        <RememberedApprovals
          settings={view(['Updating todo list'])}
          onForgetTool={() => {}}
          onForgetApproval={() => {}}
        />
      )
      const main = screen.getByText(text)
      expect(main.getAttribute('title')).toBe('Updating todo list')
      expect(screen.queryByText('Updating todo list')).toBeNull()
    }
  )

  it('un titre inconnu reste celui de l’agent ; révoquer désigne le titre exact de l’agent', () => {
    const forget = vi.fn()
    render(
      <RememberedApprovals
        settings={view(['Updating todo list', 'Running Mot Secret'])}
        onForgetTool={forget}
        onForgetApproval={() => {}}
      />
    )
    expect(screen.getByText('Running Mot Secret')).toBeTruthy()
    fireEvent.click(screen.getAllByTestId('forget-tool')[0] as HTMLElement)
    fireEvent.click(screen.getByTestId('confirm-row-confirm'))
    expect(forget).toHaveBeenCalledWith('bob', 'Updating todo list')
  })
})
