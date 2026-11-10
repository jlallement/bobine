import * as Tooltip from '@radix-ui/react-tooltip'
import type { ReactNode } from 'react'
import { createElement } from 'react'
import { fireEvent, render as testingRender, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ConversationSummary } from '@shared/agent'
import { childProposalSchema } from '@shared/children'
import type { TranscriptItem } from '@shared/transcript'
import { Transcript } from './Transcript'

function render(ui: ReactNode) {
  return testingRender(ui, { wrapper: Tooltip.Provider })
}

// Rendus de cartes d'outils comptés (fiche 047) : la vraie carte, appelée à travers un compteur.
const renders = vi.hoisted(() => ({ tools: 0 }))
vi.mock('./ToolCall', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./ToolCall')>()
  return {
    ...actual,
    ToolCall: (props: Parameters<typeof actual.ToolCall>[0]) => {
      renders.tools++
      return createElement(actual.ToolCall, props)
    }
  }
})

type ToolItem = Extract<TranscriptItem, { kind: 'tool' }>
const tool = (id: number, extra: Partial<ToolItem> = {}): ToolItem => ({
  kind: 'tool',
  id,
  toolCallId: `t${id}`,
  title: `Running Browser Type (bobine) ${id}`,
  toolKind: 'other',
  status: 'completed',
  content: [{ type: 'content', content: { type: 'text', text: `résultat ${id}` } }],
  locations: [],
  appTool: { label: `Saisit « ${id} »`, group: 'browser' },
  ...extra
})

const noop = () => {}
const view = (items: TranscriptItem[]) => (
  // Fonctions recréées à chaque rendu, comme dans l'app.
  <Transcript
    items={items}
    onRespondPermission={() => noop()}
    onRespondElicitation={() => noop()}
  />
)

describe('Transcript (fiche 047)', () => {
  it('outils consécutifs regroupés, libellés lisibles, dernière capture visible', () => {
    const image = { mimeType: 'image/png', data: 'iVBORw0KGgo=' }
    render(
      view([
        { kind: 'user', id: 1, text: 'Teste la page' },
        tool(2),
        tool(3, { images: [image] }),
        tool(4, { status: 'failed' }),
        { kind: 'agent', id: 5, text: 'Fini.' }
      ])
    )
    expect(screen.getByTestId('tool-group-summary').textContent).toBe(
      '3 actions dans le navigateur'
    )
    expect(screen.getByTestId('tool-group').textContent).toContain('1 échec')
    // Cartes dans le groupe, libellé lisible, titre de l'agent en infobulle.
    const label = screen.getByText('Saisit « 2 »')
    expect(label.getAttribute('title')).toBe('Running Browser Type (bobine) 2')
    // Une seule capture affichée, au niveau du groupe.
    expect(screen.getAllByTestId('tool-images')).toHaveLength(1)
  })

  it('outil de l’agent : ce qu’il a fait et sur quoi, chemin relatif au dossier (fiche 107)', () => {
    const agentTool = (id: number, extra: Partial<ToolItem>): ToolItem => {
      const { appTool: _ignored, ...base } = tool(id)
      return { ...base, ...extra }
    }
    render(
      <Transcript
        items={[
          agentTool(1, {
            title: 'read',
            toolKind: 'read',
            locations: [{ path: '/depot/livres/src/books.js' }]
          }),
          agentTool(2, {
            title: 'grep',
            toolKind: 'search',
            input: { pattern: 'TODO', path: '/depot/livres/src' }
          }),
          agentTool(3, { title: 'Reading the project', toolKind: 'read' })
        ]}
        onRespondPermission={() => noop()}
        onRespondElicitation={() => noop()}
        workspace="/depot/livres"
      />
    )
    // Libellé d'un fichier en morceaux (fiche 203) : texte, dossier, nom ; lu en entier.
    const read = screen
      .getAllByTestId('tool-label')
      .find((e) => e.textContent === 'Lecture de src/books.js')
    expect(read?.getAttribute('title')).toBe('/depot/livres/src/books.js\nread')
    expect(read?.querySelector('.tool-file-dir')?.textContent).toBe('src/')
    expect(read?.querySelector('.tool-file-name')?.textContent).toBe('books.js')
    expect(screen.getByText('Recherche « TODO »').getAttribute('title')).toBe(
      'TODO\n/depot/livres/src\ngrep'
    )
    // Sans cible : le titre de l'agent.
    expect(screen.getByText('Reading the project').getAttribute('title')).toBeNull()
  })

  it('un morceau de réponse ne refait pas le rendu des outils déjà affichés', () => {
    const tools = Array.from({ length: 60 }, (_, i) =>
      i % 3 === 2 ? ({ kind: 'agent', id: 1000 + i, text: `Étape ${i}` } as const) : tool(i + 1)
    )
    const first: TranscriptItem[] = [...tools, { kind: 'agent', id: 2000, text: 'Je ' }]
    const { rerender } = render(view(first))
    expect(renders.tools).toBeGreaterThan(30)
    renders.tools = 0
    // Le réducteur remplace seulement l'élément qui change : les autres gardent leur identité.
    rerender(view([...tools, { kind: 'agent', id: 2000, text: 'Je réfléchis' }]))
    expect(renders.tools).toBe(0)
    // Un outil qui change : seul son groupe refait son rendu.
    const changed = tools.map((item) =>
      item.id === 1 ? tool(1, { status: 'failed' as const }) : item
    )
    rerender(view([...changed, { kind: 'agent', id: 2000, text: 'Je réfléchis' }]))
    expect(renders.tools).toBe(2)
  })
})

