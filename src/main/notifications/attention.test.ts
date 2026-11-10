import { describe, expect, it } from 'vitest'
import type { AgentEvent, AgentSnapshot } from '@shared/agent'
import type { AttentionDetails, AttentionState } from '@shared/attention'
import { AttentionTracker, excerpt, type AttentionNotice } from './attention'
import { createDockBounce } from './dock-bounce'

function setup() {
  const world = { focused: false, active: 'a', enabled: true, bounce: true, now: 0 }
  const notices: AttentionNotice[] = []
  const withdrawn: string[] = []
  const details: AttentionDetails[] = []
  const states: AttentionState[] = []
  const chimes: string[] = []
  // Rebond du Dock (fiche 101) : le vrai suivi des rebonds, sur un Dock qui note ce qu'on lui demande.
  const bounces: string[] = []
  const dock = createDockBounce({
    dock: {
      bounce: (kind) => bounces.push(kind),
      cancelBounce: () => bounces.push('stop')
    },
    enabled: () => world.bounce,
    now: () => world.now
  })
  const tracker = new AttentionTracker({
    chime: () => chimes.push('son'),
    bounce: (kind) => dock.bounce(kind),
    stopBounce: () => dock.stop(),
    isFocused: () => world.focused,
    shownIds: () => [world.active],
    describe: (id) => ({ title: `Conversation ${id}`, agent: 'IBM Bob', workspace: '/p/livres' }),
    enabled: () => world.enabled,
    notify: (notice) => notices.push(notice),
    withdraw: (id) => withdrawn.push(id),
    now: () => world.now,
    emit: (state, detail) => {
      states.push(state)
      details.push(detail)
    }
  })
  return { world, tracker, notices, withdrawn, details, states, chimes, bounces }
}

const text = (t: string): AgentEvent => ({
  type: 'update',
  update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: t } }
})
const turnEnd: AgentEvent = { type: 'turn-end', stopReason: 'end_turn' }
const permission = (requestId: string): AgentEvent => ({
  type: 'permission-request',
  requestId,
  toolCall: { toolCallId: 't1', title: 'Modification de config.json' },
  options: []
})
const status = (snapshot: Partial<AgentSnapshot>): AgentEvent => ({
  type: 'status',
  snapshot: snapshot as AgentSnapshot
})

