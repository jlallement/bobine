import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  type CatalogEntry,
  type Task,
  countFailures,
  fingerprint,
  firstMatch,
  formatDuration,
  globToRegExp,
  isFullRun,
  NO_MAP,
  nextTask,
  orderTasks,
  parseArgs,
  selectSuites,
  suiteSources,
  supported,
  tasksFor
} from './e2e-select.mts'
import { ALL_FEATURES } from '../src/shared/platform.ts'

const ROOT = join(import.meta.dirname, '..')

describe('parseArgs', () => {
  it('par défaut : toutes les suites, deux thèmes, 3 jobs, base main', () => {
    const o = parseArgs([])
    expect(o).toMatchObject({ suites: [], schemes: ['light', 'dark'], jobs: 3, base: 'main' })
    expect(isFullRun(o)).toBe(true)
  })

  it('valeurs séparées ou après =, suites nommées, thème', () => {
    const o = parseArgs(['plan', '--jobs', '5', '--lang=en', '--dark', 'history', '--base', 'x'])
    expect(o).toMatchObject({ suites: ['plan', 'history'], jobs: 5, lang: 'en', schemes: ['dark'] })
    expect(o.base).toBe('x')
    expect(isFullRun(o)).toBe(false)
  })

  it('refuse un nombre de jobs, une langue ou une option inconnus', () => {
    expect(() => parseArgs(['--jobs', '0'])).toThrow(/--jobs/)
    expect(() => parseArgs(['--jobs', '13'])).toThrow(/--jobs/)
    expect(() => parseArgs(['--jobs'])).toThrow(/valeur manquante/)
    expect(() => parseArgs(['--lang', 'de'])).toThrow(/Langue inconnue/)
    expect(() => parseArgs(['--vite'])).toThrow(/option inconnue/)
  })

  it('--if-needed ne se combine pas avec un filtre', () => {
    expect(parseArgs(['--if-needed']).ifNeeded).toBe(true)
    expect(() => parseArgs(['--if-needed', 'plan'])).toThrow(/--if-needed/)
    expect(() => parseArgs(['--if-needed', '--changed'])).toThrow(/--if-needed/)
  })

  it('--changed n’est pas une suite complète', () => {
    expect(isFullRun(parseArgs(['--changed']))).toBe(false)
  })
})

describe('motifs de fichiers', () => {
  it('* reste dans un dossier, ** les traverse, / final couvre le dossier', () => {
    expect(globToRegExp('src/main/agent/bob-*.ts').test('src/main/agent/bob-costs.ts')).toBe(true)
    expect(globToRegExp('src/*.ts').test('src/main/index.ts')).toBe(false)
    expect(globToRegExp('src/mock-agent/**').test('src/mock-agent/a/b.mts')).toBe(true)
    expect(globToRegExp('src/**/x.ts').test('src/x.ts')).toBe(true)
    expect(globToRegExp('src/main/android/').test('src/main/android/fixtures/f.txt')).toBe(true)
    expect(globToRegExp('e2e/fixtures/android*').test('e2e/fixtures/android.h264')).toBe(true)
    expect(globToRegExp('a.b').test('axb')).toBe(false)
  })

  it('firstMatch renvoie le motif qui couvre', () => {
    expect(firstMatch('src/shared/i18n/locales/fr.json', ['x', 'src/shared/i18n/**'])).toBe(
      'src/shared/i18n/**'
    )
    expect(firstMatch('docs/a.md', ['src/**'])).toBeUndefined()
  })
})

const CATALOG: CatalogEntry[] = [
  {
    name: 'subagents',
    file: 'subagents.mjs',
    themes: ['light', 'dark'],
    sources: ['src/shared/subagent.ts']
  },
  {
    name: 'plan',
    file: 'plan.mjs',
    themes: ['light', 'dark'],
    sources: ['src/shared/plan-doc.ts']
  },
  { name: 'libre', file: 'libre.mjs', themes: [null] }
]
const GLOBALS = ['src/renderer/src/styles.css', 'e2e/lib.mjs']

describe('selectSuites', () => {
  it('une source d’une suite la choisit, avec le fichier en raison', () => {
    const s = selectSuites(CATALOG, ['src/shared/subagent.ts', 'docs/x.md'], GLOBALS)
    expect(s.everything).toEqual([])
    expect(s.suites).toEqual([
      { name: 'subagents', why: ['src/shared/subagent.ts'] },
      { name: 'libre', why: [NO_MAP] }
    ])
    expect(s.unmapped).toEqual(['docs/x.md'])
  })

  it('le fichier de la suite elle-même la choisit', () => {
    expect(suiteSources(CATALOG[1] as CatalogEntry)).toContain('e2e/suites/plan.mjs')
    const s = selectSuites(CATALOG, ['e2e/suites/plan.mjs'], GLOBALS)
    expect(s.suites.map((x) => x.name)).toEqual(['plan', 'libre'])
  })

  it('un fichier global fait tout jouer', () => {
    const s = selectSuites(CATALOG, ['src/renderer/src/styles.css'], GLOBALS)
    expect(s.everything).toEqual(['src/renderer/src/styles.css'])
    expect(s.suites.map((x) => x.name)).toEqual(['subagents', 'plan', 'libre'])
    expect(s.suites[0]?.why).toEqual(['src/renderer/src/styles.css : tout'])
  })

  it('rien de modifié : seulement les suites sans carte', () => {
    expect(selectSuites(CATALOG, [], GLOBALS).suites.map((x) => x.name)).toEqual(['libre'])
  })
})

