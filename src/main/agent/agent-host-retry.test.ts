/**
 * Reconnexion progressive d'un tour (fiche 142), contre l'agent factice : pannes réseau, limite
 * de débit, file d'attente, Stop, retour du réseau. Attentes raccourcies (`retryDelaysMs`).
 */
import { describe, expect, it } from 'vitest'
import type { AgentEvent, AgentSnapshot } from '@shared/agent'
import { emptyTranscript, noticeText, reduceTranscript } from '@shared/transcript'
import { MOCK_AGENT_ENTRY } from '../../mock-agent/testing.mts'
import { AgentHost, type AgentHostOptions } from './agent-host'

function createHost(scenario: string, options: Partial<AgentHostOptions> = {}) {
  const events: AgentEvent[] = []
  const host = new AgentHost({
    profile: {
      id: 'mock',
      label: 'Agent factice',
      command: process.execPath,
      args: [MOCK_AGENT_ENTRY, '--scenario', scenario, '--delay', '0'],
      env: {}
    },
    workspace: process.cwd(),
    emit: (e) => events.push(e),
    retryDelaysMs: [30, 30, 30, 30, 30],
    ...options
  })
  const snapshots = () =>
    events.flatMap((e) => (e.type === 'status' ? [e.snapshot] : [])) as AgentSnapshot[]
  // Bandeaux successifs (un instantané rafraîchi sans changement de bandeau ne compte pas).
  const retries = () =>
    snapshots()
      .flatMap((s) => (s.retry ? [s.retry] : []))
      .filter((r, i, all) => JSON.stringify(r) !== JSON.stringify(all[i - 1]))
  const transcript = () => events.reduce(reduceTranscript, emptyTranscript).items
  const count = (type: AgentEvent['type']) => events.filter((e) => e.type === type).length
  return { host, events, retries, transcript, count }
}

