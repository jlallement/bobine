import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { TranscriptItem, TranscriptState } from '@shared/transcript'
import { IMPORTED_KEY, importHistoryOnce, turnsFromTranscript, type ImportRecord } from './import'
import { UsageJournal } from './journal'
import { openUsageDb } from './usage-db'

const context = {
  profileLabel: (id: string) => ({ opencode: 'OpenCode', bob: 'IBM Bob' })[id],
  repoRoot: (folder: string) => (folder.startsWith('/p/app') ? '/p/app' : undefined)
}

/** Un élément du fil sans son numéro (pour chaque genre d'élément). */
type Item = TranscriptItem extends infer T ? (T extends unknown ? Omit<T, 'id'> : never) : never

/** Éléments du fil, numérotés. */
function transcript(items: Item[], usage?: TranscriptState['usage']) {
  return {
    items: items.map((item, i) => ({ ...item, id: i + 1 }) as TranscriptItem),
    nextId: items.length + 1,
    ...(usage ? { usage } : {})
  }
}

const record: ImportRecord = { id: 'conv', profileId: 'opencode', workspace: '/p/app' }

describe('reprise de la consommation depuis les fils (fiche 137)', () => {
  it('un tour par message daté : jetons et coût du tour, fin, outils, modèle, dépôt', () => {
    const turns = turnsFromTranscript(
      record,
      transcript(
        [
          { kind: 'user', text: 'un', at: 1000, model: { id: 'gpt', name: 'GPT' } },
          {
            kind: 'tool',
            toolCallId: 't1',
            title: 'lit',
            toolKind: 'read',
            status: 'completed',
            content: [],
            locations: []
          },
          { kind: 'agent', text: 'réponse', at: 3000 },
          { kind: 'user', text: 'deux', at: 5000 },
          { kind: 'agent', text: 'réponse', at: 6000 },
          { kind: 'user', text: 'rejoué, sans heure' }
        ],
        {
          cost: { amount: 0.03, currency: 'USD' },
          turns: [
            { at: 3500, input: 100, output: 10, total: 110, costStart: 0, costEnd: 0.01 },
            { at: 6500, input: 200, output: 20, total: 220, costStart: 0.01, costEnd: 0.03 }
          ]
        }
      ),
      context
    )
    expect(turns).toEqual([
      {
        id: 'conv:1000',
        conversationId: 'conv',
        startedAt: 1000,
        endedAt: 3500,
        profileId: 'opencode',
        profileLabel: 'OpenCode',
        model: { id: 'gpt', name: 'GPT' },
        workspace: '/p/app',
        repoRoot: '/p/app',
        tokens: { input: 100, output: 10, total: 110 },
        cost: { amount: 0.01, currency: 'USD' },
        tools: { read: 1 },
        subagents: 0
      },
      expect.objectContaining({
        id: 'conv:5000',
        endedAt: 6500,
        tokens: { input: 200, output: 20, total: 220 },
        cost: { amount: 0.02, currency: 'USD' },
        tools: {}
      })
    ])
  })

  it('tour au-delà des 100 gardés : compté, fini à la dernière réponse, sans jetons', () => {
    const [turn] = turnsFromTranscript(
      record,
      transcript([
        { kind: 'user', text: 'un', at: 1000 },
        { kind: 'agent', text: 'a', at: 2000 },
        { kind: 'agent', text: 'b', at: 2500 }
      ]),
      context
    )
    expect(turn).toMatchObject({ endedAt: 2500, tokens: {} })
    expect(turn?.cost).toBeUndefined()
  })

  it('branche : ce qui précède la marque vient de l’origine, pas compté', () => {
    const turns = turnsFromTranscript(
      { ...record, id: 'branche' },
      transcript([
        { kind: 'user', text: 'origine', at: 1000 },
        { kind: 'agent', text: 'a', at: 1500 },
        { kind: 'branch', fromId: 'conv', fromTitle: 'Origine', restored: 0, skipped: 0 },
        { kind: 'user', text: 'nouveau', at: 9000 }
      ]),
      context
    )
    expect(turns.map((t) => t.id)).toEqual(['branche:9000'])
  })

  it('compte rendu d’une fille ignoré ; la fille compte chez elle, rattachée à sa mère', () => {
    const mother = turnsFromTranscript(
      record,
      transcript([
        { kind: 'user', text: 'lance', at: 1000 },
        {
          kind: 'child-report',
          childId: 'fille',
          title: 'Fille',
          outcome: 'done',
          files: [],
          fileCount: 0,
          added: 0,
          removed: 0,
          excerpt: '',
          at: 4000,
          usage: { turns: 3, total: 999, cost: { amount: 1, currency: 'USD' } }
        } as unknown as Item
      ]),
      context
    )
    expect(mother).toHaveLength(1)
    expect(mother[0]?.cost).toBeUndefined()
    const child = turnsFromTranscript(
      { ...record, id: 'fille', startedFrom: { id: 'conv' } },
      transcript([{ kind: 'user', text: 'tâche', at: 2000 }]),
      context
    )
    expect(child[0]).toMatchObject({ id: 'fille:2000', parentId: 'conv' })
  })

  it('bascule d’agent : les tours d’avant sont à l’agent d’avant, sans la consommation d’après', () => {
    const turns = turnsFromTranscript(
      { ...record, workspace: '/p/app/.wt/x', worktree: { root: '/p/app', path: '/p/app/.wt/x' } },
      transcript(
        [
          { kind: 'user', text: 'avec Bob', at: 1000 },
          { kind: 'agent', text: 'a', at: 1500 },
          {
            kind: 'handover',
            from: { profileId: 'bob', label: 'IBM Bob' },
            to: { profileId: 'opencode', label: 'OpenCode' }
          },
          { kind: 'user', text: 'avec OpenCode', at: 5000 }
        ],
        {
          cost: { amount: 0.01, currency: 'USD' },
          turns: [{ at: 5500, input: 1, output: 1, total: 2, costEnd: 0.01 }]
        }
      ),
      context
    )
    expect(turns.map((t) => [t.profileId, t.profileLabel, t.cost?.amount, t.repoRoot])).toEqual([
      ['bob', 'IBM Bob', undefined, '/p/app'],
      ['opencode', 'OpenCode', 0.01, '/p/app']
    ])
  })

  it('une seule fois, sans doublon avec le journal : un tour déjà écrit n’est pas recompté', async () => {
    const db = openUsageDb(join(mkdtempSync(join(tmpdir(), 'usage-import-')), 'usage.sqlite'))
    // Le journal (fiche 130) a déjà écrit le second tour, avec le même identifiant.
    const journal = new UsageJournal({
      db,
      describe: () => ({ profileId: 'opencode', profileLabel: 'OpenCode' }),
      now: () => 6000
    })
    journal.onEvent({
      conversationId: 'conv',
      event: { type: 'user-message', text: 'deux', at: 5000 }
    })
    journal.onEvent({ conversationId: 'conv', event: { type: 'turn-end', stopReason: 'end_turn' } })
    const fil = transcript([
      { kind: 'user', text: 'un', at: 1000 },
      { kind: 'user', text: 'deux', at: 5000 }
    ])
    const source = { records: [record], read: async () => fil }
    expect(await importHistoryOnce(db, source, context, () => 0)).toBe(1)
    expect(db.select().map((r) => [r.id, r.stopReason])).toEqual([
      ['conv:1000', undefined],
      ['conv:5000', 'end_turn']
    ])
    expect(db.meta(IMPORTED_KEY)).toBe('1970-01-01T00:00:00.000Z')
    // Relancée : rien.
    expect(await importHistoryOnce(db, source, context)).toBeUndefined()
    // Après une remise à zéro, le drapeau reste : rien n'est repris une seconde fois.
    db.clear()
    expect(await importHistoryOnce(db, source, context)).toBeUndefined()
    expect(db.select()).toEqual([])
    db.close()
  })

  it('un fil illisible est passé, les autres repris', async () => {
    const db = openUsageDb(join(mkdtempSync(join(tmpdir(), 'usage-import-')), 'usage.sqlite'))
    const source = {
      records: [record, { ...record, id: 'abime' }],
      read: async (id: string) =>
        id === 'abime' ? undefined : transcript([{ kind: 'user', text: 'un', at: 1000 }])
    }
    expect(await importHistoryOnce(db, source, context)).toBe(1)
    db.close()
  })
})
