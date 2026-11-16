import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { AgentEvent } from '@shared/agent'
import { emptyTranscript, reduceTranscript, type TranscriptItem } from '@shared/transcript'
import { MOCK_AGENT_ENTRY } from '../../mock-agent/testing.mts'
import { AgentHost } from './agent-host'
import { OPENCODE_SUBAGENT_STREAM } from './opencode-contract'
import { OPENCODE_SUBAGENT_FORMAT } from './opencode-subagents'
import type { AgentProfile } from './profiles'
import { replaySession } from './session-replay'

/**
 * Sous-agents d'OpenCode 2.3.0 de bout en bout dans l'hôte (fiche 232), contre l'agent factice : le
 * parent répond hors tour quand le sous-agent a fini ; la carte finit alors en quelques relectures,
 * pas après la longue attente, avec son travail relu.
 */

const stores: string[] = []
afterEach(() => {
  for (const store of stores.splice(0)) rmSync(store, { recursive: true, force: true })
})

function profileOf(scenario: string): AgentProfile {
  const store = mkdtempSync(join(tmpdir(), 'host-2-3-'))
  stores.push(store)
  return {
    id: 'mock',
    label: 'Agent factice',
    command: process.execPath,
    args: [MOCK_AGENT_ENTRY, '--scenario', scenario, '--delay', '0', '--store', store],
    env: {},
    subagentFormat: OPENCODE_SUBAGENT_FORMAT,
    subagentReplay: true,
    subagentStream: OPENCODE_SUBAGENT_STREAM
  }
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

describe('AgentHost et OpenCode 2.3.0 (fiche 232)', () => {
  it('réponse hors tour : la carte finit aussitôt, avec son travail relu ; la réponse est un message à part', async () => {
    const profile = profileOf('sous-agent-arriere-plan-2-3')
    const events: AgentEvent[] = []
    const host = new AgentHost({
      profile,
      workspace: process.cwd(),
      emit: (e) => events.push(e),
      loadSubagentWork: (sessionId) =>
        replaySession({ profile, workspace: process.cwd(), sessionId, settleMs: 0 }).then(
          (items) => (items[0]?.kind === 'user' ? items.slice(1) : items)
        ),
      // Deux relectures rapides, puis une minute : sans relecture avancée, la fin attendrait.
      subagentFollowMs: [150, 150, 60_000]
    })
    try {
      await host.start()
      await host.prompt('Lance un sous-agent')
      const items = () => events.reduce(reduceTranscript, emptyTranscript).items
      const card = () =>
        items().find((i): i is Extract<TranscriptItem, { kind: 'tool' }> => i.kind === 'tool')
      expect(card()?.status).toBe('in_progress')
      // Sa session finit 4 s après, le parent répond 0,5 s plus tard ; la carte suit de près.
      await waitFor(() => card()?.status === 'completed', 9_000)
      expect(card()?.subagentRun?.answer).toBe('Le mot de code de `secret.txt` est **KANGOUROU**.')
      expect(card()?.work?.map((i) => (i.kind === 'tool' ? i.status : i.kind))).toEqual([
        'completed',
        'agent'
      ])
      expect(items().flatMap((i) => (i.kind === 'agent' ? [i.text] : []))).toEqual([
        'J’ai lancé un sous-agent **explore** pour lire `secret.txt`. Je te transmettrai le mot de code dès que j’aurai son retour.',
        'Le mot de code est **KANGOUROU**.'
      ])
    } finally {
      host.stop()
    }
  }, 20_000)
})
