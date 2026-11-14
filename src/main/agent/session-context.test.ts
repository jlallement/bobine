/**
 * Moment du contexte de session (fiches 118, 223), contre l'agent factice : complet au premier
 * message d'une session neuve, rappel au premier message après une compaction et après la reprise
 * d'une session (`session/load`), rien ailleurs ; rien du tout avec le réglage « Jamais ».
 */
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { AgentEvent } from '@shared/agent'
import type { SessionMoment } from '@shared/app-context'
import { childrenSessionContext, type ChildProposals } from '@shared/children'
import { emptyTranscript, reduceTranscript } from '@shared/transcript'
import { MOCK_AGENT_ENTRY } from '../../mock-agent/testing.mts'
import { AgentHost } from './agent-host'
import type { AgentProfile } from './profiles'

/** Agent factice qui renvoie le message reçu (contexte joint compris), sessions enregistrées. */
function echoProfile(): AgentProfile {
  const store = mkdtempSync(join(tmpdir(), 'session-context-'))
  return {
    id: 'mock',
    label: 'Agent factice',
    command: process.execPath,
    args: [MOCK_AGENT_ENTRY, '--scenario', 'echo', '--delay', '0', '--store', store],
    env: {}
  }
}

/** Hôte dont le contexte de session est celui d'une mère possible, au réglage donné. */
function host(profile: AgentProfile, proposals: ChildProposals, sessionId?: string) {
  const events: AgentEvent[] = []
  const moments: SessionMoment[] = []
  const agent = new AgentHost({
    profile,
    workspace: process.cwd(),
    emit: (e) => events.push(e),
    sessionContext: (_tools, moment) => {
      moments.push(moment)
      return childrenSessionContext(proposals, moment)
    },
    ...(sessionId ? { reopen: { sessionId } } : {})
  })
  /** Réponse de l'agent factice au dernier message : ce qu'il a reçu. */
  const received = () => {
    const last = events.reduce(reduceTranscript, emptyTranscript).items.at(-1)
    return last?.kind === 'agent' ? last.text : ''
  }
  return { agent, moments, received }
}

const FULL = 'For context, about the app the user talks to you through'
const REMINDER = 'Reminder, not a task: start_child proposes a child conversation'

describe('contexte de session : moment du rappel (fiche 223)', () => {
  it('complet à une session neuve, rappel après une compaction et après une reprise', async () => {
    const profile = echoProfile()
    const first = host(profile, 'whenFitting')
    await first.agent.start()
    await first.agent.prompt('Premier')
    expect(first.received()).toContain(FULL)
    expect(first.received()).not.toContain(REMINDER)
    // Pas à chaque message.
    await first.agent.prompt('Deuxième')
    expect(first.received()).not.toContain('<bobine_capabilities>')
    // Compaction : le message suivant reçoit le rappel, une fois.
    await first.agent.prompt('/compact')
    await first.agent.prompt('Après la compaction')
    expect(first.received()).toContain(REMINDER)
    expect(first.received()).not.toContain(FULL)
    await first.agent.prompt('Encore')
    expect(first.received()).not.toContain('<bobine_capabilities>')
    const sessionId = first.agent.currentSessionId
    first.agent.stop()
    expect(first.moments).toEqual(['opened', 'compacted'])

    // Reprise (`session/load`) : l'historique a déjà le contexte complet, le rappel suffit.
    const second = host(profile, 'whenFitting', sessionId)
    await second.agent.start()
    expect(second.agent.currentSessionId).toBe(sessionId)
    await second.agent.prompt('Je reprends')
    expect(second.received()).toContain(REMINDER)
    expect(second.received()).not.toContain(FULL)
    await second.agent.prompt('Et ensuite')
    expect(second.received()).not.toContain('<bobine_capabilities>')
    second.agent.stop()
    expect(second.moments).toEqual(['resumed'])
  })

  it('« Jamais » : ni contexte ni rappel, à aucun moment', async () => {
    const profile = echoProfile()
    const first = host(profile, 'never')
    await first.agent.start()
    await first.agent.prompt('Premier')
    await first.agent.prompt('/compact')
    await first.agent.prompt('Après la compaction')
    expect(first.received()).not.toContain('<bobine_capabilities>')
    const sessionId = first.agent.currentSessionId
    first.agent.stop()
    const second = host(profile, 'never', sessionId)
    await second.agent.start()
    await second.agent.prompt('Je reprends')
    expect(second.received()).not.toContain('<bobine_capabilities>')
    second.agent.stop()
    // Le moment est bien passé : c'est le réglage qui ne donne rien.
    expect([...first.moments, ...second.moments]).toEqual(['opened', 'compacted', 'resumed'])
  })
})