describe('conversations filles dans le fil de la mère (fiche 097)', () => {
  const summary = (id: string, status: ConversationSummary['status']): ConversationSummary => ({
    id,
    title: `Fille ${id}`,
    profileId: 'mock',
    profileLabel: 'Agent factice',
    workspace: `/depot/.worktrees/${id}`,
    updatedAt: '2026-10-20T18:00:00.000Z',
    status,
    draft: false,
    branch: `bobine/${id}`,
    startedFrom: { id: 'm', title: 'Carnet' }
  })
  const started = (id: number, childId: string): TranscriptItem => ({
    kind: 'child-started',
    id,
    childId,
    title: `Fille ${childId}`,
    branch: `bobine/${childId}`,
    prompt: 'Fais',
    at: 1
  })
  const report = (id: number, childId: string): TranscriptItem => ({
    kind: 'child-report',
    id,
    childId,
    title: `Fille ${childId}`,
    outcome: 'done',
    branch: `bobine/${childId}`,
    files: [{ path: 'a.ts', added: 62, removed: 4 }],
    fileCount: 3,
    added: 62,
    removed: 4,
    excerpt: '12 tests passent.',
    at: 2
  })

  it('carte « Sous-tâches » au dernier lancement, comptes rendus, envoi au prochain message', () => {
    const onOpen = vi.fn()
    const items: TranscriptItem[] = [
      { kind: 'user', id: 1, text: 'Organise' },
      started(2, 'b'),
      report(3, 'b'),
      { kind: 'user', id: 4, text: 'Ensuite' },
      started(5, 'a'),
      report(6, 'a')
    ]
    render(
      <Transcript
        items={items}
        onRespondPermission={noop}
        onRespondElicitation={noop}
        subtasks={{
          // Dans l'ordre de la liste (activité) ; la carte suit celui des lancements.
          children: [summary('a', 'busy'), summary('b', 'ready')],
          attention: { b: 'done' },
          onOpen
        }}
      />
    )
    expect(screen.getAllByTestId('child-started')).toHaveLength(2)
    expect(screen.getAllByTestId('subtasks')).toHaveLength(1)
    const rows = screen.getAllByTestId('subtask-row')
    expect(rows.map((r) => [r.dataset.id, r.dataset.state])).toEqual([
      ['b', 'unread'],
      ['a', 'running']
    ])
    expect(screen.getByTestId('subtasks').textContent).toContain('1 en cours, 1 terminée')
    expect(rows[0]?.textContent).toContain('3 fichiers +62 −4')
    expect(rows[0]?.textContent).toContain('bobine/b')
    fireEvent.click(screen.getAllByTestId('subtask-open')[1] ?? document.body)
    expect(onOpen).toHaveBeenCalledWith('a')
    // Seul le compte rendu d'après le dernier message attend de partir à l'agent.
    const reports = screen.getAllByTestId('child-report')
    // Replié (fiche 171) : titre et première phrase ; branche et fichiers au dépli.
    expect(reports[0]?.textContent).toBe(
      '«\u00a0Fille b\u00a0» a fini son tour12 tests passent.Afficher le détail'
    )
    fireEvent.click(reports[0]?.querySelector('[data-testid=child-report-toggle]') ?? document.body)
    expect(reports[0]?.textContent).toBe(
      '«\u00a0Fille b\u00a0» a fini son tourMasquer le détail12 tests passent.bobine/b3 fichiers +62 −4'
    )
    expect(reports.map((r) => !!r.querySelector('[data-testid=child-report-pending]'))).toEqual([
      false,
      true
    ])
  })

  it('étape 2 : lancée par l’agent, compte rendu qui attend son réveil, provenance des messages', () => {
    const onOpenConversation = vi.fn()
    const items: TranscriptItem[] = [
      { kind: 'user', id: 1, text: 'Découpe' },
      { ...started(2, 'a'), by: 'agent' } as TranscriptItem,
      report(3, 'a'),
      {
        kind: 'user',
        id: 4,
        text: 'Virgule aussi ?',
        from: { kind: 'child', id: 'a', title: 'Fille a' }
      },
      report(5, 'a'),
      { kind: 'user', id: 6, text: 'All the child conversations…', from: { kind: 'wake' } },
      { kind: 'agent', id: 7, text: 'Tout est fini.' }
    ]
    render(
      <Transcript
        items={items}
        onRespondPermission={noop}
        onRespondElicitation={noop}
        messageActions={{ busy: false, onEdit: noop, onOpenConversation }}
      />
    )
    const launch = screen.getByTestId('child-started')
    expect(launch.querySelector('summary')?.textContent).toBe(
      'L’agent a lancé la conversation fille «\u00a0Fille a\u00a0»'
    )
    expect(launch.hasAttribute('open')).toBe(false)
    expect(launch.querySelector('[data-testid=child-instruction-text]')?.textContent).toBe('Fais')
    // Un message d'une autre conversation : sa provenance, sans « Modifier » ni « Réessayer ».
    const origin = screen.getByTestId('message-origin')
    expect(origin.textContent).toBe('De la conversation fille «\u00a0Fille a\u00a0»')
    fireEvent.click(origin.querySelector('button') ?? document.body)
    expect(onOpenConversation).toHaveBeenCalledWith('a')
    expect(screen.queryAllByTestId('message-edit')).toHaveLength(1)
    // Le réveil groupé : une ligne de l'app, traduite, pas une bulle.
    expect(screen.getByTestId('wake-message').textContent).toContain(
      'Les conversations filles ont toutes fini'
    )
    expect(screen.queryByText('All the child conversations…')).toBeNull()
  })

  it('compte rendu : la fin de la réponse rendue en Markdown, comme le fil', () => {
    render(
      view([
        { kind: 'user', id: 1, text: 'Découpe' },
        started(2, 'a'),
        {
          ...report(3, 'a'),
          excerpt: '- **Import** fait dans `src/import.ts`\n- 37 tests'
        } as TranscriptItem
      ])
    )
    fireEvent.click(screen.getByTestId('child-report-toggle'))
    const excerpt = screen.getByTestId('child-report-excerpt')
    expect(excerpt.querySelectorAll('li')).toHaveLength(2)
    expect(excerpt.querySelector('strong')?.textContent).toBe('Import')
    expect(excerpt.querySelector('code')?.textContent).toBe('src/import.ts')
    expect(excerpt.textContent).not.toContain('**')
  })

  it('compte rendu d’une fille lancée par l’agent : partira à son réveil', () => {
    render(
      view([
        { kind: 'user', id: 1, text: 'Découpe' },
        { ...started(2, 'a'), by: 'agent' } as TranscriptItem,
        report(3, 'a')
      ])
    )
    expect(screen.getByTestId('child-report-pending').textContent).toBe(
      'Partira à l’agent quand ses conversations filles auront toutes fini.'
    )
  })
})

