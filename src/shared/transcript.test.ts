import { describe, expect, it } from 'vitest'
import type { SessionUpdate } from './acp-sdk.mts'
import type { AgentEvent, AgentSnapshot } from './agent'
import {
  emptyTranscript,
  noticeText,
  reduceTranscript,
  settleTranscript,
  withSubagentWork
} from './transcript'
import { conversationChanges } from './changes'
import { SUBAGENT_META } from './subagent'
import { fileChangesSince } from './branch'

const update = (u: SessionUpdate): AgentEvent => ({ type: 'update', update: u })
const text = (t: string): AgentEvent =>
  update({ sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: t } })
const thought = (t: string): AgentEvent =>
  update({ sessionUpdate: 'agent_thought_chunk', content: { type: 'text', text: t } })
const run = (...events: AgentEvent[]) => events.reduce(reduceTranscript, emptyTranscript).items

describe('reduceTranscript', () => {
  it('un avis au passage vers l’arrêt seulement : le même arrêt réannoncé n’en ajoute pas (194)', () => {
    const status = (snapshot: object): AgentEvent => ({
      type: 'status',
      snapshot: snapshot as AgentSnapshot
    })
    const exited = status({ status: 'exited', detail: 'Stop ignoré' })
    const notices = (...events: AgentEvent[]) =>
      run(...events).filter((item) => item.kind === 'notice').length
    expect(notices(exited, exited)).toBe(1)
    expect(notices(exited, status({ status: 'starting' }), exited)).toBe(2)
    expect(notices(exited, status({ status: 'exited', detail: 'code 3' }))).toBe(2)
    expect(
      notices(status({ status: 'error', detail: 'x' }), status({ status: 'error', detail: 'x' }))
    ).toBe(1)
  })
  it('garde la consigne complète adressée à une fille, sans créer de tour utilisateur (150)', () => {
    const instruction = {
      childId: 'child',
      title: 'Import',
      prompt: 'Corrige ceci.\n\nPuis cela.\n',
      at: 12
    }
    const state = reduceTranscript(emptyTranscript, { type: 'child-instruction', instruction })
    expect(state.items).toEqual([{ kind: 'child-instruction', id: 1, ...instruction }])
    expect(state.usage).toBeUndefined()
  })
  it('concatène les morceaux consécutifs du même type', () => {
    const items = run(
      { type: 'user-message', text: 'Salut' },
      thought('Je '),
      thought('réfléchis'),
      text('Bon'),
      text('jour')
    )
    expect(items.map((i) => i.kind)).toEqual(['user', 'thought', 'agent'])
    expect(items[1]).toMatchObject({ text: 'Je réfléchis' })
    expect(items[2]).toMatchObject({ text: 'Bonjour' })
  })

  it('outil de l’app : libellé lisible posé sur sa carte (fiche 047), ignoré si inconnu', () => {
    const items = run(
      update({
        sessionUpdate: 'tool_call',
        toolCallId: 't1',
        title: 'Running Browser Type (bobine)'
      }),
      {
        type: 'tool-app',
        toolCallId: 't1',
        appTool: { label: 'Saisit « Ada »', group: 'browser' }
      },
      { type: 'tool-app', toolCallId: 'absent', appTool: { label: 'X', group: 'browser' } }
    )
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      title: 'Running Browser Type (bobine)',
      appTool: { label: 'Saisit « Ada »', group: 'browser' }
    })
  })

  it('carte qui appelle plusieurs outils de l’app (fiche 079) : tous leurs libellés, dans l’ordre', () => {
    const items = run(
      update({ sessionUpdate: 'tool_call', toolCallId: 'x1', title: 'execute', kind: 'other' }),
      {
        type: 'tool-app',
        toolCallId: 'x1',
        appTool: { label: 'Capture la page', group: 'browser' }
      },
      { type: 'tool-app', toolCallId: 'x1', appTool: { label: 'Filme la page', group: 'browser' } }
    )
    expect(items[0]).toMatchObject({
      title: 'execute',
      appTool: { label: 'Capture la page', group: 'browser' },
      appTools: [
        { label: 'Capture la page', group: 'browser' },
        { label: 'Filme la page', group: 'browser' }
      ]
    })
  })

  it('un outil entre deux textes sépare les messages', () => {
    const items = run(
      text('Avant'),
      update({ sessionUpdate: 'tool_call', toolCallId: 't1', title: 'Lire', kind: 'read' }),
      text('Après')
    )
    expect(items.map((i) => i.kind)).toEqual(['agent', 'tool', 'agent'])
  })

  it('sous-agent marqué au tool_call (fiche 140), gardé par les mises à jour sans rawInput', () => {
    const [tool] = run(
      update({
        sessionUpdate: 'tool_call',
        toolCallId: 's1',
        title: 'Running subagent: Lire notes.txt',
        kind: 'other',
        status: 'pending',
        rawInput: { description: 'Lire notes.txt', name: 'explore' },
        _meta: { [SUBAGENT_META]: { subagent: { type: 'explore', task: 'Lire notes.txt' } } }
      }),
      update({ sessionUpdate: 'tool_call_update', toolCallId: 's1', status: 'completed' })
    )
    expect(tool).toMatchObject({
      status: 'completed',
      subagent: { type: 'explore', task: 'Lire notes.txt' }
    })
  })

  it('sous-agent marqué à la mise à jour qui porte rawInput ; sans marque, simple outil', () => {
    const [tool] = run(
      update({
        sessionUpdate: 'tool_call',
        toolCallId: 's2',
        title: 'task',
        kind: 'think',
        rawInput: {}
      }),
      update({
        sessionUpdate: 'tool_call_update',
        toolCallId: 's2',
        title: 'Résumer notes.txt',
        status: 'in_progress',
        rawInput: {
          description: 'Résumer notes.txt',
          prompt: 'Lis notes.txt',
          subagent_type: 'general'
        },
        _meta: {
          [SUBAGENT_META]: {
            subagent: { type: 'general', task: 'Résumer notes.txt', prompt: 'Lis notes.txt' }
          }
        }
      })
    )
    expect(tool).toMatchObject({
      title: 'Résumer notes.txt',
      subagent: { type: 'general', task: 'Résumer notes.txt', prompt: 'Lis notes.txt' }
    })
  })

  it('sans marque du main, un format d’agent n’est pas reconnu dans le fil (fiche 140)', () => {
    const [tool] = run(
      update({
        sessionUpdate: 'tool_call',
        toolCallId: 's3',
        title: 'Running subagent: Lire notes.txt',
        rawInput: { description: 'Lire notes.txt', name: 'explore' }
      })
    )
    expect(tool).not.toHaveProperty('subagent')
  })

  it('fusionne les mises à jour d’un appel d’outil sans changer son identifiant', () => {
    const items = run(
      update({
        sessionUpdate: 'tool_call',
        toolCallId: 't1',
        title: 'Lire',
        kind: 'read',
        status: 'pending'
      }),
      update({ sessionUpdate: 'tool_call_update', toolCallId: 't1', status: 'in_progress' }),
      update({
        sessionUpdate: 'tool_call_update',
        toolCallId: 't1',
        status: 'completed',
        content: [{ type: 'content', content: { type: 'text', text: 'ok' } }]
      })
    )
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ id: 1, title: 'Lire', toolKind: 'read', status: 'completed' })
    expect(items[0]?.kind === 'tool' && items[0].content).toHaveLength(1)
  })

  it('cible de rawInput gardée sur la carte (fiche 107), complétée par les mises à jour', () => {
    const items = run(
      update({
        sessionUpdate: 'tool_call',
        toolCallId: 't1',
        title: 'grep',
        kind: 'search',
        status: 'pending',
        rawInput: {}
      }),
      update({
        sessionUpdate: 'tool_call_update',
        toolCallId: 't1',
        status: 'in_progress',
        rawInput: { pattern: 'TODO', path: '/projet/src' }
      }),
      update({ sessionUpdate: 'tool_call_update', toolCallId: 't1', status: 'completed' }),
      update({
        sessionUpdate: 'tool_call_update',
        toolCallId: 't2',
        title: 'webfetch',
        kind: 'fetch',
        status: 'completed',
        rawInput: { url: 'https://example.com' }
      })
    )
    expect(items[0]).toMatchObject({
      status: 'completed',
      input: { pattern: 'TODO', path: '/projet/src' }
    })
    expect(items[1]).toMatchObject({ input: { url: 'https://example.com' } })
  })

  it('un même identifiant d’outil dans un nouveau tour crée une nouvelle carte', () => {
    const items = run(
      { type: 'user-message', text: '1' },
      update({ sessionUpdate: 'tool_call', toolCallId: 't1', title: 'Premier', status: 'pending' }),
      update({ sessionUpdate: 'tool_call_update', toolCallId: 't1', status: 'completed' }),
      { type: 'user-message', text: '2' },
      update({ sessionUpdate: 'tool_call', toolCallId: 't1', title: 'Second', status: 'pending' })
    )
    const tools = items.filter((i) => i.kind === 'tool')
    expect(tools.map((t) => t.kind === 'tool' && `${t.title}:${t.status}`)).toEqual([
      'Premier:completed',
      'Second:pending'
    ])
  })

  it('une mise à jour d’outil inconnu crée l’élément', () => {
    const items = run(
      update({ sessionUpdate: 'tool_call_update', toolCallId: 'x', status: 'failed' })
    )
    expect(items[0]).toMatchObject({ kind: 'tool', title: 'Outil', status: 'failed' })
  })

  it('un plan remplace le précédent dans le même tour, pas dans le tour suivant', () => {
    const plan = (status: 'pending' | 'completed'): AgentEvent =>
      update({ sessionUpdate: 'plan', entries: [{ content: 'Étape', priority: 'low', status }] })
    const items = run(
      { type: 'user-message', text: '1' },
      plan('pending'),
      text('…'),
      plan('completed'),
      { type: 'user-message', text: '2' },
      plan('pending')
    )
    const plans = items.filter((i) => i.kind === 'plan')
    expect(plans).toHaveLength(2)
    expect(plans[0]).toMatchObject({ entries: [{ status: 'completed' }] })
  })

  it('fin de tour : avis seulement si ce n’est pas end_turn', () => {
    expect(run({ type: 'turn-end', stopReason: 'end_turn' })).toHaveLength(0)
    const [notice] = run({ type: 'turn-end', stopReason: 'cancelled' })
    expect(notice).toMatchObject({
      kind: 'notice',
      message: { key: 'transcript.notice.cancelled' }
    })
    expect(notice?.kind === 'notice' && noticeText(notice)).toBe('Réponse interrompue.')
  })

  it('fin de tour : les outils inachevés du tour passent à cancelled, pas ceux d’avant', () => {
    const tool = (id: string, status: 'pending' | 'in_progress' | 'completed'): AgentEvent =>
      update({ sessionUpdate: 'tool_call', toolCallId: id, title: id, status })
    const items = run(
      tool('ancien', 'pending'),
      { type: 'user-message', text: 'Go' },
      tool('a', 'pending'),
      tool('b', 'in_progress'),
      tool('c', 'completed'),
      { type: 'turn-end', stopReason: 'cancelled' }
    )
    const statuses = items.flatMap((i) => (i.kind === 'tool' ? [`${i.title}:${i.status}`] : []))
    expect(statuses).toEqual(['ancien:pending', 'a:cancelled', 'b:cancelled', 'c:completed'])
  })

  it('arrêt de l’agent : avis d’erreur avec le détail', () => {
    const items = run({
      type: 'status',
      snapshot: {
        status: 'exited',
        detail: 'Sortie : code 1.',
        info: { profileId: 'mock', profileLabel: 'Agent factice', workspace: '/tmp' },
        controls: [],
        commands: [],
        promptCapabilities: { image: false, embeddedContext: false },
        queued: []
      }
    })
    expect(items[0]).toMatchObject({ kind: 'notice', level: 'error' })
    expect(items[0]?.kind === 'notice' && noticeText(items[0])).toBe(
      'L’agent s’est arrêté. Sortie\u00a0: code 1.'
    )
  })

  it('permission : attachée à l’outil existant, puis résolue avec le nom de l’option', () => {
    const options = [
      { optionId: 'ok', name: 'Autoriser', kind: 'allow_once' as const },
      { optionId: 'non', name: 'Refuser', kind: 'reject_once' as const }
    ]
    const items = run(
      update({ sessionUpdate: 'tool_call', toolCallId: 't1', title: 'Éditer', kind: 'edit' }),
      { type: 'permission-request', requestId: 'p1', toolCall: { toolCallId: 't1' }, options },
      { type: 'permission-resolved', requestId: 'p1', optionId: 'non' }
    )
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      title: 'Éditer',
      permission: {
        requestId: 'p1',
        state: { optionId: 'non', name: 'Refuser', kind: 'reject_once' }
      }
    })
  })

  it('permission retirée par l’agent (fiche 214) : la carte disparaît, l’outil garde son état ; Stop : annulée', () => {
    const options = [{ optionId: 'ok', name: 'Autoriser', kind: 'allow_once' as const }]
    const ask = (id: string): AgentEvent => ({
      type: 'permission-request',
      requestId: id,
      toolCall: { toolCallId: `t-${id}`, title: 'Éditer' },
      options
    })
    const done = (id: string): AgentEvent =>
      update({ sessionUpdate: 'tool_call_update', toolCallId: `t-${id}`, status: 'completed' })
    const [byAgent, byStop] = run(
      ask('p1'),
      ask('p2'),
      { type: 'permission-resolved', requestId: 'p1', optionId: null, cancelledBy: 'agent' },
      done('p1'),
      { type: 'permission-resolved', requestId: 'p2', optionId: null }
    )
    expect(byAgent).toMatchObject({ kind: 'tool', status: 'completed' })
    expect(byAgent).not.toHaveProperty('permission')
    expect(byStop).toMatchObject({ permission: { state: 'cancelled' } })
  })

  it('liste de tâches (Bob 2.0.9) : rawInput.todos lu pour toute carte, gardé aux mises à jour', () => {
    const options = [{ optionId: 'ok', name: 'Autoriser', kind: 'allow_once' as const }]
    const items = run(
      {
        type: 'permission-request',
        requestId: 'p1',
        toolCall: {
          toolCallId: 't1',
          title: 'Updating todo list',
          kind: 'other',
          rawInput: { todos: '[x] Lire\n[-] Tester\n[ ] Livrer' }
        },
        options
      },
      update({ sessionUpdate: 'tool_call_update', toolCallId: 't1', status: 'completed' })
    )
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      kind: 'tool',
      status: 'completed',
      todos: [
        { text: 'Lire', state: 'completed' },
        { text: 'Tester', state: 'in_progress' },
        { text: 'Livrer', state: 'pending' }
      ]
    })
  })

  it('liste de tâches annoncée par tool_call : lue ; sans todos, pas de champ', () => {
    const [withTodos, without] = run(
      update({
        sessionUpdate: 'tool_call',
        toolCallId: 'a',
        title: 'Peu importe',
        rawInput: { todos: ['Une', { content: 'Deux', status: 'completed' }] }
      }),
      update({
        sessionUpdate: 'tool_call',
        toolCallId: 'b',
        title: 'Lire',
        rawInput: { path: 'x' }
      })
    )
    expect(withTodos).toMatchObject({
      todos: [
        { text: 'Une', state: 'pending' },
        { text: 'Deux', state: 'completed' }
      ]
    })
    expect(without).not.toHaveProperty('todos')
  })

  it('permission arrivée avant le tool_call (Bob 2.0.9) : son diff reste, la carte garde la question', () => {
    const diff = { type: 'diff' as const, path: '/p/a.txt', oldText: null, newText: 'bonjour' }
    const options = [{ optionId: 'ok', name: 'Autoriser', kind: 'allow_once' as const }]
    const items = run(
      {
        type: 'permission-request',
        requestId: 'p1',
        toolCall: { toolCallId: 't1', kind: 'edit', content: [diff] },
        options
      },
      update({
        sessionUpdate: 'tool_call',
        toolCallId: 't1',
        title: 'Writing file /p/a.txt',
        kind: 'edit',
        status: 'pending',
        locations: [{ path: '/p/a.txt' }]
      })
    )
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      title: 'Writing file /p/a.txt',
      content: [diff],
      locations: [{ path: '/p/a.txt' }],
      permission: { requestId: 'p1', state: 'pending' }
    })
  })

  it('plan à valider porté par rawInput.plan (cas réel Codex) ; réponse au formulaire conservée', () => {
    const options = [
      { optionId: 'go', name: 'Yes, implement this plan', kind: 'allow_once' as const }
    ]
    const items = run(
      {
        type: 'permission-request',
        requestId: 'p1',
        toolCall: {
          toolCallId: 'plan-review:1',
          kind: 'switch_mode',
          title: 'Implement this plan?',
          rawInput: { plan: '1. Faire.' }
        },
        options
      },
      {
        type: 'elicitation-request',
        requestId: 'e1',
        prompt: { mode: 'form', message: 'm', schema: { type: 'object', properties: {} } }
      },
      { type: 'elicitation-resolved', requestId: 'e1', action: 'accept', content: { a: 'b' } }
    )
    expect(items[0]).toMatchObject({ toolKind: 'switch_mode', plan: '1. Faire.' })
    expect(items[1]).toMatchObject({ state: 'accept', content: { a: 'b' } })
  })

  it('consommation : usage_update + usage du tour, conservée au rejeu (reset)', () => {
    const state = [
      update({ sessionUpdate: 'usage_update', used: 1200, size: 200000 }),
      {
        type: 'turn-end',
        stopReason: 'end_turn',
        usage: { inputTokens: 1000, outputTokens: 200, totalTokens: 1200 }
      } as AgentEvent,
      { type: 'reset' } as AgentEvent,
      text('rejoué')
    ].reduce(reduceTranscript, emptyTranscript)
    expect(state.usage).toMatchObject({
      context: { used: 1200, size: 200000 },
      tokens: { total: 1200, turns: 1 }
    })
    expect(state.items).toHaveLength(1)
  })

  it('coût obtenu hors protocole (usage-report) : remplace le coût, garde le reste', () => {
    const state = [
      update({ sessionUpdate: 'usage_update', used: 10, size: 100 }),
      { type: 'usage-report', cost: { amount: 0.02, currency: 'bobcoins' } } as AgentEvent
    ].reduce(reduceTranscript, emptyTranscript)
    expect(state.usage).toEqual({
      context: { used: 10, size: 100 },
      cost: { amount: 0.02, currency: 'bobcoins' }
    })
  })

  it('une ligne par tour (fiche 109) : envoi, coût annoncé, fin ou échec ; gardée au rejeu', () => {
    const usd = (amount: number) => ({ amount, currency: 'USD' })
    const state = [
      { type: 'user-message', text: 'un' } as AgentEvent,
      update({ sessionUpdate: 'usage_update', used: 10, size: 100, cost: usd(0.01) }),
      {
        type: 'turn-end',
        at: 1000,
        stopReason: 'end_turn',
        usage: { inputTokens: 8, outputTokens: 2, totalTokens: 10 }
      } as AgentEvent,
      { type: 'user-message', text: 'deux' } as AgentEvent,
      { type: 'turn-error', message: 'Panne' } as AgentEvent,
      // Coût relu après coup (Bob) : revient au tour qui vient de finir.
      { type: 'usage-report', cost: usd(0.015) } as AgentEvent,
      { type: 'reset' } as AgentEvent
    ].reduce(reduceTranscript, emptyTranscript)
    expect(state.usage?.turns).toEqual([
      { at: 1000, input: 8, output: 2, total: 10, costEnd: 0.01 },
      { costStart: 0.01, costEnd: 0.015 }
    ])
    expect(state.usage?.pending).toBeUndefined()
  })

  it('tentative ratée (fiche 142) : ses outils interrompus, le tour ouvert, sans avis', () => {
    const state = [
      { type: 'user-message', text: 'un' } as AgentEvent,
      update({
        sessionUpdate: 'tool_call',
        toolCallId: 'lire',
        title: 'read',
        kind: 'read',
        status: 'in_progress'
      }),
      { type: 'attempt-failed' } as AgentEvent
    ].reduce(reduceTranscript, emptyTranscript)
    expect(state.items.find((i) => i.kind === 'tool')).toMatchObject({ status: 'cancelled' })
    expect(state.items.some((i) => i.kind === 'notice')).toBe(false)
    expect(state.usage?.pending).toBeDefined()
  })

  it('agent arrêté en plein tour (fiche 139) : le tour est compté, rien ne reste ouvert', () => {
    const usd = (amount: number) => ({ amount, currency: 'USD' })
    const snapshot = { status: 'exited', detail: 'code 3' } as unknown as AgentSnapshot
    const state = [
      update({ sessionUpdate: 'usage_update', used: 10, size: 100, cost: usd(0.01) }),
      { type: 'user-message', text: 'un' } as AgentEvent,
      { type: 'status', snapshot } as AgentEvent,
      // Coût relu après coup (Bob) : revient au tour en panne.
      { type: 'usage-report', cost: usd(0.02) } as AgentEvent
    ].reduce(reduceTranscript, emptyTranscript)
    expect(state.usage?.pending).toBeUndefined()
    expect(state.usage?.turns).toEqual([{ costStart: 0.01, costEnd: 0.02 }])
  })

  it('pièces jointes : message envoyé, puis rejoué (image et fichiers rattachés au message)', () => {
    const sent = run({
      type: 'user-message',
      text: 'Regarde',
      attachments: [{ kind: 'file', name: 'notes.md', path: '/p/notes.md' }]
    })
    expect(sent[0]).toMatchObject({ kind: 'user', attachments: [{ name: 'notes.md' }] })
    const replayed = run(
      update({ sessionUpdate: 'user_message_chunk', content: { type: 'text', text: 'Regarde' } }),
      update({
        sessionUpdate: 'user_message_chunk',
        content: { type: 'image', mimeType: 'image/png', data: 'AA==' }
      }),
      update({
        sessionUpdate: 'user_message_chunk',
        content: { type: 'resource', resource: { uri: 'file:///p/mes%20notes.md', text: '#' } }
      }),
      update({
        sessionUpdate: 'user_message_chunk',
        content: { type: 'resource_link', uri: 'file:///p/gros.log', name: 'gros.log' }
      })
    )
    expect(replayed).toHaveLength(1)
    expect(replayed[0]).toMatchObject({
      kind: 'user',
      text: 'Regarde',
      attachments: [
        { kind: 'image', mimeType: 'image/png' },
        { kind: 'file', name: 'mes notes.md' },
        { kind: 'file', name: 'gros.log' }
      ]
    })
  })

  it('sortie de commande (extension de terminal) : morceaux cumulés, code de sortie', () => {
    const state = [
      update({
        sessionUpdate: 'tool_call',
        toolCallId: 'exec-1',
        title: 'echo bonjour',
        kind: 'execute',
        status: 'in_progress',
        content: [{ type: 'terminal', terminalId: 'exec-1' }],
        _meta: { terminal_info: { terminal_id: 'exec-1' } }
      }),
      update({
        sessionUpdate: 'tool_call_update',
        toolCallId: 'exec-1',
        _meta: { terminal_output_delta: { terminal_id: 'exec-1', data: 'bon' } }
      }),
      update({
        sessionUpdate: 'tool_call_update',
        toolCallId: 'exec-1',
        status: 'completed',
        _meta: {
          terminal_output_delta: { terminal_id: 'exec-1', data: 'jour\n' },
          terminal_exit: { terminal_id: 'exec-1', exit_code: 0, signal: null }
        }
      })
    ].reduce(reduceTranscript, emptyTranscript)
    expect(state.items[0]).toMatchObject({
      kind: 'tool',
      terminalId: 'exec-1',
      status: 'completed'
    })
    expect(state.terminals?.['exec-1']).toEqual({
      output: 'bonjour\n',
      exitCode: 0,
      signal: null,
      exited: true
    })
  })

  it('question ask_user : reste ouverte après la fin du tour (réponse tardive possible)', () => {
    const schema = { type: 'object' as const, properties: {} }
    const items = run(
      { type: 'user-message', text: 'Go' },
      {
        type: 'elicitation-request',
        requestId: 'e1',
        prompt: { mode: 'form', message: 'Q', schema, outlivesTurn: true }
      },
      {
        type: 'elicitation-request',
        requestId: 'e2',
        prompt: { mode: 'form', message: 'R', schema }
      },
      { type: 'turn-end', stopReason: 'end_turn' }
    )
    expect(
      items.filter((i) => i.kind === 'elicitation').map((i) => i.kind === 'elicitation' && i.state)
    ).toEqual(['pending', 'cancel'])
  })

  it('compaction : élément créé, résumé en morceaux, statut mis à jour', () => {
    const items = run(
      update({ sessionUpdate: 'compaction_update', compactionId: 'c1', status: 'in_progress' }),
      update({
        sessionUpdate: 'compaction_summary_chunk',
        compactionId: 'c1',
        content: { type: 'text', text: 'Résumé ' }
      }),
      update({
        sessionUpdate: 'compaction_summary_chunk',
        compactionId: 'c1',
        content: { type: 'text', text: 'complet.' }
      }),
      update({ sessionUpdate: 'compaction_update', compactionId: 'c1', status: 'completed' })
    )
    expect(items).toEqual([
      {
        kind: 'compaction',
        id: 1,
        compactionId: 'c1',
        status: 'completed',
        summary: 'Résumé complet.'
      }
    ])
  })

  it('réponse en texte à la commande de compaction : carte « Conversation résumée » (fiche 126)', () => {
    const items = run(
      { type: 'user-message', text: '/compress', compaction: true },
      text('Compressing context…\n\n## Résumé\n- fait'),
      { type: 'turn-end', stopReason: 'end_turn' }
    )
    expect(items.map((i) => i.kind)).toEqual(['user', 'compaction'])
    expect(items[1]).toMatchObject({
      status: 'completed',
      summary: 'Compressing context…\n\n## Résumé\n- fait'
    })
  })

  it('compaction annoncée par l’agent : son texte reste un message (fiche 126)', () => {
    const items = run(
      { type: 'user-message', text: '/compact', compaction: true },
      update({ sessionUpdate: 'compaction_update', compactionId: 'c1', status: 'completed' }),
      text('Fait.'),
      { type: 'turn-end', stopReason: 'end_turn' }
    )
    expect(items.map((i) => i.kind)).toEqual(['user', 'compaction', 'agent'])
    // Sans la marque de l'hôte, un message reste un message (fiche 140).
    const other = run({ type: 'user-message', text: '/compress' }, text('Non.'), {
      type: 'turn-end',
      stopReason: 'end_turn'
    })
    expect(other.map((i) => i.kind)).toEqual(['user', 'agent'])
  })

  it('outil arrêté par l’utilisateur : interrompu, pas en échec (fiche 126)', () => {
    const started = (id: string) =>
      update({ sessionUpdate: 'tool_call', toolCallId: id, title: id, status: 'in_progress' })
    const failed = (id: string) =>
      update({ sessionUpdate: 'tool_call_update', toolCallId: id, status: 'failed' })
    const items = run(
      { type: 'user-message', text: 'Go' },
      started('avant'),
      failed('avant'),
      started('patch'),
      { type: 'cancel-requested' },
      failed('patch'),
      { type: 'turn-end', stopReason: 'cancelled' },
      { type: 'user-message', text: 'Encore' },
      started('apres'),
      failed('apres')
    )
    const status = (id: string) =>
      items.find((i) => i.kind === 'tool' && i.toolCallId === id)?.kind === 'tool'
        ? (items.find((i) => i.kind === 'tool' && i.toolCallId === id) as { status: string }).status
        : undefined
    expect([status('avant'), status('patch'), status('apres')]).toEqual([
      'failed',
      'cancelled',
      'failed'
    ])
  })

  it('permission : ne remplace pas le titre précis de la carte (cas réel Codex)', () => {
    const items = run(
      update({
        sessionUpdate: 'tool_call',
        toolCallId: 'exec-1',
        title: "printf 'Bonjour Bob\\n' > hello.txt",
        kind: 'execute',
        status: 'in_progress'
      }),
      {
        type: 'permission-request',
        requestId: 'p1',
        toolCall: {
          toolCallId: 'exec-1',
          title: 'Run command',
          kind: 'execute',
          status: 'pending'
        },
        options: [{ optionId: 'allow_once', name: 'Yes, proceed', kind: 'allow_once' }]
      }
    )
    expect(items[0]).toMatchObject({
      title: "printf 'Bonjour Bob\\n' > hello.txt",
      permission: { state: 'pending' }
    })
  })

  it('permission reçue AVANT le tool_call correspondant : la permission est conservée', () => {
    const items = run(
      { type: 'user-message', text: 'Go' },
      {
        type: 'permission-request',
        requestId: 'p1',
        toolCall: { toolCallId: 't1' },
        options: [{ optionId: 'ok', name: 'Autoriser', kind: 'allow_once' }]
      },
      update({ sessionUpdate: 'tool_call', toolCallId: 't1', title: 'Éditer', kind: 'edit' })
    )
    expect(items.filter((i) => i.kind === 'tool')).toHaveLength(1)
    expect(items[1]).toMatchObject({
      title: 'Éditer',
      permission: { requestId: 'p1', state: 'pending' }
    })
  })

  it('commande entière gardée : demande, tool_call sans rawInput, mise à jour (0.11, M1)', () => {
    const long = `${'echo a && '.repeat(40)}\nwc -l gros.txt`
    const items = run(
      { type: 'user-message', text: 'Go' },
      {
        type: 'permission-request',
        requestId: 'p1',
        toolCall: { toolCallId: 't1', rawInput: { command: long, cwd: '/tmp/x' } },
        options: [{ optionId: 'ok', name: 'Autoriser', kind: 'allow_once' }]
      },
      update({ sessionUpdate: 'tool_call', toolCallId: 't1', title: 'Shell', kind: 'execute' }),
      update({ sessionUpdate: 'tool_call_update', toolCallId: 't1', status: 'completed' })
    )
    expect(items[1]).toMatchObject({ command: { text: long, cwd: '/tmp/x' } })
  })

  it('permission sur un outil inconnu : crée l’outil ; annulée en fin de tour', () => {
    const items = run(
      { type: 'user-message', text: 'Go' },
      {
        type: 'permission-request',
        requestId: 'p1',
        toolCall: { toolCallId: 'x', title: 'Commande', kind: 'execute' },
        options: []
      },
      { type: 'turn-end', stopReason: 'cancelled' }
    )
    expect(items[1]).toMatchObject({
      kind: 'tool',
      title: 'Commande',
      permission: { state: 'cancelled' }
    })
  })

  it('permission-resolved inconnue : sans effet', () => {
    const items = run(text('a'), { type: 'permission-resolved', requestId: 'zzz', optionId: null })
    expect(items).toHaveLength(1)
  })

  it('élicitation : demandée, puis résolue ; en attente à la fin du tour → annulée', () => {
    const prompt = { mode: 'url' as const, message: 'Connecte-toi', url: 'https://example.com' }
    const answered = run(
      { type: 'elicitation-request', requestId: 'e1', prompt },
      { type: 'elicitation-resolved', requestId: 'e1', action: 'accept' }
    )
    expect(answered[0]).toMatchObject({ kind: 'elicitation', requestId: 'e1', state: 'accept' })
    const abandoned = run(
      { type: 'user-message', text: 'Go' },
      { type: 'elicitation-request', requestId: 'e2', prompt },
      { type: 'turn-end', stopReason: 'cancelled' }
    )
    expect(abandoned[1]).toMatchObject({ state: 'cancel' })
  })

  it('rejeu (session/load) : les messages de l’utilisateur sont reconstruits', () => {
    const items = run(
      update({ sessionUpdate: 'user_message_chunk', content: { type: 'text', text: 'Ma ' } }),
      update({ sessionUpdate: 'user_message_chunk', content: { type: 'text', text: 'question' } }),
      text('Réponse')
    )
    expect(items.map((i) => [i.kind, 'text' in i ? i.text : ''])).toEqual([
      ['user', 'Ma question'],
      ['agent', 'Réponse']
    ])
  })

  it('reset vide le fil', () => {
    expect(
      run({ type: 'user-message', text: 'Salut' }, text('Bonjour'), { type: 'reset' })
    ).toEqual([])
  })

  it('ignore les updates non gérées (modes, sous-agents…)', () => {
    expect(run(update({ sessionUpdate: 'current_mode_update', currentModeId: 'ask' }))).toEqual([])
  })
})

