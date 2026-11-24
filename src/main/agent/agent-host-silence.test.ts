/**
 * Bandeau de silence (fiche 194) contre l'agent factice : un agent qui ne joint pas son modèle et
 * n'envoie que des mises à jour d'état (OpenCode 2.3.0 derrière un proxy injoignable, recette du
 * 2026-11-23) se tait quand même aux yeux de l'utilisateur. Seuil raccourci (`BOBINE_SILENCE_MS`).
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { AgentEvent, AgentSnapshot } from '@shared/agent'
import { MOCK_AGENT_ENTRY } from '../../mock-agent/testing.mts'
import { NETWORK_BACK_MARKER } from '../../mock-agent/scenarios-opencode-2-3.mts'
import { AgentHost, type AgentHostOptions } from './agent-host'
import { OPENCODE_RETRY_STATUS } from './opencode-retry'
import { eventLog } from './test-events'

function createHost(scenario: string, options: Partial<AgentHostOptions> = {}) {
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
    emit,
    ...options
  })
  const snapshots = () =>
    events.flatMap((e) => (e.type === 'status' ? [e.snapshot] : [])) as AgentSnapshot[]
  return { host, snapshots, until }
}

let previous: string | undefined
beforeEach(() => {
  previous = process.env['BOBINE_SILENCE_MS']
  process.env['BOBINE_SILENCE_MS'] = '1000'
})
afterEach(() => {
  if (previous === undefined) delete process.env['BOBINE_SILENCE_MS']
  else process.env['BOBINE_SILENCE_MS'] = previous
})

describe('AgentHost : silence malgré des mises à jour d’état (fiche 194)', () => {
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

  it('silence avec un proxy : bandeau et proxy de l’agent, identifiants masqués', async () => {
    const { host, until } = createHost('silence-annulable', {
      credentials: async () => ({ HTTPS_PROXY: 'http://jean:s3cr3t@proxy.exemple:3128' })
    })
    await host.start()
    const turn = host.prompt('Bonjour')
    await until(() => host.snapshot().silentSince !== undefined)
    expect(host.snapshot().proxy).toBe('http://•••@proxy.exemple:3128')
    expect(JSON.stringify(host.snapshot())).not.toContain('s3cr3t')
    await host.cancel()
    await turn
    await until(() => host.snapshot().status === 'ready')
    // Plus de bandeau : plus de proxy dans l'instantané.
    expect(host.snapshot().proxy).toBeUndefined()
    host.stop()
  }, 20_000)
})

describe('AgentHost : modèle injoignable annoncé par l’agent (fiche 275)', () => {
  const profile = (scenario: string) => ({
    id: 'mock',
    label: 'Agent factice',
    command: process.execPath,
    args: [MOCK_AGENT_ENTRY, '--scenario', scenario, '--delay', '20'],
    env: {},
    retryStatus: OPENCODE_RETRY_STATUS
  })

  it('reprises de l’agent : état générique tout de suite, effacé à l’arrêt du tour', async () => {
    const { host, until } = createHost('reseau-injoignable-2-3', {
      profile: profile('reseau-injoignable-2-3')
    })
    await host.start()
    const turn = host.prompt('Bonjour')
    await until(() => (host.snapshot().unreachable?.attempt ?? 0) >= 3)
    const view = host.snapshot().unreachable
    expect(view?.message).toContain("Can't reach opencode.ai")
    expect((view?.at ?? 0) - Date.now()).toBeGreaterThan(20_000)
    // Bien avant le bandeau de silence, et sans proxy défini : pas de piste proxy.
    expect(host.snapshot().proxy).toBeUndefined()
    await host.cancel()
    await turn
    await until(() => host.snapshot().status === 'ready')
    expect(host.snapshot().unreachable).toBeUndefined()
    host.stop()
  }, 20_000)

  it('sans `retryStatus` dans le profil : rien de lu (générique, ADR-0011)', async () => {
    const { host, until, snapshots } = createHost('reseau-injoignable-2-3')
    await host.start()
    const turn = host.prompt('Bonjour')
    await until(() => host.snapshot().silentSince !== undefined)
    expect(snapshots().some((s) => s.unreachable !== undefined)).toBe(false)
    await host.cancel()
    await turn
    host.stop()
  }, 20_000)

  it('l’agent répond après des reprises : le bandeau part au premier contenu', async () => {
    const { host, until, snapshots } = createHost('reseau-revenu-2-3', {
      profile: profile('reseau-revenu-2-3')
    })
    await host.start()
    await host.prompt('Bonjour')
    await until(() => host.snapshot().status === 'ready')
    const seen = snapshots().map((s) => s.unreachable?.attempt ?? 0)
    expect(seen).toContain(2)
    expect(host.snapshot().unreachable).toBeUndefined()
    host.stop()
  }, 20_000)

  it('réseau revenu au signal (e2e `parcours-reglages`, fiche 278) : reprises jusqu’au fichier', async () => {
    const workspace = mkdtempSync(join(tmpdir(), 'reseau-signal-'))
    try {
      const { host, until, snapshots } = createHost('reseau-revenu-au-signal-2-3', {
        profile: profile('reseau-revenu-au-signal-2-3'),
        workspace
      })
      await host.start()
      const turn = host.prompt('Bonjour')
      // Bien au-delà des deux reprises de `reseau-revenu-2-3` : le bandeau reste.
      await until(() => (host.snapshot().unreachable?.attempt ?? 0) >= 5)
      expect(host.snapshot().status).toBe('busy')
      writeFileSync(join(workspace, NETWORK_BACK_MARKER), '')
      await turn
      expect(host.snapshot().unreachable).toBeUndefined()
      expect(snapshots().some((s) => s.unreachable !== undefined)).toBe(true)
      host.stop()
    } finally {
      rmSync(workspace, { recursive: true, force: true })
    }
  }, 20_000)
})
