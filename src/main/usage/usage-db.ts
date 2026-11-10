/**
 * Base du journal de consommation (fiche 130, ADR-0025) : `userData/usage.sqlite`, une ligne par
 * tour terminé, écrite par le main process seul.
 *
 * - Schéma versionné par `PRAGMA user_version` ; les migrations sont ci-dessous, dans l'ordre, et
 *   une migration publiée ne change plus jamais (on en ajoute une).
 * - Mode WAL : un arrêt brutal ne laisse pas de base à moitié écrite.
 * - Ouverture tolérante : une base illisible est journalisée, mise de côté
 *   (`usage.sqlite.broken-<date>`) et recréée ; une base d'une version plus récente de l'app n'est
 *   jamais touchée. En dernier recours, le journal se tait : il ne fait jamais tomber l'app.
 * - Le journal de l'app ne cite que le nom du fichier : le chemin de `userData` dit le nom de
 *   l'utilisateur, et les lignes portent des chemins de dossiers (confidentialité, fiche 130).
 */
import { existsSync, renameSync } from 'node:fs'
import { basename } from 'node:path'
import { DatabaseSync, type SQLInputValue } from 'node:sqlite'
import { messageOf } from '@shared/errors'
import { log } from '../log'

/** Migrations : la n-ième fait passer la base de la version n à n + 1. */
export const MIGRATIONS: readonly string[] = [
  `CREATE TABLE turns (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    parent_id TEXT,
    started_at INTEGER NOT NULL,
    ended_at INTEGER,
    profile_id TEXT NOT NULL,
    profile_label TEXT,
    model_id TEXT,
    model_name TEXT,
    mode_id TEXT,
    mode_name TEXT,
    workspace TEXT,
    repo_root TEXT,
    stop_reason TEXT,
    input_tokens INTEGER,
    output_tokens INTEGER,
    cached_read_tokens INTEGER,
    cached_write_tokens INTEGER,
    thought_tokens INTEGER,
    total_tokens INTEGER,
    cost_amount REAL,
    cost_currency TEXT,
    context_used INTEGER,
    context_size INTEGER,
    tool_calls INTEGER NOT NULL DEFAULT 0,
    tools TEXT,
    subagents INTEGER NOT NULL DEFAULT 0,
    subagent_cost_amount REAL,
    subagent_cost_currency TEXT
  ) STRICT;
  CREATE INDEX turns_started ON turns (started_at);
  CREATE INDEX turns_profile ON turns (profile_id, started_at);
  CREATE INDEX turns_conversation ON turns (conversation_id);`,
  // Fiche 137 : réglages du journal lui-même (drapeau de la reprise depuis les fils), gardés par
  // « Remettre à zéro ».
  `CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT;`
]

export const SCHEMA_VERSION = MIGRATIONS.length

export interface Cost {
  amount: number
  currency: string
}

/** Jetons d'un tour ; une valeur que l'agent ne donne pas est absente (`NULL` dans la base). */
export interface TurnTokens {
  input?: number
  output?: number
  cachedRead?: number
  cachedWrite?: number
  thought?: number
  total?: number
}

/** Une ligne du journal : un tour. */
export interface TurnRow {
  /** `<conversation>:<début du tour en ms>`. */
  id: string
  conversationId: string
  /** Mère d'une conversation fille (fiche 097). */
  parentId?: string
  /** Millisecondes UTC. */
  startedAt: number
  endedAt?: number
  profileId: string
  profileLabel?: string
  model?: { id: string; name: string }
  mode?: { id: string; name: string }
  workspace?: string
  /** Racine du dépôt git ; celle du dépôt principal pour un worktree. */
  repoRoot?: string
  /** `stopReason` ACP, `error` (tour en échec) ou `interrupted` (agent ou app arrêtés). */
  stopReason?: string
  tokens: TurnTokens
  /** Coût du tour, dans l'unité de l'agent ; jamais estimé. */
  cost?: Cost
  context?: { used: number; size: number }
  /** Outils appelés par genre ACP (`read`, `edit`, `execute`, `other`…). */
  tools: Record<string, number>
  subagents: number
  /** Coût des sous-agents, pour le détail (chez Bob, déjà compris dans `cost`). */
  subagentCost?: Cost
}

export interface TurnFilter {
  /** Début de période, inclus (ms UTC). */
  from?: number
  /** Fin de période, exclue (ms UTC). */
  to?: number
  profileId?: string
  modelId?: string
}

/** Un couple agent, modèle du journal. */
export interface JournalSeries {
  profileId: string
  profileLabel?: string
  model?: { id: string; name: string }
}