describe('tâches et ordonnancement', () => {
  it('une tâche par suite et par thème demandé ; sans thème, une seule', () => {
    expect(tasksFor(CATALOG, null, ['dark']).map((t) => t.key)).toEqual([
      'subagents:dark',
      'plan:dark',
      'libre:-'
    ])
    expect(tasksFor(CATALOG, ['plan'], ['light', 'dark']).map((t) => t.key)).toEqual([
      'plan:light',
      'plan:dark'
    ])
  })

  it('suite qui demande une capacité absente de la plateforme : sautée (fiche 145)', () => {
    const ios: CatalogEntry = {
      name: 'simulator',
      file: 'simulator.mjs',
      themes: ['light'],
      needs: ['simulator']
    }
    const linux = { ...ALL_FEATURES, simulator: false }
    expect(supported(ios, linux)).toBe(false)
    expect(CATALOG.every((entry) => supported(entry, linux))).toBe(true)
    expect(tasksFor([...CATALOG, ios], null, ['light'], linux).map((t) => t.name)).not.toContain(
      'simulator'
    )
    expect(tasksFor([ios], null, ['light']).map((t) => t.key)).toEqual(['simulator:light'])
  })

  const t = (key: string, extra: Partial<Task> = {}): Task => ({
    key,
    name: key,
    scheme: null,
    ...extra
  })

  it('les seules d’abord, puis les plus longues', () => {
    const order = orderTasks([t('a'), t('b'), t('q', { alone: true }), t('c')], {
      a: 10,
      b: 50,
      c: 30
    })
    expect(order.map((x) => x.key)).toEqual(['q', 'b', 'c', 'a'])
  })

  it('pas plus de jobs que demandé', () => {
    expect(nextTask([t('a')], [t('b'), t('c')], 2)).toBe(-1)
    expect(nextTask([t('a')], [t('b')], 2)).toBe(0)
  })

  it('une tâche seule attend que tout soit fini et bloque la file', () => {
    const queue = [t('q', { alone: true }), t('a')]
    expect(nextTask(queue, [t('b')], 3)).toBe(-1)
    expect(nextTask(queue, [], 3)).toBe(0)
    expect(nextTask([t('a')], [t('q', { alone: true })], 3)).toBe(-1)
  })

  it('deux tâches au même verrou ne se chevauchent pas, la suivante passe devant', () => {
    const clip = { locks: ['presse-papiers'] }
    expect(nextTask([t('d', clip), t('a')], [t('touches', clip)], 3)).toBe(1)
    expect(nextTask([t('d', clip)], [t('a')], 3)).toBe(0)
  })
})

describe('empreinte, durées, échecs', () => {
  const enc = (s: string) => new TextEncoder().encode(s)

  it('dépend du contenu et du chemin, pas de l’ordre', () => {
    const a = fingerprint([
      { path: 'a', content: enc('1') },
      { path: 'b', content: enc('2') }
    ])
    expect(
      fingerprint([
        { path: 'b', content: enc('2') },
        { path: 'a', content: enc('1') }
      ])
    ).toBe(a)
    expect(
      fingerprint([
        { path: 'a', content: enc('1') },
        { path: 'b', content: enc('3') }
      ])
    ).not.toBe(a)
    expect(
      fingerprint([
        { path: 'a', content: enc('1') },
        { path: 'b', content: null }
      ])
    ).not.toBe(a)
  })

  it('formatDuration', () => {
    expect(formatDuration(41_600)).toBe('42 s')
    expect(formatDuration(232_000)).toBe('3 min 52 s')
    expect(formatDuration(65_000)).toBe('1 min 05 s')
  })

  it('compte les lignes d’échec, pas le résumé final', () => {
    expect(countFailures('  ✓ ok\n  ✗ un\n  ✗ deux\n\n✗ 2 échec(s) en 3 s')).toBe(2)
  })
})

describe('catalogue des suites (e2e/catalog.mjs)', async () => {
  const path = join(ROOT, 'e2e', 'catalog.mjs')
  const { SUITES, GLOBAL_SOURCES } = (await import(path)) as {
    SUITES: CatalogEntry[]
    GLOBAL_SOURCES: string[]
  }
  const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
    cwd: ROOT,
    encoding: 'utf8'
  })
    .split('\n')
    .filter(Boolean)

  it('chaque suite a son fichier', () => {
    for (const s of SUITES)
      expect(existsSync(join(ROOT, 'e2e', 'suites', s.file)), s.name).toBe(true)
  })

  it('chaque motif couvre au moins un fichier du dépôt (carte à jour après un renommage)', () => {
    const patterns = [...GLOBAL_SOURCES, ...SUITES.flatMap((s) => s.sources ?? [])]
    const orphans = [...new Set(patterns)].filter(
      (p) => !files.some((f) => globToRegExp(p).test(f))
    )
    expect(orphans).toEqual([])
  })
})
