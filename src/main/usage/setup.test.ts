import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { dayKey } from '@shared/usage-periods'
import { MOCK_AGENT_ENTRY } from '../../mock-agent/testing.mts'
import type { AgentProfile } from '../agent/profiles'
import { continueWith } from '../conversations/handover'
import { ConversationManager } from '../conversations/manager'
import { setupUsageJournal, USAGE_DB_FILE, watchedUsageDb } from './setup'
import { openUsageDb } from './usage-db'

function waitFor(predicate: () => boolean, timeoutMs = 8000): Promise<void> {
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

const mock = (id: string, label: string, env = {}): AgentProfile => ({
  id,
  label,
  command: process.execPath,
  args: [MOCK_AGENT_ENTRY, '--scenario', 'streaming-texte', '--delay', '0'],
  env
})

describe('journal branché sur le gestionnaire de conversations (fiche 130)', () => {
  it('les lignes restent après le passage à un autre agent et la suppression de la conversation', async () => {
    const root = mkdtempSync(join(tmpdir(), 'usage-setup-'))
    const workspace = mkdtempSync(join(tmpdir(), 'ws-usage-'))
    const manager = new ConversationManager({
      profiles: [
        mock('premier', 'Premier agent'),
        mock('second', 'Second agent', { MOCK_MODELS: 'llmaas/qwen3-32b=LLMaaS/Qwen3 32B' })
      ],
      settingsFile: join(root, 'settings.json'),
      conversationsDir: join(root, 'conversations'),
      defaultWorkspace: workspace,
      neutralFolder: workspace,
      pathEnv: () => process.env['PATH'],
      agentHome: mkdtempSync(join(tmpdir(), 'maison-vide-'))
    })
    const usage = setupUsageJournal(manager, join(root, USAGE_DB_FILE))
    const { activeId: id } = manager.state()
    const status = () => manager.view(id).snapshot?.status
    await manager.startActive()
    await manager.prompt(id, 'Bonjour')
    await waitFor(() => status() === 'ready' && usage.db.select().length === 1)

    await continueWith(manager, () => [], id, 'second', 'llmaas/qwen3-32b')
    await manager.prompt(id, 'Continue')
    await waitFor(() => status() === 'ready' && usage.db.select().length === 2)
    await manager.delete(id, { fromAgent: false })

    const rows = usage.db.select()
    usage.close()
    manager.stopAll()
    expect(rows.map((r) => [r.conversationId, r.profileId, r.profileLabel, r.stopReason])).toEqual([
      [id, 'premier', 'Premier agent', 'end_turn'],
      [id, 'second', 'Second agent', 'end_turn']
    ])
    expect(rows[1]?.model).toEqual({ id: 'llmaas/qwen3-32b', name: 'LLMaaS/Qwen3 32B' })
    expect(rows[0]?.workspace).toBe(workspace)
    expect(rows.every((r) => r.cost?.currency === 'USD')).toBe(true)
  }, 20_000)

  it('tableau (fiche 137) : deux tours comptés, filtre d’agent, remise à zéro puis de nouveau compté', async () => {
    const root = mkdtempSync(join(tmpdir(), 'usage-board-'))
    const workspace = mkdtempSync(join(tmpdir(), 'ws-board-'))
    const manager = new ConversationManager({
      profiles: [mock('premier', 'Premier agent')],
      settingsFile: join(root, 'settings.json'),
      conversationsDir: join(root, 'conversations'),
      defaultWorkspace: workspace,
      neutralFolder: workspace,
      pathEnv: () => process.env['PATH'],
      agentHome: mkdtempSync(join(tmpdir(), 'maison-vide-'))
    })
    const spend = { currency: 'bobcoins', today: 0.1, week: 0.2, month: 0.3 }
    const source = {
      id: 'bob-db' as const,
      currency: 'bobcoins',
      session: () => undefined,
      spend: () => spend
    }
    const usage = setupUsageJournal(manager, join(root, USAGE_DB_FILE), {
      profiles: [
        // Installé : sa dépense sur ce Mac est montrée ; Bob, absent du gestionnaire, ne l'est pas.
        { id: 'premier', label: 'Premier agent', chartSlot: 2, costSource: source },
        { id: 'bob', label: 'IBM Bob', costSource: source }
      ]
    })
    const { activeId: id } = manager.state()
    const status = () => manager.view(id).snapshot?.status
    await manager.startActive()
    for (const text of ['Un', 'Deux']) {
      await manager.prompt(id, text)
      await waitFor(() => status() === 'ready' && usage.db.select().length >= 1)
    }
    await waitFor(() => usage.db.select().length === 2)
    const today = { scope: 'day' as const, date: dayKey(new Date()) }
    const stats = usage.board.stats(today)
    expect(stats.totals.turns).toBe(2)
    expect(stats.agentSeries).toEqual([{ key: 'premier', label: 'Premier agent', slot: 2 }])
    expect(stats.conversations[0]?.title).toBe(manager.view(id).summary.title)
    expect(usage.board.stats({ ...today, profileId: 'bob' }).totals.turns).toBe(0)
    expect(usage.board.csv(today, 'turns').content.trimEnd().split('\r\n')).toHaveLength(3)
    const heat = usage.board.heatmap({ range: 'last12' })
    expect([heat.total, heat.days.at(-1)?.turns, heat.labels['premier']]).toEqual([
      2,
      2,
      'Premier agent'
    ])
    expect(usage.board.csv(today, 'days').content.trimEnd().split('\r\n')).toHaveLength(2)
    expect(usage.board.spends()).toEqual([
      { profileId: 'premier', profileLabel: 'Premier agent', ...spend }
    ])

    usage.board.reset()
    expect(usage.board.stats({ ...today, scope: 'all' }).totals.turns).toBe(0)
    await manager.prompt(id, 'Trois')
    await waitFor(() => status() === 'ready' && usage.db.select().length === 1)
    expect(usage.board.stats(today).totals.turns).toBe(1)
    usage.close()
    manager.stopAll()
  }, 20_000)
})

describe('journal qui prévient (fiche 144)', () => {
  it('un tour écrit, une reprise, une remise à zéro : un seul signal regroupé ; une lecture, rien', async () => {
    const changed = vi.fn()
    const db = watchedUsageDb(
      openUsageDb(join(mkdtempSync(join(tmpdir(), 'journal-')), 'u.sqlite')),
      changed
    )
    const row = {
      id: 'c:1',
      conversationId: 'c',
      startedAt: 1000,
      profileId: 'mock',
      tokens: {},
      tools: {},
      subagents: 0
    }
    db.upsert(row)
    db.upsert({ ...row, endedAt: 2000 })
    db.select()
    await new Promise((r) => setTimeout(r, 300))
    expect(changed).toHaveBeenCalledTimes(1)
    expect(db.insertMissing([row])).toBe(0)
    db.clear()
    await new Promise((r) => setTimeout(r, 300))
    expect(changed).toHaveBeenCalledTimes(2)
    db.close()
  })
})
