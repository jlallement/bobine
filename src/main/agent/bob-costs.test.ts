import { EventEmitter } from 'node:events'
import { mkdtempSync, watch, writeFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  readBobSpend,
  readBobSubagents,
  readBobTaskCost,
  watchBobDb,
  type WatchDir
} from './bob-costs'
import { writeBobTaskCost, writeBobTaskCostLogged } from '../../mock-agent/scenario.mts'

function bobDb(rows: [string, string][]): string {
  const file = join(mkdtempSync(join(tmpdir(), 'bob-db-')), 'bob.db')
  const db = new DatabaseSync(file)
  db.exec('CREATE TABLE tasks (id TEXT PRIMARY KEY, title TEXT, costs TEXT)')
  for (const [id, costs] of rows)
    db.prepare('INSERT INTO tasks VALUES (?, ?, ?)').run(id, 't', costs)
  db.close()
  return file
}

describe('coût Bob (base locale, lecture seule)', () => {
  it('lit le coût et le contexte d’une tâche (format relevé sur Bob 2.0.6)', () => {
    const file = bobDb([['4f9dc17291ec', '{"cost":0.021006,"contextTokens":10503}']])
    expect(readBobTaskCost('4f9dc17291ec', file)).toEqual({
      amount: 0.021006,
      contextTokens: 10503
    })
  })

  it('ajoute le coût des sous-agents (lignes filles, comme Bob 2.0.6), même imbriqués', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'bob-db-')), 'bob.db')
    const db = new DatabaseSync(file)
    db.exec('CREATE TABLE tasks (id TEXT PRIMARY KEY, parent_id TEXT, task_type TEXT, costs TEXT)')
    const insert = db.prepare('INSERT INTO tasks VALUES (?, ?, ?, ?)')
    insert.run('parent', null, 'normal', '{"cost":0.048076,"contextTokens":10607}')
    insert.run('fille', 'parent', 'subagent', '{"cost":0.005852}')
    insert.run('petite-fille', 'fille', 'subagent', '{"cost":0.001}')
    insert.run('illisible', 'parent', 'subagent', 'pas du json')
    insert.run('autre', null, 'normal', '{"cost":9}')
    db.close()
    expect(readBobTaskCost('parent', file)).toEqual({ amount: 0.054928, contextTokens: 10607 })
  })

  it('rien en cas de surprise : tâche inconnue, JSON inattendu, base absente ou corrompue', () => {
    const file = bobDb([
      ['a', 'pas du json'],
      ['b', '{"cost":"cher"}']
    ])
    expect(readBobTaskCost('inconnue', file)).toBeUndefined()
    expect(readBobTaskCost('a', file)).toBeUndefined()
    expect(readBobTaskCost('b', file)).toBeUndefined()
    expect(readBobTaskCost('a', join(tmpdir(), 'absente', 'bob.db'))).toBeUndefined()
    const broken = join(mkdtempSync(join(tmpdir(), 'bob-db-')), 'bob.db')
    writeFileSync(broken, 'pas une base')
    expect(readBobTaskCost('a', broken)).toBeUndefined()
    expect(readBobTaskCost("x' OR 1=1 --", file)).toBeUndefined()
  })
})

describe('dépense en bobcoins (aujourd’hui, 7 jours, ce mois)', () => {
  it('tâches utilisées aujourd’hui, sur sept jours, ce mois-ci ; lignes douteuses ignorées', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'bob-spend-')), 'bob.db')
    const db = new DatabaseSync(file)
    db.exec('CREATE TABLE tasks (id TEXT PRIMARY KEY, costs TEXT, updated_at INTEGER)')
    const now = new Date(2026, 9, 13, 15, 0)
    const at = (days: number, hour: number) => new Date(2026, 9, 13 - days, hour).getTime()
    const insert = db.prepare('INSERT INTO tasks VALUES (?, ?, ?)')
    insert.run('a', '{"cost":0.1}', at(0, 9))
    insert.run('b', '{"cost":0.25}', at(0, 1))
    insert.run('c', '{"cost":0.5}', at(3, 10))
    insert.run('d', '{"cost":2}', at(9, 10))
    insert.run('g', '{"cost":4}', at(13, 10))
    insert.run('e', 'pas du json', at(0, 10))
    insert.run('f', '{"cost":-1}', at(0, 11))
    db.close()
    expect(readBobSpend(now, file)).toEqual({
      currency: 'bobcoins',
      today: 0.35,
      week: 0.85,
      month: 2.85
    })
    expect(readBobSpend(now, join(tmpdir(), 'absente.db'))).toBeUndefined()
  })
})