export interface UsageDb {
  /** Écrit ou réécrit la ligne d'un tour (même `id`). */
  upsert(row: TurnRow): void
  /** Tours qui commencent dans la période, du plus ancien au plus récent. */
  select(filter?: TurnFilter): TurnRow[]
  /** Agents et modèles présents dans tout le journal, avec leur dernier libellé (fiche 137). */
  series(): JournalSeries[]
  /** Début du premier tour du journal (ms UTC), d'un agent ou de tous (fiche 144). */
  firstStartedAt(profileId?: string): number | undefined
  /** Ajoute les tours absents (même `id` : rien) ; rend le nombre ajouté (reprise, fiche 137). */
  insertMissing(rows: readonly TurnRow[]): number
  /** Efface tous les tours (« Remettre à zéro », fiche 137) ; `meta` reste. */
  clear(): void
  /** Valeur de `meta`, ou `undefined`. */
  meta(key: string): string | undefined
  setMeta(key: string, value: string): void
  close(): void
}

/** Base absente ou refusée : rien n'est écrit, rien n'est lu. */
export const mutedUsageDb: UsageDb = {
  upsert: () => {},
  select: () => [],
  series: () => [],
  firstStartedAt: () => undefined,
  insertMissing: () => 0,
  clear: () => {},
  meta: () => undefined,
  setMeta: () => {},
  close: () => {}
}

class NewerSchemaError extends Error {}

/** Codes SQLite d'une base abîmée : `SQLITE_CORRUPT`, `SQLITE_NOTADB`. */
const BROKEN_CODES = new Set([11, 26])

const isBroken = (error: unknown): boolean =>
  BROKEN_CODES.has((error as { errcode?: number } | null)?.errcode ?? -1)

/** Ouvre la base, la vérifie et la met au dernier schéma ; lève si elle est inutilisable. */
function openChecked(file: string): DatabaseSync {
  const db = new DatabaseSync(file)
  try {
    db.exec('PRAGMA journal_mode = WAL')
    const check = db.prepare('PRAGMA quick_check').get() as Record<string, unknown> | undefined
    if (check?.['quick_check'] !== 'ok')
      throw new Error(`quick_check : ${String(check?.['quick_check'])}`)
    const { user_version: version } = db.prepare('PRAGMA user_version').get() as {
      user_version: number
    }
    if (version > SCHEMA_VERSION)
      throw new NewerSchemaError(`schéma ${version} > ${SCHEMA_VERSION}`)
    for (let v = version; v < SCHEMA_VERSION; v++) migrate(db, v)
    return db
  } catch (error) {
    db.close()
    throw error
  }
}

