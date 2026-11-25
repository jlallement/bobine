import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ProfileSummary } from '@shared/agent'
import { PROBE_PROMPT, type AgentReadiness, type CheckRequest } from '@shared/onboarding'
import i18next from 'i18next'
import { Onboarding } from './Onboarding'
import { useOnboarding } from './useOnboarding'

const original = window.api
const MOCK = { id: 'mock', label: 'Agent factice', available: true } as ProfileSummary
const BOB = { id: 'bob', label: 'IBM Bob', available: false, reason: 'Commande `bob` introuvable.' }

let resolveCheck: (result: AgentReadiness) => void = () => {}
let api: Record<string, ReturnType<typeof vi.fn>>

function mount(agents: ProfileSummary[] = [MOCK, BOB as ProfileSummary], launchFolder?: string) {
  api = {
    state: vi.fn(async () => ({
      due: true,
      agents,
      trialFolder: '~/Bobine',
      ...(launchFolder ? { launchFolder } : {})
    })),
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

async function setup(agents?: ProfileSummary[], launchFolder?: string) {
  mount(agents, launchFolder)
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

  it('`bobine <dossier>` : « Où travailler ? » propose d’abord le dossier demandé (E4)', async () => {
    const { configure, rerender } = await setup(undefined, '/projets/bricole')
    await act(async () => fireEvent.click(screen.getByTestId('onboarding-continue')))
    await act(async () => resolveCheck({ state: 'ready', level: 'connect', ms: 900 }))
    rerender()
    await act(async () => fireEvent.click(screen.getByTestId('onboarding-continue')))
    rerender()
    const line = screen.getByTestId('onboarding-launch-folder')
    expect(line.textContent).toContain('/projets/bricole')
    const use = screen.getByTestId('onboarding-use-launch-folder')
    expect(use.className).toContain('primary')
    expect(document.activeElement).toBe(use)
    // « Choisir… » reste là, sans être le bouton principal.
    expect(screen.getByTestId('onboarding-choose-folder').className).not.toContain('primary')
    await act(async () => fireEvent.click(use))
    expect(configure).toHaveBeenLastCalledWith({ workspace: '/projets/bricole' })
  })

  it('sans dossier demandé : « Choisir… » reste le bouton principal', async () => {
    const { rerender } = await setup()
    await act(async () => fireEvent.click(screen.getByTestId('onboarding-continue')))
    await act(async () => resolveCheck({ state: 'ready', level: 'connect', ms: 900 }))
    rerender()
    await act(async () => fireEvent.click(screen.getByTestId('onboarding-continue')))
    rerender()
    expect(screen.queryByTestId('onboarding-launch-folder')).toBeNull()
    expect(screen.getByTestId('onboarding-choose-folder').className).toContain('primary')
  })

  it('essai répondu par un autre modèle que celui de la conversation : l’écart est dit (fiche 245, D16)', async () => {
    const { rerender } = await setup()
    await act(async () => fireEvent.click(screen.getByTestId('onboarding-continue')))
    await act(async () => resolveCheck({ state: 'ready', level: 'connect', ms: 900 }))
    rerender()
    await act(async () => fireEvent.click(screen.getByTestId('onboarding-continue')))
    rerender()
    await act(async () => fireEvent.click(screen.getByTestId('onboarding-trial-folder')))
    rerender()
    await act(async () => fireEvent.click(screen.getByTestId('onboarding-send')))
    await act(async () =>
      resolveCheck({
        state: 'ready',
        level: 'reply',
        ms: 2600,
        reply: 'OK',
        cost: { amount: 0, currency: 'USD' },
        model: 'opencode/Hy4 flash Free',
        modelRequested: 'openai/GPT-6.2 Astra'
      })
    )
    rerender()
    const replied = screen.getByTestId('onboarding-replied').textContent ?? ''
    expect(replied.replace(/[\u00a0\u202f]/g, ' ')).toContain('≈ 0,00 $US')
    expect(screen.getByTestId('onboarding-model-missed').textContent).toContain(
      'Répondu avec opencode/Hy4 flash Free, pas openai/GPT-6.2 Astra'
    )
  })

  it('étape Dossier : « avec votre accord » seulement pour un agent qui demande (fiche 259, D30)', async () => {
    const folderText = async (agent: ProfileSummary) => {
      const { rerender } = await setup([agent])
      await act(async () => fireEvent.click(screen.getByTestId('onboarding-continue')))
      await act(async () => resolveCheck({ state: 'ready', level: 'connect', ms: 900 }))
      rerender()
      await act(async () => fireEvent.click(screen.getByTestId('onboarding-continue')))
      rerender()
      const text = screen.getByTestId('onboarding').textContent ?? ''
      cleanup()
      return text
    }
    const asks = await folderText(MOCK)
    expect(asks).toContain('L’agent lit et modifie les fichiers de ce dossier, avec votre accord.')
    const silent = await folderText({ ...MOCK, writesWithoutAsking: true })
    expect(silent).toContain('sans demander d’autorisation')
    expect(silent).not.toContain('avec votre accord')
    // Aucun nom d'agent dans ce texte : il vient de la capacité du profil.
    expect(silent).not.toContain('Agent factice')
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

/**
 * Remplaçants des vérifications de composant de `e2e/suites/onboarding.mjs` (n° 4, 5, 7, 9, 19,
 * 21, 22, 30, 40). Les vérifications réelles (agent lancé, aucun message au modèle) restent au
 * main (`agent-readiness.test.ts`).
 */
describe('accueil du premier lancement — remplaçants des e2e', () => {
  const focused = () => document.activeElement?.getAttribute('data-testid')

  /** Agent choisi, connexion vérifiée (`ready`), puis le dossier d'essai : l'étape Essai. */
  async function toTrial() {
    const s = await setup()
    await act(async () => fireEvent.click(screen.getByTestId('onboarding-continue')))
    await act(async () => resolveCheck({ state: 'ready', level: 'connect', ms: 900 }))
    s.rerender()
    await act(async () => fireEvent.click(screen.getByTestId('onboarding-continue')))
    s.rerender()
    await act(async () => fireEvent.click(screen.getByTestId('onboarding-trial-folder')))
    s.rerender()
    return s
  }

  it('connexion vérifiée : « Agent factice est prêt », le focus sur « Continuer » (onboarding n° 4, 5)', async () => {
    const { rerender } = await setup()
    await act(async () => fireEvent.click(screen.getByTestId('onboarding-continue')))
    expect(api['check']).toHaveBeenCalledWith(expect.objectContaining({ level: 'connect' }))
    await act(async () => resolveCheck({ state: 'ready', level: 'connect', ms: 900 }))
    rerender()
    expect(screen.getByTestId('onboarding-ready').textContent).toContain(
      i18next.t('onboarding.connect.readyTitle', { agent: 'Agent factice' })
    )
    expect(focused()).toBe('onboarding-continue')
  })

  it('essai : le message qui partira, montré tel quel (onboarding n° 7)', async () => {
    await toTrial()
    expect(screen.getByTestId('onboarding').textContent).toContain(`« ${PROBE_PROMPT} »`)
    expect(focused()).toBe('onboarding-send')
  })

  it('essai réussi : « Commencer » a le focus, et finit l’accueil (onboarding n° 9)', async () => {
    const { rerender } = await toTrial()
    await act(async () => fireEvent.click(screen.getByTestId('onboarding-send')))
    expect(api['check']).toHaveBeenLastCalledWith(expect.objectContaining({ level: 'reply' }))
    // L'attente de la réponse s'affiche d'abord, comme dans l'app.
    rerender()
    await act(async () => resolveCheck({ state: 'ready', level: 'reply', ms: 2000, reply: 'OK' }))
    rerender()
    expect(screen.getByTestId('onboarding-replied').textContent).toContain('OK')
    expect(focused()).toBe('onboarding-start')
    await act(async () => fireEvent.click(screen.getByTestId('onboarding-start')))
    expect(api['finish']).toHaveBeenCalledWith('finished')
  })

  it('aucun agent : le sous-titre, et ce que chaque profil dit d’installer, sans alerte (onboarding n° 19)', async () => {
    await setup([BOB as ProfileSummary])
    const page = screen.getByTestId('onboarding')
    expect(page.textContent).toContain(i18next.t('onboarding.agent.noneSubtitle'))
    const card = screen.getByTestId('onboarding-no-agent')
    expect(card.textContent).toContain('IBM Bob')
    expect(card.querySelector('code')?.textContent).toBe('bob')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(focused()).toBe('onboarding-search')
  })

  it('aucun agent : « Explorer » marque l’accueil passé (onboarding n° 21)', async () => {
    const { hook } = await setup([BOB as ProfileSummary])
    await act(async () => fireEvent.click(screen.getByTestId('onboarding-explore')))
    expect(api['finish']).toHaveBeenCalledWith('skipped')
    expect(hook.result.current.visible).toBe(false)
  })

  const login = {
    id: 'opencode-login',
    name: 'Login',
    step: { id: 'opencode-login', label: 'Se connecter', command: 'opencode auth login' }
  }

  it('connexion à faire : la carte, avec la commande déclarée par le profil (onboarding n° 22)', async () => {
    const { rerender } = await setup()
    await act(async () => fireEvent.click(screen.getByTestId('onboarding-continue')))
    await act(async () =>
      resolveCheck({
        state: 'auth',
        blocker: { kind: 'auth', methods: [login], authenticating: false }
      })
    )
    rerender()
    const card = screen.getByTestId('blocker-auth')
    expect(card.querySelector('.pc-title')?.textContent).toBe('Connexion requise')
    const step = screen.getByTestId('auth-opencode-login')
    expect(step.textContent).toBe('Se connecter')
    expect(step.getAttribute('title')?.replace(/[\u00a0\u202f]/g, ' ')).toContain(
      '« opencode auth login »'
    )
  })

  it('connexion expirée pendant l’essai : la carte « Connexion expirée », pas l’erreur brute (onboarding n° 30)', async () => {
    const { rerender } = await toTrial()
    await act(async () => fireEvent.click(screen.getByTestId('onboarding-send')))
    await act(async () =>
      resolveCheck({
        state: 'auth',
        blocker: { kind: 'auth', methods: [login], authenticating: false, atTurn: true }
      })
    )
    rerender()
    expect(screen.getByTestId('blocker-auth').textContent).toContain('Connexion expirée')
    expect(screen.queryByTestId('onboarding-error-failed')).toBeNull()
  })

  it('agent qui plante : détails repliés, « Réessayer » a le focus (onboarding n° 40)', async () => {
    const { rerender } = await setup()
    await act(async () => fireEvent.click(screen.getByTestId('onboarding-continue')))
    await act(async () =>
      resolveCheck({ state: 'crashed', message: 'code 1', stderr: 'panic: boom' })
    )
    rerender()
    const alert = screen.getByTestId('onboarding-error-crashed')
    const details = alert.querySelector('details') as HTMLDetailsElement
    expect(details.open).toBe(false)
    expect(details.textContent).toContain('panic: boom')
    expect(focused()).toBe('onboarding-retry')
  })
})
