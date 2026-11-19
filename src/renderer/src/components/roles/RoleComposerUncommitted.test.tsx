/**
 * `@rôle` et dossier de la mère (fiches 240, 262) : jamais d'avertissement, une ligne discrète sous
 * la saisie dit où partira un rôle qui écrit ; Entrée envoie toujours, avec le choix affiché
 * (« Partir sans elles » par défaut, retenu pour le dossier jusqu'au prochain commit) ;
 * « Changer… » : committer d'abord, juste un avis, voir les modifications ; dépôt sans commit :
 * dans ce dossier. Un rôle de conseil part en lecture seule sans rien lire ni demander.
 */
import * as Tooltip from '@radix-ui/react-tooltip'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentSnapshot, ProfileSummary } from '@shared/agent'
import type { FolderDirty, LaunchFolderState } from '@shared/launch-folder'
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
  role('front-architect', 'Architecte front', false),
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

const HEAD = '9970242aa11bb22cc33dd44ee55ff66778899aab'
const AFTER = '1234567aa11bb22cc33dd44ee55ff66778899aab'
const folderOf = (dirty?: FolderDirty, head = HEAD): LaunchFolderState => ({
  place: 'worktree',
  root: '/tmp/taches',
  head,
  ...(dirty ? { dirty } : {})
})

const childFolder = vi.fn()
beforeEach(() => {
  childFolder.mockReset().mockResolvedValue(folderOf(DIRTY))
  window.api.conversations = { childFolder } as unknown as Window['api']['conversations']
})

