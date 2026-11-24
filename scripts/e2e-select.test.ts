import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  type CatalogEntry,
  type Task,
  countFailures,
  defaultJobs,
  effectiveThemes,
  failedControls,
  indicativeWarnings,
  fingerprint,
  firstMatch,
  formatDuration,
  globToRegExp,
  isCi,
  isFullRun,
  NO_MAP,
  nextTask,
  orderTasks,
  parseArgs,
  schemesOf,
  quarantinedOn,
  selectSuites,
  suiteSources,
  supported,
  tasksFor,
  staleFailureFiles
} from './e2e-select.mts'
import { ALL_FEATURES } from '../src/shared/platform.ts'

const ROOT = join(import.meta.dirname, '..')

describe('parseArgs', () => {
  it('--skip : suites écartées, répétable ; la suite n’est plus complète (fiche 145)', () => {
    const o = parseArgs(['--skip', 'perf', '--skip=aurore'])
    expect(o.skip).toEqual(['perf', 'aurore'])
    expect(isFullRun(o)).toBe(false)
    expect(() => parseArgs(['--skip'])).toThrow('--skip : suite manquante')
  })

  it('par défaut : toutes les suites, sombre ciblé, 3 jobs, base main ; pas une suite complète', () => {
    const o = parseArgs([])
    expect(o).toMatchObject({ suites: [], themes: 'auto', jobs: 3, base: 'main' })
    expect(isFullRun(o)).toBe(false)
  })

  it('--themes both : les deux thèmes partout, la suite complète (ADR-0071)', () => {
    const o = parseArgs(['--themes', 'both'])
    expect(o.themes).toBe('both')
    expect(isFullRun(o)).toBe(true)
    expect(parseArgs(['--themes=light']).themes).toBe('light')
    expect(parseArgs(['--light']).themes).toBe('light')
    expect(() => parseArgs(['--themes', 'tous'])).toThrow(/--themes/)
    expect(() => parseArgs(['--themes', 'both', '--dark'])).toThrow(/un seul/)
    expect(() => parseArgs(['--light', '--dark'])).toThrow(/un seul/)
  })

  it('--if-needed (avant un tag) : les deux thèmes partout, jamais un seul', () => {
    const o = parseArgs(['--if-needed'])
    expect(o.themes).toBe('both')
    expect(isFullRun(o)).toBe(true)
    expect(parseArgs(['--if-needed', '--themes', 'both']).themes).toBe('both')
    expect(() => parseArgs(['--if-needed', '--dark'])).toThrow(/--if-needed/)
    expect(() => parseArgs(['--if-needed', '--themes', 'light'])).toThrow(/--if-needed/)
  })

  it('--jobs par défaut : celui de la machine, sauf --jobs explicite (fiche 279)', () => {
    expect(parseArgs([], { jobs: 5 }).jobs).toBe(5)
    expect(parseArgs(['--jobs', '3'], { jobs: 5 }).jobs).toBe(3)
  })

  it('valeurs séparées ou après =, suites nommées, thème', () => {
    const o = parseArgs(['plan', '--jobs', '5', '--lang=en', '--dark', 'history', '--base', 'x'])
    expect(o).toMatchObject({ suites: ['plan', 'history'], jobs: 5, lang: 'en', themes: 'dark' })
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

  it('--indicative : drapeau, absent par défaut (fiche 250)', () => {
    expect(parseArgs([]).indicative).toBe(false)
    expect(parseArgs(['--indicative', 'perf']).indicative).toBe(true)
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

describe('jobs par défaut (fiche 279)', () => {
  it('en local : un job pour 3 cœurs, au plus 5, au moins 1', () => {
    expect(defaultJobs(15, false)).toBe(5)
    expect(defaultJobs(24, false)).toBe(5)
    expect(defaultJobs(12, false)).toBe(4)
    expect(defaultJobs(8, false)).toBe(2)
    expect(defaultJobs(2, false)).toBe(1)
  })

  it('en CI : 3, quelle que soit la machine', () => {
    expect(defaultJobs(15, true)).toBe(3)
    expect(defaultJobs(2, true)).toBe(3)
    expect(isCi({ GITHUB_ACTIONS: 'true' })).toBe(true)
    expect(isCi({ CI: 'true' })).toBe(true)
    expect(isCi({})).toBe(false)
  })
})

describe('thèmes joués (ADR-0071)', () => {
  const dark: CatalogEntry = {
    name: 'aurore',
    file: 'aurore.mjs',
    themes: ['light', 'dark'],
    dark: true
  }
  const plain: CatalogEntry = { name: 'plan', file: 'plan.mjs', themes: ['light', 'dark'] }
  const none: CatalogEntry = { name: 'libre', file: 'libre.mjs', themes: [null] }

  it('par défaut : le clair partout, le sombre seulement pour une suite déclarée sombre', () => {
    expect(schemesOf(dark, 'auto')).toEqual(['light', 'dark'])
    expect(schemesOf(plain, 'auto')).toEqual(['light'])
    expect(schemesOf(none, 'auto')).toEqual([null])
    expect(tasksFor([dark, plain, none], null, 'auto').map((t) => t.key)).toEqual([
      'aurore:light',
      'aurore:dark',
      'plan:light',
      'libre:-'
    ])
  })

  it('--themes both (nuit, avant un tag) : les deux thèmes partout', () => {
    expect(tasksFor([dark, plain, none], null, 'both').map((t) => t.key)).toEqual([
      'aurore:light',
      'aurore:dark',
      'plan:light',
      'plan:dark',
      'libre:-'
    ])
  })

  it('--light, --dark : ce thème seulement, même pour une suite non déclarée', () => {
    expect(schemesOf(dark, 'light')).toEqual(['light'])
    expect(schemesOf(plain, 'dark')).toEqual(['dark'])
  })

  it('un fichier de thème ou de style touché : toutes les suites en sombre', () => {
    expect(effectiveThemes('auto', ['src/renderer/src/pr-card.css'])).toBe('both')
    expect(effectiveThemes('auto', [])).toBe('auto')
    // Un thème demandé explicitement l'emporte.
    expect(effectiveThemes('light', ['src/renderer/src/styles.css'])).toBe('light')
  })
})

describe('campagne de nuit (e2e.yml, ADR-0071)', () => {
  it('la nuit joue les deux thèmes partout, macOS et Linux ; à la main, le sombre ciblé', () => {
    const yml = readFileSync(join(ROOT, '.github', 'workflows', 'e2e.yml'), 'utf8')
    expect(yml).toContain("THEMES: ${{ github.event_name == 'schedule' && 'both' || '' }}")
    // Chaque passage de macOS et de Linux (français, anglais, indicatives) reçoit les thèmes de
    // la nuit ; Windows, jamais lancé la nuit, non.
    const runs = yml
      .split('\n')
      .filter((l) => /\bpnpm e2e /.test(l) && !l.includes('pnpm e2e ${suites'))
    const commands = runs.filter((l) => !/name:|::error::|description:/.test(l))
    expect(commands.length).toBe(6)
    for (const run of commands) expect(run).toContain('${themes[@]+"${themes[@]}"}')
    // Le job Linux part aussi la nuit.
    expect(yml).toMatch(
      /e2e-linux:[\s\S]*?if: github\.event_name == 'push' \|\| github\.event_name == 'schedule'/
    )
    expect(parseArgs(['--themes', 'both'])).toMatchObject({ themes: 'both' })
  })
})

describe('tâches et ordonnancement', () => {
  it('une tâche par suite et par thème demandé ; sans thème, une seule', () => {
    expect(tasksFor(CATALOG, null, 'dark').map((t) => t.key)).toEqual([
      'subagents:dark',
      'plan:dark',
      'libre:-'
    ])
    expect(tasksFor(CATALOG, ['plan'], 'both').map((t) => t.key)).toEqual([
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
    expect(tasksFor([...CATALOG, ios], null, 'light', linux).map((t) => t.name)).not.toContain(
      'simulator'
    )
    expect(tasksFor([ios], null, 'light').map((t) => t.key)).toEqual(['simulator:light'])
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

  it('nomme les contrôles en échec, sans le résumé final', () => {
    expect(failedControls('  ✓ ok\n  ✗ un < 5 ms\n  ✗ deux\n\n✗ 2 échec(s) en 3 s')).toEqual([
      'un < 5 ms',
      'deux'
    ])
  })
})

describe('suites indicatives (fiche 250)', () => {
  it('une annotation par contrôle en échec, titrée par la tâche', () => {
    expect(
      indicativeWarnings(
        [{ label: 'perf light', controls: ['streaming : aucune tâche > 400 ms'] }],
        'darwin'
      )
    ).toEqual([
      '::warning title=e2e perf light %3A indicative (darwin)%2C en échec::streaming : aucune tâche > 400 ms'
    ])
  })

  it('échappe les données d’une commande de workflow', () => {
    expect(
      indicativeWarnings([{ label: 'a', controls: ['50 % fait\nsuite'] }], 'darwin')[0]
    ).toMatch(/::50 %25 fait%0Asuite$/)
  })

  it('une tâche en échec sans contrôle nommé (plantage) a son annotation', () => {
    expect(indicativeWarnings([{ label: 'android dark', controls: [] }], 'darwin')).toHaveLength(1)
  })

  it('rien en échec : rien à dire', () => {
    expect(indicativeWarnings([], 'darwin')).toEqual([])
  })
})

describe('quarantaine par système (fiche 250)', () => {
  const catalog: CatalogEntry[] = [
    { name: 'a', file: 'a.mjs', themes: [null] },
    { name: 't', file: 't.mjs', themes: [null], quarantine: { linux: 'raison, fiche 145' } }
  ]

  it('écartée sur son système, avec sa raison ; jouée ailleurs', () => {
    expect(quarantinedOn(catalog, null, [], 'linux')).toEqual([
      { name: 't', reason: 'raison, fiche 145' }
    ])
    expect(quarantinedOn(catalog, null, [], 'darwin')).toEqual([])
    expect(quarantinedOn(catalog, null, [], 'win32')).toEqual([])
  })

  it('nommée explicitement : jouée quand même (pour la corriger)', () => {
    expect(quarantinedOn(catalog, ['t'], ['t'], 'linux')).toEqual([])
  })

  it('choisie par --changed, sans être nommée : reste en quarantaine', () => {
    expect(quarantinedOn(catalog, ['t'], [], 'linux')).toHaveLength(1)
  })

  it('non demandée : rien à dire', () => {
    expect(quarantinedOn(catalog, ['a'], ['a'], 'linux')).toEqual([])
  })
})

describe('catalogue des suites (e2e/catalog.mjs)', async () => {
  const path = join(ROOT, 'e2e', 'catalog.mjs')
  const { SUITES, GLOBAL_SOURCES, THEME_SOURCES } = (await import(path)) as {
    SUITES: CatalogEntry[]
    GLOBAL_SOURCES: string[]
    THEME_SOURCES: string[]
  }
  const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
    cwd: ROOT,
    encoding: 'utf8'
  })
    .split('\n')
    .filter(Boolean)

  it('une quarantaine dit sa raison et sa fiche, sur un vrai système', () => {
    for (const s of SUITES) {
      for (const [platform, reason] of Object.entries(s.quarantine ?? {})) {
        expect(['darwin', 'linux', 'win32'], s.name).toContain(platform)
        expect(reason, s.name).toMatch(/fiche \d{3}/)
      }
    }
  })

  it('le sombre ciblé : les suites qui vérifient un rendu sombre (ADR-0071)', () => {
    expect(SUITES.filter((s) => s.dark).map((s) => s.name)).toEqual(
      expect.arrayContaining(['aurore', 'settings', 'tables', 'turn-guards'])
    )
    for (const s of SUITES.filter((x) => x.dark)) expect(s.themes, s.name).toContain('dark')
  })

  it('les fichiers de thème et de style font jouer le sombre partout', () => {
    const touched = (f: string) => (THEME_SOURCES.some((p) => globToRegExp(p).test(f)) ? [f] : [])
    for (const f of [
      'src/renderer/src/styles.css',
      'src/renderer/src/components/scheduled/scheduled.css',
      'src/shared/themes.ts',
      'src/shared/theme-aurora.ts',
      'src/renderer/src/appearance.ts',
      'e2e/palette.mjs'
    ])
      expect(effectiveThemes('auto', touched(f)), f).toBe('both')
    expect(touched('src/renderer/src/App.tsx')).toEqual([])
  })

  it('chaque suite a son fichier', () => {
    for (const s of SUITES)
      expect(existsSync(join(ROOT, 'e2e', 'suites', s.file)), s.name).toBe(true)
  })

  it('chaque motif couvre au moins un fichier du dépôt (carte à jour après un renommage)', () => {
    const patterns = [
      ...GLOBAL_SOURCES,
      ...THEME_SOURCES,
      ...SUITES.flatMap((s) => s.sources ?? [])
    ]
    // Une expression par motif, pas une par fichier : sous Windows, la recompiler pour chaque
    // fichier du dépôt prenait 7 à 10 s (fiche 229, revue des essais lents).
    const orphans = [...new Set(patterns)].filter((p) => {
      const re = globToRegExp(p)
      return !files.some((f) => re.test(f))
    })
    expect(orphans).toEqual([])
  })
})

describe('captures d’échec périmées (fiche 267, revue UX)', () => {
  const files = [
    'echec-relecture-commits-01-de-lai-de-passe-light.png',
    'echec-relecture-commits-01-de-lai-de-passe-light.txt',
    'echec-relecture-commits-01-de-lai-de-passe-dark.png',
    'echec-relecture-01-autre-light.png',
    'en-echec-relecture-commits-01-x-light.png',
    '267-relecture-portee-light.png'
  ]
  it('celles de la suite et du thème repassés au vert, rien d’autre', () => {
    expect(staleFailureFiles(files, [{ name: 'relecture-commits', scheme: 'light' }])).toEqual([
      'echec-relecture-commits-01-de-lai-de-passe-light.png',
      'echec-relecture-commits-01-de-lai-de-passe-light.txt'
    ])
    // Une suite au nom plus court n'efface pas celle qui la prolonge.
    expect(staleFailureFiles(files, [{ name: 'relecture', scheme: 'light' }])).toEqual([
      'echec-relecture-01-autre-light.png'
    ])
    // Sans thème : tous ses thèmes ; en anglais : les captures `en-`.
    expect(staleFailureFiles(files, [{ name: 'relecture-commits' }])).toHaveLength(3)
    expect(
      staleFailureFiles(files, [{ name: 'relecture-commits', scheme: 'light' }], 'en')
    ).toEqual(['en-echec-relecture-commits-01-x-light.png'])
  })
})