describe('AttentionTracker', () => {
  it('fin de tour hors de la fenêtre : notification avec la fin de la réponse, pastille', () => {
    const { tracker, notices, states } = setup()
    tracker.onEvent('a', { type: 'user-message', text: 'salut' })
    tracker.onEvent('a', text('Je regarde. '))
    tracker.onEvent('a', text('**Terminé**, tout passe.'))
    tracker.onEvent('a', turnEnd)
    expect(notices).toEqual([
      {
        conversationId: 'a',
        kind: 'done',
        reason: 'done',
        conversationTitle: 'Conversation a',
        title: 'IBM Bob · Conversation a',
        body: 'Je regarde. Terminé, tout passe.'
      }
    ])
    expect(states.at(-1)).toEqual({ a: 'done' })
  })

  it('conversation affichée et fenêtre au premier plan : rien', () => {
    const { world, tracker, notices, states } = setup()
    world.focused = true
    tracker.onEvent('a', turnEnd)
    expect(notices).toEqual([])
    expect(states).toEqual([])
  })

  it('autre conversation, fenêtre au premier plan : pastille sans notification', () => {
    const { world, tracker, notices } = setup()
    world.focused = true
    tracker.onEvent('b', turnEnd)
    expect(notices).toEqual([])
    expect(tracker.state()).toEqual({ b: 'done' })
  })

  it('vue en revenant dans la fenêtre : la pastille et les notifications disparaissent', () => {
    const { world, tracker, withdrawn, states } = setup()
    tracker.onEvent('a', turnEnd)
    world.focused = true
    tracker.refresh()
    expect(tracker.state()).toEqual({})
    expect(states.at(-1)).toEqual({})
    expect(withdrawn).toEqual(['a'])
  })

  it('une demande reste en attente tant qu’elle n’est pas traitée, même vue', () => {
    const { world, tracker, notices } = setup()
    tracker.onEvent('a', permission('p1'))
    expect(notices[0]).toMatchObject({
      kind: 'request',
      body: 'Demande une autorisation\u00a0: Modification de config.json'
    })
    world.focused = true
    tracker.refresh()
    expect(tracker.state()).toEqual({ a: 'request' })
    tracker.onEvent('a', { type: 'permission-resolved', requestId: 'p1', optionId: 'allow' })
    expect(tracker.state()).toEqual({})
  })

  it('question et connexion requise sont des demandes', () => {
    const { tracker, notices } = setup()
    tracker.onEvent('a', {
      type: 'elicitation-request',
      requestId: 'e1',
      prompt: { mode: 'url', message: 'Connectez-vous\n  à IBM', url: 'https://x' }
    })
    tracker.onEvent(
      'b',
      status({
        status: 'needs-action',
        blocker: { kind: 'auth', methods: [], authenticating: false }
      })
    )
    tracker.onEvent(
      'b',
      status({
        status: 'needs-action',
        blocker: { kind: 'auth', methods: [], authenticating: true }
      })
    )
    expect(notices.map((n) => n.body)).toEqual([
      'Pose une question\u00a0: Connectez-vous à IBM',
      'Attend que vous vous connectiez.'
    ])
    expect(tracker.state()).toEqual({ a: 'request', b: 'request' })
    tracker.onEvent('b', status({ status: 'ready' }))
    expect(tracker.state()).toEqual({ a: 'request' })
  })

  it('fenêtre de l’app (« Enregistrer sous », boîte d’une page) : la conversation attend (fiche 097)', () => {
    const { tracker, notices } = setup()
    tracker.onEvent('f', { type: 'waiting-user', key: 'save-1', waiting: true, reason: 'save' })
    tracker.onEvent('f', {
      type: 'waiting-user',
      key: 'dialog-onglet-1',
      waiting: true,
      reason: 'page-dialog'
    })
    expect(tracker.state()).toEqual({ f: 'request' })
    expect(notices.map((n) => n.body)).toEqual([
      'Un téléchargement attend votre réponse («\u00a0Enregistrer sous\u00a0»).',
      'Une page du navigateur attend votre réponse.'
    ])
    tracker.onEvent('f', { type: 'waiting-user', key: 'save-1', waiting: false, reason: 'save' })
    expect(tracker.state()).toEqual({ f: 'request' })
    tracker.onEvent('f', {
      type: 'waiting-user',
      key: 'dialog-onglet-1',
      waiting: false,
      reason: 'page-dialog'
    })
    expect(tracker.state()).toEqual({})
  })

  it('tour interrompu par l’utilisateur : rien ; erreur : notifiée', () => {
    const { tracker, notices } = setup()
    tracker.onEvent('a', { type: 'turn-end', stopReason: 'cancelled' })
    expect(notices).toEqual([])
    tracker.onEvent('a', { type: 'turn-error', message: 'Agent arrêté' })
    expect(notices[0]).toMatchObject({ kind: 'error', body: 'Erreur\u00a0: Agent arrêté' })
    expect(tracker.state()).toEqual({ a: 'error' })
  })

  it('un nouveau message efface la réponse non lue', () => {
    const { tracker } = setup()
    tracker.onEvent('a', turnEnd)
    tracker.onEvent('a', { type: 'user-message', text: 'encore' })
    expect(tracker.state()).toEqual({})
  })

  it('réglage coupé : pas de notification, les pastilles restent', () => {
    const { world, tracker, notices, states } = setup()
    world.enabled = false
    tracker.onEvent('a', turnEnd)
    expect(notices).toEqual([])
    expect(tracker.state()).toEqual({ a: 'done' })
    world.enabled = true
    tracker.settingsChanged()
    // Le compteur du Dock suit le nouvel état (fiche 119).
    expect(states.at(-1)).toEqual({ a: 'done' })
  })

  it('ce qu’attend chaque conversation : raison, détail, depuis quand (fiche 119)', () => {
    const { world, tracker, details } = setup()
    world.now = 1000
    tracker.onEvent('a', permission('p1'))
    world.now = 2000
    tracker.onEvent('a', {
      type: 'elicitation-request',
      requestId: 'e1',
      prompt: { mode: 'url', message: 'OAuth ou\n mot de passe ?', url: 'https://x' }
    })
    tracker.onEvent('b', {
      type: 'elicitation-request',
      requestId: 'e2',
      prompt: { mode: 'url', message: 'OAuth ou\n mot de passe ?', url: 'https://x' }
    })
    world.now = 3000
    tracker.onEvent('c', { type: 'turn-error', message: 'boom' })
    tracker.onEvent(
      'd',
      status({
        status: 'needs-action',
        blocker: { kind: 'auth', methods: [], authenticating: false }
      })
    )
    expect(tracker.details()).toEqual({
      a: { reason: 'permission', detail: 'Modification de config.json', since: 1000 },
      b: { reason: 'question', detail: 'OAuth ou mot de passe ?', since: 2000 },
      c: { reason: 'error', since: 3000 },
      d: { reason: 'auth', since: 3000 }
    })
    // L'autorisation traitée : la question reste, avec son détail.
    tracker.onEvent('a', { type: 'permission-resolved', requestId: 'p1', optionId: 'allow' })
    expect(details.at(-1)?.['a']).toEqual({
      reason: 'question',
      detail: 'OAuth ou mot de passe ?',
      since: 2000
    })
  })

  it('titres bruts de l’agent : libellé lisible, chemins relatifs (fiche 125)', () => {
    const { tracker, notices } = setup()
    const ask = (requestId: string, toolCall: Record<string, unknown>): AgentEvent => ({
      type: 'permission-request',
      requestId,
      toolCall: { toolCallId: requestId, ...toolCall },
      options: []
    })
    // Comme Bob 2.0.6 : titre anglais, chemin absolu, commande précédée d'un `cd` vers le dossier.
    tracker.onEvent(
      'a',
      ask('p1', {
        title: 'Applying diff to /p/livres/src/books.js',
        kind: 'edit',
        rawInput: { path: '/p/livres/src/books.js' }
      })
    )
    tracker.onEvent(
      'b',
      ask('p2', {
        title: 'cd /p/livres && npm test 2>&1',
        kind: 'execute',
        rawInput: { command: 'cd /p/livres && npm test 2>&1' }
      })
    )
    tracker.onEvent(
      'c',
      ask('p3', { title: 'Updating todo list', kind: 'other', rawInput: { todos: '[ ] a\n[ ] b' } })
    )
    expect(Object.values(tracker.details()).map((d) => d.detail)).toEqual([
      'Modification de src/books.js',
      'npm test 2>&1',
      'Mise à jour de la liste de tâches (2)'
    ])
    expect(notices[0]?.body).toBe('Demande une autorisation\u00a0: Modification de src/books.js')
  })

  it('questionnaire : la première question plutôt que « Questions » (fiche 119)', () => {
    const { tracker } = setup()
    tracker.onEvent('a', {
      type: 'elicitation-request',
      requestId: 'e1',
      prompt: {
        mode: 'form',
        message: 'Questions',
        schema: {
          type: 'object',
          properties: {
            q0: {
              type: 'string',
              title: 'Langage',
              description: 'Quel langage préfères-tu ?',
              oneOf: [
                { const: 'Rust', title: 'Rust' },
                { const: 'Go', title: 'Go' }
              ]
            }
          }
        } as never
      }
    })
    expect(tracker.details()['a']).toMatchObject({
      reason: 'question',
      detail: 'Quel langage préfères-tu ?'
    })
  })

  it('bannières groupées : trois fins rapprochées, une bannière, un seul rebond (fiche 119)', () => {
    const notices: AttentionNotice[] = []
    const bounces: string[] = []
    const pending: (() => void)[] = []
    const tracker = new AttentionTracker({
      isFocused: () => false,
      shownIds: () => [],
      describe: (id) => ({ title: `Fille ${id}`, agent: 'IBM Bob', child: true }),
      enabled: () => true,
      notify: (notice) => notices.push(notice),
      withdraw: () => {},
      bounce: (kind) => bounces.push(kind),
      groups: {
        schedule: (run) => {
          pending.push(run)
          return () => {}
        }
      },
      emit: () => {}
    })
    for (const id of ['a', 'b', 'c']) tracker.onEvent(id, turnEnd)
    expect(notices).toEqual([])
    expect(bounces).toEqual(['informational'])
    for (const run of pending) run()
    expect(notices).toHaveLength(1)
    expect(notices[0]).toMatchObject({
      title: '3 conversations filles ont fini',
      body: 'Fille a, Fille b, Fille c'
    })
  })

  it('conversation supprimée : oubliée', () => {
    const { tracker, withdrawn } = setup()
    tracker.onEvent('a', turnEnd)
    tracker.forget('a')
    expect(tracker.state()).toEqual({})
    expect(withdrawn).toContain('a')
  })
})

