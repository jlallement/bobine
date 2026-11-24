import * as Tooltip from '@radix-ui/react-tooltip'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { AgentSettingsView, AgentSnapshot } from '@shared/agent'
import i18next from 'i18next'
import { Composer } from './Composer'

// Le terminal (xterm.js) n'a rien à faire ici : seule sa constante d'évènement est utilisée.
vi.mock('../panel/TerminalTab', () => ({ INSERT_TEXT_EVENT: 'bob:insert-text' }))

const snapshot: AgentSnapshot = {
  status: 'ready',
  info: { profileId: 'mock', profileLabel: 'Agent factice', workspace: '/tmp/projet' },
  controls: [],
  commands: [
    { name: 'scenario', description: 'Joue un scénario', hint: '<nom>' },
    { name: 'demo', description: 'Scénario de démonstration' }
  ],
  promptCapabilities: { image: true, embeddedContext: true },
  queued: []
}

/** Modes de l'agent factice, mode courant au choix. */
const modes = (currentValue: string): AgentSnapshot['controls'] => [
  {
    id: 'mode',
    name: 'Mode',
    category: 'mode',
    type: 'select',
    currentValue,
    options: [
      { value: 'code', name: 'Code' },
      { value: 'ask', name: 'Question' },
      { value: 'plan', name: 'Plan' }
    ]
  }
]

function setup(
  change: Partial<AgentSnapshot> = {},
  extra: Partial<ComponentProps<typeof Composer>> = {}
) {
  const props = {
    onSend: vi.fn(),
    onAppCommand: vi.fn(),
    onSearchFiles: vi.fn(async () => []),
    onPickFiles: vi.fn(async () => []),
    onWarn: vi.fn(),
    onCancel: vi.fn(),
    onUnqueue: vi.fn(async () => undefined),
    onSendNow: vi.fn(),
    onRestart: vi.fn(),
    onConfigure: vi.fn(),
    onChooseWorkspace: vi.fn(),
    onSetControl: vi.fn(),
    onContinueInNew: vi.fn(),
    onAuthenticate: vi.fn(),
    onRetry: vi.fn(),
    onUseApiKey: vi.fn(async () => {}),
    onRunStep: vi.fn(),
    onTrustForSession: vi.fn(),
    onOpenTerminal: vi.fn()
  }
  render(
    <Tooltip.Provider>
      <Composer
        snapshot={{ ...snapshot, ...change }}
        settings={null}
        userCommands={[
          {
            name: 'revue',
            description: 'Revue',
            prompt: 'Fais une revue de $ARGUMENTS.',
            scope: 'project'
          },
          { name: 'demo', description: 'La mienne', prompt: 'ignorée', scope: 'global' }
        ]}
        {...props}
        {...extra}
      />
    </Tooltip.Provider>
  )
  const input = screen.getByTestId('composer-input') as HTMLTextAreaElement
  const type = (value: string) => fireEvent.change(input, { target: { value } })
  const enter = () => fireEvent.keyDown(input, { key: 'Enter' })
  return { ...props, input, type, enter }
}