function setup() {
  const send = vi.fn(async (names: string[]): Promise<{ started: string[]; failed: string[] }> => ({
    started: names,
    failed: []
  }))
  const commitFolder = vi.fn(async () => {
    // Commité : le dossier est propre à la relecture, HEAD a changé.
    childFolder.mockResolvedValue(folderOf(undefined, AFTER))
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
    // Le dossier est lu dès qu'un rôle qui écrit est cité.
    await act(async () => {})
  }
  const enter = () => act(async () => void fireEvent.keyDown(input, { key: 'Enter' }))
  /** « Changer… » puis une entrée du menu. */
  const change = async (entry: string) => {
    fireEvent.pointerDown(screen.getByTestId('launch-line-change'), { button: 0, ctrlKey: false })
    await act(async () => void fireEvent.click(await screen.findByTestId(entry)))
    // Radix rend le focus à la fermeture du menu, dans une minuterie à 0 ms.
    await act(async () => void (await new Promise((resolve) => setTimeout(resolve, 0))))
  }
  const line = () => plain(screen.getByTestId('role-destination').textContent)
  return { input, type, enter, change, line, send, commitFolder }
}

describe('`@rôle` et dossier de la mère : une ligne, Entrée envoie (fiche 262)', () => {
  it('rôle qui écrit, dossier modifié : ni encadré ni bouton, la ligne en orange ; Entrée envoie', async () => {
    const { type, enter, send, input, line } = setup()
    await type('@front-architect ')
    // Avant même la demande : la ligne, rien d'autre (R1).
    expect(childFolder).toHaveBeenCalledWith('m')
    // Rien d'autre qu'une ligne : aucun bouton sous la saisie hormis « Changer… », aucune alerte.
    expect(screen.queryByRole('alert')).toBeNull()
    expect(
      [...screen.getByTestId('role-destination').querySelectorAll('button')].map(
        (b) => b.dataset.testid
      )
    ).toEqual(['launch-line-change'])
    expect(screen.getByTestId('launch-line-change').getAttribute('aria-label')).toBe(
      'Changer où partira le rôle'
    )
    const segment = screen.getByTestId('launch-line')
    expect(segment.className).toContain('warn')
    expect(segment.dataset.choice).toBe('without')
    expect(line()).toContain('son worktree')
    expect(line()).toContain('Partira du dernier commit, sans vos 17 modifications')
    expect(screen.getByTestId('launch-line-change').textContent).toContain('Changer…')
    await type('@front-architect construisez la page')
    input.focus()
    await enter()
    // Le choix affiché part, explicite (R2) ; la saisie garde le focus.
    expect(send).toHaveBeenCalledWith(['front-architect'], 'construisez la page', 'anyway')
    expect(document.activeElement).toBe(input)
  })

  it('« Changer… » : committer d’abord, partir sans elles (coché), juste un avis, voir', async () => {
    const { type } = setup()
    await type('@front-architect construisez la page')
    fireEvent.pointerDown(screen.getByTestId('launch-line-change'), { button: 0, ctrlKey: false })
    const menu = await screen.findByTestId('launch-line-menu')
    expect(plain(menu.textContent)).toContain('Committer d’abord')
    expect(plain(menu.textContent)).toContain('Juste un avis, en lecture seule')
    expect(plain(menu.textContent)).toContain('Voir les 17 modifications')
    expect(plain(menu.textContent)).toContain('9970242')
    expect(screen.getByTestId('launch-line-without').getAttribute('aria-checked')).toBe('true')
    expect(screen.getByTestId('launch-line-opinion').getAttribute('aria-checked')).toBe('false')
  })

  it('« Voir les N modifications » : la liste sous la ligne, les autres comptées', async () => {
    const { type, change } = setup()
    await type('@front-architect construisez la page')
    await change('launch-line-show')
    expect(screen.getAllByTestId('launch-line-file').map((li) => li.textContent)).toEqual(
      DIRTY.files.map((f) => f.path)
    )
    expect(plain(screen.getByTestId('launch-line-files').textContent)).toContain('10')
  })

  it('« Juste un avis » : appliqué tout de suite, la ligne le dit, Entrée l’envoie ainsi', async () => {
    const { type, enter, send, change, line } = setup()
    await type('@front-architect @back-architect donnez votre avis sur plan.md')
    await change('launch-line-opinion')
    expect(line()).toContain('pour un avis')
    expect(line()).toContain('dans ce dossier')
    expect(line()).toContain('voient les 17 modifications non commitées')
    expect(screen.queryByTestId('launch-line')).toBeNull()
    await enter()
    expect(send).toHaveBeenCalledWith(
      ['front-architect', 'back-architect'],
      'donnez votre avis sur plan.md',
      'readOnly'
    )
  })

  it('un choix de « Changer… » rend le focus à la saisie : Entrée envoie ensuite (R2)', async () => {
    const { type, change, send, input } = setup()
    await type('@front-architect votre avis sur le plan')
    input.focus()
    await change('launch-line-opinion')
    expect(document.activeElement).toBe(input)
    await act(
      async () => void fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Enter' })
    )
    expect(send).toHaveBeenCalledWith(['front-architect'], 'votre avis sur le plan', 'readOnly')
  })

  it('« Juste un avis » ne vaut que pour l’envoi en cours ; ensuite, « Partir sans elles »', async () => {
    const { type, change, enter, send, line } = setup()
    await type('@front-architect votre avis')
    await change('launch-line-opinion')
    await enter()
    expect(send).toHaveBeenLastCalledWith(['front-architect'], 'votre avis', 'readOnly')
    // Même dossier, même HEAD : le message suivant revient au défaut, et la ligne le dit (R6).
    await type('@back-architect écrivez l’API')
    expect(line()).not.toContain('pour un avis')
    expect(screen.getByTestId('launch-line').dataset.choice).toBe('without')
    await enter()
    expect(send).toHaveBeenLastCalledWith(['back-architect'], 'écrivez l’API', 'anyway')
  })

  it('« Juste un avis » oublié quand plus aucun rôle qui écrit n’est cité', async () => {
    const { type, change, line } = setup()
    await type('@front-architect votre avis')
    await change('launch-line-opinion')
    expect(line()).toContain('pour un avis')
    await type('votre avis')
    await type('@front-architect votre avis')
    expect(line()).not.toContain('pour un avis')
  })

  it('« Committer d’abord » : le choix de commit, puis le message part de ce commit', async () => {
    const { type, change, send, commitFolder } = setup()
    await type('@front-architect construisez la page')
    await change('launch-line-commit')
    await waitFor(() =>
      expect(
        (screen.getByTestId('launch-line-commit-message') as HTMLTextAreaElement).disabled
      ).toBe(false)
    )
    const message = screen.getByTestId('launch-line-commit-message') as HTMLTextAreaElement
    expect(message.value).not.toBe('')
    expect(send).not.toHaveBeenCalled()
    await act(async () => void fireEvent.click(screen.getByTestId('launch-line-commit-confirm')))
    expect(commitFolder).toHaveBeenCalledWith(
      message.value,
      DIRTY.files.map((f) => f.path)
    )
    // Dossier propre après le commit : rien à laisser, aucun choix à porter.
    expect(send).toHaveBeenCalledWith(['front-architect'], 'construisez la page')
  })

  it('« Committer d’abord » ouvert : Entrée mène au bouton du commit, rien ne part avant', async () => {
    const { type, change, enter, send } = setup()
    await type('@front-architect construisez la page')
    await change('launch-line-commit')
    await enter()
    expect(send).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(screen.getByTestId('launch-line-commit-confirm'))
  })

  it('fiche 244 : un fichier décoché reste ; le message part sans lui (« anyway »)', async () => {
    const { type, change, send, commitFolder } = setup()
    // Après le commit, le fichier décoché reste : le dossier n'est pas propre.
    commitFolder.mockImplementation(async () => {
      childFolder.mockResolvedValue(
        folderOf({ ...DIRTY, count: 1, files: DIRTY.files.slice(0, 1) }, AFTER)
      )
    })
    await type('@front-architect construisez la page')
    await change('launch-line-commit')
    fireEvent.click(
      screen
        .getAllByTestId('launch-line-commit-file')
        .find((li) => li.dataset.path === 'plan.md')
        ?.querySelector('input') as HTMLInputElement
    )
    await waitFor(() =>
      expect(
        (screen.getByTestId('launch-line-commit-message') as HTMLTextAreaElement).disabled
      ).toBe(false)
    )
    const message = screen.getByTestId('launch-line-commit-message') as HTMLTextAreaElement
    expect(plain(screen.getByTestId('launch-line-commit-left').textContent)).toBe(
      '1 fichier décoché reste dans ce dossier, non commité : le travail partira sans lui.'
    )
    await act(async () => void fireEvent.click(screen.getByTestId('launch-line-commit-confirm')))
    expect(commitFolder).toHaveBeenCalledWith(
      message.value,
      DIRTY.files.slice(1).map((f) => f.path)
    )
    expect(send).toHaveBeenCalledWith(['front-architect'], 'construisez la page', 'anyway')
  })

  it('rôle de conseil : ni lecture du dossier ni ligne orange, il part en lecture seule', async () => {
    const { type, enter, send, line } = setup()
    await type('@security-expert relis le diff')
    expect(childFolder).not.toHaveBeenCalled()
    expect(screen.queryByTestId('launch-line')).toBeNull()
    expect(line()).toContain('lecture seule')
    expect(line()).toContain('dans ce dossier')
    await enter()
    expect(send).toHaveBeenCalledWith(['security-expert'], 'relis le diff')
  })

  it('dossier propre : « partira du dernier commit », discret ; l’envoi part sans choix', async () => {
    childFolder.mockResolvedValue(folderOf())
    const { type, enter, send, line } = setup()
    await type('@front-architect construisez la page')
    expect(screen.getByTestId('launch-line').className).not.toContain('warn')
    expect(line()).toContain('son worktree')
    expect(line()).toContain('partira du dernier commit (9970242)')
    await enter()
    expect(send).toHaveBeenCalledWith(['front-architect'], 'construisez la page')
  })

  it('dépôt sans commit : dans ce dossier, sans « Changer… » ni « () » ; l’envoi part', async () => {
    childFolder.mockResolvedValue({ place: 'here', reason: 'noCommit' })
    const { type, enter, send, line } = setup()
    await type('@front-architect construisez la page')
    expect(line()).toContain(
      'Ce dépôt n’a pas encore de commit : le rôle travaillera dans ce dossier, en même temps que l’agent, sans branche ni rien à fusionner'
    )
    // En orange : il écrit dans les mêmes fichiers que l'agent (revue QA, 3).
    expect(screen.getByTestId('launch-line').className).toContain('warn')
    expect(line()).not.toContain('worktree')
    expect(line()).not.toContain('()')
    expect(screen.queryByTestId('launch-line-change')).toBeNull()
    await enter()
    expect(send).toHaveBeenCalledWith(['front-architect'], 'construisez la page')
  })

  it('dossier hors dépôt git : les rôles qui écrivent ne peuvent pas partir, c’est dit (accordé)', async () => {
    childFolder.mockResolvedValue({ place: 'here', reason: 'notRepo' })
    const { type, line } = setup()
    await type('@front-architect @back-architect construisez la page')
    expect(line()).toContain(
      'Ce dossier n’est pas un dépôt git : les rôles qui écrivent ne peuvent pas partir d’ici'
    )
  })

  it('accord : un rôle qui écrit et un rôle de conseil, la ligne parle du rôle qui écrit', async () => {
    childFolder.mockResolvedValue({ place: 'here', reason: 'noCommit' })
    const { type, line } = setup()
    await type('@front-architect @security-expert construisez la page')
    expect(line()).toContain('le rôle travaillera dans ce dossier')
  })

  it('commit en échec : l’erreur est dite, rien ne part', async () => {
    const { type, change, send, commitFolder } = setup()
    commitFolder.mockRejectedValue(new Error('pre-commit refusé'))
    await type('@front-architect construisez la page')
    await change('launch-line-commit')
    await waitFor(() =>
      expect(
        (screen.getByTestId('launch-line-commit-message') as HTMLTextAreaElement).disabled
      ).toBe(false)
    )
    await act(async () => void fireEvent.click(screen.getByTestId('launch-line-commit-confirm')))
    expect(screen.getByTestId('launch-line-commit-error').textContent).toContain(
      'pre-commit refusé'
    )
    expect(send).not.toHaveBeenCalled()
    // Le choix de commit reste ouvert, hors de la région annoncée de la ligne (revue QA, 6).
    expect(
      screen.getByTestId('role-destination').contains(screen.getByTestId('launch-line-commit-box'))
    ).toBe(false)
  })

  it('double Entrée : un seul envoi', async () => {
    const { type, send, input } = setup()
    let release: () => void = () => {}
    send.mockImplementation(
      (names: string[]) =>
        new Promise((resolve) => (release = () => resolve({ started: names, failed: [] })))
    )
    await type('@front-architect construisez la page')
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' })
      fireEvent.keyDown(input, { key: 'Enter' })
    })
    expect(send).toHaveBeenCalledTimes(1)
    await act(async () => release())
  })

  it('dossier modifié entre la lecture et l’envoi : refusé, la ligne se met à jour, le renvoi part', async () => {
    childFolder.mockResolvedValue(folderOf())
    const { type, enter, send, input, line } = setup()
    // Le main refuse (non commité apparu depuis la lecture) : rien n'est parti.
    send.mockImplementationOnce(async (names: string[]) => {
      childFolder.mockResolvedValue(folderOf(DIRTY))
      return { started: [], failed: names }
    })
    await type('@front-architect construisez la page')
    await enter()
    expect(send).toHaveBeenLastCalledWith(['front-architect'], 'construisez la page')
    // Le message revient dans la saisie, le dossier est relu : la ligne dit ce qui reste.
    await waitFor(() => expect(line()).toContain('sans vos 17 modifications'))
    expect(input.value).toContain('construisez la page')
    await enter()
    expect(send).toHaveBeenLastCalledWith(['front-architect'], 'construisez la page', 'anyway')
  })

  it('dossier pas encore lu à l’Entrée : lu d’abord, puis l’envoi part avec le bon choix', async () => {
    let answer: (state: LaunchFolderState) => void = () => {}
    childFolder.mockReturnValue(new Promise<LaunchFolderState>((resolve) => (answer = resolve)))
    const { type, enter, send } = setup()
    await type('@front-architect construisez la page')
    await enter()
    expect(send).not.toHaveBeenCalled()
    await act(async () => answer(folderOf(DIRTY)))
    expect(send).toHaveBeenCalledWith(['front-architect'], 'construisez la page', 'anyway')
  })
})
