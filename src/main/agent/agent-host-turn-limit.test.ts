/**
 * Limite d'étapes de l'agent (fiche 209), contre l'agent factice : `limite-etapes-session` imite
 * Bob 2.0.9 (limite comptée sur la session, refus immédiat sans mise à jour, remise à zéro par une
 * relance puis `session/load`) ; `limite-etapes-tenace` ne remet jamais le compte à zéro.
 */
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { AgentEvent } from '@shared/agent'
import { emptyTranscript, reduceTranscript, type TranscriptItem } from '@shared/transcript'
import { MOCK_AGENT_ENTRY } from '../../mock-agent/testing.mts'
import { AgentHost } from './agent-host'
import type { AgentProfile } from './profiles'

function profile(scenario: string, ...extra: string[]): AgentProfile {
  const store = mkdtempSync(join(tmpdir(), 'host-limit-'))
  return {
    id: 'mock',
    label: 'Agent factice',
    command: process.execPath,
    args: [MOCK_AGENT_ENTRY, '--scenario', scenario, '--delay', '0', '--store', store, ...extra],
    env: {}
  }
}

function createHost(agent: AgentProfile) {
  const events: AgentEvent[] = []
  const host = new AgentHost({
    profile: agent,
    workspace: process.cwd(),
    emit: (e) => events.push(e)
  })
  const items = () => events.reduce(reduceTranscript, emptyTranscript).items
  const ends = () =>
    events.flatMap((e) => (e.type === 'turn-end' ? [{ stop: e.stopReason, limit: e.limit }] : []))
  return { host, events, items, ends }
}

function waitFor(predicate: () => boolean, timeoutMs = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    const started = Date.now()
    const check = () => {
      if (predicate()) return resolve()
      if (Date.now() - started > timeoutMs) return reject(new Error('waitFor : délai dépassé'))
      setTimeout(check, 10)
    }
    check()
  })
}

const users = (items: TranscriptItem[]) =>
  items.filter((i): i is Extract<TranscriptItem, { kind: 'user' }> => i.kind === 'user')
const cards = (items: TranscriptItem[]) =>
  items.filter((i): i is Extract<TranscriptItem, { kind: 'turn-limit' }> => i.kind === 'turn-limit')
const agentText = (items: TranscriptItem[]) =>
  items.flatMap((i) => (i.kind === 'agent' ? [i.text] : [])).join('\n')

/** Premier tour arrêté par la limite, puis « Continue » refusé sans rien faire. */
async function exhaust(host: AgentHost, ends: () => { stop: string }[]) {
  await host.start()
  await host.prompt('Passe à PanacheEntityBase')
  await host.prompt('Continue')
  await waitFor(() => ends().length === 2 && host.snapshot().status === 'ready')
}

describe('AgentHost : limite d’étapes de l’agent (fiche 209)', () => {
  it('travail arrêté, puis refus sans rien faire : deux cartes différentes, réouverture proposée', async () => {
    const { host, items, ends } = createHost(profile('limite-etapes-session'))
    await exhaust(host, ends)
    host.stop()
    expect(ends()).toEqual([
      { stop: 'max_turn_requests', limit: { refused: false, reopen: false } },
      { stop: 'max_turn_requests', limit: { refused: true, reopen: true } }
    ])
    expect(cards(items()).map(({ refused, reopen }) => ({ refused, reopen }))).toEqual([
      { refused: false, reopen: false },
      { refused: true, reopen: true }
    ])
    expect(items().some((i) => i.kind === 'notice')).toBe(false)
  })

  it('après max_turn_requests, la file attend l’utilisateur (elle serait refusée pareil)', async () => {
    const { host, events, items, ends } = createHost(
      profile('limite-etapes-session', '--delay', '20')
    )
    await host.start()
    const turn = host.prompt('Passe à PanacheEntityBase')
    await waitFor(() => events.some((e) => e.type === 'update'))
    await host.send('Et les dépôts ?')
    await turn
    await waitFor(() => ends().length === 1 && host.snapshot().status === 'ready')
    // Laisse le temps à un envoi automatique de partir, s'il devait partir.
    await new Promise((r) => setTimeout(r, 200))
    expect(host.snapshot().queued.map((m) => m.text)).toEqual(['Et les dépôts ?'])
    expect(users(items())).toHaveLength(1)
    host.stop()
  })

  it('« Rouvrir la session et continuer » : agent relancé, même session, message renvoyé une fois', async () => {
    const { host, events, items, ends } = createHost(profile('limite-etapes-session'))
    await exhaust(host, ends)
    const sessionId = host.currentSessionId
    await host.afterTurnLimit('reopen')
    await waitFor(() => ends().length === 3 && host.snapshot().status === 'ready')
    host.stop()
    expect(host.currentSessionId).toBeUndefined()
    expect(events.filter((e) => e.type === 'resent')).toEqual([{ type: 'resent' }])
    expect(ends()[2]).toEqual({ stop: 'end_turn', limit: undefined })
    expect(users(items()).map((u) => [u.text, u.resent])).toEqual([
      ['Passe à PanacheEntityBase', undefined],
      ['Continue', 1]
    ])
    expect(agentText(items())).toContain('Les entités utilisent maintenant PanacheEntityBase.')
    expect(items().some((i) => i.kind === 'handover')).toBe(false)
    expect(sessionId).toBeDefined()
  })

  it('refusé encore après la réouverture : seule la session neuve reste, qui repart avec le résumé', async () => {
    const { host, events, items, ends } = createHost(profile('limite-etapes-tenace'))
    await exhaust(host, ends)
    const before = host.currentSessionId
    await host.afterTurnLimit('reopen')
    await waitFor(() => ends().length === 3 && host.snapshot().status === 'ready')
    expect(ends()[2]).toEqual({
      stop: 'max_turn_requests',
      limit: { refused: true, reopen: false }
    })
    expect(host.currentSessionId).toBe(before)

    await host.afterTurnLimit('renew')
    await waitFor(() => ends().length === 4 && host.snapshot().status === 'ready')
    const after = host.currentSessionId
    host.stop()
    expect(after).toBeDefined()
    expect(after).not.toBe(before)
    expect(ends()[3]).toEqual({ stop: 'end_turn', limit: undefined })
    expect(events.filter((e) => e.type === 'resent').at(-1)).toEqual({
      type: 'resent',
      fresh: true
    })
    const handover = items().find((i) => i.kind === 'handover')
    expect(handover).toMatchObject({ reason: 'turn-limit', resent: 1 })
    expect(agentText(items())).toContain('Les entités utilisent maintenant PanacheEntityBase.')
  })

  it('agent qui ne sait pas recharger sa session : pas de réouverture proposée, ni acceptée', async () => {
    const { host, ends } = createHost(profile('limite-etapes-session', '--sans-rejeu'))
    await exhaust(host, ends)
    expect(ends()[1]).toEqual({
      stop: 'max_turn_requests',
      limit: { refused: true, reopen: false }
    })
    await expect(host.afterTurnLimit('reopen')).rejects.toThrow()
    expect(host.snapshot().status).toBe('ready')
    host.stop()
  })

  it('hors d’un tour arrêté par la limite (ou pendant une réponse) : refusé', async () => {
    const { host } = createHost(profile('limite-etapes-session'))
    await host.start()
    await expect(host.afterTurnLimit('renew')).rejects.toThrow()
    host.stop()
  })
})
