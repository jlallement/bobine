/**
 * Historique de la saisie dans `Composer` (fiche 227) : ↑ / ↓, pastille, Échap, modification,
 * jetons de rôle, pièces jointes non reprises, commande tapée, rappel de la saisie vide.
 * (Les lignes affichées sont essayées dans `visual-lines.test.ts` et la suite e2e : jsdom ne met
 * rien en page, tout message y tient sur une ligne.)
 */
import * as Tooltip from '@radix-ui/react-tooltip'
import { fireEvent, render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { AgentSnapshot } from '@shared/agent'
import type { RoleView } from '@shared/roles'
import type { SentEntry } from '@shared/sent-history'
import { TipsContext, type Tips } from '../../useTips'
import { Composer } from './Composer'
import type { ComposerRoles } from '../roles/useRoleCompose'

vi.mock('../panel/TerminalTab', () => ({ INSERT_TEXT_EVENT: 'bob:insert-text' }))

const snapshot: AgentSnapshot = {
  status: 'ready',
  info: { profileId: 'mock', profileLabel: 'Agent factice', workspace: '/tmp/projet' },
  controls: [],
  commands: [{ name: 'compact', description: 'Compacte' }],
  promptCapabilities: { image: true, embeddedContext: true },
  queued: []
}

const expert: RoleView = {
  name: 'security-expert',
  label: 'Expert sécu',
  icon: 'shield-check',
  color: 'orange',
  description: 'Relit',
  readOnly: true,
  prompt: 'p',
  scope: 'builtin',
  enabled: true
}

const HISTORY: SentEntry[] = [
  { text: 'Premier message' },
  { text: 'relis le diff du paiement', roles: [{ name: 'security-expert', label: 'Expert sécu' }] },
  { text: 'avec deux pièces', attachments: 2 },
  { text: 'regarde ça', roles: [{ name: 'parti', label: 'Rôle parti' }] },
  { text: '/compact' },
  { text: 'Dernier envoyé' }
]

function setup(
  extra: Partial<ComponentProps<typeof Composer>> = {},
  options: { hint?: boolean; queued?: AgentSnapshot['queued'] } = {}
) {
  const recordSent = vi.fn(async () => undefined)
  Object.assign(window.api, { conversations: { recordSent } })
  const tips = {
    current: null,
    offer: vi.fn(),
    close: vi.fn(),
    never: vi.fn(),
    used: vi.fn(),
    hint: vi.fn(() => options.hint ?? true),
    hintUsed: vi.fn()
  } satisfies Tips
  const roles: ComposerRoles = {
    list: [expert],
    invokable: true,
    refresh: vi.fn(),
    send: vi.fn(async (names: string[]) => ({ started: names, failed: [] })),
    profiles: []
  }
  const props = {
    onSend: vi.fn(),
    onAppCommand: vi.fn(),
    onCancel: vi.fn(),
    onUnqueue: vi.fn(async () => undefined)
  }
  const noop = vi.fn()
  render(
    <TipsContext.Provider value={tips}>
      <Tooltip.Provider>
        <Composer
          snapshot={{ ...snapshot, queued: options.queued ?? [] }}
          settings={null}
          draftKey={`c-${Math.random()}`}
          roles={roles}
          sentHistory={HISTORY}
          userCommands={[
            {
              name: 'revue',
              description: 'Revue',
              prompt: 'Revue de $ARGUMENTS.',
              scope: 'project'
            }
          ]}
          onSearchFiles={vi.fn(async () => [])}
          onPickFiles={vi.fn(async () => [])}
          onWarn={noop}
          onSendNow={noop}
          onRestart={noop}
          onConfigure={noop}
          onChooseWorkspace={noop}
          onSetControl={noop}
          onContinueInNew={noop}
          onAuthenticate={noop}
          onRetry={noop}
          onUseApiKey={vi.fn(async () => {})}
          onRunStep={noop}
          onTrustForSession={noop}
          onOpenTerminal={noop}
          {...props}
          {...extra}
        />
      </Tooltip.Provider>
    </TipsContext.Provider>
  )
  const input = screen.getByTestId('composer-input') as HTMLTextAreaElement
  const key = (k: string, init: Partial<KeyboardEventInit> = {}) =>
    fireEvent.keyDown(input, { key: k, ...init })
  const pill = () => screen.queryByTestId('history-pill')?.textContent ?? null
  return { ...props, recordSent, tips, roles, input, key, pill }
}

describe('historique de la saisie (fiche 227)', () => {
  it('↑ : le dernier envoyé (6/6), puis les précédents ; ↓ revient, puis rend la saisie vide', () => {
    const { input, key, pill, tips } = setup()
    key('ArrowUp')
    expect(input.value).toBe('Dernier envoyé')
    expect(pill()).toContain('6/6')
    expect(tips.hintUsed).toHaveBeenCalledWith('history')
    key('ArrowUp')
    expect(pill()).toContain('5/6')
    key('ArrowDown')
    expect(input.value).toBe('Dernier envoyé')
    key('ArrowDown')
    expect(input.value).toBe('')
    expect(pill()).toBeNull()
    // Le rappel n'est compté qu'à l'entrée dans l'historique.
    expect(tips.hintUsed).toHaveBeenCalledTimes(1)
  })

  it('↑ sur 1/6 ne fait rien ; annonce polie de la position', () => {
    const { input, key, pill } = setup()
    for (let i = 0; i < 8; i++) key('ArrowUp')
    expect(input.value).toBe('Premier message')
    expect(pill()).toContain('1/6')
    expect(screen.getByTestId('history-announce').textContent).toContain('1 sur 6')
    expect(screen.getByTestId('history-announce').getAttribute('aria-live')).toBe('polite')
  })

  it('Échap vide la saisie et quitte l’historique avant d’arrêter la réponse', () => {
    const { input, key, pill, onCancel } = setup({
      snapshot: { ...snapshot, status: 'busy' }
    })
    key('ArrowUp')
    key('Escape')
    expect(input.value).toBe('')
    expect(pill()).toBeNull()
    expect(onCancel).not.toHaveBeenCalled()
    key('Escape')
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('une modification fait un brouillon : plus de pastille, les flèches ne changent plus de message', () => {
    const { input, key, pill } = setup()
    key('ArrowUp')
    fireEvent.change(input, { target: { value: 'Dernier envoyé, modifié' } })
    expect(pill()).toBeNull()
    key('ArrowUp')
    expect(input.value).toBe('Dernier envoyé, modifié')
    // Même revenu au texte d'origine, il reste un brouillon.
    fireEvent.change(input, { target: { value: 'Dernier envoyé' } })
    key('ArrowUp')
    expect(input.value).toBe('Dernier envoyé')
    expect(pill()).toBeNull()
  })

  it('pas d’entrée dans l’historique si la saisie n’est pas vide, ni avant un message en attente', () => {
    const { input, key } = setup()
    fireEvent.change(input, { target: { value: 'brouillon' } })
    key('ArrowUp')
    expect(input.value).toBe('brouillon')
  })

  it('message en attente : ↑ le reprend d’abord, sans rappel', () => {
    const queued = [{ id: 'q1', text: 'En attente', attachments: [] }]
    const { key, onUnqueue } = setup(
      { snapshot: { ...snapshot, status: 'busy', queued } },
      { queued }
    )
    fireEvent.focus(screen.getByTestId('composer-input'))
    expect(screen.queryByTestId('history-hint')).toBeNull()
    key('ArrowUp')
    expect(onUnqueue).toHaveBeenCalledWith('q1')
  })

  it('jetons de rôle repris (ligne « Partira à… ») ; rôle supprimé : « @Libellé » en texte', () => {
    const { input, key } = setup()
    for (let i = 0; i < 5; i++) key('ArrowUp')
    expect(input.value).toBe('relis le diff du paiement')
    expect(screen.getByTestId('role-token').dataset.role).toBe('security-expert')
    expect(screen.getByTestId('role-destination')).toBeTruthy()
    key('ArrowDown')
    key('ArrowDown')
    expect(input.value).toBe('@Rôle parti regarde ça')
    expect(screen.queryByTestId('role-token')).toBeNull()
  })

  it('pièces jointes non reprises : une ligne atténuée, jusqu’à ce que la saisie soit vide', () => {
    const { input, key } = setup()
    for (let i = 0; i < 4; i++) key('ArrowUp')
    expect(input.value).toBe('avec deux pièces')
    expect(screen.getByTestId('history-lost').textContent).toBe('2 pièces jointes non reprises')
    fireEvent.change(input, { target: { value: 'avec deux pièces !' } })
    expect(screen.getByTestId('history-lost')).toBeTruthy()
    fireEvent.change(input, { target: { value: '' } })
    expect(screen.queryByTestId('history-lost')).toBeNull()
  })

  it('une commande reprise n’ouvre pas le menu « / »', () => {
    const { input, key } = setup()
    key('ArrowUp')
    key('ArrowUp')
    expect(input.value).toBe('/compact')
    expect(screen.queryByTestId('command-menu')).toBeNull()
  })

  it('à l’envoi : le texte tapé (la commande, pas sa consigne), jetons et pièces jointes comptés', () => {
    const { input, recordSent, onSend } = setup()
    fireEvent.change(input, { target: { value: '/revue src/panier' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSend).toHaveBeenCalledWith('Revue de src/panier.', [])
    expect(recordSent).toHaveBeenCalledWith(expect.any(String), {
      text: '/revue src/panier',
      roles: [],
      attachments: 0
    })
    fireEvent.change(input, { target: { value: 'Bonjour' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(recordSent).toHaveBeenLastCalledWith(expect.any(String), {
      text: 'Bonjour',
      roles: [],
      attachments: 0
    })
  })

  it('↑ juste après l’envoi : le message parti, sans attendre le main', () => {
    const { input, key, pill } = setup()
    fireEvent.change(input, { target: { value: 'Tout juste parti' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    key('ArrowUp')
    expect(input.value).toBe('Tout juste parti')
    expect(pill()).toContain('7/7')
  })

  it('rappel « ↑ Messages précédents » : saisie vide avec le focus, tant qu’il n’a pas servi 3 fois', () => {
    setup()
    expect(screen.queryByTestId('history-hint')).toBeNull()
    fireEvent.focus(screen.getByTestId('composer-input'))
    expect(screen.getByTestId('history-hint').textContent).toContain('Messages précédents')
    fireEvent.change(screen.getByTestId('composer-input'), { target: { value: 'x' } })
    expect(screen.queryByTestId('history-hint')).toBeNull()
  })

  it('rappel déjà appris (3 utilisations) : rien', () => {
    setup({}, { hint: false })
    fireEvent.focus(screen.getByTestId('composer-input'))
    expect(screen.queryByTestId('history-hint')).toBeNull()
  })

  it('conversation sans historique : ↑ ne fait rien, pas de rappel', () => {
    const { input, key, pill } = setup({ sentHistory: undefined })
    fireEvent.focus(input)
    key('ArrowUp')
    expect(input.value).toBe('')
    expect(pill()).toBeNull()
    expect(screen.queryByTestId('history-hint')).toBeNull()
  })
})