describe('propositions de conversations filles (fiche 112)', () => {
  const proposal = (id: number, title: string, toolCallId?: string): TranscriptItem => ({
    kind: 'elicitation',
    id,
    requestId: `r${id}`,
    state: 'pending',
    prompt: {
      mode: 'form',
      message: title,
      schema: childProposalSchema(),
      child: { title, prompt: 'Fais' },
      ...(toolCallId ? { toolCallId } : {})
    }
  })
  const startChild = (id: number, toolCallId: string): ToolItem =>
    tool(id, {
      toolCallId,
      title: 'start_child',
      appTool: { label: 'start_child', group: 'children' }
    })

  it('une carte par tour, à la place de la première proposition ; les appels start_child cachés', () => {
    const items: TranscriptItem[] = [
      { kind: 'user', id: 1, text: 'Découpe' },
      startChild(2, 'c1'),
      proposal(3, 'Import CSV', 'c1'),
      { kind: 'agent', id: 4, text: 'Et aussi :' },
      startChild(5, 'c2'),
      proposal(6, 'Page d’aide', 'c2'),
      { kind: 'user', id: 7, text: 'Encore une' },
      proposal(8, 'Export')
    ]
    const before = renders.tools
    render(view(items))
    const cards = screen.getAllByTestId('proposals')
    expect(cards).toHaveLength(2)
    expect(cards[0]?.querySelectorAll('[data-testid=proposal-row]')).toHaveLength(2)
    expect(cards[0]?.textContent).toContain('2 tâches proposées')
    expect(cards[1]?.querySelectorAll('[data-testid=proposal-row]')).toHaveLength(1)
    // Les appels `start_child` reliés sont derrière la carte, pas affichés.
    expect(renders.tools).toBe(before)
    expect(screen.queryAllByTestId('questions')).toHaveLength(0)
    // L'agent qui parle entre deux propositions reste visible, entre les deux cartes.
    expect(screen.getByText('Et aussi :')).toBeTruthy()
  })
})

