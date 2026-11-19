import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { AgentEvent } from '@shared/agent'
import type { CommitDraftResult } from '@shared/commit-draft'
import type { TranscriptItem } from '@shared/transcript'
import { MOCK_AGENT_ENTRY } from '../../mock-agent/testing.mts'
import { bobDbCosts, readBobSpend } from '../agent/bob-costs'
import type { AgentProfile } from '../agent/profiles'
import { eventLog } from '../agent/test-events'
import { runCommand } from '../simulator/run'
import { CommitDrafts, type CommitDraftConversations } from './commit-draft'

const ITEMS: TranscriptItem[] = [
  { kind: 'user', id: 1, text: 'Ajoute le filtre par statut\napi_key = "sk-abcdefghijklmnop"' },
  { kind: 'agent', id: 2, text: 'C’est fait.' }
]

/** Dépôt jetable : un commit, puis deux fichiers modifiés, un nouveau et un `.env`. */
function repo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'draft-'))
  const git = (...a: string[]) =>
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@x.invalid', ...a], { cwd: dir })
  git('init', '-q', '-b', 'main')
  writeFileSync(join(dir, 'README.md'), '# Carnet\n')
  writeFileSync(join(dir, 'app.js'), 'const a = 1\n')
  git('add', '.')
  git('commit', '-q', '-m', 'init')
  writeFileSync(
    join(dir, 'app.js'),
    'const a = 2\nconst token = "ghp_abcdefghijklmnopqrstuvwxyz0123456789"\n'
  )
  writeFileSync(join(dir, 'filters.js'), 'export const f = 1\n')
  writeFileSync(join(dir, '.env'), 'SECRET_VALUE=do-not-send\n')
  return dir
}

const FILES = [
  { path: 'app.js', status: 'modified' as const },
  { path: 'filters.js', status: 'untracked' as const },
  { path: '.env', status: 'untracked' as const }
]

const hosts: CommitDrafts[] = []
afterEach(() => {
  for (const drafts of hosts.splice(0)) drafts.stopAll()
})

function setup(
  commit: string | undefined,
  options: { timeoutMs?: number; enabled?: boolean; bobDb?: string; lateCostMs?: number } = {}
) {
  const dir = repo()
  const pids = join(mkdtempSync(join(tmpdir(), 'draft-pids-')), 'pids')
  writeFileSync(pids, '')
  const profile: AgentProfile = {
    id: 'mock',
    label: 'Agent factice',
    command: process.execPath,
    args: [
      MOCK_AGENT_ENTRY,
      '--scenario',
      'echo',
      '--delay',
      '0',
      '--trust',
      // Comme Bob (fiche 254) : coût hors protocole, écrit dans sa base après la réponse.
      ...(options.bobDb ? ['--cout-bob', '--bob-db', options.bobDb] : [])
    ],
    env: {
      MOCK_AGENT_PID_FILE: pids,
      ...(commit ? { MOCK_AGENT_COMMIT: commit } : {})
    },
    ...(options.bobDb ? { costSource: bobDbCosts(options.bobDb) } : {})
  }
  // Ce que la rédaction pose dans la conversation (son coût), attendable.
  const postedLog = eventLog<AgentEvent>()
  const posted = postedLog.events
  const noted: string[][] = []
  const listeners: Parameters<CommitDraftConversations['subscribe']>[0][] = []
  // Évènements des hôtes de rédaction, vus par l'essai aussi (fiche 250) : de quoi attendre que la
  // demande soit partie plutôt que deviner le temps d'ouverture de la session.
  const host = eventLog<AgentEvent>()
  const conversations: CommitDraftConversations = {
    asideHost: (_id, emit) => ({
      profile,
      workspace: '/nulle-part',
      emit: (event) => {
        emit(event)
        host.emit(event)
      },
      conversationId: 'c1'
    }),
    view: () => ({ transcript: { items: ITEMS } }),
    title: () => 'Ajoute le filtre par statut',
    post: (_id, event) => postedLog.emit(event),
    noteAsideSession: (...note) => noted.push(note),
    subscribe: (l) => {
      listeners.push(l)
      return () => {}
    }
  }
  const drafts = new CommitDrafts({
    conversations,
    cwdFor: () => Promise.resolve(dir),
    memories: () =>
      Promise.resolve([
        {
          name: 'commit-style',
          description: 'Commit messages',
          body: 'Conventional Commits in English.'
        }
      ]),
    enabled: () => options.enabled ?? true,
    run: runCommand,
    timeoutMs: options.timeoutMs ?? 20_000,
    lateCostMs: options.lateCostMs ?? 0
  })
  hosts.push(drafts)
  return { dir, drafts, pids, posted, postedLog, noted, listeners, host }
}

