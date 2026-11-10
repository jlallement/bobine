/**
 * Logique pure du lanceur d'essais de bout en bout (`e2e/run.mjs`, fiche 115) : arguments, choix
 * des suites d'après les fichiers modifiés, ordre et ordonnancement des tâches en parallèle,
 * empreinte des sources. Sans effet de bord : testée par `scripts/e2e-select.test.ts`.
 */
import { createHash } from 'node:crypto'
import {
  ALL_FEATURES,
  type PlatformFeature,
  type PlatformFeatures
} from '../src/shared/platform.ts'

/** Thèmes joués par défaut. */
export const BOTH = ['light', 'dark'] as const
export type Scheme = (typeof BOTH)[number]

/** Processus en parallèle par défaut (`--jobs`). */
export const DEFAULT_JOBS = 3
/**
 * Au plus : les ports des apps d'essai sont partagés entre les processus (plages de 300 ports
 * coupées en autant de tranches), 12 tranches de 25 ports restent confortables.
 */
export const MAX_JOBS = 12

/** Une suite du catalogue (`e2e/catalog.mjs`). */
export interface CatalogEntry {
  /** Nom passé à `pnpm e2e`. */
  readonly name: string
  /** Fichier de la suite dans `e2e/suites/`. */
  readonly file: string
  /** Thèmes joués ; `[null]` : la suite ne prend pas de thème. */
  readonly themes: readonly (Scheme | null)[]
  /**
   * Fichiers dont la suite dépend (motifs : `*` sans `/`, `**` avec, un `/` final pour un dossier).
   * Absent : la suite est jouée à chaque `--changed`. Son propre fichier s'y ajoute toujours.
   */
  readonly sources?: readonly string[]
  /** Tourne seule : elle prend une ressource de toute la machine (raccourci global). */
  readonly alone?: boolean
  /** Ressources de la machine qu'elle partage : deux suites au même verrou ne se chevauchent pas. */
  readonly locks?: readonly string[]
  /**
   * Capacités de la plateforme dont elle a besoin (fiche 145, ex. `simulator`) : sautée sur une
   * machine qui ne les a pas. Absent : jouée partout.
   */
  readonly needs?: readonly PlatformFeature[]
}

/** La plateforme a-t-elle tout ce dont la suite a besoin ? */
export const supported = (entry: CatalogEntry, features: PlatformFeatures): boolean =>
  (entry.needs ?? []).every((need) => features[need])

/** Options de `pnpm e2e`. */
export interface Options {
  suites: string[]
  schemes: Scheme[]
  lang: string
  jobs: number
  changed: boolean
  base: string
  ifNeeded: boolean
  list: boolean
  dryRun: boolean
  verbose: boolean
}

/** Options qui prennent une valeur (`--jobs 3` ou `--jobs=3`). */
const VALUED = ['--lang', '--jobs', '--base']

/** Lit les arguments de `pnpm e2e` ; lève une erreur lisible si l'un d'eux ne va pas. */
export function parseArgs(argv: readonly string[]): Options {
  const values = new Map<string, string>()
  const flags = new Set<string>()
  const suites: string[] = []
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? ''
    const [key = '', inline] = arg.split(/=(.*)/s, 2)
    if (VALUED.includes(key)) {
      const value = inline ?? argv[++i]
      if (value === undefined || value.startsWith('--'))
        throw new Error(`${key} : valeur manquante`)
      values.set(key, value)
    } else if (arg.startsWith('--')) flags.add(arg)
    else suites.push(arg)
  }
  const known = [
    '--light',
    '--dark',
    '--changed',
    '--if-needed',
    '--list',
    '--dry-run',
    '--verbose'
  ]
  const unknown = [...flags].filter((f) => !known.includes(f))
  if (unknown.length) throw new Error(`option inconnue : ${unknown.join(', ')}`)
  const jobsText = values.get('--jobs') ?? String(DEFAULT_JOBS)
  const jobs = Number(jobsText)
  if (!Number.isInteger(jobs) || jobs < 1 || jobs > MAX_JOBS) {
    throw new Error(`--jobs : un entier de 1 à ${MAX_JOBS} (reçu : ${jobsText})`)
  }
  const lang = values.get('--lang') ?? 'fr'
  if (!['fr', 'en'].includes(lang)) throw new Error(`Langue inconnue : ${lang} (fr ou en)`)
  const ifNeeded = flags.has('--if-needed')
  if (
    ifNeeded &&
    (suites.length || flags.has('--changed') || flags.has('--light') || flags.has('--dark'))
  ) {
    throw new Error('--if-needed joue la suite complète : sans suite, --changed, --light ni --dark')
  }
  return {
    suites,
    schemes: flags.has('--light') ? ['light'] : flags.has('--dark') ? ['dark'] : [...BOTH],
    lang,
    jobs,
    changed: flags.has('--changed'),
    base: values.get('--base') ?? 'main',
    ifNeeded,
    list: flags.has('--list'),
    dryRun: flags.has('--dry-run'),
    verbose: flags.has('--verbose')
  }
}

/** Suite complète : toutes les suites, les deux thèmes (celle qui peut poser le tampon vert). */
export const isFullRun = (o: Options): boolean =>
  !o.suites.length && !o.changed && o.schemes.length === BOTH.length

/** Motif de fichier en expression régulière : `**` traverse les dossiers, `*` et `?` non. */
export function globToRegExp(glob: string): RegExp {
  const pattern = glob.endsWith('/') ? `${glob}**` : glob
  let re = ''
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i] ?? ''
    if (c === '*' && pattern[i + 1] === '*') {
      // `a/**/b` couvre aussi `a/b`.
      if (pattern[i + 2] === '/') {
        re += '(?:.*/)?'
        i += 2
      } else {
        re += '.*'
        i += 1
      }
    } else if (c === '*') re += '[^/]*'
    else if (c === '?') re += '[^/]'
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  }
  return new RegExp(`^${re}$`)
}

