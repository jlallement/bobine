/**
 * `@rôle` et dossier modifié (fiche 240) : un rôle qui partirait en worktree d'un dossier avec du
 * non commité ne part pas avant le choix ; « Partir quand même », « Committer d'abord » et l'avis
 * en lecture seule ; un rôle en lecture seule part sans rien demander.
 */
import * as Tooltip from '@radix-ui/react-tooltip'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentSnapshot, ProfileSummary } from '@shared/agent'
import type { FolderDirty } from '@shared/launch-folder'
import type { RoleView } from '@shared/roles'
import { Composer } from '../composer/Composer'
import type { ComposerRoles } from './useRoleCompose'

vi.mock('../panel/TerminalTab', () => ({ INSERT_TEXT_EVENT: 'bob:insert-text' }))

const snapshot: AgentSnapshot = {
  status: 'ready',
  info: { profileId: 'mock', profileLabel: 'Agent factice', workspace: '/tmp/taches' },
  controls: [],
  commands: [],
  promptCapabilities: { image: true, embeddedContext: true },
  queued: []
}

const role = (name: string, label: string, readOnly: boolean): RoleView => ({
  name,
  label,
  icon: 'palette',
  color: 'pink',
  description: label,
  readOnly,
  prompt: 'p',
  scope: 'builtin',
  enabled: true
})
const ROLES = [
  role('ux-ui-expert', 'Expert UX/UI', false),
  role('back-architect', 'Architecte back-end', false),
  role('security-expert', 'Expert sécu', true)
]

const DIRTY: FolderDirty = {
  count: 17,
  files: [
    'plan.md',
    'maquettes/b.html',
    'server/index.js',
    'public/app.js',
    'test/api.test.js',
    'ios/ContentView.swift',
    'package.json'
  ].map((path) => ({ path, status: 'untracked' as const })),
  commit: '9970242',
  branch: 'main',
  subject: 'chore: initial commit',
  title: 'Page des tâches'
}

/** Texte affiché, espaces insécables (typographie française de l'app) rendues ordinaires. */
const plain = (text: string | null | undefined) => (text ?? '').replace(/[\u00a0\u202f]/g, ' ')

const childFolderDirty = vi.fn()
beforeEach(() => {
  childFolderDirty.mockReset().mockResolvedValue(DIRTY)
  window.api.conversations = { childFolderDirty } as unknown as Window['api']['conversations']
})

function setup() {
  const send = vi.fn(async (names: string[]) => ({ started: names, failed: [] }))
  const commitFolder = vi.fn(async () => {
    // Commité : le dossier est propre à la relecture.
    childFolderDirty.mockResolvedValue(null)
  })
  const roles: ComposerRoles = {
    list: ROLES,
    invokable: true,
    refresh: vi.fn(),
    send,
    motherId: 'm',
    commitFolder,
    profiles: [{ id: 'mock', label: 'Agent factice', available: true }] as ProfileSummary[]
  }
  const noop = vi.fn()
  render(
    <Tooltip.Provider>
      <Composer
        snapshot={snapshot}
        settings={null}
        roles={roles}
        fresh={false}
        draftKey={`c-${Math.random()}`}
        onSend={noop}
        onWarn={noop}
        onSearchFiles={vi.fn(async () => [])}
        onPickFiles={vi.fn(async () => [])}
        onUnqueue={vi.fn(async () => undefined)}
        onUseApiKey={vi.fn(async () => {})}
        onAppCommand={noop}
        onCancel={noop}
        onSendNow={noop}
        onRestart={noop}
        onConfigure={noop}
        onChooseWorkspace={noop}
        onSetControl={noop}
        onContinueInNew={noop}
        onAuthenticate={noop}
        onRetry={noop}
        onRunStep={noop}
        onTrustForSession={noop}
        onOpenTerminal={noop}
      />
    </Tooltip.Provider>
  )
  const input = screen.getByTestId('composer-input') as HTMLTextAreaElement
  const type = async (value: string) => {
    fireEvent.change(input, { target: { value, selectionStart: value.length } })
    fireEvent.keyUp(input, { key: 'x' })
    fireEvent.keyDown(input, { key: 'Escape' })
    // Le dossier est lu dès qu'un rôle partirait en worktree.
    await act(async () => {})
  }
  const enter = () => act(async () => void fireEvent.keyDown(input, { key: 'Enter' }))
  return { input, type, enter, send, commitFolder }
}

