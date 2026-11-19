import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { AgentEvent } from '@shared/agent'
import { emptyTranscript, reduceTranscript, type TranscriptItem } from '@shared/transcript'
import { turnTimes } from '@shared/turn-duration'
import { MOCK_AGENT_ENTRY } from '../../mock-agent/testing.mts'
import { AgentHost } from './agent-host'
import { OPENCODE_SUBAGENT_STREAM } from './opencode-contract'
import { OPENCODE_SUBAGENT_FORMAT } from './opencode-subagents'
import type { AgentProfile } from './profiles'
import { replaySession } from './session-replay'

/**
 * Travail après la fin du tour (fiche 255), contre l'agent factice qui rejoue la séquence réelle
 * de l'exploration du 2026-11-19 (OpenCode 2.3.0) : le tour finit en quelques secondes, le
 * sous-agent travaille encore, puis le parent répond hors tour. L'hôte dit « travaille encore »
 * jusqu'à la fin de ce travail, et date la réponse hors tour, qui finit le tour.
 */

const SCENARIO = 'sous-agent-hors-tour-explo-2-3'
const QUIET_MS = 400
const stores: string[] = []
afterEach(() => {
  for (const store of stores.splice(0)) rmSync(store, { recursive: true, force: true })
})

function hostFor(events: AgentEvent[]): AgentHost {
  const store = mkdtempSync(join(tmpdir(), 'host-background-'))
  stores.push(store)
  const profile: AgentProfile = {
    id: 'mock',
    label: 'Agent factice',
    command: process.execPath,
    args: [MOCK_AGENT_ENTRY, '--scenario', SCENARIO, '--delay', '0', '--store', store],
    env: {},
    subagentFormat: OPENCODE_SUBAGENT_FORMAT,
    subagentReplay: true,
    subagentStream: OPENCODE_SUBAGENT_STREAM
  }
  return new AgentHost({
    profile,
    workspace: process.cwd(),
    emit: (e) => events.push(e),
    loadSubagentWork: (sessionId) =>
      replaySession({ profile, workspace: process.cwd(), sessionId, settleMs: 0 }).then((items) =>
        items[0]?.kind === 'user' ? items.slice(1) : items
      ),
    subagentFollowMs: [150, 150, 60_000],
    backgroundQuietMs: QUIET_MS
  })
}

const waitFor = (predicate: () => boolean, timeoutMs: number) =>
  new Promise<void>((resolve, reject) => {
    const started = Date.now()
    const check = () => {
      if (predicate()) return resolve()
      if (Date.now() - started > timeoutMs) return reject(new Error('waitFor : délai dépassé'))
      setTimeout(check, 20)
    }
    check()
  })

const stateOf = (events: AgentEvent[]) => events.reduce(reduceTranscript, emptyTranscript)
const itemsOf = (events: AgentEvent[]) => stateOf(events).items
const replies = (items: TranscriptItem[]) =>
  items.filter((i): i is Extract<TranscriptItem, { kind: 'agent' }> => i.kind === 'agent')
type Work = Extract<AgentEvent, { type: 'background-work' }>
const done = (events: AgentEvent[]) =>
  events.find((e): e is Work => e.type === 'background-work' && !e.active)
const lastStatus = (events: AgentEvent[]) =>
  events.flatMap((e) => (e.type === 'status' ? [e.snapshot.status] : [])).at(-1)

describe('AgentHost : travail après le tour (fiche 255)', () => {
  it('sous-agent en arrière-plan : « travaille encore » jusqu’à la réponse hors tour, qui finit le tour', async () => {
    const events: AgentEvent[] = []
    const host = hostFor(events)
    try {
      await host.start()
      const sentAt = Date.now()
      await host.prompt('Lance un sous-agent explore qui liste les endpoints REST')
      // Tour ACP fini (`end_turn`), l'agent prêt : mais le sous-agent travaille encore.
      expect(lastStatus(events)).toBe('ready')
      expect(stateOf(events).backgroundWork).toBe(true)
      expect(done(events)).toBeUndefined()

      await waitFor(() => done(events) !== undefined, 15_000)
      expect(stateOf(events).backgroundWork).toBeUndefined()
      const items = itemsOf(events)
      const card = items.find((i) => i.kind === 'tool' && !!i.subagent)
      expect(card).toMatchObject({ status: 'completed', subagentRun: { background: true } })
      // La réponse hors tour : un message à part, daté de sa fin, qui finit le tour.
      const [inTurn, late] = replies(items)
      expect(late?.text).toContain('Résumé en 5 lignes')
      expect(late?.text).toContain('Tests REST par Testcontainers.')
      expect(late?.at).toBe(done(events)?.at)
      expect(late?.at).toBeGreaterThan(inTurn?.at ?? Infinity)
      const time = turnTimes(items).get(late?.id ?? -1)
      expect(time?.ms).toBeGreaterThanOrEqual((late?.at ?? 0) - sentAt - 50)
      expect(turnTimes(items).has(inTurn?.id ?? -1)).toBe(false)
      // La fin vient après la fin du sous-agent, vue par le suivi.
      const ended = events.findIndex(
        (e) => e.type === 'subagent-run' && e.run.endedAt !== undefined
      )
      expect(ended).toBeGreaterThan(-1)
      expect(events.indexOf(done(events) as AgentEvent)).toBeGreaterThan(ended)
    } finally {
      host.stop()
    }
  }, 30_000)

  it('un autre message pendant que le sous-agent travaille : il part tout de suite ; le rapport reste hors tour', async () => {
    const events: AgentEvent[] = []
    const host = hostFor(events)
    try {
      await host.start()
      await host.prompt('Lance un sous-agent explore qui liste les endpoints REST')
      expect(stateOf(events).backgroundWork).toBe(true)
      // Prêt : le message n'attend pas en file, il a son propre tour.
      await host.prompt('Alors, où en est le sous-agent ?')
      expect(host.snapshot().queued).toEqual([])
      expect(events.filter((e) => e.type === 'turn-end')).toHaveLength(2)
      expect(stateOf(events).backgroundWork).toBe(true)

      await waitFor(() => done(events) !== undefined, 15_000)
      const items = itemsOf(events)
      const all = replies(items)
      // Le rapport arrive après le second tour : il ne l'allonge pas (ce tour n'a rien lancé).
      expect(all.at(-1)?.text).toContain('Résumé en 5 lignes')
      expect(all.at(-1)?.at).toBeUndefined()
      const second = all.at(-2)
      expect(second?.text).toContain('travaille encore')
      expect(turnTimes(items).get(second?.id ?? -1)?.ms).toBeLessThan(5_000)
      expect(stateOf(events).backgroundWork).toBeUndefined()
    } finally {
      host.stop()
    }
  }, 30_000)

  it('agent arrêté pendant le travail : plus rien « en cours », aucune date posée', async () => {
    const events: AgentEvent[] = []
    const host = hostFor(events)
    await host.start()
    await host.prompt('Lance un sous-agent explore qui liste les endpoints REST')
    expect(stateOf(events).backgroundWork).toBe(true)
    host.stop()
    expect(stateOf(events).backgroundWork).toBeUndefined()
    expect(done(events)).toBeUndefined()
  }, 30_000)
})