const alive = (pid: number) => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

/** Les processus lancés (pids inscrits par l'agent factice) ; tous doivent finir. */
async function noAgentLeft(pids: string, drafts: CommitDrafts): Promise<number> {
  const list = readFileSync(pids, 'utf8').split('\n').filter(Boolean).map(Number)
  const started = Date.now()
  while (Date.now() - started < 8_000) {
    if (drafts.active === 0 && list.every((pid) => !alive(pid))) return list.length
    await new Promise((r) => setTimeout(r, 50))
  }
  throw new Error(
    `agent encore vivant : ${list.filter(alive).join(', ')} (actives ${drafts.active})`
  )
}

/** La demande de rédaction est partie : un hôte est au travail (statut `busy`). */
function waitStarted(host: ReturnType<typeof eventLog<AgentEvent>>): Promise<void> {
  return host.until(() =>
    host.events.some((e) => e.type === 'status' && e.snapshot.status === 'busy')
  )
}

const isAgent = (r: CommitDraftResult): r is Extract<CommitDraftResult, { source: 'agent' }> =>
  r.source === 'agent'

describe('CommitDrafts (fiche 246)', () => {
  it('réponse normale : message de l’agent, fichiers cochés, notes, secret retenu, lignes masquées ; agent arrêté, session supprimée', async () => {
    const { drafts, pids, posted, noted } = setup(undefined)
    const result = await drafts.draft('c1', { files: FILES, place: 'conversation' })
    expect(isAgent(result)).toBe(true)
    if (!isAgent(result)) return
    expect(result.message.split('\n')[0]).toBe('feat: update app.js, filters.js and 1 more')
    // Ce que l'agent a reçu, d'après ce qu'il en dit.
    expect(result.message).toContain('3 file(s)')
    expect(result.message).toContain('user notes received')
    expect(result.message).toContain('first request received')
    expect(result.message).toContain('1 withheld')
    // Le jeton de app.js et la clé du premier message : lignes masquées.
    expect(result.message).toContain('2 redacted')
    expect(result.withMemory).toBe(true)
    expect(result.agentLabel).toBeTruthy()
    expect(await noAgentLeft(pids, drafts)).toBe(1)
    // L'agent factice sait supprimer sa session : rien à retenir.
    expect(noted).toEqual([])
    expect(posted.filter((e) => e.type === 'aside-cost').length).toBeLessThanOrEqual(1)
  })

  it('réponse lente au-delà du délai : repli `timeout` en anglais, agent arrêté', async () => {
    const { drafts, pids } = setup('message-commit-lent', { timeoutMs: 2_500 })
    const started = Date.now()
    const result = await drafts.draft('c1', { files: FILES, place: 'conversation' })
    expect(result).toMatchObject({ source: 'fallback', reason: 'timeout', timeoutMs: 2_500 })
    expect(Date.now() - started).toBeLessThan(6_000)
    expect(result.message.split('\n')[0]).toBe('chore: update app.js, filters.js and .env')
    expect(await noAgentLeft(pids, drafts)).toBe(1)
  })

  it('refus (`stopReason: refusal`) : repli `refused`, agent arrêté', async () => {
    const { drafts, pids } = setup('message-commit-refus')
    const result = await drafts.draft('c1', { files: FILES, place: 'conversation' })
    expect(result).toMatchObject({ source: 'fallback', reason: 'refused' })
    expect(await noAgentLeft(pids, drafts)).toBe(1)
  })

  it('erreur de l’agent : repli `failed` avec la raison, agent arrêté', async () => {
    const { drafts, pids } = setup('message-commit-erreur')
    const result = await drafts.draft('c1', { files: FILES, place: 'conversation' })
    expect(result).toMatchObject({ source: 'fallback', reason: 'failed' })
    expect(result.source === 'fallback' && result.detail).toContain('model overloaded')
    expect(await noAgentLeft(pids, drafts)).toBe(1)
  })

  it('jamais d’écriture : l’agent tente de modifier README.md et de lancer une commande, tout est refusé, le dépôt est intact', async () => {
    const { dir, drafts, pids } = setup('message-commit-ecriture')
    const status = () =>
      execFileSync('git', ['status', '--porcelain', '-uall'], { cwd: dir }).toString()
    const before = status()
    const result = await drafts.draft('c1', { files: FILES, place: 'conversation' })
    expect(isAgent(result)).toBe(true)
    expect(readFileSync(join(dir, 'README.md'), 'utf8')).toBe('# Carnet\n')
    expect(existsSync(join(dir, 'pwned.txt'))).toBe(false)
    expect(status()).toBe(before)
    expect(await noAgentLeft(pids, drafts)).toBe(1)
  })

  it('« Arrêter » pendant la rédaction : repli `stopped`, agent arrêté', async () => {
    const { drafts, pids, host } = setup('message-commit-lent')
    const pending = drafts.draft('c1', { files: FILES, place: 'conversation' })
    await waitStarted(host)
    drafts.stop('c1')
    expect(await pending).toMatchObject({ source: 'fallback', reason: 'stopped' })
    expect(await noAgentLeft(pids, drafts)).toBe(1)
  })

  it('sortie de l’app pendant la rédaction : agent arrêté', async () => {
    const { drafts, pids, listeners, host } = setup('message-commit-lent')
    const pending = drafts.draft('c1', { files: FILES, place: 'conversation' })
    await waitStarted(host)
    for (const l of listeners) l.stopped?.()
    expect(await pending).toMatchObject({ source: 'fallback', reason: 'stopped' })
    expect(await noAgentLeft(pids, drafts)).toBe(1)
  })

  it('nouvelle demande : la précédente s’arrête, son agent aussi', async () => {
    const { drafts, pids, host } = setup('message-commit-lent', { timeoutMs: 3_000 })
    const first = drafts.draft('c1', { files: FILES, place: 'conversation' })
    await waitStarted(host)
    const second = drafts.draft('c1', { files: FILES.slice(0, 1), place: 'conversation' })
    expect(await first).toMatchObject({ reason: 'stopped' })
    expect(await second).toMatchObject({ reason: 'timeout' })
    expect(await noAgentLeft(pids, drafts)).toBe(2)
  })

  it('coût écrit par l’agent après sa réponse (Bob, fiche 254 D1) : lu avant la suppression de la session, ajouté à la conversation', async () => {
    const bobDb = join(mkdtempSync(join(tmpdir(), 'draft-bob-db-')), 'bob.db')
    // Borne large : l'attente finit dès que le coût arrive (300 ms après la réponse chez l'agent
    // factice), jamais au bout de la borne.
    const { drafts, pids, posted, postedLog } = setup(undefined, {
      bobDb,
      lateCostMs: 15_000
    })
    const result = await drafts.draft('c1', { files: FILES, place: 'conversation' })
    expect(isAgent(result)).toBe(true)
    await postedLog.until(() => posted.some((e) => e.type === 'aside-cost'))
    expect(posted.filter((e) => e.type === 'aside-cost')).toEqual([
      { type: 'aside-cost', cost: { amount: 0.0125, currency: 'bobcoins' } }
    ])
    expect(await noAgentLeft(pids, drafts)).toBe(1)
    // Session supprimée ensuite : comme chez Bob, sa ligne de coût part avec elle (la dépense
    // n'est plus dans sa base) ; seul le coût lu avant la suppression pouvait être compté.
    expect(readBobSpend(new Date(), bobDb)?.today).toBe(0)
  })

  it('coût donné par ACP (OpenCode, fiche 254 D1) : ajouté à la conversation, une seule fois', async () => {
    const { drafts, pids, posted } = setup(undefined)
    const result = await drafts.draft('c1', { files: FILES, place: 'conversation' })
    expect(isAgent(result)).toBe(true)
    expect(await noAgentLeft(pids, drafts)).toBe(1)
    const costs = posted.filter((e) => e.type === 'aside-cost')
    expect(costs).toHaveLength(1)
    expect(costs[0]?.type === 'aside-cost' && costs[0].cost.amount).toBeGreaterThan(0)
  })

  it('réglage désactivé : le repli tout de suite, aucun agent lancé', async () => {
    const { drafts, pids } = setup(undefined, { enabled: false })
    const result = await drafts.draft('c1', { files: FILES, place: 'conversation' })
    expect(result).toMatchObject({ source: 'fallback', reason: 'disabled' })
    expect(await noAgentLeft(pids, drafts)).toBe(0)
  })
})
