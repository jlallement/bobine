import * as Tooltip from '@radix-ui/react-tooltip'
import { act, fireEvent, render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { AgentSnapshot } from '@shared/agent'
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
