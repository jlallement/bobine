import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { describe, expect, it } from 'vitest'
import { MIGRATIONS, mutedUsageDb, openUsageDb, SCHEMA_VERSION, type TurnRow } from './usage-db'

const dbFile = () => join(mkdtempSync(join(tmpdir(), 'usage-db-')), 'usage.sqlite')

const row = (over: Partial<TurnRow> = {}): TurnRow => ({
  id: 'c1:1000',
  conversationId: 'c1',
  startedAt: 1000,
  endedAt: 3500,
  profileId: 'mock',
  profileLabel: 'Agent factice',
  stopReason: 'end_turn',
  tokens: {},
  tools: {},
  subagents: 0,
  ...over
})

const pragma = (file: string, name: string): unknown => {
  const db = new DatabaseSync(file, { readOnly: true })
  try {
    return Object.values(db.prepare(`PRAGMA ${name}`).get() ?? {})[0]
  } finally {
    db.close()
  }
}

describe('base du journal de consommation (fiche 130)', () => {
  it('créée au dernier schéma, en mode WAL', () => {
    const file = dbFile()
    openUsageDb(file).close()
    expect(pragma(file, 'user_version')).toBe(SCHEMA_VERSION)
    expect(pragma(file, 'journal_mode')).toBe('wal')
  })

  it('une ligne complète relue telle quelle ; une valeur absente reste absente', () => {
    const db = openUsageDb(dbFile())
    const full = row({
      parentId: 'mere',
      model: { id: 'factice-precis', name: 'Factice précis' },
      mode: { id: 'code', name: 'Code' },
      workspace: '/tmp/projet/.worktrees/a',
      repoRoot: '/tmp/projet',
      tokens: {
        input: 800,
        output: 100,
        cachedRead: 500,
        cachedWrite: 20,
        thought: 40,
        total: 900
      },
      cost: { amount: 0.0125, currency: 'USD' },
      context: { used: 900, size: 200000 },
      tools: { read: 2, edit: 1 },
      subagents: 1,
      subagentCost: { amount: 0.002, currency: 'bobcoins' }
    })
    db.upsert(full)
    db.upsert(row({ id: 'c2:2000', conversationId: 'c2', startedAt: 2000, endedAt: undefined }))
    const [first, second] = db.select()
    expect(first).toEqual(full)
    expect(second).toEqual({
      id: 'c2:2000',
      conversationId: 'c2',
      startedAt: 2000,
      profileId: 'mock',
      profileLabel: 'Agent factice',
      stopReason: 'end_turn',
      tokens: {},
      tools: {},
      subagents: 0
    })
    db.close()
  })

  it('même identifiant : la ligne est réécrite (coût de Bob lu après coup)', () => {
    const db = openUsageDb(dbFile())
    db.upsert(row())
    db.upsert(row({ cost: { amount: 0.0125, currency: 'bobcoins' } }))
    expect(db.select().map((r) => r.cost)).toEqual([{ amount: 0.0125, currency: 'bobcoins' }])
    db.close()
  })

  it('filtre : période (début inclus, fin exclue), agent, modèle', () => {
    const db = openUsageDb(dbFile())
    db.upsert(row({ id: 'a', startedAt: 1000 }))
    db.upsert(row({ id: 'b', startedAt: 2000, model: { id: 'm2', name: 'M2' } }))
    db.upsert(row({ id: 'c', startedAt: 3000, profileId: 'opencode' }))
    const ids = (filter: Parameters<typeof db.select>[0]) => db.select(filter).map((r) => r.id)
    expect(ids({})).toEqual(['a', 'b', 'c'])
    expect(ids({ from: 2000, to: 3000 })).toEqual(['b'])
    expect(ids({ profileId: 'opencode' })).toEqual(['c'])
    expect(ids({ modelId: 'm2' })).toEqual(['b'])
    db.close()
  })

  it('migration : une base à la version 0 (vide) passe au dernier schéma sans rien perdre', () => {
    const file = dbFile()
    const raw = new DatabaseSync(file)
    raw.exec('CREATE TABLE autre (x INTEGER); INSERT INTO autre VALUES (7)')
    raw.close()
    const db = openUsageDb(file)
    db.upsert(row())
    db.close()
    expect(pragma(file, 'user_version')).toBe(MIGRATIONS.length)
    const check = new DatabaseSync(file, { readOnly: true })
    expect(check.prepare('SELECT x FROM autre').get()).toEqual({ x: 7 })
    check.close()
  })

  it('base abîmée : mise de côté, recréée, l’app continue', () => {
    const file = dbFile()
    writeFileSync(file, 'ceci n’est pas une base SQLite, mais un fichier abîmé'.repeat(100))
    const db = openUsageDb(file, () => new Date('2026-10-23T10:00:00Z'))
    db.upsert(row())
    expect(db.select()).toHaveLength(1)
    db.close()
    const folder = join(file, '..')
    expect(readdirSync(folder)).toContain('usage.sqlite.broken-2026-10-23T10-00-00-000Z')
  })

  it('base d’une version plus récente de l’app : jamais touchée, journal muet', () => {
    const file = dbFile()
    const raw = new DatabaseSync(file)
    raw.exec(`PRAGMA user_version = ${SCHEMA_VERSION + 1}`)
    raw.close()
    const db = openUsageDb(file)
    db.upsert(row())
    expect(db.select()).toEqual([])
    db.close()
    expect(pragma(file, 'user_version')).toBe(SCHEMA_VERSION + 1)
    expect(readdirSync(join(file, '..')).some((f) => f.includes('broken'))).toBe(false)
  })

  it('dossier impossible : journal muet, aucune exception', () => {
    const db = openUsageDb(join(dbFile(), 'absent', 'usage.sqlite'))
    expect(() => db.upsert(row())).not.toThrow()
    expect(db.select()).toEqual([])
    db.close()
  })

  it('fichier écrasé pendant le lancement : aucune exception', () => {
    const file = dbFile()
    const db = openUsageDb(file)
    db.upsert(row({ id: 'avant' }))
    // Écrase le fichier pendant que la base est ouverte (disque abîmé). SQLite sert encore ses
    // pages en cache et son WAL, et réécrit le fichier à la fermeture : rien ne doit lever.
    writeFileSync(file, Buffer.alloc(8192, 0xff))
    expect(() => db.upsert(row({ id: 'apres' }))).not.toThrow()
    expect(() => db.select()).not.toThrow()
    expect(() => db.close()).not.toThrow()
    const next = openUsageDb(file)
    expect(() => next.upsert(row({ id: 'ensuite' }))).not.toThrow()
    next.close()
  })
})

