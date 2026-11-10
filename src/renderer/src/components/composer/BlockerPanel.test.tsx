import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { AgentBlocker, SessionControl } from '@shared/agent'
import { BlockerPanel } from './BlockerPanel'

const trust = (extra: Partial<Extract<AgentBlocker, { kind: 'trust' }>> = {}): AgentBlocker => ({
  kind: 'trust',
  message: 'Workspace "/tmp/projet" is not trusted.',
  canTrustForSession: true,
  trustRemembered: false,
  ...extra
})

function panel(
  blocker: AgentBlocker,
  onChooseWorkspace = () => {},
  onRetry: () => unknown = () => {}
) {
  const noop = () => {}
  return render(
    <BlockerPanel
      blocker={blocker}
      agentLabel="Un agent"
      workspace="/tmp/projet"
      onAuthenticate={noop}
      onRetry={onRetry}
      onUseApiKey={async () => {}}
      onRunStep={noop}
      onTrustForSession={noop}
      onOpenTerminal={noop}
      onChooseWorkspace={onChooseWorkspace}
    />
  )
}

/** Libellés des boutons du pied de carte, de gauche à droite. */
const actions = (testId: string) =>
  [...screen.getByTestId(testId).querySelectorAll('.pc-actions button')].map((b) => ({
    text: b.textContent?.trim(),
    primary: b.classList.contains('primary')
  }))

describe('panneau « Dossier non approuvé » (fiche 088)', () => {
  it('commande déclarée par le profil : affichée telle quelle, sans rien supposer de l’agent', () => {
    panel(trust({ approveCommand: 'bob' }))
    const code = screen.getByText('bob', { selector: 'code' })
    expect(code.closest('p')?.textContent).toContain('ouvrez un terminal dans ce dossier')
    expect(screen.queryByText(/Approuvez ce dossier dans l’agent/)).toBeNull()
  })

  it('sans commande : texte générique', () => {
    panel(trust())
    expect(screen.getByText('Approuvez ce dossier dans l’agent, puis réessayez.')).toBeTruthy()
    expect(screen.getByTestId('blocker-trust').querySelector('.blocker-body p code')).toBeNull()
  })
})

describe('pied de la carte « Dossier non approuvé » (fiche 093)', () => {
  it('la confiance est le bouton principal, à droite ; terminal et Réessayer à sa gauche', () => {
    panel(trust({ trustRemembered: true }))
    expect(actions('blocker-trust')).toEqual([
      { text: 'Ouvrir un terminal ici', primary: false },
      { text: 'Réessayer', primary: false },
      { text: 'Faire confiance à ce dossier', primary: true }
    ])
  })

  it('confiance pour cette session seulement : même place', () => {
    panel(trust())
    expect(actions('blocker-trust').at(-1)).toEqual({
      text: 'Faire confiance pour cette session',
      primary: true
    })
  })

  it('profil sans confiance possible : Réessayer reste l’action principale', () => {
    panel(trust({ canTrustForSession: false }))
    expect(actions('blocker-trust')).toEqual([
      { text: 'Ouvrir un terminal ici', primary: false },
      { text: 'Réessayer', primary: true }
    ])
  })
})

describe('carte « Choisissez le dossier de votre projet » (fiche 093)', () => {
  it('titre, explication et un seul bouton, qui ouvre le choix du dossier', () => {
    const choose = vi.fn()
    panel({ kind: 'workspace' }, choose)
    const card = screen.getByTestId('blocker-workspace')
    expect(card.textContent).toContain('Choisissez le dossier de votre projet')
    expect(card.textContent).toContain('L’agent y lira et modifiera des fichiers.')
    expect(actions('blocker-workspace')).toEqual([{ text: 'Choisir un dossier…', primary: true }])
    fireEvent.click(screen.getByTestId('choose-workspace'))
    expect(choose).toHaveBeenCalledOnce()
  })
})

