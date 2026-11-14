/**
 * `@rôle` dans la saisie (fiche 223, phase 3B) : menu `@` avec les rôles en tête, jeton, retour
 * arrière, ligne « Partira à… », envoi d'une fille par rôle, rôle inconnu laissé en texte.
 */
import * as Tooltip from '@radix-ui/react-tooltip'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { AgentSnapshot, ProfileSummary } from '@shared/agent'
import type { RoleView } from '@shared/roles'
import { Composer } from '../composer/Composer'
import type { ComposerRoles } from './useRoleCompose'
import { invokeRole } from '../../roles/roles-store'

vi.mock('../panel/TerminalTab', () => ({ INSERT_TEXT_EVENT: 'bob:insert-text' }))

const snapshot: AgentSnapshot = {
  status: 'ready',
  info: { profileId: 'mock', profileLabel: 'Agent factice', workspace: '/tmp/projet' },
  controls: [],
  commands: [],
  promptCapabilities: { image: true, embeddedContext: true },
  queued: []
}

const role = (name: string, label: string, extra: Partial<RoleView> = {}): RoleView => ({
  name,
  label,
  icon: 'shield-check',
  color: 'orange',
  description: `${label}, sa description`,
  readOnly: false,
  prompt: 'p',
  scope: 'builtin',
  enabled: true,
  ...extra
})

const ROLES = [
  role('security-expert', 'Expert sécu', { readOnly: true }),
  role('code-reviewer', 'Code reviewer', { color: 'blue', icon: 'scan-search', readOnly: true }),
  role('tech-lead', 'Tech lead'),
  role('ux-ui-expert', 'Expert UX/UI'),
  role('front-architect', 'Architecte front'),
  role('back-architect', 'Architecte back', {
    description: 'API, sécurité des API',
    scope: 'user'
  }),
  role('flutter-expert', 'Expert Flutter', { scope: 'project' })
]

