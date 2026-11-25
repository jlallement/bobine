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

/** Les deux thèmes. */
export const BOTH = ['light', 'dark'] as const
export type Scheme = (typeof BOTH)[number]

/**
 * Thèmes à jouer (`--themes`, ADR-0071) : `auto` (par défaut), le clair pour toutes les suites et
 * le sombre seulement pour celles qui vérifient un rendu sombre (`dark` du catalogue) ; `both`,
 * les deux partout (nuit, `--if-needed`, un fichier de thème touché) ; `light` ou `dark`, un seul
 * thème partout (`--light`, `--dark`).
 */
export const THEME_MODES = ['auto', 'both', 'light', 'dark'] as const
export type ThemeMode = (typeof THEME_MODES)[number]

/**
 * Au plus, par défaut, en CI (`--jobs`). Fiche 250 (2026-11-25) : à 3 jobs sur le runner Mac de
 * GitHub (3 cœurs, 7 Gio), charge 15 à 20 et pages qui mettent ~12 s à répondre.
 */
export const CI_MAX_JOBS = 3
/**
 * Au plus, par défaut, sur une machine locale (fiche 279, mesuré sur un Mac à 15 cœurs) : à
 * 5 tâches le temps machine ne monte que de 2 % ; à 8, chaque lancement double, saturation.
 */
export const LOCAL_MAX_JOBS = 5

/** Sur une machine d'intégration continue (GitHub Actions ou `CI`) ? */
export const isCi = (env: Readonly<Record<string, string | undefined>>): boolean =>
  env.GITHUB_ACTIONS === 'true' || env.CI === 'true'

/**
 * `--jobs` par défaut, d'après les cœurs dans les deux cas. En local, un job pour 3 cœurs, entre 1
 * et `LOCAL_MAX_JOBS` (les attentes des suites sont des minuteurs, pas du calcul ; avec d'autres
 * travaux lourds à côté, `--jobs 3` à la main). En CI, machine partagée sans marge : un job pour
 * 2 cœurs arrondi au-dessus, entre 1 et `CI_MAX_JOBS` (2 sur les runners à 3 ou 4 cœurs, comme le
 * `--jobs 2` déjà imposé sous Linux).
 */
export const defaultJobs = (cores: number, ci: boolean): number =>
  ci
    ? Math.max(1, Math.min(CI_MAX_JOBS, Math.ceil(cores / 2)))
    : Math.max(1, Math.min(LOCAL_MAX_JOBS, Math.floor(cores / 3)))
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
  /** Thèmes possibles ; `[null]` : la suite ne prend pas de thème. */
  readonly themes: readonly (Scheme | null)[]
  /**
   * Vérifie un rendu propre au sombre (un contrôle qui dépend du thème : jetons, palette sombre) :
   * jouée aussi en sombre à chaque passage. Les autres ne le sont qu'en `--themes both` (nuit,
   * avant un tag, fichier de thème touché), ADR-0071.
   */
  readonly dark?: boolean
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
  /**
   * Quarantaine par vrai système (`process.platform` ; `BOBINE_PLATFORM` n'y change rien : c'est la
   * machine qui rend l'échec, pas les capacités imposées) : un échec connu, compris,
   * qui n'est pas un défaut visible de l'app, et qui masquerait les autres échecs (fiche 250). La
   * valeur est la raison, avec sa fiche : le lanceur l'affiche à chaque passage (annotation sur
   * GitHub), la suite n'est plus complète, et nommer la suite la joue quand même.
   */
  readonly quarantine?: Readonly<Partial<Record<NodeJS.Platform, string>>>
}

/** Une suite mise en quarantaine sur ce système, et pourquoi. */
export interface Quarantined {
  readonly name: string
  readonly reason: string
}

/**
 * Suites demandées (`names`, `null` : toutes) en quarantaine sur `platform`, sauf celles nommées
 * explicitement (`explicit`, les suites passées à `pnpm e2e`) : on peut toujours la jouer pour la
 * corriger, jamais l'oublier.
 */
export function quarantinedOn(
  catalog: readonly CatalogEntry[],
  names: readonly string[] | null,
  explicit: readonly string[],
  platform: string
): Quarantined[] {
  return catalog.flatMap((e) => {
    const reason = e.quarantine?.[platform as NodeJS.Platform]
    if (!reason || explicit.includes(e.name) || (names && !names.includes(e.name))) return []
    return [{ name: e.name, reason }]
  })
}