describe('connexion expirée en pleine conversation (recette 0.9, D10)', () => {
  const expired = (extra: Partial<Extract<AgentBlocker, { kind: 'auth' }>> = {}): AgentBlocker => ({
    kind: 'auth',
    methods: [
      {
        id: 'opencode-login',
        name: 'Login',
        step: { id: 'opencode-login', label: 'Se connecter', command: 'opencode auth login' }
      }
    ],
    authenticating: false,
    atTurn: true,
    ...extra
  })
  const primaries = () =>
    [...screen.getByTestId('blocker-auth').querySelectorAll('button.primary')].map((b) =>
      b.textContent?.trim()
    )

  it('un seul bouton principal : la connexion, puis « Réessayer » une fois l’étape lancée', () => {
    panel(expired())
    expect(screen.getByText('Connexion expirée')).toBeTruthy()
    expect(screen.getByText('opencode auth login', { selector: 'code' })).toBeTruthy()
    expect(primaries()).toEqual(['Se connecter'])
    expect(screen.queryByTestId('auth-api-key')).toBeNull()
    expect(screen.queryByTestId('auth-tools-ran')).toBeNull()
    fireEvent.click(screen.getByTestId('auth-opencode-login'))
    expect(primaries()).toEqual(['Réessayer'])
  })

  it('outils déjà lancés : la carte le dit, et « Réessayer » demande confirmation', () => {
    const onRetry = vi.fn()
    panel(expired({ toolsRan: true }), undefined, onRetry)
    expect(screen.getByTestId('auth-tools-ran').textContent).toContain('depuis le début')
    fireEvent.click(screen.getByTestId('retry'))
    expect(onRetry).not.toHaveBeenCalled()
    expect(
      screen.getByText('Des outils ont déjà tourné pour ce message ; les relancer ?')
    ).toBeTruthy()
    expect(primaries()).toEqual(['Relancer'])
    fireEvent.click(screen.getByTestId('retry-cancel'))
    expect(onRetry).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('retry'))
    fireEvent.click(screen.getByTestId('retry-confirm'))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('« Réessayer » désactivé tant que l’appel est en cours (pas de double envoi)', async () => {
    let finish = () => {}
    const onRetry = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)))
    panel(expired(), undefined, onRetry)
    const button = screen.getByTestId('retry') as HTMLButtonElement
    fireEvent.click(button)
    fireEvent.click(button)
    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(button.disabled).toBe(true)
    finish()
    await vi.waitFor(() => expect(button.disabled).toBe(false))
  })
})