/** Premier motif qui couvre le fichier, ou `undefined`. */
export function firstMatch(file: string, patterns: readonly string[]): string | undefined {
  return patterns.find((p) => globToRegExp(p).test(file))
}

/** Sources d'une suite, son propre fichier compris ; `undefined` : pas de carte. */
export const suiteSources = (entry: CatalogEntry): string[] | undefined =>
  entry.sources ? [`e2e/suites/${entry.file}`, ...entry.sources] : undefined

export interface Selection {
  /** Fichiers « globaux » modifiés : toutes les suites sont jouées. */
  readonly everything: readonly string[]
  /** Suites retenues, dans l'ordre du catalogue, et pourquoi. */
  readonly suites: readonly { name: string; why: readonly string[] }[]
  /** Fichiers modifiés que rien ne couvre (ni global, ni carte d'une suite). */
  readonly unmapped: readonly string[]
}

/** Raison affichée pour une suite sans carte. */
export const NO_MAP = 'pas de carte : toujours jouée'

/** Suites touchées par ces fichiers modifiés (`pnpm e2e --changed`). */
export function selectSuites(
  catalog: readonly CatalogEntry[],
  changed: readonly string[],
  globals: readonly string[]
): Selection {
  const everything = changed.filter((f) => firstMatch(f, globals))
  const covered = new Set(everything)
  const suites: { name: string; why: string[] }[] = []
  for (const entry of catalog) {
    const sources = suiteSources(entry)
    if (everything.length) {
      suites.push({ name: entry.name, why: everything.map((f) => `${f} : tout`) })
      continue
    }
    if (!sources) {
      suites.push({ name: entry.name, why: [NO_MAP] })
      continue
    }
    const why = changed.filter((f) => firstMatch(f, sources))
    for (const f of why) covered.add(f)
    if (why.length) suites.push({ name: entry.name, why })
  }
  return { everything, suites, unmapped: changed.filter((f) => !covered.has(f)) }
}

/** Une tâche : une suite dans un thème. */
export interface Task {
  readonly key: string
  readonly name: string
  readonly scheme: Scheme | null
  readonly alone?: boolean
  readonly locks?: readonly string[]
}

/** Tâches des suites demandées, dans l'ordre du catalogue. */
export function tasksFor(
  catalog: readonly CatalogEntry[],
  names: readonly string[] | null,
  schemes: readonly Scheme[],
  features: PlatformFeatures = ALL_FEATURES
): Task[] {
  return catalog
    .filter((e) => (!names || names.includes(e.name)) && supported(e, features))
    .flatMap((e) =>
      e.themes
        .filter((s) => s === null || schemes.includes(s))
        .map((scheme) => ({
          key: `${e.name}:${scheme ?? '-'}`,
          name: e.name,
          scheme,
          ...(e.alone ? { alone: true } : {}),
          ...(e.locks ? { locks: e.locks } : {})
        }))
    )
}

/** Durée supposée d'une tâche jamais mesurée. */
const UNKNOWN_MS = 60_000

/**
 * Ordre de passage en parallèle : les tâches seules d'abord (la machine entière, avant que le pool
 * se remplisse), puis les plus longues d'après les durées du dernier passage, pour que la fin ne
 * se joue pas sur une longue suite lancée en dernier.
 */
export function orderTasks(tasks: readonly Task[], durations: Record<string, number>): Task[] {
  const weight = (t: Task) => (t.alone ? Infinity : (durations[t.key] ?? UNKNOWN_MS))
  return [...tasks].sort((a, b) => weight(b) - weight(a))
}

/**
 * Prochaine tâche à lancer (indice dans la file), ou -1. Une tâche seule attend que tout soit fini
 * et bloque la file derrière elle (sinon elle n'aurait jamais la machine) ; deux tâches au même
 * verrou ne tournent pas ensemble, la suivante compatible passe devant.
 */
export function nextTask(queue: readonly Task[], running: readonly Task[], jobs: number): number {
  if (running.length >= jobs || running.some((t) => t.alone)) return -1
  const held = new Set(running.flatMap((t) => t.locks ?? []))
  for (let i = 0; i < queue.length; i++) {
    const task = queue[i]
    if (!task) continue
    if (task.alone) return running.length === 0 ? i : -1
    if ((task.locks ?? []).some((l) => held.has(l))) continue
    return i
  }
  return -1
}

/** Empreinte des sources : chemins triés et contenu (`null` : fichier suivi mais supprimé). */
export function fingerprint(
  files: readonly { path: string; content: Uint8Array | null }[]
): string {
  const hash = createHash('sha256')
  for (const { path, content } of [...files].sort((a, b) => (a.path < b.path ? -1 : 1))) {
    hash.update(`${path}\0`)
    hash.update(content ? createHash('sha256').update(content).digest('hex') : 'supprimé')
    hash.update('\n')
  }
  return hash.digest('hex')
}

/** Durée lisible : « 42 s », « 3 min 52 s ». */
export function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000)
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`
}

/**
 * Nombre d'échecs dans la sortie d'une suite : ses lignes `  ✗ …` (`check`, `fail` de `lib.mjs`),
 * pas le résumé final (`✗ N échec(s)…`, en début de ligne).
 */
export const countFailures = (output: string): number =>
  output.split('\n').filter((l) => l.startsWith('  ✗')).length
