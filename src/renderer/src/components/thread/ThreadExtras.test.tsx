import * as Tooltip from '@radix-ui/react-tooltip'
import type { ReactNode } from 'react'
import { act, fireEvent, render as testingRender, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TranscriptItem } from '@shared/transcript'
import { Transcript } from './Transcript'
import { ResumeCard } from './ResumeCard'
import { EditorContext, OpenInEditorButton } from './OpenInEditor'
import { FileLinksContext } from './FileLink'
import { editorOutcomeNote } from '../../useEditor'

function render(ui: ReactNode) {
  return testingRender(ui, { wrapper: Tooltip.Provider })
}

const noop = () => {}
const PNG = 'iVBORw0KGgo='
const T0 = Date.UTC(2026, 9, 20, 9, 0)

describe('fil (fiche 156)', () => {
  it('durée du tour sous sa dernière réponse, copie du message envoyé', () => {
    render(
      <Transcript
        items={[
          { kind: 'user', id: 1, text: 'Fais-le', at: T0 },
          { kind: 'agent', id: 2, text: 'Je regarde', at: T0 + 134_000 },
          { kind: 'agent', id: 3, text: 'Fait', at: T0 + 134_000 }
        ]}
        onRespondPermission={noop}
        onRespondElicitation={noop}
      />
    )
    const durations = screen.getAllByTestId('turn-duration')
    expect(durations.map((d) => d.textContent)).toEqual(['2 min 14 s'])
    expect(durations[0]?.title).toMatch(/^Durée du tour\s*:\s2\smin\s14\ss$/)
    expect(screen.getByTestId('copy-message').getAttribute('aria-label')).toBe('Copier le message')
  })

  it('message fait seulement d’un texte collé (fiche 155) : il se copie aussi', () => {
    render(
      <Transcript
        items={[
          {
            kind: 'user',
            id: 1,
            text: '',
            at: T0,
            attachments: [{ kind: 'text', name: 'Texte collé', text: 'ligne 1\nligne 2' }]
          }
        ]}
        onRespondPermission={noop}
        onRespondElicitation={noop}
      />
    )
    expect(screen.getByTestId('copy-message')).toBeTruthy()
  })

  it('image d’un message : en grand au clic, Échap ferme', async () => {
    render(
      <Transcript
        items={[
          {
            kind: 'user',
            id: 1,
            text: '',
            attachments: [{ kind: 'image', name: 'écran.png', mimeType: 'image/png', data: PNG }]
          }
        ]}
        onRespondPermission={noop}
        onRespondElicitation={noop}
      />
    )
    fireEvent.click(screen.getByTestId('image-zoom-open'))
    expect(screen.getByTestId('image-zoom-image').getAttribute('src')).toBe(
      `data:image/png;base64,${PNG}`
    )
    fireEvent.keyDown(screen.getByTestId('image-zoom-dialog'), { key: 'Escape' })
    expect(screen.queryByTestId('image-zoom-dialog')).toBeNull()
  })

  it('glisser une image : le main la reçoit, le glisser HTML est annulé', () => {
    const startDrag = vi.fn(async () => undefined)
    window.api.images = { startDrag }
    render(
      <Transcript
        items={[
          {
            kind: 'user',
            id: 1,
            text: '',
            attachments: [{ kind: 'image', name: 'a.png', mimeType: 'image/png', data: PNG }]
          }
        ]}
        onRespondPermission={noop}
        onRespondElicitation={noop}
      />
    )
    const img = screen.getByTestId('image-zoom-open').querySelector('img')
    const event = img && fireEvent.dragStart(img)
    expect(event).toBe(false)
    expect(startDrag).toHaveBeenCalledWith({ name: 'a.png', mimeType: 'image/png', data: PNG })
  })
})

