/**
 * Coût d'une conversation Bob, lu dans la base locale de Bob Shell.
 *
 * Bob 2.0.6 ne transmet pas sa consommation par ACP (ni `usage_update`, ni `usage`), mais il
 * enregistre le coût de chaque tâche, en bobcoins, dans `~/.bob/db/bob.db` (table `tasks`,
 * colonne `costs` : `{"cost":0.021006,"contextTokens":10503}`), et l'identifiant de tâche est
 * l'identifiant de session ACP. Format non documenté : lecture seule, et la moindre surprise
 * (fichier absent, schéma changé, JSON inattendu) donne simplement « pas de coût ».
 */
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import type { AgentSpend } from '@shared/usage'
import type { CostSource, SubagentCost } from './adapters'

/** Base de Bob sous un dossier personnel (`BOBINE_CONFIG_HOME` pour les essais). */
export const bobDbIn = (home: string) => join(home, '.bob', 'db', 'bob.db')

export const BOB_DB = bobDbIn(homedir())

/**
 * Coûts de Bob tels que son profil les déclare (`costSource`, ADR-0015) : conversation, sous-agents
 * et dépense récente, lus dans sa base locale, en bobcoins.
 */
export function bobDbCosts(dbPath = BOB_DB): CostSource {
  return {
    id: 'bob-db',
    currency: 'bobcoins',
    session: (sessionId) => readBobTaskCost(sessionId, dbPath)?.amount,
    subagents: (sessionId) => readBobSubagents(sessionId, dbPath),
    spend: (now) => readBobSpend(now, dbPath)
  }
}

export interface BobTaskCost {
  /** Coût cumulé de la tâche, en bobcoins. */
  amount: number
  /** Jetons dans le contexte, selon Bob. */
  contextTokens?: number
}

export function readBobTaskCost(sessionId: string, dbPath = BOB_DB): BobTaskCost | undefined {
  if (!/^[\w-]+$/.test(sessionId) || !existsSync(dbPath)) return undefined
  let db: DatabaseSync | undefined
  try {
    db = new DatabaseSync(dbPath, { readOnly: true })
    const row = db.prepare('SELECT costs FROM tasks WHERE id = ?').get(sessionId) as
      { costs?: unknown } | undefined
    if (typeof row?.costs !== 'string') return undefined
    const costs = JSON.parse(row.costs) as Record<string, unknown>
    const amount = costs['cost']
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) return undefined
    const tokens = costs['contextTokens']
    return {
      amount: round(amount + descendantsCost(db, sessionId)),
      ...(typeof tokens === 'number' && Number.isFinite(tokens) ? { contextTokens: tokens } : {})
    }
  } catch {
    return undefined
  } finally {
    try {
      db?.close()
    } catch {
      // Déjà fermée : rien à faire.
    }
  }
}

/**
 * Sous-agents lancés par une tâche, dans l'ordre de création. Bob 2.0.6 crée leur ligne au lancement
 * (`parent_id` = tâche de la conversation, `task_type: subagent`) et réécrit son `costs` à chaque
 * dépense (vu dans la base). Titre : `mask` ou consigne de l'appel `spawn_subagent` ; coût en
 * bobcoins. `undefined` à la moindre surprise.
 */
export function readBobSubagents(parentId: string, dbPath = BOB_DB): SubagentCost[] | undefined {
  if (!/^[\w-]+$/.test(parentId) || !existsSync(dbPath)) return undefined
  let db: DatabaseSync | undefined
  try {
    db = new DatabaseSync(dbPath, { readOnly: true })
    const rows = db
      .prepare(
        `SELECT id, title, created_at, costs FROM tasks
         WHERE parent_id = ? AND task_type = 'subagent' ORDER BY created_at, id`
      )
      .all(parentId) as { id?: unknown; title?: unknown; created_at?: unknown; costs?: unknown }[]
    return rows.flatMap((row) => {
      if (typeof row.id !== 'string' || typeof row.created_at !== 'number') return []
      const cost = typeof row.costs === 'string' ? costOf(row.costs) : undefined
      return [
        {
          id: row.id,
          title: typeof row.title === 'string' ? row.title : '',
          createdAt: row.created_at,
          ...(typeof cost === 'number' && Number.isFinite(cost) && cost >= 0
            ? { cost: round(cost) }
            : {})
        }
      ]
    })
  } catch {
    return undefined
  } finally {
    try {
      db?.close()
    } catch {
      // Déjà fermée : rien à faire.
    }
  }
}