describe('Composer', () => {
  it('agent arrêté : « Relancer », sans répéter « L’agent s’est arrêté » (fiche 272, recette)', () => {
    const { input, onRestart } = setup({ status: 'exited' })
    expect(document.body.textContent).not.toContain('L’agent s’est arrêté')
    expect(input.getAttribute('placeholder')).not.toContain('s’est arrêté')
    fireEvent.click(screen.getByTestId('restart'))
    expect(onRestart).toHaveBeenCalled()
  })

  it('Entrée envoie le message, Maj+Entrée non', () => {
    const t = setup()
    t.type('Bonjour')
    fireEvent.keyDown(t.input, { key: 'Enter', shiftKey: true })
    expect(t.onSend).not.toHaveBeenCalled()
    t.enter()
    expect(t.onSend).toHaveBeenCalledWith('Bonjour', [])
    expect(t.input.value).toBe('')
  })

  it('menu « / » : commandes de l’agent et de l’app filtrées ; Entrée complète une commande à argument', () => {
    const t = setup()
    t.type('/')
    const names = () =>
      screen
        .getAllByTestId('command-item')
        .map((el) => el.querySelector('.command-name')?.textContent)
    expect(names()).toContain('/scenario <nom>')
    expect(names()).toContain('/help')
    // « sc » retiendrait aussi /demo par sa description (« Scénario… ») ; « scen » non (accent).
    t.type('/scen')
    expect(names()).toEqual(['/scenario <nom>'])
    t.enter()
    expect(t.input.value).toBe('/scenario ')
    expect(t.onSend).not.toHaveBeenCalled()
  })

  it('commande de l’agent sans argument : envoyée telle quelle ; commande de l’app : traitée par l’app', () => {
    const t = setup()
    t.type('/demo')
    t.enter()
    expect(t.onSend).toHaveBeenCalledWith('/demo')
    t.type('/help')
    t.enter()
    expect(t.onAppCommand).toHaveBeenCalledWith('help', '')
    expect(t.input.value).toBe('')
  })

  it('commande personnelle : consigne développée envoyée, sauf si l’agent a le même nom', () => {
    const { onSend, type, enter } = setup()
    type('/revue src/a.ts')
    enter()
    expect(onSend).toHaveBeenCalledWith('Fais une revue de src/a.ts.', [])
    type('/demo tout')
    enter()
    expect(onSend).toHaveBeenLastCalledWith('/demo tout', [])
  })

  it('Échap ferme le menu, sans envoyer', () => {
    const t = setup()
    t.type('/de')
    expect(screen.queryByTestId('command-menu')).not.toBeNull()
    fireEvent.keyDown(t.input, { key: 'Escape' })
    expect(screen.queryByTestId('command-menu')).toBeNull()
    expect(t.onSend).not.toHaveBeenCalled()
  })

  it('mode Plan (fiche 098) : zone teintée, invite et ligne de rappel, Maj+Tab vers le mode suivant', () => {
    const t = setup({ controls: modes('plan') })
    expect(t.input.closest('form')?.dataset['plan']).toBe('true')
    expect(t.input.placeholder).toBe('Explorer et planifier avec Agent factice…')
    const hint = screen.getByTestId('plan-hint')
    expect(hint.textContent).toBe(
      'Mode Plan\u00a0: l’agent lit et propose, il ne modifie rien. Maj+Tab pour passer en Code.'
    )
    expect(t.input.getAttribute('aria-describedby')).toBe(hint.id)
    fireEvent.keyDown(t.input, { key: 'Tab', shiftKey: true })
    expect(t.onSetControl).toHaveBeenCalledWith('mode', 'code')
  })

  it('hors mode Plan : ni teinte, ni ligne de rappel, invite habituelle', () => {
    const t = setup({ controls: modes('code') })
    expect(t.input.closest('form')?.dataset['plan']).toBeUndefined()
    expect(screen.queryByTestId('plan-hint')).toBeNull()
    expect(t.input.placeholder).toBe('Répondre à Agent factice…')
    expect(t.input.hasAttribute('aria-describedby')).toBe(false)
  })

  it('mode Plan pendant une réponse : l’invite de la réponse en cours reste prioritaire', () => {
    const t = setup({ status: 'busy', controls: modes('plan') })
    expect(t.input.placeholder).toBe('Ajouter une suite (envoyée à la fin de la réponse)…')
    expect(screen.getByTestId('plan-hint')).not.toBeNull()
  })

  it('capture impossible (fiche 124) : dit sous la zone de saisie, réglage de macOS à ouvrir', async () => {
    const onCaptureScreen = vi
      .fn()
      .mockResolvedValueOnce({ kind: 'unavailable', reason: 'denied' })
      .mockResolvedValueOnce(null)
    const onOpenCaptureSettings = vi.fn(async () => {})
    setup({}, { onCaptureScreen, onOpenCaptureSettings })
    await act(async () => fireEvent.click(screen.getByTestId('capture')))
    const problem = screen.getByTestId('capture-problem')
    expect(problem.textContent).toContain('Capture d’écran indisponible')
    expect(problem.textContent).toContain('Enregistrement de l’écran')
    fireEvent.click(screen.getByTestId('capture-settings'))
    expect(onOpenCaptureSettings).toHaveBeenCalledOnce()
    // Nouvel essai annulé (Échap) : le message s'en va, rien d'autre n'est dit.
    await act(async () => fireEvent.click(screen.getByTestId('capture')))
    expect(screen.queryByTestId('capture-problem')).toBeNull()
  })
})

/**
 * Saisie dont l'état de l'agent change au fil de l'essai (`rerender`) : nouveau fil dont la vue
 * arrive après le démarrage (fiche 272).
 */