describe('base du journal : reprise et remise à zéro (fiche 137)', () => {
  it('migration 2 : une base de la fiche 130 (version 1) garde ses lignes et gagne `meta`', () => {
    const file = dbFile()
    const raw = new DatabaseSync(file)
    raw.exec(MIGRATIONS[0] ?? '')
    raw.exec(
      "INSERT INTO turns (id, conversation_id, started_at, profile_id) VALUES ('c1:1', 'c1', 1, 'mock'); PRAGMA user_version = 1"
    )
    raw.close()
    const db = openUsageDb(file)
    expect(db.select().map((r) => r.id)).toEqual(['c1:1'])
    db.setMeta('imported_at', 'hier')
    expect(db.meta('imported_at')).toBe('hier')
    db.close()
    expect(pragma(file, 'user_version')).toBe(2)
  })

  it('ajout des tours absents seulement : un tour déjà écrit garde sa ligne', () => {
    const db = openUsageDb(dbFile())
    db.upsert(row({ stopReason: 'end_turn' }))
    const added = db.insertMissing([
      row({ stopReason: undefined, tokens: { input: 1 } }),
      row({ id: 'c1:2000', startedAt: 2000 })
    ])
    expect(added).toBe(1)
    expect(db.select().map((r) => [r.id, r.stopReason, r.tokens])).toEqual([
      ['c1:1000', 'end_turn', {}],
      ['c1:2000', 'end_turn', {}]
    ])
    expect(db.insertMissing([])).toBe(0)
    db.close()
  })

  it('agents et modèles de tout le journal', () => {
    const db = openUsageDb(dbFile())
    db.upsert(row())
    db.upsert(row({ id: 'c1:2', model: { id: 'gpt', name: 'GPT' } }))
    db.upsert(row({ id: 'c1:3', model: { id: 'gpt', name: 'GPT' } }))
    expect(db.series()).toEqual([
      { profileId: 'mock', profileLabel: 'Agent factice' },
      { profileId: 'mock', profileLabel: 'Agent factice', model: { id: 'gpt', name: 'GPT' } }
    ])
    db.close()
  })

  it('premier tour du journal, de tous les agents ou d’un seul (fiche 144)', () => {
    const db = openUsageDb(dbFile())
    expect(db.firstStartedAt()).toBeUndefined()
    db.upsert(row({ id: 'c1:5000', startedAt: 5000 }))
    db.upsert(row({ id: 'c2:3000', startedAt: 3000, profileId: 'bob' }))
    expect([db.firstStartedAt(), db.firstStartedAt('mock'), db.firstStartedAt('x')]).toEqual([
      3000,
      5000,
      undefined
    ])
    db.close()
  })

  it('remise à zéro : plus aucun tour, ni dans le fichier ; `meta` reste ; la base resert', () => {
    const file = dbFile()
    const db = openUsageDb(file)
    db.upsert(row({ workspace: '/Users/moi/secret-du-projet' }))
    db.setMeta('imported_at', 'hier')
    db.clear()
    expect(db.select()).toEqual([])
    expect(db.meta('imported_at')).toBe('hier')
    db.upsert(row({ id: 'c1:9' }))
    expect(db.select()).toHaveLength(1)
    db.close()
    const bytes = readdirSync(join(file, '..'))
      .map((name) => readFileSync(join(file, '..', name)).toString('latin1'))
      .join('')
    expect(bytes.includes('secret-du-projet')).toBe(false)
  })

  it('journal muet : rien à lire, rien à effacer', () => {
    const db = mutedUsageDb
    expect([db.insertMissing([row()]), db.series(), db.meta('x')]).toEqual([0, [], undefined])
    db.clear()
  })
})