/** Faux réseau : `restore()` prévient comme `net.isOnline()` qui repasse à vrai. */
function fakeNetwork() {
  const listeners = new Set<() => void>()
  return {
    onRestored: (listener: () => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    restore: () => [...listeners].forEach((listener) => listener())
  }
}

const agentTexts = (items: ReturnType<ReturnType<typeof createHost>['transcript']>) =>
  items.flatMap((item) => (item.kind === 'agent' ? [item.text] : []))

describe('AgentHost : reconnexion après une panne réseau (fiche 142)', () => {
  it('deux tentatives, puis le message part, sans nouvelle bulle ni erreur', async () => {
    const { host, retries, transcript, count } = createHost('reseau-instable')
    await host.start()
    await host.prompt('Bonjour')
    await expect.poll(() => host.snapshot().status).toBe('ready')
    expect(agentTexts(transcript())).toEqual(['Réseau revenu : voici la réponse complète.'])
    expect(count('user-message')).toBe(1)
    expect(count('turn-error')).toBe(0)
    expect(count('turn-end')).toBe(1)
    expect(retries().map((r) => [r.cause, r.attempt, r.max])).toEqual([
      ['network', 1, 5],
      ['network', 2, 5]
    ])
    expect(host.snapshot().retry).toBeUndefined()
    host.stop()
  })

  it('une limite de débit est réessayée sous sa propre cause', async () => {
    const { host, retries, transcript } = createHost('limite-debit')
    await host.start()
    await host.prompt('Bonjour')
    await expect.poll(() => host.snapshot().status).toBe('ready')
    expect(retries().map((r) => r.cause)).toEqual(['rate-limit'])
    expect(agentTexts(transcript())).toEqual(['Limite levée : voici la réponse.'])
    host.stop()
  })

  it('cinq échecs : « Connexion impossible », une seule erreur, puis « Réessayer » repart', async () => {
    const { host, transcript, count } = createHost('reseau-coupe')
    await host.start()
    await host.prompt('Bonjour')
    await expect.poll(() => count('turn-error')).toBe(1)
    await expect.poll(() => host.snapshot().status).toBe('ready')
    // La cause n'était que sur la sortie d'erreur de l'agent (`getaddrinfo ENOTFOUND`).
    expect(host.snapshot().retry).toEqual({ cause: 'network', attempt: 5, max: 5 })
    const notices = transcript().filter((item) => item.kind === 'notice')
    expect(notices).toHaveLength(1)
    expect(count('user-message')).toBe(1)
    // « Réessayer » : un nouveau cycle de cinq tentatives, toujours sans nouvelle bulle.
    host.retryTurn()
    expect(host.snapshot().status).toBe('busy')
    await expect.poll(() => count('turn-error')).toBe(2)
    expect(count('user-message')).toBe(1)
    expect(host.snapshot().retry).toEqual({ cause: 'network', attempt: 5, max: 5 })
    // Un nouveau message remplace celui qui attendait : le bandeau s'en va.
    void host.send('Autre chose')
    await expect.poll(() => count('user-message')).toBe(2)
    expect(host.snapshot().retry).toBeUndefined()
    host.stop()
  })

  it('un message envoyé pendant l’attente rejoint la file et part après la réussite', async () => {
    const { host, retries, count, events } = createHost('reseau-instable', {
      retryDelaysMs: [300, 300, 300, 300, 300]
    })
    await host.start()
    const turn = host.prompt('Bonjour')
    await expect.poll(() => retries().length).toBe(1)
    expect(host.snapshot().status).toBe('busy')
    await host.send('Suite')
    expect(host.snapshot().queued.map((m) => m.text)).toEqual(['Suite'])
    await turn
    await expect.poll(() => count('turn-end')).toBe(2)
    const sent = events.flatMap((e) => (e.type === 'user-message' ? [e.text] : []))
    expect(sent).toEqual(['Bonjour', 'Suite'])
    expect(host.snapshot().queued).toEqual([])
    host.stop()
  })

  it('Stop pendant l’attente annule les tentatives, la file attend', async () => {
    const { host, retries, count, events } = createHost('reseau-coupe', {
      retryDelaysMs: [200, 200, 200, 200, 200]
    })
    await host.start()
    await host.prompt('Bonjour')
    await expect.poll(() => retries().length).toBe(1)
    await host.send('Suite')
    await host.cancel()
    expect(host.snapshot()).toMatchObject({ status: 'ready', queued: [{ text: 'Suite' }] })
    expect(host.snapshot().retry).toBeUndefined()
    expect(events.at(-2)).toMatchObject({ type: 'turn-end', stopReason: 'cancelled' })
    await new Promise((resolve) => setTimeout(resolve, 400))
    // Plus aucune tentative : une seule demande (la première), aucune erreur de tour.
    expect(retries()).toHaveLength(1)
    expect(count('turn-error')).toBe(0)
    expect(count('user-message')).toBe(1)
    host.stop()
  })

  it('le retour du réseau déclenche une tentative immédiate', async () => {
    const network = fakeNetwork()
    const { host, retries, transcript } = createHost('reseau-instable', {
      network,
      retryDelaysMs: [60_000, 60_000, 60_000, 60_000, 60_000]
    })
    await host.start()
    await host.prompt('Bonjour')
    await expect.poll(() => retries().length).toBe(1)
    network.restore()
    await expect.poll(() => retries().length).toBe(2)
    network.restore()
    await expect.poll(() => host.snapshot().status).toBe('ready')
    expect(agentTexts(transcript())).toEqual(['Réseau revenu : voici la réponse complète.'])
    host.stop()
  })

  it('une autre erreur reste une erreur du tour, sans tentative', async () => {
    const { host, retries, transcript } = createHost('erreur')
    await host.start()
    await host.prompt('Bonjour')
    expect(host.snapshot()).toMatchObject({ status: 'ready' })
    expect(retries()).toEqual([])
    const notice = transcript().at(-1)
    expect(notice?.kind === 'notice' && noticeText(notice)).toMatch(/Erreur simulée/)
    host.stop()
  })
})