function pendingSetup(first: AgentSnapshot | null, draftKey: string | null = 'nouveau-fil') {
  const onSend = vi.fn()
  const props = {
    settings: null,
    onSend,
    onAppCommand: vi.fn(),
    onSearchFiles: vi.fn(async () => []),
    onPickFiles: vi.fn(async () => []),
    onWarn: vi.fn(),
    onCancel: vi.fn(),
    onUnqueue: vi.fn(async () => undefined),
    onSendNow: vi.fn(),
    onRestart: vi.fn(),
    onConfigure: vi.fn(),
    onChooseWorkspace: vi.fn(),
    onSetControl: vi.fn(),
    onContinueInNew: vi.fn(),
    onAuthenticate: vi.fn(),
    onRetry: vi.fn(),
    onUseApiKey: vi.fn(async () => {}),
    onRunStep: vi.fn(),
    onTrustForSession: vi.fn(),
    onOpenTerminal: vi.fn()
  }
  const ui = (snap: AgentSnapshot | null, key: string | null = draftKey) => (
    <Tooltip.Provider>
      <Composer key="saisie" {...props} snapshot={snap} {...(key ? { draftKey: key } : {})} />
    </Tooltip.Provider>
  )
  const view = render(ui(first))
  const input = () => screen.getByTestId('composer-input') as HTMLTextAreaElement
  return {
    onSend,
    input,
    type: (value: string) => fireEvent.change(input(), { target: { value } }),
    enter: () => fireEvent.keyDown(input(), { key: 'Enter' }),
    become: (snap: AgentSnapshot | null, key: string | null = draftKey) =>
      view.rerender(ui(snap, key))
  }
}

const withStatus = (status: AgentSnapshot['status']): AgentSnapshot => ({ ...snapshot, status })

describe('Composer : envoi pendant le démarrage d’un nouveau fil (fiche 272)', () => {
  it('Entrée pendant le démarrage : le texte reste, puis part une seule fois quand l’agent est prêt', () => {
    const t = pendingSetup(null)
    t.type('Premier message')
    t.enter()
    expect(t.onSend).not.toHaveBeenCalled()
    expect(t.input().value).toBe('Premier message')
    // Retenu : le bouton Envoyer reste grisé jusqu'au départ.
    expect(screen.getByTestId('send')).toHaveProperty('disabled', true)
    t.become(withStatus('starting'))
    expect(t.onSend).not.toHaveBeenCalled()
    t.become(withStatus('ready'))
    expect(t.onSend).toHaveBeenCalledTimes(1)
    expect(t.onSend).toHaveBeenCalledWith('Premier message', [])
    expect(t.input().value).toBe('')
  })

  it('double Entrée, ou Entrée puis clic sur Envoyer : un seul envoi', () => {
    const t = pendingSetup(withStatus('starting'))
    t.type('Une fois')
    expect(screen.getByTestId('send')).toHaveProperty('disabled', false)
    t.enter()
    t.enter()
    fireEvent.click(screen.getByTestId('send'))
    t.become(withStatus('ready'))
    t.become(withStatus('busy'))
    expect(t.onSend).toHaveBeenCalledTimes(1)
  })

  it('texte modifié pendant l’attente : plus rien ne part tout seul, le texte reste', () => {
    const t = pendingSetup(null)
    t.type('Premier')
    t.enter()
    t.type('Premier message, corrigé')
    t.become(withStatus('ready'))
    expect(t.onSend).not.toHaveBeenCalled()
    expect(t.input().value).toBe('Premier message, corrigé')
  })

  it('démarrage fini en connexion demandée (needs-action) : rien ne part, le texte reste', () => {
    const t = pendingSetup(withStatus('starting'))
    t.type('Premier message')
    t.enter()
    t.become(withStatus('needs-action'))
    // Connexion faite ensuite : l'attente était tombée, rien ne part tout seul.
    t.become(withStatus('ready'))
    expect(t.onSend).not.toHaveBeenCalled()
    expect(t.input().value).toBe('Premier message')
  })

  it('autre conversation avant que l’agent soit prêt : rien ne part', () => {
    const t = pendingSetup(null, 'fil-a')
    t.type('Pour le fil A')
    t.enter()
    t.become(withStatus('ready'), 'fil-b')
    expect(t.onSend).not.toHaveBeenCalled()
  })

  it('sans conversation (aucune chargée) : Entrée ne retient rien', () => {
    const t = pendingSetup(null, null)
    t.type('Bonjour')
    t.enter()
    t.become(withStatus('starting'))
    expect(t.onSend).not.toHaveBeenCalled()
    expect(t.input().value).toBe('Bonjour')
  })
})

