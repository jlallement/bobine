/**
 * Bandeau de silence (fiche 194) contre l'agent factice : un agent qui ne joint pas son modèle et
 * n'envoie que des mises à jour d'état (OpenCode 2.3.0 derrière un proxy injoignable, recette du
 * 2026-11-23) se tait quand même aux yeux de l'utilisateur. Seuil raccourci (`BOBINE_SILENCE_MS`).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { AgentEvent, AgentSnapshot } from '@shared/agent'
import { MOCK_AGENT_ENTRY } from '../../mock-agent/testing.mts'
import { AgentHost } from './agent-host'
import { eventLog } from './test-events'

function createHost(scenario: string) {
  const { events, emit, until } = eventLog<AgentEvent>()
  const host = new AgentHost({
    profile: {
      id: 'mock',
      label: 'Agent factice',
      command: process.execPath,
      args: [MOCK_AGENT_ENTRY, '--scenario', scenario, '--delay', '20'],
      env: {}
    },
    workspace: process.cwd(),
    emit
  })
  const snapshots = () =>
    events.flatMap((e) => (e.type === 'status' ? [e.snapshot] : [])) as AgentSnapshot[]
  return { host, snapshots, until }
}

describe('AgentHost : silence malgré des mises à jour d’état (fiche 194)', () => {
  let previous: string | undefined
  beforeEach(() => {
    previous = process.env['BOBINE_SILENCE_MS']
    process.env['BOBINE_SILENCE_MS'] = '1000'
  })
  afterEach(() => {
    if (previous === undefined) delete process.env['BOBINE_SILENCE_MS']
    else process.env['BOBINE_SILENCE_MS'] = previous
  })

  it('agent qui réessaie sans fin de joindre son modèle : bandeau, puis Stop termine le tour', async () => {
    const { host, until } = createHost('reseau-injoignable-2-3')
    await host.start()
    const turn = host.prompt('Bonjour')
    const promptedAt = Date.now()
    await until(() => host.snapshot().silentSince !== undefined)
    // Le silence part du début du tour (aucune avancée depuis), pas du dernier état reçu.
    expect(host.snapshot().status).toBe('busy')
    expect(Math.abs((host.snapshot().silentSince ?? 0) - promptedAt)).toBeLessThan(500)
    await host.cancel()
    await turn
    await until(() => host.snapshot().status === 'ready')
    expect(host.snapshot().silentSince).toBeUndefined()
    host.stop()
  }, 20_000)

  it('agent qui avance (texte en continu) : pas de bandeau', async () => {
    const { host, until, snapshots } = createHost('streaming-texte')
    await host.start()
    await host.prompt('Bonjour')
    await until(() => host.snapshot().status === 'ready')
    expect(snapshots().some((s) => s.silentSince !== undefined)).toBe(false)
    host.stop()
  })
})