/** La plateforme a-t-elle tout ce dont la suite a besoin ? */
export const supported = (entry: CatalogEntry, features: PlatformFeatures): boolean =>
  (entry.needs ?? []).every((need) => features[need])

/** Options de `pnpm e2e`. */
export interface Options {
  suites: string[]
  /** Thèmes demandés (`--themes`, `--light`, `--dark`) ; `auto` par défaut. */
  themes: ThemeMode
  lang: string
  jobs: number
  changed: boolean
  base: string
  ifNeeded: boolean
  list: boolean
  dryRun: boolean
  verbose: boolean
  /** Suites écartées (`--skip <suite>`, répétable) : dites par le lanceur, jamais en silence. */
  skip: string[]
  /**
   * Suites jouées à titre indicatif (`--indicative`, fiche 250) : sur GitHub, chaque contrôle en
   * échec devient une annotation `::warning::`. Le code de sortie ne change pas ; c'est l'étape du
   * workflow (`continue-on-error`) qui ne bloque pas le job.
   */
  indicative: boolean
}

/** Options qui prennent une valeur (`--jobs 3` ou `--jobs=3`). */
const VALUED = ['--lang', '--jobs', '--base', '--themes']

/** Thèmes demandés : `--themes`, ou ses raccourcis `--light` et `--dark`, un seul des trois. */
function themesOf(values: ReadonlyMap<string, string>, flags: ReadonlySet<string>): ThemeMode {
  const given = [
    ...(values.has('--themes') ? ['--themes'] : []),
    ...['--light', '--dark'].filter((f) => flags.has(f))
  ]
  if (given.length > 1) throw new Error(`thèmes : un seul de ${given.join(', ')}`)
  if (flags.has('--light')) return 'light'
  if (flags.has('--dark')) return 'dark'
  const themes = values.get('--themes') ?? 'auto'
  if (!(THEME_MODES as readonly string[]).includes(themes)) {
    throw new Error(`--themes : ${THEME_MODES.join(', ')} (reçu : ${themes})`)
  }
  return themes as ThemeMode
}

/**
 * Lit les arguments de `pnpm e2e` ; lève une erreur lisible si l'un d'eux ne va pas.
 * `defaults.jobs` : `--jobs` par défaut (`defaultJobs`, d'après la machine).
 */
export function parseArgs(
  argv: readonly string[],
  defaults: { jobs: number } = { jobs: CI_MAX_JOBS }
): Options {
  const values = new Map<string, string>()
  const flags = new Set<string>()
  const suites: string[] = []
  const skip: string[] = []
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? ''
    const [key = '', inline] = arg.split(/=(.*)/s, 2)
    if (key === '--skip') {
      const value = inline ?? argv[++i]
      if (value === undefined || value.startsWith('--')) throw new Error('--skip : suite manquante')
      skip.push(value)
    } else if (VALUED.includes(key)) {
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
    '--verbose',
    '--indicative'
  ]
  const unknown = [...flags].filter((f) => !known.includes(f))
  if (unknown.length) throw new Error(`option inconnue : ${unknown.join(', ')}`)
  const jobsText = values.get('--jobs') ?? String(defaults.jobs)
  const jobs = Number(jobsText)
  if (!Number.isInteger(jobs) || jobs < 1 || jobs > MAX_JOBS) {
    throw new Error(`--jobs : un entier de 1 à ${MAX_JOBS} (reçu : ${jobsText})`)
  }
  const lang = values.get('--lang') ?? 'fr'
  if (!['fr', 'en'].includes(lang)) throw new Error(`Langue inconnue : ${lang} (fr ou en)`)
  const themes = themesOf(values, flags)
  const ifNeeded = flags.has('--if-needed')
  if (ifNeeded && (suites.length || flags.has('--changed') || !['auto', 'both'].includes(themes))) {
    throw new Error(
      '--if-needed joue la suite complète, aux deux thèmes : sans suite, --changed, --light ni --dark'
    )
  }
  return {
    suites,
    // Avant un tag : la suite complète aux deux thèmes partout (ADR-0071).
    themes: ifNeeded ? 'both' : themes,
    lang,
    jobs,
    changed: flags.has('--changed'),
    base: values.get('--base') ?? 'main',
    ifNeeded,
    list: flags.has('--list'),
    dryRun: flags.has('--dry-run'),
    verbose: flags.has('--verbose'),
    skip,
    indicative: flags.has('--indicative')
  }
}