describe('Composer : texte collé, fichiers exclus, brouillon (fiche 155)', () => {
  const paste = (input: HTMLTextAreaElement, text: string) =>
    fireEvent.paste(input, { clipboardData: { files: [], getData: () => text } })

  it('long texte collé : une puce, qui part en pièce jointe ; un texte court reste dans la saisie', () => {
    const t = setup()
    const long = Array.from({ length: 41 }, (_, i) => `ligne ${i}`).join('\n')
    paste(t.input, long)
    expect(screen.getByTestId('attachment-pasted').textContent).toContain('41 lignes')
    paste(t.input, 'court')
    expect(screen.getAllByTestId('attachment')).toHaveLength(1)
    t.type('voir')
    t.enter()
    expect(t.onSend).toHaveBeenCalledWith('voir', [
      { kind: 'text', name: 'Texte collé', text: long }
    ])
  })

  it('aperçu du texte collé, puis remis dans la saisie', () => {
    const t = setup()
    const long = 'x'.repeat(5000)
    paste(t.input, long)
    fireEvent.click(screen.getByTestId('attachment-pasted'))
    expect(screen.getByTestId('pasted-text').textContent).toBe(long)
    fireEvent.click(screen.getByTestId('pasted-put-back'))
    expect(t.input.value).toBe(long)
    expect(screen.queryByTestId('attachment-pasted')).toBeNull()
  })

  it('fichier exclu par l’agent : confirmation avant de le joindre', async () => {
    const t = setup(
      {},
      {
        onPickFiles: vi.fn(async () => ['/tmp/projet/a.ts', '/tmp/projet/.env']),
        onCheckExcluded: vi.fn(async (paths: string[]) => ({
          paths: paths.filter((p) => p.endsWith('.env')),
          files: ['.bobignore', '.env']
        }))
      }
    )
    await act(async () => fireEvent.click(screen.getByTestId('attach')))
    expect(screen.getAllByTestId('attachment')).toHaveLength(1)
    expect(screen.getByTestId('excluded-confirm').textContent).toContain('.bobignore, .env')
    fireEvent.click(screen.getByTestId('excluded-skip'))
    expect(screen.queryByTestId('excluded-confirm')).toBeNull()
    expect(screen.getAllByTestId('attachment')).toHaveLength(1)
    await act(async () => fireEvent.click(screen.getByTestId('attach')))
    fireEvent.click(screen.getByTestId('excluded-attach'))
    expect(screen.getAllByTestId('attachment')).toHaveLength(2)
    t.enter()
    expect(t.onSend).toHaveBeenCalledWith('', [
      { kind: 'file', path: '/tmp/projet/a.ts' },
      { kind: 'file', path: '/tmp/projet/.env' }
    ])
  })

  it('vérification impossible (IPC refusée) : tout est retenu, et c’est dit', async () => {
    setup(
      {},
      {
        onPickFiles: vi.fn(async () => ['/tmp/projet/a.ts']),
        onCheckExcluded: vi.fn(async () => {
          throw new Error('Chemins invalides')
        })
      }
    )
    await act(async () => fireEvent.click(screen.getByTestId('attach')))
    expect(screen.queryAllByTestId('attachment')).toHaveLength(0)
    expect(screen.getByTestId('excluded-confirm').textContent).toContain('Impossible de vérifier')
  })

  it('image déposée avec un chemin : vérifiée aussi, jointe par son chemin si on confirme', async () => {
    const pathFor = vi.spyOn(window.api.files, 'pathFor').mockReturnValue('/tmp/projet/.env.png')
    const t = setup(
      {},
      {
        onCheckExcluded: vi.fn(async (paths: string[]) => ({ paths, files: ['.bobignore'] }))
      }
    )
    const image = new File([new Uint8Array([1])], 'capture.png', { type: 'image/png' })
    await act(async () => {
      fireEvent.paste(t.input, { clipboardData: { files: [image], getData: () => '' } })
    })
    expect(screen.queryAllByTestId('attachment')).toHaveLength(0)
    fireEvent.click(screen.getByTestId('excluded-attach'))
    t.enter()
    expect(t.onSend).toHaveBeenCalledWith('', [{ kind: 'file', path: '/tmp/projet/.env.png' }])
    pathFor.mockRestore()
  })
})

/**
 * Remplaçants des vérifications de composant des e2e `queue`, `startup`, `composer`, `commands`,
 * `git` et `quick` (inventaire `docs/tests/inventaire-e2e-*.md`). Ce qui tient à la mise en page
 * réelle (clic à travers une infobulle, repli mesuré) reste e2e ou en capture.
 */
