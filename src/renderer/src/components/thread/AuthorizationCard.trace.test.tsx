import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { AgentEvent } from '@shared/agent'
import { emptyTranscript, reduceTranscript, type TranscriptItem } from '@shared/transcript'
import { ToolCall, WorkspaceContext } from './ToolCall'

type ToolItem = Extract<TranscriptItem, { kind: 'tool' }>

/** Les traces enregistrées par la sonde (`pnpm opencode-probe --only commande --traces`), brutes. */
const TRACES = import.meta.glob<string>('../../../../main/agent/__traces__/*/commande-*.ndjson', {
  query: '?raw',
  import: 'default',
  eager: true
})
const trace = (name: string): string => {
  const found = Object.entries(TRACES).find(([path]) => path.endsWith(`/${name}.ndjson`))
  if (!found) throw new Error(`trace absente : ${name}`)
  return found[1]
}
const inside = trace('commande-dans-un-sous-dossier')
const outside = trace('commande-hors-du-dossier-refusee')

/**
 * Cartes « commande » nourries par les traces RÉELLES d'OpenCode 2.2.5 (fiche 203, correctif de
 * recette) : `rawInput.workdir` relatif (`"docs"`, `"../autre"`) et l'emplacement absolu. Le
 * renderer ne charge pas le code du main : le rejeu est ici réduit aux messages des outils, passés
 * au réducteur du fil (le rejeu complet, adaptateurs compris, est dans `trace-replay.test.ts`).
 * Le dossier de la conversation en `/dossier`, le HOME jetable de la sonde en `/home-sonde`.
 */
const WS = '/dossier'

interface TraceLine {
  from: 'client' | 'agent'
  msg: { id?: number; method?: string; params?: Record<string, unknown>; result?: unknown }
}

/** Les fils du rejeu : à la demande d'autorisation (`asked`), puis à la fin (`done`). */
function replayed(text: string): { asked: ToolItem; done: ToolItem } {
  const lines = text
    .replaceAll('<dossier>', WS)
    .replaceAll('<home>', '/home-sonde')
    .trim()
    .split('\n')
    .slice(1)
    .map((line) => JSON.parse(line) as TraceLine)
  let state = emptyTranscript
  let asked: ToolItem | undefined
  const emit = (event: AgentEvent) => (state = reduceTranscript(state, event))
  const tool = () =>
    state.items.find((i): i is ToolItem => i.kind === 'tool' && i.toolKind === 'execute')
  for (const { from, msg } of lines) {
    const params = msg.params ?? {}
    if (from === 'agent' && msg.method === 'session/update') {
      const update = params['update'] as { sessionUpdate: string }
      if (update.sessionUpdate.startsWith('tool_call')) emit({ type: 'update', update } as never)
    }
    if (from === 'agent' && msg.method === 'session/request_permission') {
      emit({
        type: 'permission-request',
        requestId: String(msg.id),
        toolCall: params['toolCall'],
        options: params['options']
      } as never)
      asked = tool()
    }
    if (from === 'client' && msg.method === undefined && msg.result && asked) {
      const outcome = (msg.result as { outcome?: { optionId?: string } }).outcome
      if (outcome?.optionId)
        emit({ type: 'permission-resolved', requestId: String(msg.id), optionId: outcome.optionId })
    }
  }
  const done = tool()
  if (!asked || !done) throw new Error('Carte de la commande absente de la trace')
  return { asked, done }
}

const view = (item: ToolItem) =>
  render(
    <WorkspaceContext.Provider value={WS}>
      <ToolCall item={item} onRespond={vi.fn()} />
    </WorkspaceContext.Provider>
  )

const cwdText = () => screen.getByTestId('command-cwd-text').textContent

describe('Trace réelle OpenCode 2.2.5 : commande dans un sous-dossier (fiche 203)', () => {
  it('le contrat relevé : `workdir` relatif, emplacement absolu', () => {
    const { asked, done } = replayed(inside)
    expect(asked.permission?.state).toBe('pending')
    expect(asked.command).toEqual({ text: 'ls', cwd: 'docs' })
    expect(asked.locations).toEqual([{ path: `${WS}/docs` }])
    expect(done.status).toBe('completed')
  })

  it('carte d’autorisation : « Dans dossier/docs », le chemin absolu pas répété', () => {
    view(replayed(inside).asked)
    expect(cwdText()).toBe('dossier/docs')
    expect(screen.getByTestId('command-cwd').getAttribute('title')).toBe(`${WS}/docs`)
    expect(document.querySelector('.tool-locations')).toBeNull()
    expect(screen.queryByTestId('command-outside')).toBeNull()
  })

  it('après la décision, dépliée : pareil', async () => {
    view(replayed(inside).done)
    const summary = document.querySelector('details.tool summary')
    if (!summary) throw new Error('Résumé absent')
    fireEvent.click(summary)
    expect((await screen.findByTestId('command-cwd-text')).textContent).toBe('dossier/docs')
    expect(document.querySelector('.tool-locations')).toBeNull()
  })
})

describe('Trace réelle OpenCode 2.2.5 : commande hors du dossier, refusée (fiche 203)', () => {
  it('`workdir: "../autre"` : alerte « hors du dossier », emplacement gardé', () => {
    const { asked } = replayed(outside)
    expect(asked.command?.cwd).toBe('../autre')
    view(asked)
    expect(screen.getByTestId('command-outside')).toBeTruthy()
    const shown = [...document.querySelectorAll('.tool-location code')].map((c) => c.textContent)
    expect(shown).toEqual(['/home-sonde/autre'])
  })
})