/**
 * Suite complète : toutes les suites, les deux thèmes partout (celle qui peut poser le tampon
 * vert). Le passage par défaut (`auto` : clair, et sombre ciblé) n'en est pas une.
 */
export const isFullRun = (o: Options): boolean =>
  !o.suites.length && !o.changed && !o.skip.length && o.themes === 'both'

/**
 * Thèmes joués pour de bon : en `auto`, un fichier de thème ou de style modifié (`touched`, voir
 * `THEME_SOURCES` du catalogue) fait jouer le sombre à toutes les suites, comme une source.
 */
export const effectiveThemes = (themes: ThemeMode, touched: readonly string[]): ThemeMode =>
  themes === 'auto' && touched.length ? 'both' : themes

/** Thèmes d'une suite dans ce mode, parmi ceux qu'elle prend. */
export function schemesOf(entry: CatalogEntry, mode: ThemeMode): (Scheme | null)[] {
  const wanted: readonly Scheme[] =
    mode === 'both' ? BOTH : mode === 'auto' ? (entry.dark ? BOTH : ['light']) : [mode]
  return entry.themes.filter((s) => s === null || wanted.includes(s))
}

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
  mode: ThemeMode,
  features: PlatformFeatures = ALL_FEATURES
): Task[] {
  return catalog
    .filter((e) => (!names || names.includes(e.name)) && supported(e, features))
    .flatMap((e) =>
      schemesOf(e, mode).map((scheme) => ({
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
export const countFailures = (output: string): number => failedControls(output).length

/** Contrôles en échec dans la sortie d'une suite : ses lignes `  ✗ …`, sans la marque. */
export const failedControls = (output: string): string[] =>
  output
    .split('\n')
    .filter((l) => l.startsWith('  ✗'))
    .map((l) => l.slice('  ✗'.length).trim())

/** Données d'une commande de workflow GitHub (`%`, retours à la ligne), propriétés en plus (`:` `,`). */
const escapeData = (s: string) =>
  s.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A')
const escapeProperty = (s: string) => escapeData(s).replaceAll(':', '%3A').replaceAll(',', '%2C')

/**
 * Annotations GitHub d'une suite indicative (`--indicative`, fiche 250) : une par contrôle en échec,
 * titrée par la tâche (`perf light`) ; une tâche en échec sans contrôle nommé (plantage, suite
 * bloquée) en a une quand même.
 */
export function indicativeWarnings(
  failed: readonly { label: string; controls: readonly string[] }[],
  platform: string
): string[] {
  return failed.flatMap(({ label, controls }) => {
    const title = escapeProperty(`e2e ${label} : indicative (${platform}), en échec`)
    const lines = controls.length ? controls : ['échec sans contrôle nommé (voir le journal)']
    return lines.map((c) => `::warning title=${title}::${escapeData(c)}`)
  })
}

/**
 * Captures d'échec d'une suite repassée au vert (fiche 267, revue UX : des `echec-*` périmés
 * faisaient croire à un échec) : `echec-<suite>-NN-…-<thème>.png|txt`, préfixées de la langue hors
 * du français. Une suite sans thème : tous ses thèmes. Rien d'une autre suite au nom voisin
 * (`relecture` n'efface pas `relecture-commits`).
 */
export function staleFailureFiles(
  files: readonly string[],
  passed: readonly { name: string; scheme?: string | undefined }[],
  lang = 'fr'
): string[] {
  const prefix = lang === 'fr' ? '' : `${lang}-`
  const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const patterns = passed.map(
    ({ name, scheme }) =>
      new RegExp(
        `^${escape(prefix)}echec-${escape(name)}-\\d{2}-.*-${scheme ? escape(scheme) : '[a-z]+'}\\.(png|txt)$`
      )
  )
  return files.filter((file) => patterns.some((p) => p.test(file)))
}
