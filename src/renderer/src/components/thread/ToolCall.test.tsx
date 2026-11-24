import { fireEvent, render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { TranscriptItem } from '@shared/transcript'
import { ToolCall, WorkspaceContext } from './ToolCall'

/**
 * Carte d'outil : remplace les vérifications de composant de `e2e/suites/activity.mjs` (n° 12),
 * `inbox.mjs` (n° 25) et `autorisation-commande.mjs` (n° 29, 33, 43). Les largeurs sont simulées :
 * la coupe réelle par la police reste à la capture.
 */

type ToolItem = Extract<TranscriptItem, { kind: 'tool' }>
const WS = '/Users/ada/projet'

/** Largeurs simulées (jsdom ne met rien en page) : ligne étroite, nom qui la remplit presque. */
const widths = { line: 200, name: 180, text: 40 }

beforeAll(() => {
  // Un observateur qui mesure tout de suite (dans l'app : après la mise en page).
  globalThis.ResizeObserver = class {
    private readonly callback: ResizeObserverCallback
    constructor(callback: ResizeObserverCallback) {
      this.callback = callback
    }
    observe(target: Element) {
      this.callback([{ target } as ResizeObserverEntry], this as unknown as ResizeObserver)
    }
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
  Object.defineProperty(Element.prototype, 'clientWidth', {
    configurable: true,
    get(this: Element) {
      return this.classList.contains('tool-title') ? widths.line : 0
    }
  })
  Object.defineProperty(Element.prototype, 'scrollWidth', {
    configurable: true,
    get(this: Element) {
      if (this.classList.contains('tool-file-name')) return widths.name
      if (this.classList.contains('tool-file-text')) return widths.text
      return 0
    }
  })
})

const view = (item: ToolItem) =>
  render(
    <WorkspaceContext.Provider value={WS}>
      <ToolCall item={item} onRespond={vi.fn()} />
    </WorkspaceContext.Provider>
  )

const open = () => {
  const details = document.querySelector('details.tool') as HTMLDetailsElement | null
  if (!details) throw new Error('détails attendus')
  details.open = true
  fireEvent(details, new Event('toggle'))
}

describe('carte d’outil — remplaçants des e2e', () => {
  it('sortie JSON d’une commande : indentée, vrais retours à la ligne (activity n° 12)', () => {
    view({
      kind: 'tool',
      id: 1,
      toolCallId: 'j',
      title: 'curl api',
      toolKind: 'execute',
      status: 'completed',
      content: [
        {
          type: 'content',
          content: { type: 'text', text: '{"ok":true,"message":"ligne 1\\nligne 2"}' }
        }
      ],
      locations: []
    })
    open()
    const json = screen.getByTestId('tool-json')
    expect(json.textContent).toContain('{\n  "ok": true,')
    expect(json.textContent).toContain('ligne 1\nligne 2')
    expect(json.textContent).not.toContain('\\n')
  })

  it('aucun chemin absolu du dossier dans la carte (inbox n° 25)', () => {
    view({
      kind: 'tool',
      id: 2,
      toolCallId: 'r',
      title: `Read ${WS}/src/app.ts`,
      toolKind: 'read',
      status: 'completed',
      content: [],
      locations: [{ path: `${WS}/src/app.ts` }]
    })
    const row = screen.getByTestId('tool')
    expect(row.textContent).not.toContain(WS)
    expect(screen.getByTestId('tool-label-name').textContent).toBe('app.ts')
  })

  it('le nom tient seul : le dossier effacé, jamais un « / » seul (autorisation-commande n° 33)', () => {
    view({
      kind: 'tool',
      id: 3,
      toolCallId: 'w',
      title: 'write',
      toolKind: 'edit',
      status: 'completed',
      content: [],
      locations: [{ path: `${WS}/src/renderer/src/components/thread/tres-long-nom.md` }]
    })
    const label = screen.getByTestId('tool-label')
    expect(screen.getByTestId('tool-label-name').textContent).toBe('tres-long-nom.md')
    expect(label.querySelector('.tool-file-dir')).toBeNull()
    expect(label.textContent).not.toMatch(/\/\s*tres-long-nom/)
  })

  it('le nom tient avec la place du dossier : le dossier reste, à part (même règle, ligne large)', () => {
    widths.line = 600
    try {
      view({
        kind: 'tool',
        id: 4,
        toolCallId: 'w2',
        title: 'write',
        toolKind: 'edit',
        status: 'completed',
        content: [],
        locations: [{ path: `${WS}/src/notes.md` }]
      })
      expect(screen.getByTestId('tool-label').querySelector('.tool-file-dir')?.textContent).toBe(
        'src/'
      )
    } finally {
      widths.line = 200
    }
  })

  it('écriture dans un sous-dossier : dossier grisé à part, nom entier, compteurs visibles (autorisation-commande n° 29)', () => {
    view({
      kind: 'tool',
      id: 5,
      toolCallId: 'e',
      title: 'edit',
      toolKind: 'edit',
      status: 'pending',
      content: [
        { type: 'diff', path: `${WS}/src/notes.md`, oldText: 'a\nb\n', newText: 'a\nB\nc\n' }
      ],
      locations: [{ path: `${WS}/src/notes.md` }],
      permission: {
        requestId: 'p',
        state: 'pending',
        options: [{ optionId: 'ok', name: 'Allow once', kind: 'allow_once' }]
      }
    })
    const path = screen.getByTestId('diff-path')
    expect(path.querySelector('.diff-path-dir')?.textContent).toBe('src/')
    expect(path.querySelector('.diff-path-name')?.textContent).toBe('notes.md')
    const header = path.closest('.diff')
    expect(header?.querySelector('.diff-added')?.textContent).toMatch(/^\+\d/)
    expect(header?.querySelector('.diff-removed')?.textContent).toMatch(/^−\d/)
  })

  it('commande à risque : la commande montrée au-dessus du bandeau, puis les boutons (autorisation-commande n° 43)', () => {
    view({
      kind: 'tool',
      id: 6,
      toolCallId: 's',
      title: 'sudo rm -rf /var/tmp/x',
      toolKind: 'execute',
      status: 'pending',
      content: [],
      locations: [],
      command: { text: 'sudo rm -rf /var/tmp/x' },
      permission: {
        requestId: 'p',
        state: 'pending',
        options: [{ optionId: 'ok', name: 'Allow once', kind: 'allow_once' }],
        risks: [{ kind: 'privilege', via: 'sudo' }]
      }
    })
    const card = screen.getByTestId('permission')
    const order = [
      ...card.querySelectorAll(
        '[data-testid=command-block], [data-testid=permission-risks], .pc-actions'
      )
    ].map((e) => e.getAttribute('data-testid') ?? e.className)
    expect(order).toEqual(['command-block', 'permission-risks', 'pc-actions'])
  })
})