function migrate(db: DatabaseSync, from: number): void {
  db.exec('BEGIN')
  try {
    db.exec(MIGRATIONS[from] ?? '')
    db.exec(`PRAGMA user_version = ${from + 1}`)
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

/** Met la base de côté (avec ses fichiers WAL), sans rien effacer. */
function setAside(file: string, now: Date): void {
  const stamp = now.toISOString().replace(/[:.]/g, '-')
  for (const suffix of ['', '-wal', '-shm']) {
    if (existsSync(file + suffix)) renameSync(file + suffix, `${file}.broken-${stamp}${suffix}`)
  }
}

/**
 * Ouvre `usage.sqlite` sans jamais lever : base abîmée mise de côté et recréée, base plus récente
 * laissée telle quelle (journal muet), échec complet → journal muet.
 */
export function openUsageDb(file: string, now: () => Date = () => new Date()): UsageDb {
  const name = basename(file)
  const open = (): UsageDb => new SqliteUsageDb(openChecked(file), file, now)
  try {
    return open()
  } catch (error) {
    if (error instanceof NewerSchemaError) {
      log.warn(
        `Journal de consommation (${name}) d'une version plus récente de l'app, laissé tel quel :`,
        error.message
      )
      return mutedUsageDb
    }
    log.warn(
      `Journal de consommation (${name}) illisible, mis de côté et recréé :`,
      messageOf(error)
    )
    try {
      setAside(file, now())
      return open()
    } catch (again) {
      log.error(
        `Journal de consommation (${name}) impossible à recréer, désactivé :`,
        messageOf(again)
      )
      return mutedUsageDb
    }
  }
}

const COLUMNS = [
  'id',
  'conversation_id',
  'parent_id',
  'started_at',
  'ended_at',
  'profile_id',
  'profile_label',
  'model_id',
  'model_name',
  'mode_id',
  'mode_name',
  'workspace',
  'repo_root',
  'stop_reason',
  'input_tokens',
  'output_tokens',
  'cached_read_tokens',
  'cached_write_tokens',
  'thought_tokens',
  'total_tokens',
  'cost_amount',
  'cost_currency',
  'context_used',
  'context_size',
  'tool_calls',
  'tools',
  'subagents',
  'subagent_cost_amount',
  'subagent_cost_currency'
] as const

type Column = (typeof COLUMNS)[number]

const INSERT_MISSING = `INSERT INTO turns (${COLUMNS.join(', ')})
  VALUES (${COLUMNS.map((c) => `:${c}`).join(', ')})
  ON CONFLICT (id) DO NOTHING`

const UPSERT = `INSERT INTO turns (${COLUMNS.join(', ')})
  VALUES (${COLUMNS.map((c) => `:${c}`).join(', ')})
  ON CONFLICT (id) DO UPDATE SET ${COLUMNS.filter((c) => c !== 'id')
    .map((c) => `${c} = excluded.${c}`)
    .join(', ')}`

const nil = <T>(value: T | undefined): T | null => (value === undefined ? null : value)

function toColumns(row: TurnRow): Record<Column, SQLInputValue> {
  const toolCalls = Object.values(row.tools).reduce((a, b) => a + b, 0)
  return {
    id: row.id,
    conversation_id: row.conversationId,
    parent_id: nil(row.parentId),
    started_at: row.startedAt,
    ended_at: nil(row.endedAt),
    profile_id: row.profileId,
    profile_label: nil(row.profileLabel),
    model_id: nil(row.model?.id),
    model_name: nil(row.model?.name),
    mode_id: nil(row.mode?.id),
    mode_name: nil(row.mode?.name),
    workspace: nil(row.workspace),
    repo_root: nil(row.repoRoot),
    stop_reason: nil(row.stopReason),
    input_tokens: nil(row.tokens.input),
    output_tokens: nil(row.tokens.output),
    cached_read_tokens: nil(row.tokens.cachedRead),
    cached_write_tokens: nil(row.tokens.cachedWrite),
    thought_tokens: nil(row.tokens.thought),
    total_tokens: nil(row.tokens.total),
    cost_amount: nil(row.cost?.amount),
    cost_currency: nil(row.cost?.currency),
    context_used: nil(row.context?.used),
    context_size: nil(row.context?.size),
    tool_calls: toolCalls,
    tools: toolCalls ? JSON.stringify(row.tools) : null,
    subagents: row.subagents,
    subagent_cost_amount: nil(row.subagentCost?.amount),
    subagent_cost_currency: nil(row.subagentCost?.currency)
  }
}

const text = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)
const num = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined
const pair = (id: unknown, name: unknown) =>
  typeof id === 'string' ? { id, name: text(name) ?? id } : undefined
const cost = (amount: unknown, currency: unknown): Cost | undefined =>
  num(amount) !== undefined && typeof currency === 'string'
    ? { amount: amount as number, currency }
    : undefined

function toolsOf(raw: unknown): Record<string, number> {
  if (typeof raw !== 'string') return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    if (typeof parsed !== 'object' || parsed === null) return {}
    return Object.fromEntries(
      Object.entries(parsed).filter((e): e is [string, number] => num(e[1]) !== undefined)
    )
  } catch {
    return {}
  }
}

/** Retire les clés `undefined` (lignes comparables, objets plus courts). */
function compact<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T
}

function fromColumns(r: Record<string, unknown>): TurnRow {
  const context =
    num(r['context_used']) !== undefined && num(r['context_size']) !== undefined
      ? { used: r['context_used'] as number, size: r['context_size'] as number }
      : undefined
  return compact({
    id: String(r['id']),
    conversationId: String(r['conversation_id']),
    parentId: text(r['parent_id']),
    startedAt: Number(r['started_at']),
    endedAt: num(r['ended_at']),
    profileId: String(r['profile_id']),
    profileLabel: text(r['profile_label']),
    model: pair(r['model_id'], r['model_name']),
    mode: pair(r['mode_id'], r['mode_name']),
    workspace: text(r['workspace']),
    repoRoot: text(r['repo_root']),
    stopReason: text(r['stop_reason']),
    tokens: compact({
      input: num(r['input_tokens']),
      output: num(r['output_tokens']),
      cachedRead: num(r['cached_read_tokens']),
      cachedWrite: num(r['cached_write_tokens']),
      thought: num(r['thought_tokens']),
      total: num(r['total_tokens'])
    }),
    cost: cost(r['cost_amount'], r['cost_currency']),
    context,
    tools: toolsOf(r['tools']),
    subagents: num(r['subagents']) ?? 0,
    subagentCost: cost(r['subagent_cost_amount'], r['subagent_cost_currency'])
  })
}

