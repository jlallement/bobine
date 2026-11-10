import { existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { AgentSnapshot, ConversationEvent } from '@shared/agent'
import type { AgentQuota } from '@shared/usage'
import type { QuotaContext, QuotaReading, QuotaSource } from './adapters'
import type { AgentProfile } from './profiles'
import type { Pty, SpawnPty } from '../terminal/terminal-manager'
import { bobStatusQuota } from './bob-status'
import {
  PAUSE_AFTER_FAILURE_MS,
  QuotaReader,
  quotaAfterCheck,
  quotaOnReady,
  READ_TIMEOUT_MS,
  RETRY_WHEN_READY_MS,
  quotaStatusDir,
  type QuotaReaderOptions
} from './quota'

const source = (read: (context: QuotaContext) => Promise<QuotaReading>): QuotaSource => ({
  id: 'bob-status',
  currency: 'bobcoins',
  read
})

const profile = (id: string, quotaSource?: QuotaSource): AgentProfile =>
  ({
    id,
    label: id === 'bob' ? 'IBM Bob' : id,
    command: id,
    args: [],
    env: { PROFIL: id },
    ...(quotaSource ? { quotaSource } : {})
  }) as AgentProfile

function reader(
  profiles: AgentProfile[],
  options: { available?: (p: AgentProfile) => boolean } = {}
) {
  const deleteSessions = vi.fn(async () => {})
  const quota = new QuotaReader({
    profiles,
    statusDir: mkdtempSync(join(tmpdir(), 'quota-')),
    spawnPty: () => {
      throw new Error('pas de terminal dans ces essais')
    },
    env: () => ({ HOME: '/maison' }),
    isAvailable: options.available ?? (() => true),
    credentials: () => Promise.resolve({ BOB_API_KEY: 'cle' }),
    deleteSessions,
    now: () => 1000
  })
  return { quota, deleteSessions }
}

describe('quota des agents (fiche 091)', () => {
  it('lit le quota dans un dossier réservé, supprime les sessions laissées, prévient', async () => {
    let context: QuotaContext | undefined
    const bob = profile(
      'bob',
      source(async (c) => {
        context = c
        return { quota: { limit: 1000, used: 812.5 }, leftovers: ['tache-vide'] }
      })
    )
    const { quota, deleteSessions } = reader([bob, profile('opencode')])
    const seen: AgentQuota[][] = []
    quota.subscribe((quotas) => seen.push(quotas))
    await quota.refresh()
    expect(context?.cwd).toMatch(/quota-[^/]+\/bob$/)
    expect(context?.timeoutMs).toBe(READ_TIMEOUT_MS)
    expect(context?.env).toMatchObject({ HOME: '/maison', PROFIL: 'bob', BOB_API_KEY: 'cle' })
    expect(deleteSessions).toHaveBeenCalledWith(bob, context?.cwd, ['tache-vide'])
    const expected: AgentQuota = {
      profileId: 'bob',
      profileLabel: 'IBM Bob',
      currency: 'bobcoins',
      limit: 1000,
      used: 812.5,
      readAt: 1000
    }
    expect(quota.list()).toEqual([expected])
    expect(seen).toEqual([[expected]])
  })

  it('échec : sessions supprimées quand même, lecture précédente gardée', async () => {
    let fail = false
    const bob = profile(
      'bob',
      source(async () =>
        fail
          ? { leftovers: ['autre-vide'], problem: 'pas de chiffres' }
          : { quota: { limit: null, used: 3 }, leftovers: [] }
      )
    )
    const { quota, deleteSessions } = reader([bob])
    await quota.refresh()
    fail = true
    await quota.refresh('bob')
    expect(deleteSessions).toHaveBeenCalledTimes(1)
    expect(deleteSessions).toHaveBeenCalledWith(bob, expect.any(String), ['autre-vide'])
    expect(quota.list()).toMatchObject([{ limit: null, used: 3 }])
  })

  it('agent absent ou sans quota : rien ; deux demandes à la fois : une seule lecture', async () => {
    const read = vi.fn(
      () =>
        new Promise<QuotaReading>((resolve) =>
          setTimeout(() => resolve({ quota: { limit: 50, used: 1 }, leftovers: [] }), 10)
        )
    )
    const absent = reader([profile('bob', source(read))], { available: () => false })
    await absent.quota.refresh()
    expect(read).not.toHaveBeenCalled()
    const { quota } = reader([profile('bob', source(read)), profile('opencode')])
    await Promise.all([quota.refresh(), quota.refresh('bob')])
    expect(read).toHaveBeenCalledTimes(1)
  })

  it('adaptateur en erreur : quota inconnu, rien ne casse', async () => {
    const { quota } = reader([
      profile(
        'bob',
        source(async () => {
          throw new Error('bob introuvable')
        })
      )
    ])
    await expect(quota.refresh()).resolves.toBeUndefined()
    expect(quota.list()).toEqual([])
  })
})

/**
 * Faux `bob chat` dans un pseudo-terminal : `connected` montre le panneau de `/status`, sinon un
 * écran de connexion qui n'y arrive jamais. Retient le dossier et les arguments de chaque lancement.
 */
function fakeBob(state: { connected: boolean }) {
  const runs: { cwd: string | undefined; args: string[] }[] = []
  const spawnPty: SpawnPty = (_command, args, options) => {
    runs.push({ cwd: options.cwd, args })
    let onData: (data: string) => void = () => {}
    let typed = ''
    const pty: Pty = {
      pid: 1,
      process: 'bob',
      onData: (listener) => {
        onData = listener
        setTimeout(() => onData(state.connected ? 'Bob Shell\r\n> ' : 'Please sign in'), 5)
      },
      onExit: () => {},
      write: (data) => {
        typed += data
        if (state.connected && typed.endsWith('/status\r')) {
          onData('\r\nMonthly Budget: 300.00\r\nMonthly Usage: 12.34\r\n')
        }
      },
      resize: () => {},
      kill: () => {}
    }
    return pty
  }
  return { spawnPty, runs }
}

const timings = { quietMs: 20, retypeMs: 200, pollMs: 5, enterDelayMs: 5 }

function bobReader(statusDir: string, spawnPty: SpawnPty, clock: { now: number }) {
  const bob = profile('bob', bobStatusQuota({ dbPath: '/nulle/part/bob.db', timings }))
  const options: QuotaReaderOptions = {
    profiles: [bob],
    statusDir,
    spawnPty,
    env: () => ({}),
    isAvailable: () => true,
    credentials: () => Promise.resolve({}),
    deleteSessions: async () => {},
    timeoutMs: 300,
    now: () => clock.now
  }
  return new QuotaReader(options)
}

describe('quota : un seul dossier, pas d’attente à chaque lancement (D6, D11)', () => {
  it('dossier stable, propre à Bobine, hors des données de l’app', () => {
    expect(quotaStatusDir('/Users/moi', {}, 'darwin')).toBe(
      '/Users/moi/Library/Caches/Bobine/agent-status'
    )
    expect(quotaStatusDir('/home/moi', {}, 'linux')).toBe('/home/moi/.cache/bobine/agent-status')
    expect(quotaStatusDir('/home/moi', { XDG_CACHE_HOME: '/c' }, 'linux')).toBe(
      '/c/bobine/agent-status'
    )
    expect(READ_TIMEOUT_MS).toBeLessThanOrEqual(20_000)
  })

  it('deux profils de Bobine (temporaires compris) : le même dossier, avec `--trust`', async () => {
    const statusDir = quotaStatusDir(mkdtempSync(join(tmpdir(), 'maison-')), {}, 'darwin')
    const fake = fakeBob({ connected: true })
    const clock = { now: 1000 }
    // Deux lancements, deux profils (données de l'app différentes) : un seul dossier de lecture.
    await bobReader(statusDir, fake.spawnPty, clock).refresh(undefined, { automatic: true })
    await bobReader(statusDir, fake.spawnPty, clock).refresh(undefined, { automatic: true })
    expect(fake.runs).toHaveLength(2)
    expect(new Set(fake.runs.map((r) => r.cwd))).toEqual(new Set([join(statusDir, 'bob')]))
    expect(fake.runs[0]?.args).toContain('--trust')
  })

  it('Bob pas connecté : un essai court, puis plus de lecture au lancement pendant la pause', async () => {
    const statusDir = mkdtempSync(join(tmpdir(), 'quota-pause-'))
    const state = { connected: false }
    const fake = fakeBob(state)
    const clock = { now: 1000 }
    const first = bobReader(statusDir, fake.spawnPty, clock)
    const started = Date.now()
    await first.refresh(undefined, { automatic: true })
    expect(Date.now() - started).toBeLessThan(5000)
    expect(first.list()).toEqual([])
    expect(fake.runs).toHaveLength(1)
    expect(existsSync(join(statusDir, 'bob.pause.json'))).toBe(true)

    // Lancements suivants (nouvel objet, même machine) : rien de lancé pendant la pause.
    clock.now += 60_000
    await bobReader(statusDir, fake.spawnPty, clock).refresh(undefined, { automatic: true })
    expect(fake.runs).toHaveLength(1)

    // Relecture demandée : elle passe ; connecté, la pause est levée.
    state.connected = true
    const asked = bobReader(statusDir, fake.spawnPty, clock)
    await asked.refresh('bob')
    expect(fake.runs).toHaveLength(2)
    expect(asked.list()).toMatchObject([{ limit: 300, used: 12.34 }])
    expect(existsSync(join(statusDir, 'bob.pause.json'))).toBe(false)
  })

  it('pause finie : nouvel essai au lancement ; fichier de pause abîmé : ignoré', async () => {
    const statusDir = mkdtempSync(join(tmpdir(), 'quota-pause-'))
    const fake = fakeBob({ connected: false })
    const clock = { now: 1000 }
    await bobReader(statusDir, fake.spawnPty, clock).refresh(undefined, { automatic: true })
    clock.now += PAUSE_AFTER_FAILURE_MS + 1
    await bobReader(statusDir, fake.spawnPty, clock).refresh(undefined, { automatic: true })
    expect(fake.runs).toHaveLength(2)

    for (const bad of ['{ abîmé', '{"until":"demain"}', 'null', '[]']) {
      writeFileSync(join(statusDir, 'bob.pause.json'), bad)
      await bobReader(statusDir, fake.spawnPty, clock).refresh(undefined, { automatic: true })
    }
    expect(fake.runs).toHaveLength(6)
  })
})

describe('quota : relu quand l’agent se montre prêt (fiche 205, recette 0.11.1)', () => {
  it('lancé déconnecté, connecté ensuite par SSO : le plafond est lu à la session suivante', async () => {
    const statusDir = mkdtempSync(join(tmpdir(), 'quota-pret-'))
    const state = { connected: false }
    const fake = fakeBob(state)
    const clock = { now: 1000 }
    const quota = bobReader(statusDir, fake.spawnPty, clock)
    await quota.refresh(undefined, { automatic: true })
    expect(fake.runs).toHaveLength(1)
    expect(quota.list()).toEqual([])

    // Session ouverte juste après l'échec (toujours déconnecté) : pas de nouvel essai aussitôt.
    clock.now += 60_000
    await quota.agentReady('bob')
    expect(fake.runs).toHaveLength(1)

    // Connexion par SSO, puis une session s'ouvre : relu malgré la pause du lancement.
    state.connected = true
    clock.now += RETRY_WHEN_READY_MS
    await quota.agentReady('bob')
    expect(fake.runs).toHaveLength(2)
    expect(quota.list()).toMatchObject([{ limit: 300, used: 12.34 }])
    expect(existsSync(join(statusDir, 'bob.pause.json'))).toBe(false)

    // Quota connu : les sessions suivantes ne relancent rien.
    clock.now += 2 * RETRY_WHEN_READY_MS
    await quota.agentReady('bob')
    expect(fake.runs).toHaveLength(2)
  })

  it('pause d’un lancement précédent : l’agent prêt la lève ; agent inconnu ou absent : rien', async () => {
    const statusDir = mkdtempSync(join(tmpdir(), 'quota-pret-'))
    const state = { connected: false }
    const fake = fakeBob(state)
    const clock = { now: 1000 }
    await bobReader(statusDir, fake.spawnPty, clock).refresh(undefined, { automatic: true })
    state.connected = true
    clock.now += 60_000
    const next = bobReader(statusDir, fake.spawnPty, clock)
    await next.refresh(undefined, { automatic: true })
    expect(fake.runs).toHaveLength(1)
    await next.agentReady('opencode')
    expect(fake.runs).toHaveLength(1)
    await next.agentReady('bob')
    expect(fake.runs).toHaveLength(2)
    expect(next.list()).toMatchObject([{ limit: 300 }])

    const { quota } = reader(
      [
        profile(
          'bob',
          source(async () => ({ leftovers: [] }))
        )
      ],
      {
        available: () => false
      }
    )
    await expect(quota.agentReady('bob')).resolves.toBeUndefined()
  })
})

describe('quota : ce qui dit l’agent prêt (fiche 205)', () => {
  const snapshot = (status: string) => ({ status }) as AgentSnapshot

  it('conversation dont l’agent passe « prêt » : son profil ; autres évènements : rien', () => {
    const agentReady = vi.fn()
    const bob = profile('bob')
    const { event } = quotaOnReady({ agentReady }, (id) => (id === 'c1' ? bob : undefined))
    const status = (conversationId: string, value: string) =>
      event?.({
        conversationId,
        event: { type: 'status', snapshot: snapshot(value) }
      } as ConversationEvent)
    status('c1', 'starting')
    status('c1', 'needs-action')
    status('perdue', 'ready')
    expect(agentReady).not.toHaveBeenCalled()
    status('c1', 'ready')
    expect(agentReady).toHaveBeenCalledWith('bob')
  })

  it('diagnostic : seulement quand une session d’essai a été ouverte', () => {
    const agentReady = vi.fn()
    quotaAfterCheck({ agentReady }, 'bob', { snapshot: snapshot('ready'), session: 'skipped' })
    quotaAfterCheck({ agentReady }, 'bob', { snapshot: snapshot('ready') })
    quotaAfterCheck({ agentReady }, 'bob', {
      snapshot: snapshot('needs-action'),
      session: 'deleted'
    })
    expect(agentReady).not.toHaveBeenCalled()
    quotaAfterCheck({ agentReady }, 'bob', { snapshot: snapshot('ready'), session: 'deleted' })
    expect(agentReady).toHaveBeenCalledWith('bob')
  })
})

describe('quota : l’app quitte pendant une lecture (fiche 208)', () => {
  it('lecture en cours : `bob chat` fermé tout de suite, rien écrit ni lancé après', async () => {
    const statusDir = mkdtempSync(join(tmpdir(), 'quota-'))
    let killed = 0
    let spawned = 0
    // `bob chat` qui démarre et n'arrive jamais aux chiffres (pas connecté, lent).
    const spawnPty: SpawnPty = () => {
      spawned++
      return {
        pid: 1,
        process: 'bob',
        onData: () => {},
        onExit: () => {},
        write: () => {},
        resize: () => {},
        kill: () => void killed++
      }
    }
    const deleteSessions = vi.fn(async () => {})
    const bob = profile('bob', bobStatusQuota({ dbPath: '/nulle/part/bob.db', timings }))
    const quota = new QuotaReader({
      profiles: [bob],
      statusDir,
      spawnPty,
      env: () => ({}),
      isAvailable: () => true,
      credentials: () => Promise.resolve({}),
      deleteSessions,
      timeoutMs: 60_000
    })
    const listener = vi.fn()
    quota.subscribe(listener)
    const reading = quota.refresh()
    await vi.waitFor(() => expect(spawned).toBe(1))
    const started = Date.now()
    quota.stop()
    await reading
    expect(Date.now() - started).toBeLessThan(1000)
    expect(killed).toBe(1)
    expect(deleteSessions).not.toHaveBeenCalled()
    expect(listener).not.toHaveBeenCalled()
    // Pas de pause posée : la lecture n'a pas échoué, elle a été arrêtée.
    expect(existsSync(join(statusDir, 'bob.pause.json'))).toBe(false)
    // Plus de lecture ensuite, ni demandée ni « agent prêt ».
    await quota.refresh('bob')
    await quota.agentReady('bob')
    expect(spawned).toBe(1)
  })

  it('l’adaptateur rend sa lecture après l’arrêt : ni suppression de sessions ni quota', async () => {
    let release: ((reading: QuotaReading) => void) | undefined
    const bob = profile(
      'bob',
      source(() => new Promise<QuotaReading>((resolve) => (release = resolve)))
    )
    const { quota, deleteSessions } = reader([bob])
    const reading = quota.refresh()
    await vi.waitFor(() => expect(release).toBeDefined())
    quota.stop()
    release?.({ quota: { limit: 10, used: 1 }, leftovers: ['tache-vide'] })
    await reading
    expect(deleteSessions).not.toHaveBeenCalled()
    expect(quota.list()).toEqual([])
  })
})