function setup(
  options: {
    list?: RoleView[]
    profiles?: Partial<ProfileSummary>[]
    fresh?: boolean
    sent?: boolean
    onCreate?: ComposerRoles['onCreate']
    invokable?: boolean
    files?: string[]
    send?: ComposerRoles['send']
    reload?: ComposerRoles['reload']
    elsewhere?: RoleView[]
  } = {}
) {
  const send = vi.fn(
    options.send ??
      (async (names: string[], _text: string) =>
        (options.sent ?? true) ? { started: names, failed: [] } : { started: [], failed: names })
  )
  const roles: ComposerRoles = {
    list: options.list ?? ROLES,
    invokable: options.invokable ?? true,
    refresh: vi.fn(),
    ...(options.reload ? { reload: options.reload } : {}),
    ...(options.elsewhere ? { elsewhere: options.elsewhere } : {}),
    send,
    profiles: (options.profiles ?? [
      { id: 'mock', label: 'Agent factice', available: true }
    ]) as ProfileSummary[],
    ...(options.onCreate ? { onCreate: options.onCreate } : {})
  }
  const onSend = vi.fn()
  const onWarn = vi.fn()
  const noop = vi.fn()
  render(
    <Tooltip.Provider>
      <Composer
        snapshot={snapshot}
        settings={null}
        roles={roles}
        fresh={options.fresh ?? false}
        draftKey={`c-${Math.random()}`}
        onSend={onSend}
        onWarn={onWarn}
        onSearchFiles={vi.fn(async () =>
          (options.files ?? []).map((relative) => ({ path: `/w/${relative}`, relative }))
        )}
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
  const key = (k: string) => fireEvent.keyDown(input, { key: k })
  return { input, type, key, send, onSend, onWarn, roles }
}

const roleNames = () => screen.queryAllByTestId('role-item').map((i) => i.dataset['role'])

describe('menu `@` : rôles en tête', () => {
  it('cinq rôles, « Tous les rôles (7) », puis les fichiers ; marque d’un rôle du projet', () => {
    const { type } = setup()
    type('Relis le diff @')
    expect(roleNames()).toEqual(ROLES.slice(0, 5).map((r) => r.name))
    expect(screen.getByTestId('role-more').textContent).toContain('Tous les rôles (7)')
    fireEvent.mouseDown(screen.getByTestId('role-more'))
    expect(roleNames()).toHaveLength(7)
    expect(within(screen.getByTestId('file-menu')).getByText('Rôles')).toBeTruthy()
    const flutter = screen
      .getAllByTestId('role-item')
      .find((i) => i.dataset['role'] === 'flutter-expert')
    expect(flutter?.querySelector('.role-item-project')).toBeTruthy()
  })

  it('filtre : nom d’abord, puis la description ; accents ignorés', () => {
    const { type } = setup()
    type('Relis @secu')
    expect(roleNames()).toEqual(['security-expert', 'back-architect'])
  })

  it('rôle fourni : description reçue du main (déjà dans la langue de l’interface), affichée et cherchée', () => {
    const { type } = setup({
      list: [
        role('security-expert', 'Expert sécu', {
          description: 'Audite la sécurité d’un changement (injection, secrets, authentification).'
        })
      ]
    })
    type('@authentif')
    expect(roleNames()).toEqual(['security-expert'])
    expect(screen.getByTestId('role-item').textContent).toContain('Audite la sécurité')
  })

  it('`@git` : `@git-changes` d’abord, pas un rôle trouvé par sa seule description', () => {
    const { type, key, input } = setup({
      list: [role('code-reviewer', 'Code reviewer', { description: 'Lit le git diff.' })]
    })
    type('Relis @git')
    expect(roleNames()).toEqual([])
    key('Enter')
    expect(input.value).toBe('Relis @git-changes ')
    expect(screen.queryByTestId('role-token')).toBeNull()
  })

  it('rôle trouvé par sa seule description : après les fichiers, Entrée prend le fichier', async () => {
    const { type, key, input } = setup({
      list: [
        role('qa-expert', 'Expert qualité', {
          description: 'Écrit les tests manquants.',
          scope: 'user'
        })
      ],
      files: ['tests/app.test.ts']
    })
    type('Relis @test')
    await screen.findByTestId('file-item')
    const options = [...screen.getByTestId('file-menu').querySelectorAll('[role=option]')]
    expect(options.map((o) => o.getAttribute('data-testid'))).toEqual(['file-item', 'role-item'])
    expect(screen.getByTestId('role-menu-by-description')).toBeTruthy()
    key('Enter')
    expect(input.value).toContain('@tests/app.test.ts')
    expect(screen.queryByTestId('role-token')).toBeNull()
  })

  it('« + Nouveau rôle » en dernier : Entrée après `@git` prend `@git-changes`', () => {
    const onCreate = vi.fn()
    const { type, key, input } = setup({ onCreate })
    type('Relis @git')
    const options = [...screen.getByTestId('file-menu').querySelectorAll('[role=option]')]
    expect(options.at(-1)?.getAttribute('data-testid')).toBe('role-new')
    key('Enter')
    expect(input.value).toBe('Relis @git-changes ')
    expect(onCreate).not.toHaveBeenCalled()
  })

  it('« + Nouveau rôle » seulement si l’app sait ouvrir l’assistant', () => {
    const onCreate = vi.fn()
    const first = setup()
    first.type('@zz')
    expect(screen.queryByTestId('role-new')).toBeNull()
    expect(screen.queryByTestId('role-menu-new')).toBeNull()
    first.input.remove()
    document.body.innerHTML = ''
    const second = setup({ onCreate })
    second.type('@zz')
    fireEvent.mouseDown(screen.getByTestId('role-new'))
    expect(onCreate).toHaveBeenCalledWith('zz')
  })

  it('aucun rôle actif : une invitation, qu’on peut écarter', () => {
    localStorage.removeItem('bobine.rolesInviteHidden')
    const { type } = setup({ list: [] })
    type('@')
    expect(screen.getByTestId('roles-invite')).toBeTruthy()
    fireEvent.click(screen.getByTestId('roles-invite-hide'))
    expect(screen.queryByTestId('roles-invite')).toBeNull()
    expect(localStorage.getItem('bobine.rolesInviteHidden')).toBe('1')
  })
})

describe('jeton et envoi', () => {
  it('Entrée choisit le rôle : un jeton, `@requête` sort du texte ; « Partira à… »', () => {
    const { type, key, input } = setup()
    type('@sécu')
    key('Enter')
    expect(input.value).toBe('')
    const token = screen.getByTestId('role-token')
    expect(token.dataset['role']).toBe('security-expert')
    const line = screen.getByTestId('role-destination')
    expect(line.textContent).toContain('Partira à Expert sécu, dans une conversation fille')
    expect(line.textContent).toContain('lecture seule')
    expect(line.textContent).toContain('dans ce dossier')
    expect(input.closest('form')?.className).toContain('to-role')
  })

  it('flèches puis Entrée : le rôle surligné ; Échap referme le menu', () => {
    const { type, key } = setup()
    type('@')
    key('ArrowDown')
    key('Enter')
    expect(screen.getByTestId('role-token').dataset['role']).toBe('code-reviewer')
    type('@')
    expect(screen.getByTestId('file-menu')).toBeTruthy()
    key('Escape')
    expect(screen.queryByTestId('file-menu')).toBeNull()
  })

  it('retour arrière en tête de la saisie : le dernier jeton part d’un coup', () => {
    const { type, key, input } = setup()
    type('@sécu')
    key('Enter')
    type('@tech')
    key('Enter')
    expect(screen.getAllByTestId('role-token')).toHaveLength(2)
    input.setSelectionRange(0, 0)
    key('Backspace')
    expect(screen.getAllByTestId('role-token').map((t) => t.dataset['role'])).toEqual([
      'security-expert'
    ])
  })

  it('un jeton : une fille, le texte sans rien d’autre ; rien à la conversation', async () => {
    const { type, key, send, onSend, input } = setup()
    type('@sécu')
    key('Enter')
    type('relis le diff du paiement')
    await act(async () => key('Enter'))
    expect(send).toHaveBeenCalledWith(['security-expert'], 'relis le diff du paiement')
    expect(onSend).not.toHaveBeenCalled()
    expect(input.value).toBe('')
    expect(screen.queryByTestId('role-token')).toBeNull()
  })

  it('deux `@rôle` tapés en entier : deux filles, en parallèle, même texte', async () => {
    const { type, key, send } = setup()
    type('@security-expert @code-reviewer relisez avant la fusion')
    expect(screen.getByTestId('role-destination').textContent).toContain(
      'Partira à 2 rôles, une conversation fille chacun, en parallèle'
    )
    key('Escape')
    await act(async () => key('Enter'))
    expect(send).toHaveBeenCalledWith(
      ['security-expert', 'code-reviewer'],
      'relisez avant la fusion'
    )
  })

  it('rôle inconnu : laissé en texte, le message part à la conversation', () => {
    const { type, key, send, onSend } = setup()
    type('Demande à @astronaute la météo')
    key('Escape')
    key('Enter')
    expect(send).not.toHaveBeenCalled()
    expect(onSend).toHaveBeenCalledWith('Demande à @astronaute la météo', [])
  })

  it('aucune fille partie : le texte et le jeton restent', async () => {
    const { type, key, input } = setup({ sent: false })
    type('@sécu')
    key('Enter')
    type('relis')
    await act(async () => key('Enter'))
    expect(input.value).toBe('relis')
    expect(screen.getByTestId('role-token')).toBeTruthy()
  })

  it('agent qui écrit sans demander : « lecture seule demandée »', () => {
    const { type, key } = setup({
      profiles: [{ id: 'mock', label: 'Agent factice', available: true, writesWithoutAsking: true }]
    })
    type('@sécu')
    key('Enter')
    expect(screen.getByTestId('role-destination').textContent).toContain('lecture seule demandée')
  })

  it('conversation encore vide : rien ne retient le premier `@rôle` (elle entre dans l’historique)', () => {
    const { type, key } = setup({ fresh: true })
    type('@sécu')
    key('Enter')
    expect(screen.getByTestId('role-destination').textContent).not.toContain('Écrivez d’abord')
  })
})

describe('rôle invoqué d’ailleurs (section Équipe, Réglages, assistant) : un seul chemin', () => {
  it('le jeton `@rôle` est posé dans la saisie, les rôles relus ; le texte reste', () => {
    const { type, roles, send } = setup()
    type('Relis le diff')
    act(() => {
      expect(invokeRole('code-reviewer')).toBe(true)
    })
    const token = screen.getByTestId('role-token')
    expect(token.dataset['role']).toBe('code-reviewer')
    expect((screen.getByTestId('composer-input') as HTMLTextAreaElement).value).toBe(
      'Relis le diff'
    )
    expect(roles.refresh).toHaveBeenCalled()
    // Deux fois le même rôle : un seul jeton.
    act(() => {
      invokeRole('code-reviewer')
    })
    expect(screen.getAllByTestId('role-token')).toHaveLength(1)
    expect(send).not.toHaveBeenCalled()
  })

  it('conversation qui ne lance pas de filles : rien n’est posé, c’est dit', () => {
    const { onWarn } = setup({ invokable: false })
    act(() => {
      invokeRole('code-reviewer')
    })
    expect(screen.queryByTestId('role-token')).toBeNull()
    expect(onWarn).toHaveBeenCalledWith(expect.stringContaining('conversation mère'))
  })
})

describe('envoi aux rôles : un seul à la fois, rien de perdu (relecture phase 3)', () => {
  const deferred = () => {
    let resolve: (value: { started: string[]; failed: string[] }) => void = () => {}
    const promise = new Promise<{ started: string[]; failed: string[] }>((r) => (resolve = r))
    return { promise, resolve }
  }

  it('pendant l’envoi : second Entrée sans effet, bouton désactivé, « Lancement… » ; le texte tapé entre-temps reste', async () => {
    const pending = deferred()
    const { type, key, send, input } = setup({ send: () => pending.promise })
    type('@security-expert relis')
    key('Escape')
    await act(async () => key('Enter'))
    await act(async () => key('Enter'))
    expect(send).toHaveBeenCalledTimes(1)
    expect((screen.getByTestId('send') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByTestId('role-destination-sending')).toBeTruthy()
    type('autre chose')
    await act(async () => pending.resolve({ started: ['security-expert'], failed: [] }))
    expect(input.value).toBe('autre chose')
  })

  it('échec partiel : le texte et le jeton du rôle refusé restent', async () => {
    const { type, key, input } = setup({
      send: async () => ({ started: ['security-expert'], failed: ['code-reviewer'] })
    })
    type('@security-expert @code-reviewer relisez')
    key('Escape')
    await act(async () => key('Enter'))
    expect(input.value).toBe('relisez')
    expect(screen.getAllByTestId('role-token').map((t) => t.dataset['role'])).toEqual([
      'code-reviewer'
    ])
  })

  it('rien à demander après le rôle : bouton désactivé et dit pourquoi, Entrée n’envoie rien', async () => {
    const { type, key, send, onSend } = setup()
    type('@security-expert')
    key('Escape')
    expect((screen.getByTestId('send') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByTestId('role-destination-empty').textContent).toContain(
      'Écrivez votre demande'
    )
    await act(async () => key('Enter'))
    expect(send).not.toHaveBeenCalled()
    expect(onSend).not.toHaveBeenCalled()
  })

  it('`@nom` inconnu à l’envoi : la liste est relue ; le rôle tout juste créé reçoit la demande', async () => {
    const created = role('perf-expert', 'Expert perf', { scope: 'user' })
    const reload = vi.fn(async () => [...ROLES, created])
    const { type, key, send, onSend } = setup({ reload })
    type('@perf-expert fais X')
    key('Escape')
    await act(async () => key('Enter'))
    expect(reload).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith(['perf-expert'], 'fais X')
    expect(onSend).not.toHaveBeenCalled()
  })

  it('`@nom` toujours inconnu après relecture : le message part à la conversation', async () => {
    const reload = vi.fn(async () => ROLES)
    const { type, key, send, onSend } = setup({ reload })
    type('Demande à @astronaute la météo')
    key('Escape')
    await act(async () => key('Enter'))
    expect(reload).toHaveBeenCalledTimes(1)
    expect(send).not.toHaveBeenCalled()
    expect(onSend).toHaveBeenCalledWith('Demande à @astronaute la météo', [])
  })

  it('retour arrière : le dernier jeton **visible** part (pas celui d’un rôle pas encore lu)', () => {
    const { type, key, input } = setup()
    type('@sécu')
    key('Enter')
    act(() => {
      invokeRole('pas-encore-lu')
    })
    input.setSelectionRange(0, 0)
    key('Backspace')
    expect(screen.queryByTestId('role-token')).toBeNull()
  })
})

describe('`@rôle` tapé dans une fille (essais réels avant 1.0.0-beta.2)', () => {
  it('c’est dit sous la saisie, aucun rôle au menu, et le message part tel quel à son agent', async () => {
    const reload = vi.fn(async () => [])
    const { type, key, send, onSend } = setup({
      list: [],
      invokable: false,
      elsewhere: ROLES,
      reload
    })
    type('@security-expert relis auth.js')
    expect(screen.getByTestId('role-not-here').textContent).toContain('conversation mère')
    expect(screen.queryByTestId('role-item')).toBeNull()
    expect(screen.queryByTestId('roles-invite')).toBeNull()
    key('Escape')
    await act(async () => key('Enter'))
    expect(send).not.toHaveBeenCalled()
    expect(reload).not.toHaveBeenCalled()
    expect(onSend).toHaveBeenCalledWith('@security-expert relis auth.js', [])
  })
})
