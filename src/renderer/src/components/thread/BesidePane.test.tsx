import * as Tooltip from '@radix-ui/react-tooltip'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { AgentSnapshot, ConversationSummary } from '@shared/agent'
import type { TranscriptState } from '@shared/transcript'
import type { BesideActions } from '../../beside-actions'
import { BesidePane } from './BesidePane'

// Le terminal (xterm.js) n'a rien à faire ici : seule sa constante d'évènement est utilisée.
vi.mock('../panel/TerminalTab', () => ({ INSERT_TEXT_EVENT: 'bob:insert-text' }))

/**
 * Conversation à côté (fiche 036) : remplace la vérification de composant de
 * `e2e/suites/pinned-plan.mjs` (n° 8). L'envoi réel depuis le volet d'à côté reste à
 * `parcours-outils`.
 */

const summary = {
  id: 'b1',
  title: 'À côté',
  profileId: 'mock',
  profileLabel: 'Agent factice',
  workspace: '/tmp/projet',
  updatedAt: '2026-11-24T08:00:00Z',
  status: 'busy',
  draft: false
} as ConversationSummary

const snapshot = (status: AgentSnapshot['status']) =>
  ({
    status,
    info: { profileId: 'mock', profileLabel: 'Agent factice', workspace: '/tmp/projet' },
    controls: [],
    commands: [],
    promptCapabilities: {},
    queued: []
  }) as unknown as AgentSnapshot

const transcript: TranscriptState = {
  items: [
    { kind: 'user', id: 1, text: 'Fais le plan' },
    {
      kind: 'plan',
      id: 2,
      entries: [
        { content: 'Lire la configuration', status: 'completed', priority: 'high' },
        { content: 'Modifier la configuration', status: 'in_progress', priority: 'high' }
      ]
    }
  ]
} as TranscriptState

const show = (status: AgentSnapshot['status']) =>
  render(
    <Tooltip.Provider>
      <BesidePane
        summary={summary}
        snapshot={snapshot(status)}
        transcript={transcript}
        actions={{} as BesideActions}
        onWarn={vi.fn()}
        onFocus={vi.fn()}
        onClose={vi.fn()}
      />
    </Tooltip.Provider>
  )

describe('conversation à côté : liste de tâches épinglée (fiche 036)', () => {
  it('pendant le tour : la liste épinglée au-dessus de sa saisie, pas de carte « Plan » dans le fil (pinned-plan n° 8)', () => {
    show('busy')
    const pane = screen.getByTestId('beside')
    expect(screen.getByTestId('pinned-plan').textContent).toContain('Modifier la configuration')
    expect(pane.querySelector('.scroll .plan')).toBeNull()
  })

  it('tour fini : plus de liste épinglée, la carte « Plan » revient dans le fil', () => {
    show('ready')
    const pane = screen.getByTestId('beside')
    expect(pane.querySelector('[data-testid=pinned-plan]')).toBeNull()
    expect(pane.querySelector('.scroll .plan li.in_progress')?.textContent).toBe(
      'Modifier la configuration'
    )
  })
})
