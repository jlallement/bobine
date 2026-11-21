import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { AgentEvent } from '@shared/agent'
import { emptyTranscript, reduceTranscript, type TranscriptItem } from '@shared/transcript'
import type { ConversationUsage } from '@shared/usage'
import { turnTimes } from '@shared/turn-duration'
import { replyFeet, ReplyFoot, sameFoot, type AgentLive, type TurnFacts } from './TurnSummary'

// Mode présentation (fiche 159), réglé par chaque essai.
const presentation = vi.hoisted(() => ({ on: false }))
vi.mock('../../presentation', () => ({ usePresentation: () => presentation.on }))

const edit = (id: number, oldText: string, newText: string): TranscriptItem => ({
  kind: 'tool',
  id,
  toolCallId: `t${id}`,
  title: 'Modifier',
  status: 'completed',
  content: [{ type: 'diff', path: `/p/f${id}.ts`, oldText, newText }],
  locations: []
})

/** Bilans des tours finis (pieds `done`), par réponse. */
function turnFacts(
  items: TranscriptItem[],
  times: ReturnType<typeof turnTimes>,
  usage: ConversationUsage | undefined,
  live: AgentLive
): Map<number, TurnFacts> {
  const facts = new Map<number, TurnFacts>()
  for (const [id, foot] of replyFeet(items, times, usage, live)) {
    if (foot.kind === 'done') facts.set(id, foot.facts)
  }
  return facts
}

/** Agent au repos. */
const IDLE = { busy: false, background: false }

/** Pied d'une réponse qui finit un tour bien fini (fiche 261). */
const renderFoot = (facts: TurnFacts, at?: number) =>
  render(<ReplyFoot foot={{ kind: 'done', facts }} text={() => 'r'} at={at} />)
// Le texte lu (pilote, `innerText` nettoyé) : l'espace insécable devant « · » compte pour une espace.
const footText = () =>
  (screen.getAllByTestId('turn-summary').at(-1)?.textContent ?? '').replace(/\u00a0/g, ' ')

/** Bilan du dernier tour, fini (fiche 185, P4). */
const lastTurnFacts = (items: TranscriptItem[], usage: ConversationUsage | undefined) => {
  const reply = items.findLast((i) => i.kind === 'agent' && turnTimes(items).has(i.id))
  const start = items.findLastIndex((i) => i.kind === 'user')
  if (!reply || items.indexOf(reply) < start) return undefined
  return turnFacts(items, turnTimes(items), usage, IDLE).get(reply.id)
}

describe('fichier écrit sans diff connu (fiche 272)', () => {
  const written = (id: number, path: string): TranscriptItem => ({
    kind: 'tool',
    id,
    toolCallId: `w${id}`,
    title: 'write',
    toolKind: 'edit',
    status: 'completed',
    content: [{ type: 'content', content: { type: 'text', text: 'Wrote file successfully' } }],
    locations: [{ path }]
  })

  it('jamais « +0 −0 » : « sans totaux », seul ou à côté des totaux connus', () => {
    const only: TranscriptItem[] = [
      { kind: 'user', id: 1, text: 'Réécris', at: 0 },
      written(2, '/p/a.js'),
      { kind: 'agent', id: 3, text: 'Fait', at: 2_000 }
    ]
    const facts = lastTurnFacts(only, undefined)
    expect(facts).toMatchObject({ files: 1, unknown: 1 })
    renderFoot(facts as TurnFacts)
    expect(footText()).toContain('1 fichier sans totaux')
    expect(footText()).not.toContain('+0')
    const mixed: TranscriptItem[] = [
      ...only.slice(0, 2),
      edit(4, 'a\n', 'b\n'),
      { kind: 'agent', id: 5, text: 'Fait', at: 2_000 }
    ]
    renderFoot(lastTurnFacts(mixed, undefined) as TurnFacts)
    expect(footText()).toContain('2 fichiers +1 −1 · 1 sans totaux')
  })
})