describe('Ouvrir dans l’éditeur (fiche 156)', () => {
  it('rien sans éditeur ; sinon le nom, et le chemin à la ligne', () => {
    const { container } = render(<OpenInEditorButton path="src/a.ts" line={3} />)
    expect(container.textContent).toBe('')
    const open = vi.fn()
    render(
      <EditorContext.Provider value={{ name: 'Zed', open }}>
        <OpenInEditorButton path="src/a.ts" line={3} base="/p/docs" />
      </EditorContext.Provider>
    )
    const button = screen.getByTestId('open-in-editor')
    expect(button.getAttribute('aria-label')).toBe('Ouvrir dans Zed')
    expect(button.title).toBe('Ouvrir dans Zed, ligne 3')
    fireEvent.click(button)
    expect(open).toHaveBeenCalledWith('src/a.ts', { line: 3, base: '/p/docs' })
  })

  it('emplacements d’une carte d’outil et en-tête d’un diff', () => {
    const open = vi.fn()
    render(
      <EditorContext.Provider value={{ name: 'Zed', open }}>
        <Transcript
          items={[
            {
              kind: 'tool',
              id: 1,
              toolCallId: 't1',
              title: 'Edit',
              toolKind: 'edit',
              status: 'completed',
              content: [{ type: 'diff', path: '/p/a.ts', oldText: 'a\nb\n', newText: 'a\nB\n' }],
              locations: []
            },
            {
              kind: 'tool',
              id: 2,
              toolCallId: 't2',
              title: 'Read',
              toolKind: 'read',
              status: 'completed',
              content: [],
              locations: [{ path: '/p/b.ts', line: 8 }]
            }
          ]}
          onRespondPermission={noop}
          onRespondElicitation={noop}
        />
      </EditorContext.Provider>
    )
    // Détail d'un outil rendu à son premier dépliage (fiche 192).
    for (const details of document.querySelectorAll('details')) {
      details.open = true
      fireEvent(details, new Event('toggle'))
    }
    for (const button of screen.getAllByTestId('open-in-editor')) fireEvent.click(button)
    expect(open.mock.calls).toEqual([
      ['/p/a.ts', { line: 2 }],
      ['/p/b.ts', { line: 8 }]
    ])
  })

  it('avis d’une ouverture refusée', () => {
    expect(editorOutcomeNote({ kind: 'opened', path: '/p/a' })).toBeUndefined()
    expect(editorOutcomeNote({ kind: 'outside', path: '/x' })).toMatch(/Hors du dossier/)
    expect(editorOutcomeNote({ kind: 'missing', path: '/x' })).toMatch(/introuvable/)
  })
})

describe('« Où en était-on ? » (fiche 156)', () => {
  afterEach(() => vi.useRealTimers())
  const items: TranscriptItem[] = [
    { kind: 'user', id: 1, text: 'Ajoute la connexion', at: T0 },
    {
      kind: 'plan',
      id: 2,
      entries: [
        { content: 'Formulaire', status: 'completed', priority: 'high' },
        { content: 'Serveur', status: 'in_progress', priority: 'high' }
      ]
    },
    { kind: 'agent', id: 3, text: 'En cours', at: T0 + 1000 }
  ]

  it('inactive depuis plus d’un jour : demande, tâches, fichiers non commités ; fermée, elle ne revient pas', async () => {
    vi.useFakeTimers({ now: T0 + 3 * 86_400_000, toFake: ['Date'] })
    const git = vi.fn(async () => ({
      root: '/p',
      files: [{ path: 'src/login.ts', status: 'modified', added: 3, removed: 1 }]
    }))
    window.api.changes = { git } as unknown as Window['api']['changes']
    const first = render(<ResumeCard conversationId="c1" items={items} />)
    await act(async () => {})
    expect(screen.getByTestId('resume-request').textContent).toContain('Ajoute la connexion')
    expect(screen.getByTestId('resume-done').textContent).toContain('Formulaire')
    expect(screen.getByTestId('resume-todo').textContent).toContain('Serveur')
    expect(screen.getByTestId('resume-files').textContent).toContain('src/login.ts')
    expect(git).toHaveBeenCalledWith('c1')
    fireEvent.click(screen.getByTestId('resume-close'))
    expect(screen.queryByTestId('resume-card')).toBeNull()
    first.unmount()
    render(<ResumeCard conversationId="c1" items={items} />)
    expect(screen.queryByTestId('resume-card')).toBeNull()
  })

  it('activité récente, ou nouveau message : pas de carte', async () => {
    vi.useFakeTimers({ now: T0 + 3600_000, toFake: ['Date'] })
    window.api.changes = { git: async () => null } as unknown as Window['api']['changes']
    render(<ResumeCard conversationId="c2" items={items} />)
    expect(screen.queryByTestId('resume-card')).toBeNull()
  })
})

/**
 * Remplaçants des vérifications de composant de `e2e/suites/fil.mjs` (n° 2, 7, 13, 16). La ligne
 * de commande de l'éditeur reste au main (`editors.test.ts`).
 */