describe('départ d’un worktree (fiche 117)', () => {
  it('un seul élément, avec ce que dit l’app ; les anciens avis restent lisibles', () => {
    const start = {
      branch: 'main',
      commit: 'e6ee04c0000000000000000000000000000000000',
      date: '2026-10-22T08:17:00.000Z',
      subject: 'Merge fiche 114',
      dirty: 4
    }
    expect(run({ type: 'worktree-start', start })).toEqual([
      { kind: 'worktree-start', id: 1, ...start }
    ])
    const old = run({
      type: 'notice',
      level: 'warning',
      message: { key: 'worktrees.notice.dirty', params: { count: 4 } }
    })[0]
    expect(old?.kind === 'notice' && noticeText(old)).toBe(
      '4 modifications non commitées du dossier d’origine ne sont pas dans ce worktree.'
    )
  })
})

describe('préparation du worktree (fiche 175)', () => {
  it('un seul élément, remplacé à chaque étape', () => {
    const items = run(
      { type: 'worktree-setup', setup: { command: 'pnpm i', state: 'running' } },
      { type: 'notice', level: 'info', message: 'entre deux' },
      { type: 'worktree-setup', setup: { command: 'pnpm i', state: 'done', output: 'ok' } }
    )
    expect(items).toEqual([
      { kind: 'worktree-setup', id: 1, command: 'pnpm i', state: 'done', output: 'ok' },
      expect.objectContaining({ kind: 'notice', id: 2 })
    ])
  })
})

