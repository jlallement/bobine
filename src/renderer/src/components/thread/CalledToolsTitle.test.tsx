/**
 * Titre d'une carte d'après les outils qu'elle a appelés (fiche 293, lot 3), dans le fil. Nourri
 * par la trace **réelle** d'OpenCode 2.3.0 connecté à Figma (`__traces__/opencode-2.3.0/
 * acp-execute-figma.jsonl`). Le renderer ne charge pas le code du main : la marque que le main pose
 * à la fin de chaque carte est celle que prouve `main/agent/opencode-called-tools.test.ts` (rejeu
 * complet, adaptateur d'OpenCode compris) ; ici, elle est jointe telle quelle aux mises à jour
 * relevées, puis le fil est rendu.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { AgentEvent } from '@shared/agent'
import {
  CALLED_TOOLS_META,
  calledToolsMark,
  withCalledTools,
  type CalledToolsMark
} from '@shared/called-tools'
import { calledToolsText } from '@shared/called-tools-text'
import { emptyTranscript, reduceTranscript, type TranscriptItem } from '@shared/transcript'
import { ToolCall, WorkspaceContext } from './ToolCall'

type ToolItem = Extract<TranscriptItem, { kind: 'tool' }>

const RAW = import.meta.glob<string>(
  '../../../../main/agent/__traces__/opencode-2.3.0/acp-execute-figma.jsonl',
  { query: '?raw', import: 'default', eager: true }
)
const relevé = Object.values(RAW)[0] ?? ''

/** Marques posées par le main à la fin des deux cartes (prouvées par le rejeu du main). */
const MARKS: Record<string, CalledToolsMark> = {
  call_FAKE_1: { tools: [{ search: true }], total: 1 },
  call_FAKE_2: { tools: [{ server: 'figma', tool: 'whoami' }], total: 1 }
}

/** Le fil après les `count` premiers messages relevés. */
function thread(count: number): ToolItem[] {
  let state = emptyTranscript
  const updates = relevé
    .trim()
    .split('\n')
    .slice(0, count)
    .map(
      (line) => (JSON.parse(line) as { params: { update: Record<string, unknown> } }).params.update
    )
  for (const update of updates) {
    const mark = MARKS[String(update['toolCallId'])]
    const ended = update['status'] === 'completed'
    const marked = ended && mark ? withCalledTools(update, mark) : update
    state = reduceTranscript(state, { type: 'update', update: marked } as unknown as AgentEvent)
  }
  return state.items.filter((i): i is ToolItem => i.kind === 'tool')
}

const view = (item: ToolItem) =>
  render(
    <WorkspaceContext.Provider value="/dossier">
      <ToolCall item={item} onRespond={vi.fn()} />
    </WorkspaceContext.Provider>
  )
const titleOf = (item: ToolItem) => {
  const { container, unmount } = view(item)
  const text = container.querySelector('.tool-title')?.textContent ?? ''
  unmount()
  return text
}

describe('fil : trace réelle d’OpenCode 2.3.0 connecté à Figma (fiche 293)', () => {
  it('rejouée dans l’ordre : « execute » pendant l’appel, puis les deux titres attendus', () => {
    // Annoncée (`pending`), la carte dit « Prépare un outil… » comme toute carte (inchangé).
    const preparing = 'Prépare un outil…'
    expect(Array.from({ length: 9 }, (_, i) => thread(i + 1).map(titleOf))).toEqual([
      [preparing],
      ['execute'],
      ['execute'],
      ['Cherche parmi les outils'],
      ['Cherche parmi les outils', preparing],
      ['Cherche parmi les outils', 'execute'],
      ['Cherche parmi les outils', 'execute'],
      ['Cherche parmi les outils', 'execute'],
      ['Cherche parmi les outils', 'figma · whoami']
    ])
  })

  it('« figma · whoami » : le serveur en retrait (maquette), l’outil en clair ; infobulle complète', () => {
    const whoami = thread(9)[1]
    if (!whoami) throw new Error('carte absente')
    view(whoami)
    const title = screen.getByTestId('tool-called')
    expect(title.querySelector('.tool-called-server')?.textContent).toBe('figma ·')
    expect(title.textContent).toBe('figma · whoami')
    expect(title.textContent).toBe(calledToolsText(MARKS['call_FAKE_2'] as CalledToolsMark))
    expect(title.getAttribute('title')).toBe('execute · 1 appel\nfigma · whoami')
    expect(screen.getByTestId('tool').dataset['status']).toBe('completed')
  })
})