describe('sous-agents Bob (fiche 053)', () => {
  it('lignes `subagent` de la conversation, dans l’ordre de création, coût s’il est lisible', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'bob-db-')), 'bob.db')
    const db = new DatabaseSync(file)
    db.exec(
      'CREATE TABLE tasks (id TEXT PRIMARY KEY, parent_id TEXT, task_type TEXT, title TEXT, created_at INTEGER, costs TEXT)'
    )
    const insert = db.prepare('INSERT INTO tasks VALUES (?, ?, ?, ?, ?, ?)')
    insert.run('parent', null, 'normal', 'Conversation', 1, '{"cost":0.05}')
    insert.run('deux', 'parent', 'subagent', 'Lis b.txt', 20, '{"cost":0.0031}')
    insert.run('un', 'parent', 'subagent', 'Lis a.txt', 10, '{"cost":0.0058519999999999996}')
    insert.run('pas-encore', 'parent', 'subagent', 'Lis c.txt', 30, null)
    insert.run('sous-tache', 'parent', 'subtask', 'Autre', 15, '{"cost":1}')
    insert.run('ailleurs', 'autre', 'subagent', 'Lis a.txt', 12, '{"cost":1}')
    db.close()
    expect(readBobSubagents('parent', file)).toEqual([
      { id: 'un', title: 'Lis a.txt', createdAt: 10, cost: 0.005852 },
      { id: 'deux', title: 'Lis b.txt', createdAt: 20, cost: 0.0031 },
      { id: 'pas-encore', title: 'Lis c.txt', createdAt: 30 }
    ])
    expect(readBobSubagents('parent', join(tmpdir(), 'absente', 'bob.db'))).toBeUndefined()
    expect(readBobSubagents("x' OR 1=1", file)).toBeUndefined()
  })

  it('schéma inattendu : rien', () => {
    expect(readBobSubagents('a', bobDb([['a', '{"cost":1}']]))).toBeUndefined()
  })
})