/**
 * Dépense récente, d'après la base de Bob (Bobine et `bob` en terminal, sur ce Mac). Bob ne
 * garde que le coût cumulé de chaque tâche : une tâche utilisée aujourd'hui compte en entier, même
 * commencée avant. `undefined` si la base est absente ou illisible.
 *
 * Le budget mensuel et la consommation du compte ne sont pas dans la base : Bob les lit auprès de
 * son service avec la connexion de l'utilisateur, et ne les transmet pas par ACP (2.0.6).
 */
export function readBobSpend(now = new Date(), dbPath = BOB_DB): AgentSpend | undefined {
  if (!existsSync(dbPath)) return undefined
  const midnight = new Date(now)
  midnight.setHours(0, 0, 0, 0)
  const weekStart = now.getTime() - 7 * 24 * 3600 * 1000
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  let db: DatabaseSync | undefined
  try {
    db = new DatabaseSync(dbPath, { readOnly: true })
    const rows = db
      .prepare('SELECT costs, updated_at FROM tasks WHERE updated_at >= ?')
      .all(Math.min(weekStart, monthStart)) as { costs?: unknown; updated_at?: unknown }[]
    let today = 0
    let week = 0
    let month = 0
    for (const row of rows) {
      if (typeof row.costs !== 'string' || typeof row.updated_at !== 'number') continue
      const amount = costOf(row.costs)
      if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) continue
      if (row.updated_at >= weekStart) week += amount
      if (row.updated_at >= monthStart) month += amount
      if (row.updated_at >= midnight.getTime()) today += amount
    }
    return { currency: 'bobcoins', today: round(today), week: round(week), month: round(month) }
  } catch {
    return undefined
  } finally {
    try {
      db?.close()
    } catch {
      // Déjà fermée : rien à faire.
    }
  }
}

const round = (n: number) => Math.round(n * 1e6) / 1e6

/**
 * Coût des sous-agents (et sous-tâches) lancés par une tâche. Bob 2.0.6 enregistre chacun dans sa
 * propre ligne (`parent_id`, `task_type: subagent`) sans l'ajouter au coût du parent (relevé le
 * 2026-10-13, fiche 010). 0 si la base n'a pas de colonne `parent_id`.
 */
function descendantsCost(db: DatabaseSync, taskId: string): number {
  try {
    const rows = db
      .prepare(
        `WITH RECURSIVE sub(id) AS (
           SELECT id FROM tasks WHERE parent_id = ?
           UNION SELECT tasks.id FROM tasks JOIN sub ON tasks.parent_id = sub.id
         )
         SELECT costs FROM tasks WHERE id IN (SELECT id FROM sub)`
      )
      .all(taskId) as { costs?: unknown }[]
    let total = 0
    for (const row of rows) {
      const amount = typeof row.costs === 'string' ? costOf(row.costs) : undefined
      if (typeof amount === 'number' && Number.isFinite(amount) && amount >= 0) total += amount
    }
    return total
  } catch {
    return 0
  }
}

/** Coût d'une ligne `costs` ; `undefined` si elle est illisible. */
function costOf(json: string): number | undefined {
  try {
    const value = (JSON.parse(json) as Record<string, unknown>)['cost']
    return typeof value === 'number' ? value : undefined
  } catch {
    return undefined
  }
}
