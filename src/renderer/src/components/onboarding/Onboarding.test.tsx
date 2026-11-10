import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ProfileSummary } from '@shared/agent'
import type { AgentReadiness, CheckRequest } from '@shared/onboarding'
import { Onboarding } from './Onboarding'
import { useOnboarding } from './useOnboarding'

const original = window.api
const MOCK = { id: 'mock', label: 'Agent factice', available: true } as ProfileSummary
const BOB = { id: 'bob', label: 'IBM Bob', available: false, reason: 'Commande `bob` introuvable.' }

let resolveCheck: (result: AgentReadiness) => void = () => {}
let api: Record<string, ReturnType<typeof vi.fn>>

function mount(agents: ProfileSummary[] = [MOCK, BOB as ProfileSummary]) {
  api = {
    state: vi.fn(async () => ({ due: true, agents, trialFolder: '~/Bobine' })),
    check: vi.fn(
      (_request: CheckRequest) =>
        new Promise<AgentReadiness>((resolve) => {
          resolveCheck = resolve
        })
    ),
    cancel: vi.fn(async () => {
      resolveCheck({ state: 'cancelled' })
    }),
    finish: vi.fn(async () => undefined),
    hints: vi.fn(async () => ({})),
    runStep: vi.fn(async () => 'tab-1'),
    trialFolder: vi.fn(async () => '/tmp/essai')
  }
  window.api = {
    ...original,
    onboarding: api,
    settings: { ...original?.settings, reloadShellEnv: vi.fn(async () => ({})) },
    workspace: { ...original?.workspace, choose: vi.fn(async () => '/projets/meteo') }
  } as unknown as Window['api']
}

afterEach(() => {
  window.api = original
})

async function setup(agents?: ProfileSummary[]) {
  mount(agents)
  const hook = renderHook(() => useOnboarding({ conversationId: 'c1', pageOpen: false }))
  await waitFor(() => expect(hook.result.current.visible).toBe(true))
  const configure = vi.fn(async () => undefined)
  const view = render(
    <Onboarding
      onboarding={hook.result.current}
      configure={configure}
      workspace=""
      onShowTerminal={() => {}}
    />
  )
  const rerender = () =>
    view.rerender(
      <Onboarding
        onboarding={hook.result.current}
        configure={configure}
        workspace=""
        onShowTerminal={() => {}}
      />
    )
  return { hook, configure, rerender }
}

describe('accueil du premier lancement (fiche 188)', () => {
  it('agent trouvé présélectionné, introuvable grisé ; pas de « Passer cette étape »', async () => {
    await setup()
    const mock = screen.getByTestId('onboarding-agent-mock').querySelector('input')
    const bob = screen.getByTestId('onboarding-agent-bob').querySelector('input')
    expect(mock?.checked).toBe(true)
    expect(bob?.disabled).toBe(true)
    expect(screen.getByTestId('onboarding-agent-bob').textContent).toContain('bob')
    expect(screen.queryByTestId('onboarding-skip-step')).toBeNull()
  })

  it('Continuer : agent configuré, vérification sans message ; Échap annule, ne passe pas', async () => {
    const { configure, hook, rerender } = await setup()
    await act(async () => fireEvent.click(screen.getByTestId('onboarding-continue')))
    expect(configure).toHaveBeenCalledWith({ profileId: 'mock' })
    expect(api['check']).toHaveBeenCalledWith(
      expect.objectContaining({ conversationId: 'c1', profileId: 'mock', level: 'connect' })
    )
    rerender()
    expect(screen.getByTestId('onboarding-waiting')).toBeTruthy()
    expect(document.activeElement?.getAttribute('data-testid')).toBe('onboarding-cancel')
    await act(async () => fireEvent.keyDown(window, { key: 'Escape' }))
    expect(api['cancel']).toHaveBeenCalled()
    await waitFor(() => expect(hook.result.current.check.status).toBe('done'))
    rerender()
    expect(screen.getByTestId('onboarding-cancelled')).toBeTruthy()
    // Toujours à l'étape Connexion : Échap n'a rien passé.
    expect(screen.getByTestId('onboarding-back-agent')).toBeTruthy()
    expect(api['finish']).not.toHaveBeenCalled()
  })

  it('« Passer l’accueil » : marqué passé, l’accueil disparaît', async () => {
    const { hook } = await setup()
    await act(async () => fireEvent.click(screen.getByTestId('onboarding-skip-all')))
    expect(api['finish']).toHaveBeenCalledWith('skipped')
    expect(hook.result.current.visible).toBe(false)
  })

  it('sortie par la barre latérale (autre conversation, page de l’app) : passé', async () => {
    mount()
    const { result, rerender } = renderHook(
      (props: { conversationId: string; pageOpen: boolean }) => useOnboarding(props),
      { initialProps: { conversationId: 'c1', pageOpen: false } }
    )
    await waitFor(() => expect(result.current.visible).toBe(true))
    rerender({ conversationId: 'c2', pageOpen: false })
    await waitFor(() => expect(result.current.visible).toBe(false))
    expect(api['finish']).toHaveBeenCalledWith('skipped')
  })

  it('SSO qui ne revient pas (fiche 207) : l’attente le dit, « Réessayer » vérifie sans connexion', async () => {
    const { hook, rerender } = await setup()
    await act(async () => fireEvent.click(screen.getByTestId('onboarding-continue')))
    rerender()
    // Vérification simple : ni la question ni sa sortie.
    expect(screen.getByTestId('onboarding-waiting').textContent).toContain('sans aucun message')
    expect(screen.queryByTestId('onboarding-stuck')).toBeNull()
    await act(async () =>
      resolveCheck({
        state: 'auth',
        blocker: {
          kind: 'auth',
          methods: [{ id: 'mock-sso', name: 'Se connecter avec le SSO' }],
          authenticating: false
        }
      } as AgentReadiness)
    )
    rerender()
    await act(async () => fireEvent.click(screen.getByTestId('auth-mock-sso')))
    expect(api['check']).toHaveBeenLastCalledWith(
      expect.objectContaining({ level: 'connect', authenticate: 'mock-sso' })
    )
    rerender()
    expect(screen.getByTestId('onboarding-waiting').textContent).toContain(
      'Terminez la connexion dans votre navigateur'
    )
    expect(screen.getByTestId('onboarding-stuck').textContent).toContain(
      'Connecté dans le navigateur, mais rien ne se passe ici'
    )
    expect(screen.getByTestId('onboarding-cancel')).toBeTruthy()
    await act(async () => fireEvent.click(screen.getByTestId('onboarding-stuck-retry')))
    // Nouvelle vérification, sans `authenticate` : le main arrête l'agent de la précédente.
    expect(api['check']).toHaveBeenCalledTimes(3)
    expect(api['check']?.mock.calls[2]?.[0]).not.toHaveProperty('authenticate')
    rerender()
    expect(hook.result.current.check.status).toBe('running')
    expect(screen.queryByTestId('onboarding-stuck')).toBeNull()
    await act(async () => resolveCheck({ state: 'ready', level: 'connect', ms: 1200 }))
    rerender()
    expect(screen.getByTestId('onboarding-ready')).toBeTruthy()
  })

  it('aucun agent : « Chercher à nouveau » sans résultat le dit', async () => {
    await setup([BOB as ProfileSummary])
    expect(screen.getByTestId('onboarding-no-agent').textContent).toContain('bob')
    await act(async () => fireEvent.click(screen.getByTestId('onboarding-search')))
    await waitFor(() =>
      expect(screen.getByTestId('onboarding-still-none').textContent).not.toBe('')
    )
  })
})