describe('avis avec lien (fiche 198)', () => {
  it('« Diagnostic » à la suite du texte ouvre la section des Réglages', () => {
    const opened = vi.fn()
    const listener = (event: Event) => opened((event as CustomEvent<string>).detail)
    window.addEventListener('bobine:open-settings', listener)
    render(
      view([
        {
          kind: 'notice',
          id: 1,
          level: 'info',
          message: {
            key: 'agentHost.version.newer',
            params: { named: 'Agent X 2.3.0', newest: '2.2.5' }
          },
          link: 'diagnostics'
        }
      ])
    )
    fireEvent.click(screen.getByTestId('notice-link'))
    window.removeEventListener('bobine:open-settings', listener)
    expect(opened).toHaveBeenCalledWith('diagnostics')
    expect(screen.getByTestId('notice-link').textContent).toBe('Diagnostic')
  })
})

describe('« Réessayer » un message en branche (fiches 023, 210)', () => {
  const items: TranscriptItem[] = [
    { kind: 'user', id: 1, text: 'Premier' },
    { kind: 'agent', id: 2, text: 'Réponse' },
    { kind: 'user', id: 3, text: 'Ajoute un test' }
  ]
  const show = (refused: boolean) =>
    render(
      <Transcript
        items={items}
        onRespondPermission={() => {}}
        onRespondElicitation={() => {}}
        messageActions={{ busy: false, refused, onEdit: () => {}, onOpenConversation: () => {} }}
      />
    )

  it('prêt : l’icône sous le dernier message, nommée « Réessayer dans une nouvelle branche »', () => {
    show(false)
    const retry = screen.getAllByTestId('message-retry')
    expect(retry).toHaveLength(1)
    expect(retry[0]?.getAttribute('aria-label')).toBe('Réessayer dans une nouvelle branche')
    expect(screen.queryByRole('button', { name: 'Réessayer' })).toBeNull()
  })

  it('message refusé, carte en attente : pas d’icône (la carte le renvoie en place)', () => {
    show(true)
    expect(screen.queryByTestId('message-retry')).toBeNull()
    expect(screen.getAllByTestId('message-edit')).toHaveLength(2)
  })
})
