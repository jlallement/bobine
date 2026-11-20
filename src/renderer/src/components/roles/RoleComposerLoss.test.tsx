/**
 * Saisie avec un rôle, recette N5 (fiche 267) : « rôle choisi, texte tapé, Entrée 0,3 s plus tard :
 * la saisie se vide et rien ne part », vu une fois. Ces essais tentent de le reproduire — envoi
 * pendant la lecture du dossier, juste après le choix du rôle, double Entrée — et vérifient la
 * règle : un texte n'est jamais perdu, il part ou il revient dans la saisie.
 */
import * as Tooltip from '@radix-ui/react-tooltip'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentSnapshot, ProfileSummary } from '@shared/agent'
import type { LaunchFolderState } from '@shared/launch-folder'
import type { RoleView } from '@shared/roles'
import { Composer } from '../composer/Composer'
import type { ComposerRoles } from './useRoleCompose'

vi.mock('../panel/TerminalTab', () => ({ INSERT_TEXT_EVENT: 'bob:insert-text' }))

const snapshot: AgentSnapshot = {
  status: 'ready',
  info: { profileId: 'mock', profileLabel: 'Agent factice', workspace: '/tmp/courses' },
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
const ROLES = [role('ux-ui-expert', 'Expert UX/UI', true), role('tech-lead', 'Tech lead', false)]

/** Dépôt sans commit et non propre : le cas de la recette. */
const NO_COMMIT: LaunchFolderState = { place: 'here', reason: 'noCommit' }

function deferred<T>() {
  let resolve: (value: T) => void = () => {}
  const promise = new Promise<T>((r) => (resolve = r))
  return { promise, resolve }
}

const childFolder = vi.fn()
beforeEach(() => {
  childFolder.mockReset().mockResolvedValue(NO_COMMIT)
  window.api.conversations = { childFolder } as unknown as Window['api']['conversations']
})

function setup(send: ComposerRoles['send']) {
  const sent = vi.fn(send)
  const roles: ComposerRoles = {
    list: ROLES,
    invokable: true,
    refresh: vi.fn(),
    send: sent,
    motherId: 'm',
    commitFolder: vi.fn(async () => {}),
    profiles: [{ id: 'mock', label: 'Agent factice', available: true }] as ProfileSummary[]
  }
  const onSend = vi.fn()
  const noop = vi.fn()
  render(
    <Tooltip.Provider>
      <Composer
        snapshot={snapshot}
        settings={null}
        roles={roles}
        fresh={false}
        draftKey={`c-${Math.random()}`}
        onSend={onSend}
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
  const type = (value: string) => {
    fireEvent.change(input, { target: { value, selectionStart: value.length } })
    fireEvent.keyUp(input, { key: 'x' })
  }
  /** Choisit le rôle dans le menu `@` (Entrée), comme dans la recette. */
  const pick = (query: string) => {
    type(`@${query}`)
    fireEvent.keyDown(input, { key: 'Enter' })
  }
  const enter = () => fireEvent.keyDown(input, { key: 'Enter' })
  return { input, type, pick, enter, sent, onSend }
}

const ASK = 'À quoi ça pourrait ressembler ? Propose une direction.'

describe('saisie avec un rôle : le texte part ou revient (recette N5, fiche 267)', () => {
  it('rôle de conseil choisi, texte tapé, Entrée aussitôt : il part, une fois', async () => {
    const { input, type, pick, enter, sent, onSend } = setup(async (names) => ({
      started: names,
      failed: []
    }))
    pick('ux')
    expect(screen.getByTestId('role-token').dataset['role']).toBe('ux-ui-expert')
    type(ASK)
    await act(async () => void enter())
    expect(sent).toHaveBeenCalledTimes(1)
    expect(sent).toHaveBeenCalledWith(['ux-ui-expert'], ASK)
    expect(onSend).not.toHaveBeenCalled()
    expect(input.value).toBe('')
  })

  it('double Entrée pendant l’envoi : un seul envoi, rien de perdu', async () => {
    const answer = deferred<{ started: string[]; failed: string[] }>()
    const { input, type, pick, enter, sent } = setup(() => answer.promise)
    pick('ux')
    type(ASK)
    act(() => void enter())
    act(() => void enter())
    expect(sent).toHaveBeenCalledTimes(1)
    // Refusé : la demande et le jeton reviennent.
    await act(async () => answer.resolve({ started: [], failed: ['ux-ui-expert'] }))
    expect(input.value).toBe(ASK)
    expect(screen.getByTestId('role-token').dataset['role']).toBe('ux-ui-expert')
  })

  it('envoi refusé (rejet de l’IPC) : la demande revient', async () => {
    const { input, type, pick, enter } = setup(async () => ({
      started: [],
      failed: ['ux-ui-expert']
    }))
    pick('ux')
    type(ASK)
    await act(async () => void enter())
    expect(input.value).toBe(ASK)
  })

  it('rôle qui écrit, Entrée pendant la lecture du dossier : il part après, avec la demande', async () => {
    const read = deferred<LaunchFolderState>()
    childFolder.mockReturnValue(read.promise)
    const { input, type, pick, enter, sent } = setup(async (names) => ({
      started: names,
      failed: []
    }))
    pick('tech')
    type(ASK)
    act(() => void enter())
    // Le dossier n'est pas encore lu : rien n'est parti, la demande est encore là.
    expect(sent).not.toHaveBeenCalled()
    expect(input.value).toBe(ASK)
    await act(async () => read.resolve(NO_COMMIT))
    expect(sent).toHaveBeenCalledTimes(1)
    expect(sent.mock.calls[0]?.[1]).toBe(ASK)
    expect(input.value).toBe('')
  })

  it('texte ajouté pendant la lecture du dossier : jamais effacé sans partir', async () => {
    const read = deferred<LaunchFolderState>()
    childFolder.mockReturnValue(read.promise)
    const { input, type, pick, enter, sent } = setup(async (names) => ({
      started: names,
      failed: []
    }))
    pick('tech')
    type(ASK)
    act(() => void enter())
    type(`${ASK} Et le mode sombre ?`)
    await act(async () => read.resolve(NO_COMMIT))
    // Ce qui part est la demande validée par Entrée ; ce qui a été tapé ensuite reste.
    expect(sent).toHaveBeenCalledTimes(1)
    expect(sent.mock.calls[0]?.[1]).toBe(ASK)
    expect(input.value).toBe(' Et le mode sombre ?')
  })
})
