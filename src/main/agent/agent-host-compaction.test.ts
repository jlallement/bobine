import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { AgentEvent } from '@shared/agent'
import { contextBreakdown } from '@shared/context-breakdown'
import { emptyTranscript, reduceTranscript } from '@shared/transcript'
import { MOCK_AGENT_ENTRY } from '../../mock-agent/testing.mts'
import { AgentHost } from './agent-host'
import type { AgentProfile } from './profiles'

/**
 * Jauge de contexte après `/compact` (fiche 257), de bout en bout dans l'hôte contre l'agent
 * factice qui rejoue la séquence d'OpenCode 2.3.0 : chiffre du tour d'avant (38 271), compaction
 * sans `usage_update` ni `usage`, puis chiffre du tour suivant (11 965).
 */

const stores: string[] = []
afterEach(() => {
  for (const store of stores.splice(0)) rmSync(store, { recursive: true, force: true })
})

function profile(): AgentProfile {
  const store = mkdtempSync(join(tmpdir(), 'host-compaction-'))
  stores.push(store)
  return {
    id: 'mock',
    label: 'Agent factice',
    command: process.execPath,
    args: [MOCK_AGENT_ENTRY, '--scenario', 'contexte-opencode', '--delay', '0', '--store', store],
    env: {}
  }
}

const usageUpdates = (events: readonly AgentEvent[]) =>
  events.filter((e) => e.type === 'update' && e.update.sessionUpdate === 'usage_update').length

describe('AgentHost : jauge de contexte après /compact (fiche 257)', () => {
  it('estimée après la compaction, puis remplacée par le chiffre du tour suivant', async () => {
    const events: AgentEvent[] = []
    const host = new AgentHost({
      profile: profile(),
      workspace: process.cwd(),
      emit: (e) => events.push(e)
    })
    const state = () => events.reduce(reduceTranscript, emptyTranscript)
    try {
      await host.start()
      await host.prompt('Où en sont les deux branches ?')
      expect(state().usage?.context).toMatchObject({ used: 38_271, size: 628_000 })
      expect(state().usage?.context?.estimated).toBeUndefined()

      const before = usageUpdates(events)
      await host.prompt('/compact')
      // Comme OpenCode 2.3.0 : rien de chiffré pendant ce tour, ni dans sa réponse.
      expect(usageUpdates(events)).toBe(before)
      const turnEnd = events.findLast((e) => e.type === 'turn-end')
      expect(turnEnd?.type === 'turn-end' && turnEnd.usage).toBeFalsy()
      const compacted = state()
      expect(compacted.items.find((i) => i.kind === 'compaction')).toMatchObject({
        status: 'completed'
      })
      const estimated = compacted.usage?.context
      expect(estimated?.estimated).toBe(true)
      // Reste (hors messages) au chiffre d'avant + résumé : de l'ordre des 11 965 que l'agent
      // annoncera au tour suivant, loin des 38 271 d'avant la compaction.
      expect(estimated?.used).toBeGreaterThan(5_000)
      expect(estimated?.used).toBeLessThan(15_000)
      const breakdown = contextBreakdown({ items: compacted.items, usage: compacted.usage })
      expect(breakdown.total?.estimated).toBe(true)

      await host.prompt('/scenario apres-compaction-opencode')
      const next = state()
      expect(next.usage?.context).toMatchObject({ used: 11_965, size: 628_000 })
      expect(next.usage?.context?.estimated).toBeUndefined()
      // La baisse vient de la compaction : le message et la réponse de ce tour restent comptés.
      expect(next.usage?.contextSince).toBeUndefined()
      const messages = contextBreakdown({ items: next.items, usage: next.usage }).lines.find(
        (l) => l.id === 'messages'
      )
      const summary = compacted.items.find((i) => i.kind === 'compaction')
      const summaryTokens =
        summary?.kind === 'compaction' ? Math.round(summary.summary.length / 4) : 0
      expect(messages?.tokens).toBeGreaterThan(summaryTokens)
    } finally {
      await host.stop()
    }
  })
})