describe('Composer — remplaçants des e2e', () => {
  beforeAll(() => {
    globalThis.ResizeObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  })

  const settings = {
    profileId: 'mock',
    profiles: [{ id: 'mock', label: 'Agent factice', available: true, capabilities: {} }],
    workspace: '/tmp/projet',
    recentWorkspaces: ['/tmp/projet'],
    inGitRepo: true
  } as unknown as AgentSettingsView

  it('conversation neuve : l’invite demande quoi faire (queue n° 1)', () => {
    const t = setup({}, { fresh: true })
    expect(t.input.placeholder).toBe(i18next.t('composer.placeholder.new'))
  })

  it('« Modifier » d’un message en attente : retiré pour modification, remis dans la saisie (queue n° 4)', async () => {
    const onUnqueue = vi.fn(async () => ({ text: 'Suite à faire', attachments: [] }))
    const t = setup(
      { status: 'busy', queued: [{ id: 'q1', text: 'Suite à faire', attachments: [] }] },
      { onUnqueue }
    )
    await act(async () => fireEvent.click(screen.getByTestId('queued-edit')))
    expect(onUnqueue).toHaveBeenCalledWith('q1', true)
    expect(t.input.value).toBe('Suite à faire')
    expect(document.activeElement).toBe(t.input)
  })

  it('pas encore de dossier : saisie inactive, « Choisissez d’abord un dossier » (startup n° 2)', () => {
    const t = setup({ status: 'needs-action', blocker: { kind: 'workspace' } })
    expect(t.input.placeholder).toBe('Choisissez d’abord un dossier')
    expect(t.input.disabled).toBe(true)
  })

  it('dossier et branche sur la ligne sous la saisie, pas dans la barre (composer n° 1, git n° 1)', () => {
    setup(
      {},
      {
        settings,
        fresh: true,
        gitBranch: { name: 'main', dirty: 2, ahead: 0, behind: 0, onOpen: vi.fn() }
      }
    )
    const context = screen.getByTestId('composer-context')
    const bar = screen.getByTestId('composer-bar')
    expect(context.contains(screen.getByTestId('workspace-menu'))).toBe(true)
    expect(bar.contains(screen.getByTestId('workspace-menu'))).toBe(false)
    const branch = screen.getByTestId('git-branch')
    expect(context.contains(branch)).toBe(true)
    expect(branch.textContent).toBe('main')
    expect(branch.getAttribute('data-dirty')).toBe('true')
  })

  it('mode choisi dans le menu : focus rendu à la saisie, sans infobulle ouverte (composer n° 2, 3)', async () => {
    const t = setup({ controls: modes('code') })
    screen.getByTestId('mode-chip').focus()
    fireEvent.keyDown(screen.getByTestId('mode-chip'), { key: 'Enter' })
    await act(async () => fireEvent.click(screen.getByTestId('control-mode-ask')))
    // Laisse passer le tour où Radix rendrait le focus à la puce : il doit rester à la saisie.
    await act(async () => new Promise((resolve) => setTimeout(resolve, 10)))
    expect(t.onSetControl).toHaveBeenCalledWith('mode', 'ask')
    expect(screen.queryByTestId('mode-menu-content')).toBeNull()
    expect(document.activeElement).toBe(t.input)
    expect(document.querySelector('.tooltip')).toBeNull()
  })

  it('Échap ferme le menu du mode et rend le focus à la puce (composer n° 10)', async () => {
    setup({ controls: modes('code') })
    const chip = screen.getByTestId('mode-chip')
    chip.focus()
    fireEvent.keyDown(chip, { key: 'Enter' })
    expect(screen.getByTestId('mode-menu-content')).toBeTruthy()
    await act(async () =>
      fireEvent.keyDown(screen.getByTestId('mode-menu-content'), { key: 'Escape' })
    )
    expect(screen.queryByTestId('mode-menu-content')).toBeNull()
    // Radix rend le focus au tour suivant (FocusScope, `setTimeout`).
    await waitFor(() => expect(document.activeElement).toBe(chip))
  })

  it('le mode Plan a son icône, distincte des autres modes (composer n° 23)', () => {
    setup({ controls: modes('code') })
    const icon = () => screen.getByTestId('mode-chip').querySelector('svg')?.getAttribute('class')
    const code = icon()
    expect(screen.getByTestId('mode-chip').getAttribute('data-plan')).toBeNull()
    cleanup()
    setup({ controls: modes('plan') })
    expect(screen.getByTestId('mode-chip').getAttribute('data-plan')).toBe('true')
    expect(icon()).not.toBe(code)
  })

  it('accueil : un clic sur Envoyer envoie le message (composer n° 34)', () => {
    const t = setup({}, { fresh: true })
    t.type('Lance les tests')
    fireEvent.click(screen.getByTestId('send'))
    expect(t.onSend).toHaveBeenCalledWith('Lance les tests', [])
  })

  it('commande de l’app : badge au nom de l’agent de la conversation, pas « Bobine » (commands n° 2)', () => {
    const t = setup()
    t.type('/help')
    const item = screen.getAllByTestId('command-item')[0]
    expect(item?.querySelector('.command-source.from-app')?.textContent).toBe('Agent factice')
    expect(item?.textContent).not.toContain('Bobine')
  })

  it('« / » : `/btw` (aparté) proposée parmi les commandes de l’app (aparte n° 2)', () => {
    const t = setup()
    t.type('/bt')
    const names = screen
      .getAllByTestId('command-item')
      .map((el) => el.querySelector('.command-name')?.textContent)
    expect(names).toEqual(['/btw [question]'])
  })

  it('« / » : commandes de l’agent et de l’app, chacune avec son origine (commands n° 1)', () => {
    const t = setup()
    t.type('/')
    const items = screen.getAllByTestId('command-item')
    const source = (name: string) =>
      items
        .find((el) => el.querySelector('.command-name')?.textContent?.startsWith(name))
        ?.querySelector('.command-source')
    expect(source('/scenario')?.classList.contains('from-app')).toBe(false)
    expect(source('/help')?.classList.contains('from-app')).toBe(true)
    expect(source('/revue')?.textContent).toBe('Projet')
  })

  it('commande avec son argument : envoyée telle quelle, saisie vidée (commands n° 6)', () => {
    const t = setup()
    t.type('/scenario refus')
    fireEvent.keyDown(t.input, { key: 'Escape' })
    t.enter()
    expect(t.onSend).toHaveBeenCalledWith('/scenario refus', [])
    expect(t.input.value).toBe('')
  })

  it('« / » sans correspondance : le menu le dit (commands n° 8)', () => {
    const t = setup()
    t.type('/zzzz')
    expect(screen.getByTestId('command-menu').textContent).toContain(
      'Aucune commande ne correspond.'
    )
    expect(screen.queryAllByTestId('command-item')).toHaveLength(0)
  })

  it('brouillon par conversation : vide ailleurs, retrouvé en revenant, texte collé compris (history n° 8, 9, 10)', () => {
    const paste = (input: HTMLTextAreaElement, text: string) =>
      fireEvent.paste(input, { clipboardData: { files: [], getData: () => text } })
    const key = `c-brouillon-${Math.random()}`
    const long = Array.from({ length: 41 }, (_, i) => `ligne ${i}`).join('\n')
    const first = setup({}, { draftKey: key })
    paste(first.input, long)
    first.type('à finir')
    cleanup()
    // Autre conversation : la zone de saisie est vide.
    const other = setup({}, { draftKey: `${key}-autre` })
    expect(other.input.value).toBe('')
    expect(screen.queryByTestId('attachment')).toBeNull()
    cleanup()
    // De retour : le texte et la pièce jointe (texte collé) reviennent.
    const back = setup({}, { draftKey: key })
    expect(back.input.value).toBe('à finir')
    expect(screen.getByTestId('attachment-pasted').textContent).toContain('41 lignes')
  })

  it('capture d’écran : l’image est jointe dans la zone de saisie (quick n° 12)', async () => {
    const image = {
      kind: 'image' as const,
      name: 'capture.png',
      mimeType: 'image/png',
      data: 'AA=='
    }
    setup({}, { onCaptureScreen: vi.fn(async () => image) })
    await act(async () => fireEvent.click(screen.getByTestId('capture')))
    const [chip, ...others] = screen.getAllByTestId('attachment')
    expect(others).toHaveLength(0)
    expect(chip?.querySelector('img')?.getAttribute('src')).toContain('AA==')
    expect(chip?.innerHTML).toContain('capture.png')
  })

  it('sans capture d’écran (plateforme) : pas de bouton de capture dans la saisie (quick n° 14)', () => {
    setup()
    expect(screen.queryByTestId('capture')).toBeNull()
    expect(screen.getByTestId('attach')).toBeTruthy()
  })
})