describe('veille de la base de Bob (CI Windows du 2026-11-18)', () => {
  /** Veille simulée : les évènements sont donnés par l'essai, sans dépendre du système. */
  function fakeWatchDir() {
    const watcher = Object.assign(new EventEmitter(), { closed: false, close() {} })
    watcher.close = () => {
      watcher.closed = true
    }
    let listener: ((event: string, file: string | Buffer | null) => void) | undefined
    let watched: string | undefined
    const watchDir: WatchDir = (dir, _options, l) => {
      watched = dir
      listener = l
      return watcher
    }
    return {
      watchDir,
      watcher,
      emit: (file: string | Buffer | null) => listener?.('rename', file),
      dir: () => watched
    }
  }

  it('prévient pour la base, son journal et son WAL, base créée à cette écriture comprise', () => {
    const fake = fakeWatchDir()
    let changes = 0
    const stop = watchBobDb(join('home', '.bob', 'db', 'bob.db'), () => changes++, fake.watchDir)
    expect(fake.dir()).toBe(join('home', '.bob', 'db'))
    fake.emit('bob.db') // Création de la base, à la première écriture du coût.
    fake.emit('bob.db-wal')
    fake.emit('bob.db-journal')
    fake.emit(Buffer.from('bob.db-shm'))
    fake.emit(null) // Nom inconnu (le système ne le dit pas toujours) : relu par prudence.
    expect(changes).toBe(5)
    fake.emit('autre.db')
    fake.emit('notes.txt')
    expect(changes).toBe(5)
    stop()
    expect(fake.watcher.closed).toBe(true)
  })

  it('veille en erreur : fermée, sans exception', () => {
    const fake = fakeWatchDir()
    watchBobDb(join('x', 'bob.db'), () => {}, fake.watchDir)
    fake.watcher.emit('error', new Error('EPERM'))
    expect(fake.watcher.closed).toBe(true)
  })

  it('vrai dossier : une écriture du coût par l’agent factice est signalée, base créée comprise', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'bob-veille-'))
    const db = join(dir, 'bob.db')
    const seen: string[] = []
    let changes = 0
    const stop = watchBobDb(
      db,
      () => changes++,
      (folder, options, listener) =>
        watch(folder, options, (event, file) => {
          seen.push(String(file))
          listener(event, file)
        })
    )
    try {
      // Veille armée d'abord. Sous macOS, `fs.watch` ouvre son flux FSEvents en différé (libuv, sur
      // son fil CoreFoundation) : une écriture faite avant est perdue pour de bon, et l'essai
      // attendait jusqu'à son délai (15 s, suite complète en cours, 2026-11-21). Un fichier témoin,
      // hors de la base, est écrit jusqu'à être vu : la veille est alors en place, sans supposer de
      // délai. L'écriture vérifiée, elle, n'a lieu qu'une fois.
      let probes = 0
      await vi.waitFor(
        () => {
          writeFileSync(join(dir, 'temoin'), String(probes++))
          expect(seen).toContain('temoin')
        },
        { timeout: 10_000, interval: 50 }
      )
      const before = changes
      writeBobTaskCost(db, 'mock-1', 0.0125)
      await vi.waitFor(() => expect(changes).toBeGreaterThan(before), { timeout: 10_000 })
      expect(seen.some((file) => file.startsWith('bob.db'))).toBe(true)
      expect(readBobTaskCost('mock-1', db)?.amount).toBe(0.0125)
    } finally {
      stop()
    }
  })

  it('dossier absent : rien à guetter, sans erreur', () => {
    const stop = watchBobDb(join(tmpdir(), 'bob-absent-x9', 'db', 'bob.db'), () => {})
    expect(() => stop()).not.toThrow()
  })
})

describe('coût écrit par l’agent factice pendant une lecture (CI Windows du 2026-11-19)', () => {
  it('une lecture en cours ne bloque pas l’écriture : base en WAL, comme celle de Bob', () => {
    const db = join(mkdtempSync(join(tmpdir(), 'bob-wal-')), 'bob.db')
    writeBobTaskCost(db, 'mock-1', 0.0125)
    // Lecture de l'app qui croise l'écriture du tour suivant (veille, relecture à heure fixe).
    const reader = new DatabaseSync(db, { readOnly: true })
    try {
      reader.exec('BEGIN')
      reader.prepare('SELECT costs FROM tasks').all()
      const started = Date.now()
      // En mode journal, l'écrivain attendait la fin de la lecture (5 s), puis échouait.
      expect(() => writeBobTaskCost(db, 'mock-1', 0.025)).not.toThrow()
      expect(Date.now() - started).toBeLessThan(1000)
      reader.exec('COMMIT')
      expect(reader.prepare('PRAGMA journal_mode').get()).toEqual({ journal_mode: 'wal' })
    } finally {
      reader.close()
    }
    expect(readBobTaskCost('mock-1', db)?.amount).toBe(0.025)
  }, 10_000)

  it('écriture impossible : dite sur stderr, l’agent continue', () => {
    const notADir = join(mkdtempSync(join(tmpdir(), 'bob-ko-')), 'fichier')
    writeFileSync(notADir, '')
    const lines: string[] = []
    const ok = writeBobTaskCostLogged(join(notADir, 'db', 'bob.db'), 'mock-1', 0.0125, (l) =>
      lines.push(l)
    )
    expect(ok).toBe(false)
    expect(lines).toEqual([expect.stringMatching(/coût de Bob PAS écrit \(mock-1\) : .+/)])
    const db = join(mkdtempSync(join(tmpdir(), 'bob-ok-')), 'bob.db')
    expect(writeBobTaskCostLogged(db, 'mock-1', 0.0125, (l) => lines.push(l))).toBe(true)
    expect(lines.at(-1)).toMatch(/coût de Bob écrit : 0\.0125 \(mock-1\)/)
  })
})