describe('fil — remplaçants des e2e', () => {
  afterEach(() => vi.useRealTimers())

  it('copier un message envoyé : son texte dans le presse-papiers, puis « Copié » (fil n° 2)', async () => {
    const writeText = vi.fn(async () => {})
    const clipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    try {
      render(
        <Transcript
          items={[{ kind: 'user', id: 1, text: 'Ajoute un test', at: T0 }]}
          onRespondPermission={noop}
          onRespondElicitation={noop}
        />
      )
      const copy = screen.getByTestId('copy-message')
      await act(async () => fireEvent.click(copy))
      expect(writeText).toHaveBeenCalledWith('Ajoute un test')
      expect(copy.getAttribute('aria-label')).toBe('Copié')
    } finally {
      if (clipboard) Object.defineProperty(navigator, 'clipboard', clipboard)
      else delete (navigator as unknown as Record<string, unknown>).clipboard
    }
  })

  // Remplace `e2e/suites/touches.mjs` n° 2 : la réponse copiée est sa source Markdown.
  it('copier la réponse : le Markdown complet, pas le texte rendu', async () => {
    const writeText = vi.fn(async () => {})
    const clipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    try {
      const reply = '## Bilan\n\n- **trois** fichiers\n- `pnpm test` vert'
      render(
        <Transcript
          items={[
            { kind: 'user', id: 1, text: 'Fais-le', at: T0 },
            { kind: 'agent', id: 2, text: reply, at: T0 + 5000 }
          ]}
          onRespondPermission={noop}
          onRespondElicitation={noop}
          messageActions={{ busy: false, onEdit: noop, onOpenConversation: noop }}
        />
      )
      await act(async () => fireEvent.click(screen.getByTestId('copy-reply')))
      expect(writeText).toHaveBeenCalledWith(reply)
    } finally {
      if (clipboard) Object.defineProperty(navigator, 'clipboard', clipboard)
      else delete (navigator as unknown as Record<string, unknown>).clipboard
    }
  })

  it('lien `fichier:ligne` d’une réponse : « Ouvrir dans VS Code » juste après, à la ligne (fil n° 7)', () => {
    const open = vi.fn()
    render(
      <FileLinksContext.Provider value={vi.fn()}>
        <EditorContext.Provider value={{ name: 'VS Code', open }}>
          <Transcript
            items={[
              {
                kind: 'agent',
                id: 1,
                text: 'Le point d’entrée est [src/app.ts:3](src/app.ts:3).'
              }
            ]}
            onRespondPermission={noop}
            onRespondElicitation={noop}
          />
        </EditorContext.Provider>
      </FileLinksContext.Provider>
    )
    const link = screen.getByTestId('file-link')
    expect(link.textContent).toBe('src/app.ts:3')
    const button = link.parentElement?.querySelector('[data-testid=open-in-editor]')
    expect(button?.getAttribute('aria-label')).toBe('Ouvrir dans VS Code')
    if (button) fireEvent.click(button)
    expect(open).toHaveBeenCalledWith('src/app.ts', { line: 3 })
  })

  it('conversation sans aucun élément : pas de carte de reprise (fil n° 13)', async () => {
    vi.useFakeTimers({ now: T0 + 3 * 86_400_000, toFake: ['Date'] })
    window.api.changes = { git: async () => null } as unknown as Window['api']['changes']
    render(<ResumeCard conversationId="vide" items={[]} />)
    await act(async () => {})
    expect(screen.queryByTestId('resume-card')).toBeNull()
  })

  it('carte de reprise repliable : ouverte, puis repliée par son titre (fil n° 16)', async () => {
    vi.useFakeTimers({ now: T0 + 3 * 86_400_000, toFake: ['Date'] })
    window.api.changes = { git: async () => null } as unknown as Window['api']['changes']
    render(
      <ResumeCard
        conversationId="pliable"
        items={[
          { kind: 'user', id: 1, text: 'Ajoute la connexion', at: T0 },
          { kind: 'agent', id: 2, text: 'En cours', at: T0 + 1000 }
        ]}
      />
    )
    await act(async () => {})
    const card = screen.getByTestId('resume-card') as HTMLDetailsElement
    expect(card.tagName).toBe('DETAILS')
    expect(card.open).toBe(true)
    expect(card.querySelector(':scope > summary')).toBeTruthy()
    card.open = false
    fireEvent(card, new Event('toggle'))
    expect(card.open).toBe(false)
    expect(screen.getByTestId('resume-card')).toBe(card)
  })
})