describe('settleTranscript (fil relu du disque, fiche 041)', () => {
  it('outils en cours interrompus, permissions et questions en attente annulées', () => {
    const events: AgentEvent[] = [
      { type: 'user-message', text: 'Vas-y' },
      {
        type: 'update',
        update: {
          sessionUpdate: 'tool_call',
          toolCallId: 't1',
          title: 'Compiler',
          status: 'in_progress'
        }
      },
      {
        type: 'permission-request',
        requestId: 'p1',
        toolCall: { toolCallId: 't2', title: 'Écrire', status: 'pending' },
        options: [{ optionId: 'allow', name: 'Autoriser', kind: 'allow_once' }]
      },
      {
        type: 'elicitation-request',
        requestId: 'e1',
        prompt: {
          mode: 'form',
          message: 'Choix ?',
          schema: { type: 'object', properties: {} },
          outlivesTurn: true
        }
      }
    ]
    const saved = events.reduce(reduceTranscript, emptyTranscript)
    const settled = settleTranscript(saved).items
    expect(settled.find((i) => i.kind === 'tool' && i.toolCallId === 't1')).toMatchObject({
      status: 'cancelled'
    })
    expect(settled.find((i) => i.kind === 'tool' && i.toolCallId === 't2')).toMatchObject({
      status: 'cancelled',
      permission: { state: 'cancelled' }
    })
    expect(settled.find((i) => i.kind === 'elicitation')).toMatchObject({ state: 'cancel' })
  })

  it('fil déjà terminé : rendu tel quel', () => {
    const saved = [
      { type: 'user-message', text: 'Bonjour' },
      { type: 'turn-end', stopReason: 'end_turn' }
    ].reduce((s, e) => reduceTranscript(s, e as AgentEvent), emptyTranscript)
    expect(settleTranscript(saved)).toBe(saved)
  })
})