describe('excerpt', () => {
  it('retire le Markdown visible et garde la fin d’une longue réponse', () => {
    expect(excerpt('# Titre\n```ts\ncode\n```\nVoir [la doc](https://x) et `pnpm dev`.')).toBe(
      'Titre Voir la doc et pnpm dev.'
    )
    const long = `${'a'.repeat(300)} fin.`
    expect(excerpt(long).startsWith('…')).toBe(true)
    expect(excerpt(long).endsWith('fin.')).toBe(true)
    expect(excerpt(long).length).toBeLessThanOrEqual(160)
  })
})

describe('AttentionTracker — son (fiche 068)', () => {
  it('un son pour une action attendue, fenêtre sans focus ; pas pour une réponse finie', () => {
    const { world, tracker, chimes } = setup()
    // Même notifications désactivées : le son a son propre réglage.
    world.enabled = false
    tracker.onEvent('a', permission('r1'))
    expect(chimes).toEqual(['son'])
    tracker.onEvent('b', turnEnd)
    expect(chimes).toEqual(['son'])
    world.focused = true
    tracker.onEvent('b', permission('r2'))
    expect(chimes).toEqual(['son'])
  })
})

describe('AttentionTracker — rebond du Dock (fiche 101)', () => {
  const question: AgentEvent = {
    type: 'elicitation-request',
    requestId: 'e1',
    prompt: { mode: 'form', message: 'Quel dossier ?', schema: { type: 'object', properties: {} } }
  }

  it('réponse finie : un rebond `informational` ; erreur aussi (mêmes moments qu’une notification)', () => {
    const { world, tracker, bounces } = setup()
    tracker.onEvent('a', turnEnd)
    expect(bounces).toEqual(['informational'])
    world.now = 5000
    tracker.onEvent('b', { type: 'turn-error', message: 'Agent arrêté' })
    expect(bounces).toEqual(['informational', 'stop', 'informational'])
    // Interrompu par l'utilisateur : pas de notification, pas de rebond.
    world.now = 10_000
    tracker.onEvent('c', { type: 'turn-end', stopReason: 'cancelled' })
    expect(bounces).toHaveLength(3)
  })

  it('un agent attend : un rebond `critical`, quelle que soit la demande', () => {
    const cases: AgentEvent[] = [
      permission('p1'),
      question,
      status({
        status: 'needs-action',
        blocker: { kind: 'auth', methods: [], authenticating: false }
      }),
      { type: 'waiting-user', key: 'save-1', waiting: true, reason: 'save' },
      { type: 'waiting-user', key: 'dialog-1', waiting: true, reason: 'page-dialog' }
    ]
    for (const event of cases) {
      const { tracker, bounces } = setup()
      tracker.onEvent('a', event)
      expect(bounces, event.type).toEqual(['critical'])
    }
  })

  it('fenêtre au premier plan : pas de rebond', () => {
    const { world, tracker, bounces } = setup()
    world.focused = true
    tracker.onEvent('a', permission('p1'))
    tracker.onEvent('b', turnEnd)
    expect(bounces).toEqual([])
  })

  it('la cloche et le réglage coupent le rebond ; le son, lui, reste', () => {
    const { world, tracker, bounces, chimes } = setup()
    world.enabled = false
    tracker.onEvent('a', permission('p1'))
    expect(bounces).toEqual([])
    expect(chimes).toEqual(['son'])
    world.enabled = true
    world.bounce = false
    tracker.onEvent('b', permission('p2'))
    tracker.onEvent('c', turnEnd)
    expect(bounces).toEqual([])
  })

  it('pas de rafale : plusieurs demandes et réponses rapprochées, un seul rebond en cours', () => {
    const { world, tracker, bounces } = setup()
    tracker.onEvent('a', turnEnd)
    tracker.onEvent('b', turnEnd)
    // Un agent qui attend passe avant une réponse à lire.
    tracker.onEvent('c', permission('p1'))
    world.now = 60_000
    tracker.onEvent('d', permission('p2'))
    tracker.onEvent('e', turnEnd)
    expect(bounces).toEqual(['informational', 'stop', 'critical'])
  })

  it('le retour dans la fenêtre arrête le rebond ; la demande suivante rebondit de nouveau', () => {
    const { world, tracker, bounces } = setup()
    tracker.onEvent('a', permission('p1'))
    tracker.refresh()
    expect(bounces).toEqual(['critical'])
    world.focused = true
    tracker.refresh()
    expect(bounces).toEqual(['critical', 'stop'])
    world.focused = false
    tracker.onEvent('b', permission('p2'))
    expect(bounces).toEqual(['critical', 'stop', 'critical'])
  })
})