describe('titre des outils appelés : cas du fil (fiche 293)', () => {
  const item = (over: Partial<ToolItem>): ToolItem => ({
    kind: 'tool',
    id: 1,
    toolCallId: 'c',
    title: 'execute',
    toolKind: 'other',
    status: 'completed',
    content: [],
    locations: [],
    ...over
  })
  const mark = (tools: unknown[], total?: number) =>
    calledToolsMark(tools, total) as CalledToolsMark

  it('recherche dans un espace connu : « Cherche parmi les outils de figma »', () => {
    expect(titleOf(item({ calledTools: mark([{ search: true, server: 'figma' }]) }))).toBe(
      'Cherche parmi les outils de figma'
    )
  })

  it('plusieurs outils d’un même serveur : le serveur une fois, puis « +N »', () => {
    const tools = ['get_design_context', 'get_screenshot', 'whoami', 'get_variable_defs']
    const calledTools = mark(tools.map((tool) => ({ server: 'figma', tool })))
    expect(titleOf(item({ calledTools }))).toBe(
      'figma · get_design_context, get_screenshot, whoami +1'
    )
  })

  it('serveurs différents, outil sans serveur : chacun dit le sien', () => {
    const calledTools = mark([
      { server: 'figma', tool: 'whoami' },
      { tool: 'lire' },
      { search: true }
    ])
    expect(titleOf(item({ calledTools }))).toBe('figma · whoami, lire, Cherche parmi les outils')
  })

  it('appel en échec : l’état d’échec reste affiché (fiche 122), le titre nomme l’outil', () => {
    view(item({ status: 'failed', calledTools: mark([{ server: 'figma', tool: 'whoami' }]) }))
    expect(screen.getByTestId('tool').dataset['status']).toBe('failed')
    expect(screen.getByTestId('tool-called').textContent).toBe('figma · whoami')
  })

  it('outil de l’app appelé par la même carte (fiche 079) : son libellé l’emporte', () => {
    const { container } = view(
      item({
        appTool: { group: 'browser', label: 'Capture la page' },
        calledTools: mark([{ server: 'bobine', tool: 'browser_screenshot' }])
      })
    )
    expect(container.querySelector('.tool-title')?.textContent).toBe('Capture la page')
    expect(screen.queryByTestId('tool-called')).toBeNull()
  })

  it('carte sans marque (autre agent, `execute` sans appel MCP) : titre de l’agent', () => {
    expect(titleOf(item({}))).toBe('execute')
  })

  it('nom hostile : écrit en texte, jamais en HTML, sur une ligne', () => {
    const calledTools = mark([{ server: '<img src=x onerror=alert(1)>', tool: 'a\nb<b>x</b>' }])
    const { container } = view(item({ calledTools }))
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('.tool-title b')).toBeNull()
    expect(screen.getByTestId('tool-called').textContent).toBe(
      '<img src=x onerror=alert(1)> · a b<b>x</b>'
    )
  })

  it('marque mal formée sur une mise à jour : ignorée, rien ne casse', () => {
    const state = reduceTranscript(emptyTranscript, {
      type: 'update',
      update: {
        sessionUpdate: 'tool_call_update',
        toolCallId: 'c',
        title: 'execute',
        status: 'completed',
        _meta: { [CALLED_TOOLS_META]: { tools: 'figma.whoami' } }
      }
    } as unknown as AgentEvent)
    const tool = state.items.find((i): i is ToolItem => i.kind === 'tool')
    expect(tool?.calledTools).toBeUndefined()
    if (tool) expect(titleOf(tool)).toBe('execute')
  })
})
