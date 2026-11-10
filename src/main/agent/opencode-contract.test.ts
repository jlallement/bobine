import type { SessionUpdate } from '../../shared/acp-sdk.mts'
import { describe, expect, it } from 'vitest'
import {
  childSessionOf,
  childUpdateForCard,
  EMPTY_SESSION_TITLE,
  OPENCODE_SUBAGENT_STREAM,
  OPENCODE_TOOL_STATUS
} from './opencode-contract'

/** Marque relevée sur OpenCode 2.0.31 (fiche 078). */
const CHILD = {
  id: 'ses_eba5677c9ffeoRTtzuEDTgikp7',
  parentID: 'ses_eba56a262ffej8Zk7Scjr7JdpP',
  depth: 1,
  title: 'Lire secret.txt et rapporter'
}

describe('travail des sous-agents d’OpenCode 2 (fiche 078)', () => {
  it('reconnaît la marque _meta["opencode/child-session"]', () => {
    const update: SessionUpdate = {
      sessionUpdate: 'agent_message_chunk',
      content: { type: 'text', text: 'Fichier trouvé' },
      _meta: { 'opencode/child-session': CHILD }
    }
    expect(childSessionOf(update)).toEqual({
      id: CHILD.id,
      parentId: CHILD.parentID,
      depth: 1,
      title: CHILD.title
    })
  })

  it('mise à jour de la conversation, ou marque mal formée : pas un sous-agent', () => {
    const chunk = (meta?: Record<string, unknown>): SessionUpdate => ({
      sessionUpdate: 'agent_message_chunk',
      content: { type: 'text', text: 'x' },
      ...(meta ? { _meta: meta } : {})
    })
    expect(childSessionOf(chunk())).toBeUndefined()
    expect(childSessionOf(chunk({ 'opencode/child-session': 'ses_x' }))).toBeUndefined()
    expect(
      childSessionOf(chunk({ 'opencode/child-session': { ...CHILD, id: '../etc' } }))
    ).toBeUndefined()
    expect(
      childSessionOf(chunk({ 'opencode/child-session': { id: 'ses_a', depth: 1 } }))
    ).toBeUndefined()
  })

  it('sous la carte : sans la marque ni le préfixe du titre, identifiant gardé', () => {
    const update: SessionUpdate = {
      sessionUpdate: 'tool_call',
      toolCallId: `${CHILD.id}:call_read`,
      title: 'Lire secret.txt et rapporter: read',
      kind: 'read',
      status: 'pending',
      rawInput: {},
      _meta: { 'opencode/child-session': CHILD, autre: 1 }
    }
    const child = childSessionOf(update)
    if (!child) throw new Error('marque non reconnue')
    expect(childUpdateForCard(update, child)).toEqual({
      sessionUpdate: 'tool_call',
      toolCallId: `${CHILD.id}:call_read`,
      title: 'read',
      kind: 'read',
      status: 'pending',
      rawInput: {},
      _meta: { autre: 1 }
    })
    const text: SessionUpdate = {
      sessionUpdate: 'agent_message_chunk',
      content: { type: 'text', text: 'ok' },
      _meta: { 'opencode/child-session': CHILD }
    }
    expect(childUpdateForCard(text, child)).toEqual({
      sessionUpdate: 'agent_message_chunk',
      content: { type: 'text', text: 'ok' }
    })
  })

  it('titre des sessions vides (1.19 et 2.0.31)', () => {
    expect(EMPTY_SESSION_TITLE.test('New session - 2026-10-16T17:00:56.682Z')).toBe(true)
    expect(EMPTY_SESSION_TITLE.test('Lecture de README.md')).toBe(false)
  })
})

describe('erreurs des outils appelés par `execute` d’OpenCode 2 (fiche 122)', () => {
  /** Relevé sur OpenCode 2.0.32 (recette du 2026-10-22) : `preview_start` sans fichier de lancement. */
  const execute = (metadata: Record<string, unknown>): SessionUpdate => ({
    sessionUpdate: 'tool_call_update',
    toolCallId: 'call_exec',
    status: 'completed',
    content: [{ type: 'content', content: { type: 'text', text: 'No launch configuration…' } }],
    rawOutput: { metadata }
  })

  it('un appel en erreur (`status: "error"`, `isError`, ou `error: true`) : carte en échec', () => {
    const failed = (metadata: Record<string, unknown>) =>
      OPENCODE_TOOL_STATUS.correct(execute(metadata))
    expect(
      failed({ toolCalls: [{ tool: 'bobine.preview_start', status: 'error' }], error: true })
    ).toMatchObject({ status: 'failed', toolCallId: 'call_exec' })
    expect(
      failed({
        toolCalls: [
          { tool: 'search', status: 'completed' },
          { tool: 'x', isError: true }
        ]
      })
    ).toMatchObject({ status: 'failed' })
    expect(failed({ toolCalls: [], error: true })).toMatchObject({ status: 'failed' })
  })

  it('appels réussis, autre mise à jour, ou format inconnu : telle quelle', () => {
    const ok = execute({
      toolCalls: [{ tool: 'bobine.browser_javascript', status: 'completed' }],
      truncated: false
    })
    expect(OPENCODE_TOOL_STATUS.correct(ok)).toBe(ok)
    const plain = execute({ truncated: false })
    expect(OPENCODE_TOOL_STATUS.correct(plain)).toBe(plain)
    const running: SessionUpdate = {
      sessionUpdate: 'tool_call_update',
      toolCallId: 'call_exec',
      status: 'in_progress',
      rawOutput: { metadata: { error: true } }
    }
    expect(OPENCODE_TOOL_STATUS.correct(running)).toBe(running)
    const text: SessionUpdate = {
      sessionUpdate: 'agent_message_chunk',
      content: { type: 'text', text: 'error: true' }
    }
    expect(OPENCODE_TOOL_STATUS.correct(text)).toBe(text)
  })
})

describe('sous-agent d’OpenCode 2 lancé en arrière-plan (fiche 122)', () => {
  it('outil rendu avec `metadata.status: "running"` : il travaille encore', () => {
    const update = (status: string): SessionUpdate => ({
      sessionUpdate: 'tool_call_update',
      toolCallId: 'call_sub',
      status: 'completed',
      rawOutput: {
        metadata: { sessionID: 'ses_e9aa2de88ffelTlksXwcSq75ZO', status, truncated: false }
      }
    })
    expect(OPENCODE_SUBAGENT_STREAM.background?.(update('running'))).toBe(true)
    expect(OPENCODE_SUBAGENT_STREAM.background?.(update('completed'))).toBe(false)
    expect(
      OPENCODE_SUBAGENT_STREAM.background?.({
        sessionUpdate: 'agent_message_chunk',
        content: { type: 'text', text: 'running' }
      })
    ).toBe(false)
  })
})