describe('bilan du dernier tour (fiche 185, P4)', () => {
  const items: TranscriptItem[] = [
    { kind: 'user', id: 1, text: 'avant', at: 1_000 },
    edit(2, 'a\n', 'b\n'),
    { kind: 'agent', id: 3, text: 'fait', at: 3_000 },
    { kind: 'user', id: 4, text: 'encore', at: 10_000 },
    edit(5, 'x\n', 'x\ny\n'),
    edit(6, 'u\n', 'v\n'),
    { kind: 'agent', id: 7, text: 'fini', at: 52_000 }
  ]

  it('durée, fichiers et lignes du seul dernier tour, coût du dernier tour', () => {
    const facts = lastTurnFacts(items, {
      cost: { amount: 0.5, currency: 'USD' },
      turns: [{ at: 52_000, costStart: 0.38, costEnd: 0.5 }]
    })
    expect(facts).toMatchObject({ ms: 42_000, files: 2, added: 2, removed: 1 })
    expect(facts?.cost?.amount).toBeCloseTo(0.12)
  })

  it('réponse hors tour ensuite (fiche 232) : le bilan du tour reste', () => {
    const later: TranscriptItem[] = [...items, { kind: 'agent', id: 8, text: 'hors tour' }]
    expect(lastTurnFacts(later, undefined)).toMatchObject({ ms: 42_000 })
  })

  it('tour sans réponse finie : pas de bilan', () => {
    const open = items.slice(0, 6)
    expect(lastTurnFacts(open, undefined)).toBeUndefined()
  })

  it('coût d’un tour plus ancien : pas repris', () => {
    const facts = lastTurnFacts(items, {
      cost: { amount: 0.5, currency: 'USD' },
      turns: [{ at: 3_000, costStart: 0, costEnd: 0.38 }]
    })
    expect(facts?.cost).toBeUndefined()
  })

  it('un seul pied : « heure · durée · 2 fichiers +2 −1 », sans « Terminé » (fiche 261)', () => {
    // Aujourd'hui à 21:17 : une autre date ajouterait le jour (« 19 nov., 21:17 »).
    const at = new Date().setHours(21, 17, 0, 0)
    renderFoot({ ms: 149_000, files: 2, added: 2, removed: 1 }, at)
    expect(footText()).toBe('21:17 · 2 min 29 s · 2 fichiers +2 −1')
    expect(screen.getAllByTestId('turn-duration')).toHaveLength(1)
    expect(screen.getByTestId('copy-reply')).toBeTruthy()
    expect(footText()).not.toContain('Terminé')
  })

  it('aucun fichier, moins d’une seconde : « < 1 s » seul, ni « 0 fichier » ni montant', () => {
    renderFoot({ ms: 300, files: 0, added: 0, removed: 0 })
    expect(footText()).toBe('< 1 s')
  })

  it('« Travaille encore… » avec un petit indicateur, sans bilan', () => {
    render(<ReplyFoot foot={{ kind: 'working' }} text={() => 'r'} at={undefined} />)
    const foot = screen.getByTestId('turn-working')
    expect(foot.textContent).toBe('Travaille encore…')
    expect(foot.querySelector('.spin')).toBeTruthy()
    expect(screen.queryByTestId('turn-summary')).toBeNull()
    expect(screen.queryByTestId('turn-duration')).toBeNull()
    // Rien à copier encore (revue UX).
    expect(screen.queryByTestId('copy-reply')).toBeNull()
  })

  it('« Travaille encore… · 32 s » : le temps depuis l’envoi du message, qui avance', () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(100_000)
      render(
        <ReplyFoot foot={{ kind: 'working', since: 68_000 }} text={() => 'r'} at={undefined} />
      )
      const foot = screen.getByTestId('turn-working')
      expect(foot.textContent?.replace(/\u00a0/g, ' ')).toBe('Travaille encore… · 32 s')
      act(() => vi.advanceTimersByTime(2_000))
      expect(foot.textContent?.replace(/\u00a0/g, ' ')).toBe('Travaille encore… · 34 s')
    } finally {
      vi.useRealTimers()
    }
  })

  it('tour arrêté, refusé, coupé ou en erreur : pas de « Terminé » sous son avis', () => {
    for (const notice of [
      { level: 'info' as const, message: { key: 'transcript.notice.cancelled' as const } },
      { level: 'info' as const, message: { key: 'transcript.notice.maxTokens' as const } },
      { level: 'error' as const, text: 'boom' }
    ]) {
      const ended: TranscriptItem[] = [...items, { kind: 'notice', id: 8, ...notice }]
      expect(lastTurnFacts(ended, undefined)).toBeUndefined()
    }
  })

  it('mode présentation : pas de montant', () => {
    presentation.on = true
    renderFoot({
      ms: 5_000,
      files: 0,
      added: 0,
      removed: 0,
      cost: { amount: 0.12, currency: 'USD' }
    })
    expect(footText()).not.toContain('≈')
    presentation.on = false
  })

  it('coût en dollars annoncé par l’agent : « ≈ » ; bobcoins de Bob : sans (fiche 245)', () => {
    const facts = { ms: 5_000, files: 0, added: 0, removed: 0 }
    renderFoot({ ...facts, cost: { amount: 0.12, currency: 'USD' } })
    expect(footText()).toContain('≈ 0,12')
    renderFoot({ ...facts, cost: { amount: 0.02, currency: 'bobcoins' } })
    const bob = footText()
    expect(bob).toContain('0,02')
    expect(bob).not.toContain('≈')
  })
})