class SqliteUsageDb implements UsageDb {
  /** Une seule remise à neuf par lancement : une base qui s'abîme encore reste muette. */
  private recovered = false

  private db: DatabaseSync | undefined
  private readonly file: string
  private readonly now: () => Date

  constructor(db: DatabaseSync, file: string, now: () => Date) {
    this.db = db
    this.file = file
    this.now = now
  }

  upsert(row: TurnRow): void {
    this.attempt('écriture', () => this.db?.prepare(UPSERT).run(toColumns(row)))
  }

  select(filter: TurnFilter = {}): TurnRow[] {
    const where: string[] = []
    const params: Record<string, SQLInputValue> = {}
    const add = (clause: string, name: string, value: SQLInputValue | undefined) => {
      if (value === undefined) return
      where.push(clause)
      params[name] = value
    }
    add('started_at >= :from', 'from', filter.from)
    add('started_at < :to', 'to', filter.to)
    add('profile_id = :profile', 'profile', filter.profileId)
    add('model_id = :model', 'model', filter.modelId)
    const sql = `SELECT * FROM turns ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY started_at, id`
    const rows = this.attempt('lecture', () => this.db?.prepare(sql).all(params))
    return (rows ?? []).map((r) => fromColumns(r as Record<string, unknown>))
  }

  series(): JournalSeries[] {
    const rows = this.attempt('lecture', () =>
      this.db
        ?.prepare(
          `SELECT profile_id, MAX(profile_label) AS profile_label, model_id, MAX(model_name) AS model_name
           FROM turns GROUP BY profile_id, model_id ORDER BY profile_id, model_id`
        )
        .all()
    )
    return (rows ?? []).map((raw) => {
      const r = raw as Record<string, unknown>
      return compact({
        profileId: String(r['profile_id']),
        profileLabel: text(r['profile_label']),
        model: pair(r['model_id'], r['model_name'])
      })
    })
  }

  firstStartedAt(profileId?: string): number | undefined {
    const row = this.attempt('lecture', () =>
      profileId === undefined
        ? this.db?.prepare('SELECT MIN(started_at) AS first FROM turns').get()
        : this.db
            ?.prepare('SELECT MIN(started_at) AS first FROM turns WHERE profile_id = :profile')
            .get({ profile: profileId })
    ) as Record<string, unknown> | undefined
    const first = row?.['first']
    return typeof first === 'number' || typeof first === 'bigint' ? Number(first) : undefined
  }

  insertMissing(rows: readonly TurnRow[]): number {
    if (rows.length === 0) return 0
    const added = this.attempt('reprise', () => {
      const db = this.db
      if (!db) return 0
      const insert = db.prepare(INSERT_MISSING)
      let count = 0
      db.exec('BEGIN')
      try {
        for (const row of rows) count += Number(insert.run(toColumns(row)).changes)
        db.exec('COMMIT')
      } catch (error) {
        db.exec('ROLLBACK')
        throw error
      }
      return count
    })
    return added ?? 0
  }

  clear(): void {
    this.attempt('remise à zéro', () => {
      this.db?.exec('DELETE FROM turns')
      // Rien ne reste des lignes effacées dans le fichier ni dans son WAL.
      this.db?.exec('VACUUM')
      this.db?.exec('PRAGMA wal_checkpoint(TRUNCATE)')
    })
  }

  meta(key: string): string | undefined {
    const row = this.attempt('lecture', () =>
      this.db?.prepare('SELECT value FROM meta WHERE key = ?').get(key)
    ) as { value?: unknown } | undefined
    return typeof row?.value === 'string' ? row.value : undefined
  }

  setMeta(key: string, value: string): void {
    this.attempt('écriture', () =>
      this.db
        ?.prepare(
          'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value'
        )
        .run(key, value)
    )
  }

  close(): void {
    try {
      this.db?.close()
    } catch {
      // Déjà fermée : rien à faire.
    }
    this.db = undefined
  }

  /** Une opération qui échoue est journalisée ; une base abîmée en cours de route est recréée. */
  private attempt<T>(what: string, run: () => T): T | undefined {
    try {
      return run()
    } catch (error) {
      const name = basename(this.file)
      log.warn(`Journal de consommation (${name}) : ${what} impossible :`, messageOf(error))
      if (!isBroken(error) || this.recovered) return undefined
      this.recovered = true
      this.close()
      try {
        setAside(this.file, this.now())
        this.db = openChecked(this.file)
        log.warn(`Journal de consommation (${name}) abîmé : mis de côté et recréé`)
        return run()
      } catch (again) {
        log.error(`Journal de consommation (${name}) désactivé :`, messageOf(again))
        return undefined
      }
    }
  }
}
