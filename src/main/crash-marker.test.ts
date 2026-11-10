import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  utimesSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  CRASH_REPORTS_DIR,
  endRunMark,
  pruneReports,
  RUN_MARK_FILE,
  startRunMark,
  type RunFacts
} from './crash-marker'
import { setReadOnlyProfile } from './storage'

const facts = (dir: string, now: Date): RunFacts => ({
  version: '0.11.0',
  electron: '45.0.0',
  os: '27.2',
  now,
  pid: 1234,
  logFile: join(dir, 'main.log'),
  dumpsDir: join(dir, 'crash-dumps')
})

describe('marque « en cours » et rapport local (fiche 194)', () => {
  it('lancement propre : pas de rapport ; la marque part en quittant', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bobine-marque-'))
    expect(startRunMark(dir, facts(dir, new Date('2026-11-07T08:00:00Z')))).toBeUndefined()
    expect(existsSync(join(dir, RUN_MARK_FILE))).toBe(true)
    endRunMark(dir)
    expect(existsSync(join(dir, RUN_MARK_FILE))).toBe(false)
    expect(startRunMark(dir, facts(dir, new Date('2026-11-07T09:00:00Z')))).toBeUndefined()
  })

  it('marque restée (kill -9) : rapport avec la fin du journal et les minidumps, rien d’autre', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bobine-marque-'))
    startRunMark(dir, facts(dir, new Date('2026-11-07T08:00:00Z')))
    writeFileSync(join(dir, 'main.log'), 'ligne 1\nDémarrage\nderniere ligne avant plantage\n')
    mkdirSync(join(dir, 'crash-dumps', 'completed'), { recursive: true })
    writeFileSync(join(dir, 'crash-dumps', 'completed', 'abc.dmp'), 'MDMP')
    const during = new Date('2026-11-07T08:30:00Z')
    utimesSync(join(dir, 'crash-dumps', 'completed', 'abc.dmp'), during, during)
    // Un minidump d'avant ce lancement n'est pas le sien.
    writeFileSync(join(dir, 'crash-dumps', 'completed', 'ancien.dmp'), 'MDMP')
    const before = new Date('2026-11-06T08:30:00Z')
    utimesSync(join(dir, 'crash-dumps', 'completed', 'ancien.dmp'), before, before)
    const report = startRunMark(dir, facts(dir, new Date('2026-11-07T09:00:00Z')))
    expect(report).toBe(join(dir, CRASH_REPORTS_DIR, '2026-11-07-09-00-00'))
    if (!report) throw new Error('rapport attendu')
    const text = readFileSync(join(report, 'rapport.txt'), 'utf8')
    expect(text).toContain('rien n’a été envoyé')
    expect(text).toContain('mémoire de Bobine')
    expect(text).toContain('2026-11-07T08:00:00.000Z (pid 1234, version 0.11.0)')
    expect(text).toContain('derniere ligne avant plantage')
    expect(readdirSync(report).sort()).toEqual(['abc.dmp', 'rapport.txt'])
    // La marque de ce lancement remplace l'ancienne : un seul rapport par plantage.
    endRunMark(dir)
    expect(startRunMark(dir, facts(dir, new Date('2026-11-07T10:00:00Z')))).toBeUndefined()
  })

  it('garde les dix rapports les plus récents, de moins de trente jours', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bobine-rapports-'))
    const now = new Date('2026-11-07T00:00:00Z')
    for (let i = 0; i < 13; i++) {
      const report = join(dir, `r${String(i).padStart(2, '0')}`)
      mkdirSync(report)
      const at = new Date(now.getTime() - i * 3600_000) // r00 le plus récent
      utimesSync(report, at, at)
    }
    const old = join(dir, 'vieux')
    mkdirSync(old)
    const longAgo = new Date(now.getTime() - 40 * 24 * 3600_000)
    utimesSync(old, longAgo, longAgo)
    pruneReports(dir, now)
    expect(readdirSync(dir).sort()).toEqual(
      Array.from({ length: 10 }, (_, i) => `r${String(i).padStart(2, '0')}`)
    )
  })

  it('profil en lecture seule (fiche 196) : ni marque, ni rapport, ni ménage', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bobine-marque-'))
    // Marque restée d'un plantage : en lecture seule, elle n'est ni lue en rapport ni retirée.
    writeFileSync(join(dir, RUN_MARK_FILE), '{"pid":1,"startedAt":"2026-11-07T07:00:00Z"}\n')
    setReadOnlyProfile(dir)
    try {
      expect(startRunMark(dir, facts(dir, new Date('2026-11-07T08:00:00Z')))).toBeUndefined()
      endRunMark(dir)
      expect(readdirSync(dir)).toEqual([RUN_MARK_FILE])
    } finally {
      setReadOnlyProfile(undefined)
    }
  })
})