describe('un bilan par tour, à la vraie fin (fiche 255)', () => {
  const user = (id: number, at: number): TranscriptItem => ({ kind: 'user', id, text: 'm', at })
  const agent = (id: number, at?: number): TranscriptItem => ({
    kind: 'agent',
    id,
    text: 'r',
    ...(at !== undefined ? { at } : {})
  })
  const subagent = (id: number, run: Record<string, unknown>): TranscriptItem => ({
    kind: 'tool',
    id,
    toolCallId: `s${id}`,
    title: 'subagent',
    status: 'in_progress',
    content: [],
    locations: [],
    subagent: { task: 'Inventaire des endpoints REST' },
    subagentRun: { startedAt: 1, sessionId: 'ses_x', background: true, ...run }
  })

  it('message en file (D5) : chaque tour garde son bilan, sous sa propre réponse', () => {
    // Tour de 1 min 30, puis le message en file, parti à sa fin, répondu en 4 s.
    const items = [user(1, 0), agent(2, 90_000), user(3, 90_100), agent(4, 94_100)]
    const facts = turnFacts(items, turnTimes(items), undefined, IDLE)
    expect(facts.get(2)).toMatchObject({ ms: 90_000 })
    expect(facts.get(4)).toMatchObject({ ms: 4_000 })
  })

  it('le dernier tour qui travaille encore après le tour : seuls les précédents', () => {
    const items = [user(1, 0), agent(2, 10_000), user(3, 20_000), agent(4, 25_000)]
    const live = { busy: false, background: true }
    expect([...turnFacts(items, turnTimes(items), undefined, live).keys()]).toEqual([2])
  })

  it('sous-agent en arrière-plan encore au travail (D1) : pas de « Terminé » pour ce tour', () => {
    const items = [user(1, 0), subagent(2, {}), agent(3, 10_000)]
    const live = { busy: false, background: true }
    expect(turnFacts(items, turnTimes(items), undefined, live).size).toBe(0)
    // Fini, et la réponse hors tour datée à la fin du travail : le bilan va jusqu'à elle.
    const done = [user(1, 0), subagent(2, { endedAt: 77_000 }), agent(3, 10_000), agent(4, 80_000)]
    const facts = turnFacts(done, turnTimes(done), undefined, IDLE)
    expect([...facts.keys()]).toEqual([4])
    expect(facts.get(4)).toMatchObject({ ms: 80_000 })
  })

  it('attente de l’utilisateur (D13) : hors de la durée, dite à part', () => {
    const items: TranscriptItem[] = [
      user(1, 0),
      {
        kind: 'elicitation',
        id: 2,
        requestId: 'e1',
        prompt: { mode: 'form', message: 'Lancer ?', schema: { type: 'object', properties: {} } },
        state: 'accept',
        askedAt: 20_000,
        answeredAt: 60_000
      },
      agent(3, 71_000)
    ]
    expect(turnFacts(items, turnTimes(items), undefined, IDLE).get(3)).toMatchObject({
      ms: 31_000,
      waitedMs: 40_000
    })
    renderFoot({ ms: 31_000, waitedMs: 40_000, files: 0, added: 0, removed: 0 })
    expect(footText()).toBe('31 s · 40 s à vous attendre')
  })

  it('coût de chaque tour : celui de la consommation fini entre son message et le suivant', () => {
    const items = [user(1, 0), agent(2, 10_000), user(3, 20_000), agent(4, 25_000)]
    const usage: ConversationUsage = {
      cost: { amount: 0.5, currency: 'USD' },
      turns: [
        { at: 10_000, costStart: 0, costEnd: 0.3 },
        { at: 25_000, costStart: 0.3, costEnd: 0.5 }
      ]
    }
    const facts = turnFacts(items, turnTimes(items), usage, IDLE)
    expect(facts.get(2)?.cost?.amount).toBeCloseTo(0.3)
    expect(facts.get(4)?.cost?.amount).toBeCloseTo(0.2)
  })
})

