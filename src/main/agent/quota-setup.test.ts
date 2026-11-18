import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { QuotaReading, QuotaSource } from './adapters'
import type { AgentProfile } from './profiles'

vi.mock('electron', () => ({ app: { getVersion: () => '0.0.0-essai' } }))
vi.mock('../terminal/node-pty', () => ({
  spawnNodePty: () => {
    throw new Error('pas de terminal dans ces essais')
  }
}))

const { setupQuotas } = await import('./quota-setup')

/** Agent qui sait lire son quota (comme Bob) ; `read` compte les lectures. */
function quotaAgent(id: string) {
  const read = vi.fn(async (): Promise<QuotaReading> => ({
    leftovers: [],
    quota: { limit: 50, used: 40.79 }
  }))
  const quotaSource: QuotaSource = { id: 'bob-status', currency: 'bobcoins', read }
  const profile = { id, label: id, command: id, args: [], env: {}, quotaSource } as AgentProfile
  return { profile, read }
}

const settings = { credentials: () => Promise.resolve({}) }

/**
 * Fiche 242 (recette du 2026-11-17, D17) : à la relance, OpenCode choisi et aucun Bob lancé,
 * Bobine lisait pourtant le quota de Bob 3 s après le démarrage, ce qui crée puis supprime une
 * session dans le vrai `~/.bob`. Le quota se lit pour l'agent qui sert, jamais d'office.
 */
describe('quota : rien d’office au lancement (fiche 242, D17)', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  // Dossier personnel d'essai : seul l'agent factice (`mock`) est lisible (jamais le vrai Bob).
  const env = () => ({ BOBINE_CONFIG_HOME: mkdtempSync(join(tmpdir(), 'quota-setup-')) })

  it('agent installé mais pas utilisé : son quota n’est pas lu au lancement', async () => {
    const { profile, read } = quotaAgent('mock')
    const quotas = setupQuotas([profile], settings, () => {}, { env: env() })
    await vi.advanceTimersByTimeAsync(60_000)
    expect(read).not.toHaveBeenCalled()
    expect(quotas.list()).toEqual([])
    quotas.stop()
  })

  it('agent qui sert (prêt) ou relecture demandée : lu', async () => {
    const { profile, read } = quotaAgent('mock')
    const changed = vi.fn()
    const quotas = setupQuotas([profile], settings, changed, { env: env() })
    quotas.agentReady('mock')
    await vi.waitFor(() => expect(changed).toHaveBeenCalledTimes(1))
    await quotas.refresh('mock')
    expect(read).toHaveBeenCalledTimes(2)
    quotas.stop()
  })

  it('profil jetable sur le vrai dossier personnel : jamais lu, même prêt ou demandé', async () => {
    const { profile, read } = quotaAgent('mock')
    const quotas = setupQuotas([profile], settings, () => {}, { env: env(), disposable: true })
    quotas.agentReady('mock')
    await quotas.refresh()
    await quotas.refresh('mock')
    await vi.advanceTimersByTimeAsync(60_000)
    expect(read).not.toHaveBeenCalled()
    quotas.stop()
  })
})