describe('modèle du message (fiche 130)', () => {
  it('le message et son tour gardent le modèle de la session à l’envoi', () => {
    const model = { id: 'factice-precis', name: 'Factice précis' }
    const state = [
      { type: 'user-message', text: 'Salut', model, at: 1 } as AgentEvent,
      { type: 'turn-end', stopReason: 'end_turn', at: 2 } as AgentEvent
    ].reduce(reduceTranscript, emptyTranscript)
    expect(state.items[0]).toMatchObject({ kind: 'user', model })
    expect(state.usage?.turns).toEqual([{ at: 2, model }])
  })
})

describe('heure des messages', () => {
  it('message de l’utilisateur à l’envoi, réponses du tour à la fin', () => {
    const items = [
      { type: 'user-message', text: 'Bonjour', at: 1000 },
      {
        type: 'update',
        update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'Salut' } }
      },
      { type: 'turn-end', stopReason: 'end_turn', at: 5000 }
    ].reduce((s, e) => reduceTranscript(s, e as AgentEvent), emptyTranscript).items
    expect(items[0]).toMatchObject({ kind: 'user', at: 1000 })
    expect(items[1]).toMatchObject({ kind: 'agent', at: 5000 })
  })
})

describe('travail d’un sous-agent sous sa carte (OpenCode 2, fiche 078)', () => {
  const card = [
    { type: 'user-message', text: 'Go' } as AgentEvent,
    update({ sessionUpdate: 'tool_call', toolCallId: 'p', title: 'subagent', kind: 'think' }),
    update({
      sessionUpdate: 'tool_call_update',
      toolCallId: 'p',
      status: 'in_progress',
      rawInput: { agent: 'explore', description: 'Lire a.txt', prompt: 'Lis a.txt' },
      _meta: {
        [SUBAGENT_META]: { subagent: { type: 'explore', task: 'Lire a.txt', prompt: 'Lis a.txt' } }
      }
    })
  ]
  const work = (u: SessionUpdate): AgentEvent => ({
    type: 'subagent-update',
    toolCallId: 'p',
    update: u
  })
  const childRead = (status: 'pending' | 'completed'): SessionUpdate => ({
    sessionUpdate: status === 'pending' ? 'tool_call' : 'tool_call_update',
    toolCallId: 'ses_c:read',
    title: 'read',
    kind: 'read',
    status
  })

  it('outils et texte rangés sous la carte, réflexion écartée, rien dans le fil', () => {
    const items = run(
      ...card,
      work({ sessionUpdate: 'agent_thought_chunk', content: { type: 'text', text: 'hmm' } }),
      work(childRead('pending')),
      work(childRead('completed')),
      work({ sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'Mot : ' } }),
      work({ sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'KILO' } }),
      text('Le sous-agent a fini.')
    )
    expect(items.map((i) => i.kind)).toEqual(['user', 'tool', 'agent'])
    const tool = items[1]
    expect(tool).toMatchObject({ subagent: { type: 'explore', task: 'Lire a.txt' } })
    expect(tool?.kind === 'tool' && tool.work).toMatchObject([
      { kind: 'tool', toolCallId: 'ses_c:read', status: 'completed' },
      { kind: 'agent', text: 'Mot : KILO' }
    ])
    // Identifiants uniques dans tout le fil.
    const ids = [...items, ...(tool?.kind === 'tool' ? (tool.work ?? []) : [])].map((i) => i.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('carte inconnue : rien', () => {
    const items = run(text('a'), work(childRead('pending')))
    expect(items).toHaveLength(1)
  })

  it('fin de tour : ses outils inachevés interrompus', () => {
    const [, tool] = run(...card, work(childRead('pending')), {
      type: 'turn-end',
      stopReason: 'cancelled'
    })
    expect(tool?.kind === 'tool' && tool.work?.[0]).toMatchObject({ status: 'cancelled' })
  })

  it('autorisation demandée par un de ses outils : l’outil sort dans le fil, sa suite aussi', () => {
    const items = run(
      ...card,
      work(childRead('pending')),
      {
        type: 'permission-request',
        requestId: 'r1',
        toolCall: { toolCallId: 'ses_c:read', title: 'Lire a.txt: read' },
        options: []
      },
      work(childRead('completed'))
    )
    expect(items.map((i) => i.kind)).toEqual(['user', 'tool', 'tool'])
    expect(items[1]?.kind === 'tool' && items[1].work).toEqual([])
    expect(items[2]).toMatchObject({
      toolCallId: 'ses_c:read',
      status: 'completed',
      permission: { requestId: 'r1', state: 'pending' }
    })
  })

  it('ses modifications de fichiers comptent (récapitulatif, remise en état)', () => {
    const items = run(
      ...card,
      work({
        sessionUpdate: 'tool_call_update',
        toolCallId: 'ses_c:edit',
        title: 'edit',
        kind: 'edit',
        status: 'completed',
        content: [{ type: 'diff', path: '/p/a.txt', oldText: 'a\n', newText: 'b\n' }]
      })
    )
    expect(withSubagentWork(items).map((i) => i.kind === 'tool' && i.toolCallId)).toEqual([
      false,
      'p',
      'ses_c:edit'
    ])
    expect(conversationChanges(items).map((c) => c.path)).toEqual(['/p/a.txt'])
    expect(fileChangesSince(items, 0)).toEqual([
      { path: '/p/a.txt', edits: [{ oldText: 'a\n', newText: 'b\n' }] }
    ])
  })
})