describe('pied de la réponse qui finit le tour (fiche 261)', () => {
  const user = (id: number, at: number): TranscriptItem => ({ kind: 'user', id, text: 'm', at })
  const agent = (id: number, at?: number): TranscriptItem => ({
    kind: 'agent',
    id,
    text: 'r',
    ...(at !== undefined ? { at } : {})
  })
  const BUSY = { busy: true, background: false }
  const AFTER = { busy: false, background: true }
  const feet = (items: TranscriptItem[], live: { busy: boolean; background: boolean }) =>
    replyFeet(items, turnTimes(items), undefined, live)

  it('tour en cours (fiche 260, règle 5) : aucun pied sous ses réponses, l’indicateur du bas suffit', () => {
    const items = [user(1, 0), agent(2, 10_000), user(3, 20_000), agent(4), agent(5)]
    const result = feet(items, BUSY)
    expect(result.get(2)).toMatchObject({ kind: 'done', facts: { ms: 10_000 } })
    expect(result.has(4)).toBe(false)
    expect(result.has(5)).toBe(false)
  })

  it('travail après le tour : « Travaille encore… » sous la dernière réponse', () => {
    const items = [user(1, 0), agent(2, 10_000), user(3, 20_000), agent(4, 25_000), agent(5)]
    const result = feet(items, AFTER)
    expect(result.get(2)).toMatchObject({ kind: 'done' })
    expect(result.has(4)).toBe(false)
    expect(result.get(5)).toMatchObject({ kind: 'working' })
  })

  it('« occupé » avant le nouveau message (fiche 095) : le tour fini garde son bilan, sans saut', () => {
    const items = [user(1, 0), agent(2, 10_000), user(3, 20_000), agent(4, 25_000)]
    const before = feet(items, { busy: false, background: false }).get(4)
    expect(before).toMatchObject({ kind: 'done', facts: { ms: 5_000 } })
    // Le statut « occupé » du message suivant arrive, ce message pas encore : rien ne bouge.
    expect(feet(items, BUSY).get(4)).toEqual(before)
    // Ni s'il travaillait encore après son tour : il reste « Travaille encore… ».
    const working = [...items, agent(5)]
    expect(feet(working, AFTER).get(5)).toMatchObject({ kind: 'working' })
    expect(feet(working, { busy: true, background: true }).get(5)).toMatchObject({
      kind: 'working'
    })
    // Le message arrive : le nouveau tour n'a pas encore de pied, l'ancien garde le sien.
    const sent = [...items, user(6, 30_000)]
    expect(feet(sent, BUSY).get(4)).toEqual(before)
    expect(feet(sent, BUSY).size).toBe(2)
  })

  it('tour en cours sans réponse encore : aucun pied', () => {
    const items = [user(1, 0), agent(2, 10_000), user(3, 20_000)]
    expect([...feet(items, BUSY).keys()]).toEqual([2])
  })

  const running = (id: number): TranscriptItem => ({
    kind: 'tool',
    id,
    toolCallId: `s${id}`,
    title: 'subagent',
    status: 'in_progress',
    content: [],
    locations: [],
    subagent: { task: 'explore' },
    subagentRun: { startedAt: 1, sessionId: 'ses_x', background: true }
  })

  it('sous-agent d’un tour plus ancien : seul ce tour « travaille encore », le dernier garde son bilan', () => {
    const items = [user(1, 0), running(2), agent(3, 10_000), user(4, 20_000), agent(5, 24_000)]
    // Le travail après le tour est en cours (`background`, fiche 255) : un seul indicateur.
    const result = feet(items, AFTER)
    expect(result.get(3)).toMatchObject({ kind: 'working' })
    expect(result.get(5)).toMatchObject({ kind: 'done', facts: { ms: 4_000 } })
    expect([...result.values()].filter((f) => f.kind === 'working')).toHaveLength(1)
    // Pendant le tour suivant aussi.
    expect(feet([...items, user(6, 30_000)], BUSY).get(3)).toMatchObject({ kind: 'working' })
  })

  it('agent au repos ou arrêté : jamais « Travaille encore… », même avec un sous-agent resté « en cours »', () => {
    const items = [user(1, 0), running(2), agent(3, 10_000), user(4, 20_000), agent(5, 24_000)]
    const result = feet(items, { busy: false, background: false })
    expect(result.get(3)).toMatchObject({ kind: 'done' })
    expect(result.get(5)).toMatchObject({ kind: 'done' })
  })

  it('agent planté après un sous-agent en arrière-plan : son suivi est perdu, plus de pied qui tourne', () => {
    const exited: AgentEvent = {
      type: 'status',
      snapshot: { status: 'exited' } as Extract<AgentEvent, { type: 'status' }>['snapshot']
    }
    const events: AgentEvent[] = [
      { type: 'user-message', text: 'Audit', at: 0 },
      {
        type: 'update',
        update: {
          sessionUpdate: 'tool_call',
          toolCallId: 's1',
          title: 'subagent',
          kind: 'think',
          status: 'in_progress',
          rawInput: { agent: 'general', description: 'Audit', prompt: 'Audite' }
        }
      },
      {
        type: 'subagent-run',
        toolCallId: 's1',
        run: { startedAt: 1, sessionId: 'ses_f', background: true }
      },
      {
        type: 'update',
        update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'Lancé.' } }
      },
      { type: 'turn-end', stopReason: 'end_turn', at: 10_000 },
      { type: 'user-message', text: 'Autre chose', at: 20_000 },
      {
        type: 'update',
        update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'Fait.' } }
      },
      { type: 'turn-end', stopReason: 'end_turn', at: 24_000 },
      exited
    ]
    const { items } = events.reduce(reduceTranscript, emptyTranscript)
    const tool = items.find((i) => i.kind === 'tool')
    expect(tool).toMatchObject({ subagentRun: { lost: true } })
    // Même si un drapeau « actif » traînait (relance), le tour du sous-agent a son bilan.
    for (const live of [IDLE, AFTER, BUSY]) {
      const result = feet(items, live)
      expect([...result.values()].some((f) => f.kind === 'working')).toBe(false)
    }
  })

  it('« Réessayer » réussi après une erreur (fiche 142) : le tour a son bilan', () => {
    const items: TranscriptItem[] = [
      user(1, 0),
      { kind: 'notice', id: 2, level: 'error', message: { key: 'transcript.notice.error' } },
      agent(3, 30_000)
    ]
    expect(feet(items, IDLE).get(3)).toMatchObject({ kind: 'done' })
    // L'erreur sans réponse après elle : pas de bilan, comme avant.
    const failed: TranscriptItem[] = [
      user(1, 0),
      agent(2, 5_000),
      { kind: 'notice', id: 3, level: 'error', message: { key: 'transcript.notice.error' } }
    ]
    expect(feet(failed, IDLE).size).toBe(0)
  })

  it('tour arrêté ou en erreur : aucun pied, même en cours (rien ne change pour ces cas)', () => {
    const stopped: TranscriptItem[] = [
      user(1, 0),
      agent(2, 5_000),
      { kind: 'notice', id: 3, level: 'info', message: { key: 'transcript.notice.cancelled' } }
    ]
    expect(feet(stopped, { busy: false, background: false }).size).toBe(0)
    expect(feet(stopped, BUSY).size).toBe(0)
    expect(feet(stopped, AFTER).size).toBe(0)
  })

  it('même pied recalculé à l’identique : comparé par sa valeur', () => {
    const facts = { ms: 1_000, files: 1, added: 2, removed: 0 }
    expect(sameFoot({ kind: 'done', facts }, { kind: 'done', facts: { ...facts } })).toBe(true)
    expect(
      sameFoot({ kind: 'done', facts }, { kind: 'done', facts: { ...facts, ms: 2_000 } })
    ).toBe(false)
    expect(sameFoot({ kind: 'working' }, { kind: 'working' })).toBe(true)
    expect(sameFoot({ kind: 'working' }, undefined)).toBe(false)
    expect(sameFoot({ kind: 'working', since: 1 }, { kind: 'working', since: 2 })).toBe(false)
    expect(sameFoot(undefined, undefined)).toBe(true)
  })
})

describe('nombre de fichiers du pied (maquette 260, écran F)', () => {
  it('un bouton qui ouvre l’onglet Modifications', () => {
    const open = vi.fn()
    render(
      <ReplyFoot
        foot={{ kind: 'done', facts: { ms: 5_000, files: 2, added: 3, removed: 1 } }}
        text={() => 'r'}
        at={undefined}
        onOpenChanges={open}
      />
    )
    const files = screen.getByRole('button', { name: /2 fichiers \+3 −1/ })
    expect(files.getAttribute('title')).toBe('Voir dans Modifications (toute la conversation)')
    fireEvent.click(files)
    expect(open).toHaveBeenCalledTimes(1)
  })

  it('sans action (fil côte à côte) : un simple texte', () => {
    render(
      <ReplyFoot
        foot={{ kind: 'done', facts: { ms: 5_000, files: 2, added: 3, removed: 1 } }}
        text={() => 'r'}
        at={undefined}
      />
    )
    expect(screen.getByTestId('turn-files').tagName).toBe('SPAN')
  })
})