describe('connexion dans le navigateur qui ne revient pas (fiche 207)', () => {
  const sso = (extra: Partial<Extract<AgentBlocker, { kind: 'auth' }>> = {}): AgentBlocker => ({
    kind: 'auth',
    methods: [{ id: 'mock-sso', name: 'Se connecter avec le SSO' }],
    authenticating: true,
    ...extra
  })

  it('en attente du navigateur : la question, et « Réessayer » (principal) relance l’agent', () => {
    const onRetry = vi.fn()
    panel(sso(), undefined, onRetry)
    expect(screen.getByTestId('authenticating').textContent).toContain(
      'Terminez la connexion dans votre navigateur'
    )
    expect(screen.getByTestId('auth-stuck').textContent).toContain(
      'Connecté dans le navigateur, mais rien ne se passe ici'
    )
    expect(actions('blocker-auth')).toEqual([{ text: 'Réessayer', primary: true }])
    fireEvent.click(screen.getByTestId('retry'))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('pas d’attente du navigateur : ni question ni « Réessayer »', () => {
    panel(sso({ authenticating: false }))
    expect(screen.queryByTestId('auth-stuck')).toBeNull()
    expect(screen.queryByTestId('retry')).toBeNull()
  })

  it('connexion expirée refaite par SSO : la même question, un seul « Réessayer »', () => {
    panel(sso({ atTurn: true }))
    expect(screen.getByTestId('auth-stuck')).toBeTruthy()
    expect(actions('blocker-auth')).toEqual([{ text: 'Réessayer', primary: true }])
  })
})

describe('clé d’API de la carte « Connexion requise » : jamais silencieuse (fiche 207)', () => {
  const withKey: AgentBlocker = {
    kind: 'auth',
    methods: [],
    apiKey: { env: 'CLE', label: 'Clé d’API', stored: false, fromEnvironment: false },
    authenticating: false
  }

  function keyPanel(onUseApiKey: () => Promise<void>) {
    const noop = () => {}
    render(
      <BlockerPanel
        blocker={withKey}
        agentLabel="Un agent"
        workspace="/tmp/projet"
        onAuthenticate={noop}
        onRetry={noop}
        onUseApiKey={onUseApiKey}
        onRunStep={noop}
        onTrustForSession={noop}
        onOpenTerminal={noop}
        onChooseWorkspace={noop}
      />
    )
    fireEvent.click(screen.getByTestId('auth-api-key'))
    fireEvent.change(screen.getByTestId('api-key-input'), { target: { value: 'cle-123' } })
    fireEvent.click(screen.getByTestId('api-key-save'))
  }

  it('trousseau qui tarde : désactivé, « Enregistrement… », puis l’attente du trousseau dite', async () => {
    vi.useFakeTimers()
    try {
      keyPanel(() => new Promise<void>(() => {}))
      const input = screen.getByTestId('api-key-input') as HTMLInputElement
      const save = screen.getByTestId('api-key-save') as HTMLButtonElement
      expect(input.disabled && save.disabled).toBe(true)
      expect(save.textContent).toContain('Enregistrement…')
      expect(screen.queryByTestId('keychain-wait')).toBeNull()
      await act(async () => vi.advanceTimersByTime(1000))
      expect(screen.getByTestId('keychain-wait').textContent).toContain(
        'En attente du trousseau macOS…'
      )
    } finally {
      vi.useRealTimers()
    }
  })

  it('délai dépassé : le message, la valeur gardée, « Réessayer »', async () => {
    const onUseApiKey = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(
        new Error(
          "Error invoking remote method 'settings:setApiKey': Error: BOBINE_KEYCHAIN_TIMEOUT: Le trousseau macOS n’a pas répondu en 60 s : la clé n’est pas enregistrée."
        )
      )
      .mockResolvedValueOnce(undefined)
    keyPanel(onUseApiKey)
    await screen.findByTestId('api-key-error')
    expect(screen.getByTestId('api-key-error').textContent).toBe(
      'Le trousseau macOS n’a pas répondu en 60 s : la clé n’est pas enregistrée.'
    )
    expect((screen.getByTestId('api-key-input') as HTMLInputElement).value).toBe('cle-123')
    const save = screen.getByTestId('api-key-save') as HTMLButtonElement
    expect(save.disabled).toBe(false)
    expect(save.textContent).toContain('Réessayer')
    fireEvent.click(save)
    await vi.waitFor(() =>
      expect((screen.getByTestId('api-key-input') as HTMLInputElement).value).toBe('')
    )
    expect(onUseApiKey).toHaveBeenCalledTimes(2)
    expect(screen.queryByTestId('api-key-error')).toBeNull()
  })
})

describe('modèle refusé faute de connexion (fiche 210)', () => {
  const refused = (extra: Partial<Extract<AgentBlocker, { kind: 'auth' }>> = {}): AgentBlocker => ({
    kind: 'auth',
    methods: [
      {
        id: 'opencode-login',
        name: 'Login',
        step: { id: 'opencode-login', label: 'Se connecter', command: 'opencode auth login' }
      }
    ],
    authenticating: false,
    atTurn: true,
    model: { id: 'openai/gpt-5.2', name: 'OpenAI/GPT-5.2' },
    ...extra
  })
  const models = (): SessionControl => ({
    id: 'model',
    name: 'Modèle',
    category: 'model',
    type: 'select',
    currentValue: 'openai/gpt-5.2',
    options: [
      { value: 'opencode/big-pickle', name: 'OpenCode Zen/Big Pickle' },
      { value: 'openai/gpt-5.2', name: 'OpenAI/GPT-5.2', authRequired: true }
    ]
  })
  function modelPanel(blocker: AgentBlocker, control?: SessionControl) {
    const onSetControl = vi.fn()
    const onRunStep = vi.fn()
    const noop = () => {}
    render(
      <BlockerPanel
        blocker={blocker}
        agentLabel="OpenCode"
        workspace="/tmp/projet"
        onAuthenticate={noop}
        onRetry={noop}
        onUseApiKey={async () => {}}
        onRunStep={onRunStep}
        onTrustForSession={noop}
        onOpenTerminal={noop}
        onChooseWorkspace={noop}
        {...(control ? { modelControl: control } : {})}
        onSetControl={onSetControl}
      />
    )
    return { onSetControl, onRunStep }
  }
  const buttons = () =>
    [...screen.getByTestId('blocker-auth').querySelectorAll('button')].map((b) => ({
      text: b.textContent?.trim(),
      primary: b.classList.contains('primary')
    }))

  it('la carte nomme le modèle : « Choisir un autre modèle » (principal) et « Se connecter »', () => {
    modelPanel(refused(), models())
    expect(screen.getByText('Le modèle OpenAI/GPT-5.2 n’a pas répondu')).toBeTruthy()
    expect(screen.getByText('L’agent n’est pas connecté au fournisseur de ce modèle.')).toBeTruthy()
    expect(screen.queryByText('Connexion expirée')).toBeNull()
    expect(buttons()).toEqual([
      { text: 'Choisir un autre modèle', primary: true },
      { text: 'Se connecter', primary: false }
    ])
  })

  it('le sélecteur s’ouvre ; un autre modèle choisi est rendu, le modèle refusé marqué', () => {
    const { onSetControl } = modelPanel(refused(), models())
    fireEvent.click(screen.getByTestId('auth-choose-model'))
    const tagged = screen.getByTestId('control-model-openai/gpt-5.2')
    expect(tagged.classList.contains('model-auth-required')).toBe(true)
    expect(tagged.textContent).toContain('connexion à faire')
    expect(
      screen.getByTestId('control-model-opencode/big-pickle').querySelector('.model-auth-tag')
    ).toBeNull()
    // Le modèle en cours n'est jamais rendu ; l'autre l'est.
    fireEvent.click(tagged)
    expect(onSetControl).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('auth-choose-model'))
    fireEvent.click(screen.getByTestId('control-model-opencode/big-pickle'))
    expect(onSetControl).toHaveBeenCalledWith('model', 'opencode/big-pickle')
  })

  it('outils déjà lancés : le choix d’un modèle demande la même confirmation que « Réessayer »', () => {
    const { onSetControl } = modelPanel(refused({ toolsRan: true }), models())
    const pick = () => {
      fireEvent.click(screen.getByTestId('auth-choose-model'))
      fireEvent.click(screen.getByTestId('control-model-opencode/big-pickle'))
    }
    pick()
    expect(onSetControl).not.toHaveBeenCalled()
    expect(screen.getByTestId('model-confirm').textContent).toContain('les relancer')
    fireEvent.click(screen.getByTestId('model-cancel'))
    expect(onSetControl).not.toHaveBeenCalled()
    expect(screen.queryByTestId('model-confirm')).toBeNull()
    pick()
    fireEvent.click(screen.getByTestId('model-rerun'))
    expect(onSetControl).toHaveBeenCalledTimes(1)
    expect(onSetControl).toHaveBeenCalledWith('model', 'opencode/big-pickle')
  })

  it('connexion lancée dans le terminal : « Réessayer » apparaît et devient le principal', () => {
    const { onRunStep } = modelPanel(refused(), models())
    expect(screen.queryByTestId('retry')).toBeNull()
    fireEvent.click(screen.getByTestId('auth-opencode-login'))
    expect(onRunStep).toHaveBeenCalledWith('opencode-login')
    expect(buttons().filter((b) => b.primary)).toEqual([{ text: 'Réessayer', primary: true }])
  })

  it('un seul modèle : pas de « Choisir un autre modèle », la connexion en principal', () => {
    const only: SessionControl = { ...models(), options: models().options.slice(1) }
    modelPanel(refused(), only)
    expect(screen.queryByTestId('auth-choose-model')).toBeNull()
    expect(buttons()[0]).toEqual({ text: 'Se connecter', primary: true })
  })

  it('sans modèle connu (Bob) : la carte « Connexion expirée » d’avant', () => {
    modelPanel(refused({ model: undefined }), models())
    expect(screen.getByText('Connexion expirée')).toBeTruthy()
    expect(screen.queryByTestId('auth-choose-model')).toBeNull()
  })
})