describe('`@rôle` et non commité de la mère (fiche 240)', () => {
  it('l’avertissement paraît dès les rôles cités ; Entrée n’envoie rien sans choix', async () => {
    const { type, enter, send, input } = setup()
    await type('@ux-ui-expert @back-architect construisez la page')
    expect(childFolderDirty).toHaveBeenCalledWith('m')
    expect(plain(screen.getByTestId('launch-dirty-title').textContent)).toBe(
      'Ce dossier a 17 modifications non commitées : les 2 conversations filles ne les verront pas.'
    )
    expect(screen.getAllByTestId('launch-dirty-file')).toHaveLength(6)
    expect(screen.getByTestId('launch-dirty').textContent).toContain('9970242')
    await enter()
    expect(send).not.toHaveBeenCalled()
    expect(input.value).toBe('@ux-ui-expert @back-architect construisez la page')
    // Le bloc prend le focus : on voit pourquoi rien n'est parti.
    expect(document.activeElement).toBe(screen.getByTestId('launch-dirty-commit'))
  })

  it('« Partir quand même » : les filles partent, avec ce choix', async () => {
    const { type, send } = setup()
    await type('@ux-ui-expert construisez la page')
    await act(async () => void fireEvent.click(screen.getByTestId('launch-dirty-anyway')))
    expect(send).toHaveBeenCalledWith(['ux-ui-expert'], 'construisez la page', 'anyway')
  })

  it('« Committer d’abord » : message proposé, commit de tous les fichiers, puis l’envoi part', async () => {
    const { type, send, commitFolder } = setup()
    await type('@ux-ui-expert construisez la page')
    fireEvent.click(screen.getByTestId('launch-dirty-commit'))
    const message = screen.getByTestId('launch-dirty-commit-message') as HTMLTextAreaElement
    expect(message.value).not.toBe('')
    await act(async () => void fireEvent.click(screen.getByTestId('launch-dirty-commit-confirm')))
    expect(commitFolder).toHaveBeenCalledWith(
      message.value,
      DIRTY.files.map((f) => f.path)
    )
    expect(send).toHaveBeenCalledWith(['ux-ui-expert'], 'construisez la page')
  })

  it('avis en lecture seule : la ligne le dit, Entrée l’envoie ainsi ; retour possible', async () => {
    const { type, enter, send } = setup()
    await type('@ux-ui-expert @back-architect donnez votre avis sur plan.md')
    fireEvent.click(screen.getByTestId('launch-dirty-opinion'))
    expect(screen.queryByTestId('launch-dirty')).toBeNull()
    const line = plain(screen.getByTestId('role-destination').textContent)
    expect(line).toContain('pour un avis')
    expect(line).toContain('dans ce dossier')
    expect(line).toContain('voient les 17 modifications non commitées')
    // « Plutôt les faire travailler… » : l'avertissement revient.
    fireEvent.click(screen.getByTestId('role-destination-work'))
    expect(screen.getByTestId('launch-dirty')).toBeTruthy()
    fireEvent.click(screen.getByTestId('launch-dirty-opinion'))
    await enter()
    expect(send).toHaveBeenCalledWith(
      ['ux-ui-expert', 'back-architect'],
      'donnez votre avis sur plan.md',
      'readOnly'
    )
  })

  it('un rôle en lecture seule : ni lecture du dossier, ni avertissement, il part', async () => {
    const { type, enter, send } = setup()
    await type('@security-expert relis le diff')
    expect(childFolderDirty).not.toHaveBeenCalled()
    expect(screen.queryByTestId('launch-dirty')).toBeNull()
    await enter()
    expect(send).toHaveBeenCalledWith(['security-expert'], 'relis le diff')
  })

  it('dossier propre : rien à choisir, l’envoi part', async () => {
    childFolderDirty.mockResolvedValue(null)
    const { type, enter, send } = setup()
    await type('@ux-ui-expert construisez la page')
    expect(screen.queryByTestId('launch-dirty')).toBeNull()
    await enter()
    expect(send).toHaveBeenCalledWith(['ux-ui-expert'], 'construisez la page')
  })
})
