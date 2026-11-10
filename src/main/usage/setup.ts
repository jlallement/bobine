/**
 * Mise en place du journal de consommation au démarrage (fiche 130) : base ouverte, journal abonné
 * au flux des évènements du gestionnaire de conversations. Rien ne le relie au fil ni à la
 * suppression d'une conversation : ses lignes restent.
 *
 * Fiche 137 : il rend aussi le service du tableau (page « Mon activité » depuis la fiche 144) —
 * statistiques, grille d'activité, export CSV, remise à zéro, dépense des agents sur ce Mac — et
 * lance une fois la reprise depuis les fils.
 */
import { addDays, dateOfDay, dayKey, daysOf, heatDays } from '@shared/usage-periods'
import type {
  AgentSpendView,
  UsageExportKind,
  UsageHeatmap,
  UsageHeatQuery,
  UsageQuery,
  UsageStats
} from '@shared/usage-stats'
import type { ConversationManager } from '../conversations/manager'
import type { ConversationStore } from '../conversations/store'
import { log } from '../log'
import type { AgentProfile } from '../agent/profiles'
import { daysCsv, turnsCsv } from './csv'
import { importHistoryOnce } from './import'
import { UsageJournal, type TurnContext } from './journal'
import { localDay } from './report'
import { cachedRepoRoot } from './repo-root'
import {
  compareRows,
  comparisonPlan,
  heatmapOf,
  pastYears,
  queryRange,
  seriesOf,
  usageStats
} from './stats'
import { mutedUsageDb, openUsageDb, type UsageDb } from './usage-db'

export const USAGE_DB_FILE = 'usage.sqlite'

type Conversations = Pick<ConversationManager, 'subscribe' | 'view' | 'state' | 'settingsView'>

/** Profil, dossier et mère d'une conversation, d'après sa vue ; `undefined` si elle a disparu. */
export function turnContextOf(
  conversations: Pick<Conversations, 'view'>,
  id: string
): TurnContext | undefined {
  try {
    const { summary } = conversations.view(id)
    return {
      profileId: summary.profileId,
      profileLabel: summary.profileLabel,
      workspace: summary.workspace,
      ...(summary.startedFrom ? { parentId: summary.startedFrom.id } : {})
    }
  } catch {
    return undefined
  }
}

/** Service du tableau de consommation (fiches 137 et 144), appelé par les canaux `usage:*`. */
export interface UsageBoard {
  stats(query: UsageQuery): UsageStats
  /** Grille d'activité : douze derniers mois ou une année civile. */
  heatmap(query: UsageHeatQuery): UsageHeatmap
  /** Contenu CSV et nom de fichier proposé. */
  csv(query: UsageQuery, kind: UsageExportKind): { name: string; content: string }
  /** Vide le journal ; la collecte continue (tours en cours compris). */
  reset(): void
  /** Dépense récente sur ce Mac des agents dont le profil sait la lire (Bob : sa base). */
  spends(): AgentSpendView[]
  /** Au moins un tour dans le journal (sans rien calculer d'autre). */
  hasAny(): boolean
}

export interface UsageBoardOptions {
  profiles: readonly Pick<AgentProfile, 'id' | 'label' | 'chartSlot' | 'costSource'>[]
  /** Historique sur le disque, pour la reprise : l'index et le fil de chaque conversation. */
  history?: Pick<ConversationStore, 'loadIndex' | 'readTranscriptAsync'>
  now?: () => Date
  /** Le journal a changé (fiche 144) : « Mon activité » se relit. */
  onChanged?: () => void
  /**
   * Profil en lecture seule (fiche 196) : le journal est coupé, la base n'est même pas ouverte
   * (l'ouvrir écrit : WAL, migrations, base abîmée mise de côté).
   */
  readOnly?: boolean
}

/** Délai qui regroupe les changements d'un tour (ligne écrite, puis son coût). */
const CHANGE_DELAY_MS = 250

/** Le journal, qui prévient quand il change : un tour écrit, une reprise, une remise à zéro. */
export function watchedUsageDb(db: UsageDb, changed: (() => void) | undefined): UsageDb {
  if (!changed) return db
  let timer: ReturnType<typeof setTimeout> | undefined
  const notify = () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(changed, CHANGE_DELAY_MS)
  }
  return {
    upsert: (row) => {
      db.upsert(row)
      notify()
    },
    select: (filter) => db.select(filter),
    series: () => db.series(),
    firstStartedAt: (profileId) => db.firstStartedAt(profileId),
    insertMissing: (rows) => {
      const added = db.insertMissing(rows)
      if (added > 0) notify()
      return added
    },
    clear: () => {
      db.clear()
      notify()
    },
    meta: (key) => db.meta(key),
    setMeta: (key, value) => db.setMeta(key, value),
    close: () => {
      if (timer) clearTimeout(timer)
      db.close()
    }
  }
}

function usageBoard(
  db: UsageDb,
  journal: UsageJournal,
  conversations: Pick<Conversations, 'state' | 'settingsView'>,
  options: UsageBoardOptions
): UsageBoard {
  const now = options.now ?? (() => new Date())
  const profile = (id: string) => options.profiles.find((p) => p.id === id)
  const filter = (profileId: string | undefined, from: number, to: number) =>
    db.select({ from, to, ...(profileId ? { profileId } : {}) })
  const rowsOf = (query: UsageQuery) => {
    const range = queryRange(query, now(), db.firstStartedAt())
    return range ? filter(query.profileId, range.from, range.to) : []
  }
  const stats = (query: UsageQuery) => {
    const titles = new Map(conversations.state().conversations.map((c) => [c.id, c.title]))
    const at = now()
    const first = db.firstStartedAt()
    // La comparaison part du premier tour de l'agent filtré (ou de tous).
    const plan = comparisonPlan(query, at, db.firstStartedAt(query.profileId))
    const comparison = plan && compareRows(filter(query.profileId, plan.from, plan.to), plan)
    return usageStats(rowsOf(query), db.series(), query, {
      now: at,
      ...(first !== undefined ? { first } : {}),
      ...(comparison ? { comparison } : {}),
      agentSlot: (id) => profile(id)?.chartSlot,
      title: (id) => titles.get(id)
    })
  }
  const heatmap = (query: UsageHeatQuery): UsageHeatmap => {
    const at = now()
    const days = heatDays(query.range, at)
    const first = days[0]
    const last = days.at(-1)
    const rows =
      first && last ? filter(query.profileId, dateOfDay(first).getTime(), dayEnd(last)) : []
    const labels = Object.fromEntries(
      seriesOf(db.series(), (id) => profile(id)?.chartSlot).agents.map((a) => [a.key, a.label])
    )
    return {
      query,
      ...heatmapOf(rows, days),
      today: dayKey(at),
      years: pastYears(db.firstStartedAt(), at),
      labels
    }
  }
  return {
    stats,
    heatmap,
    csv: (query, kind) => {
      const rows = rowsOf(query)
      // Tout l'historique : « -all » dans le nom, pour ne pas le confondre avec une période.
      const scope = query.scope === 'all' ? '-all' : ''
      const name = `bobine-${kind === 'turns' ? 'turns' : 'days'}${scope}-${localDay(now().getTime())}.csv`
      const range = queryRange(query, now(), db.firstStartedAt())
      const days = range ? daysOf(new Date(range.from), new Date(range.to)) : []
      const content = kind === 'turns' ? turnsCsv(rows) : daysCsv(days, rows, localDay)
      return { name, content }
    },
    reset: () => {
      db.clear()
      journal.forgetWritten()
      log.info('Journal de consommation (usage.sqlite) remis à zéro')
    },
    // Agents installés seulement, comme le reste des réglages.
    hasAny: () => db.firstStartedAt() !== undefined,
    spends: () => {
      const installed = new Set(
        conversations
          .settingsView()
          .profiles.filter((p) => p.available)
          .map((p) => p.id)
      )
      return options.profiles.flatMap((p) => {
        if (!installed.has(p.id)) return []
        const spend = p.costSource?.spend?.(now())
        return spend ? [{ profileId: p.id, profileLabel: p.label, ...spend }] : []
      })
    }
  }
}

/** Minuit à la fin d'un jour (ms UTC). */
const dayEnd = (day: string) => dateOfDay(addDays(day, 1)).getTime()

export function setupUsageJournal(
  conversations: Conversations,
  file: string,
  board: UsageBoardOptions = { profiles: [] }
): { db: UsageDb; journal: UsageJournal; board: UsageBoard; close: () => void } {
  const db = watchedUsageDb(board.readOnly ? mutedUsageDb : openUsageDb(file), board.onChanged)
  const repoRoot = cachedRepoRoot()
  const journal = new UsageJournal({
    db,
    describe: (id) => turnContextOf(conversations, id),
    // Conversation rouverte : le coût cumulé que son fil a gardé, point de départ de son tour.
    knownCost: (id) => {
      try {
        return conversations.view(id).transcript.usage?.cost
      } catch {
        return undefined
      }
    },
    repoRoot
  })
  const unsubscribe = conversations.subscribe({ event: (payload) => journal.onEvent(payload) })
  const history = board.readOnly ? undefined : board.history
  if (history) {
    // Reprise depuis les fils (fiche 137), une seule fois, sans retarder le démarrage.
    setTimeout(() => {
      importHistoryOnce(
        db,
        { records: history.loadIndex(), read: (id) => history.readTranscriptAsync(id) },
        {
          profileLabel: (id) => board.profiles.find((p) => p.id === id)?.label,
          repoRoot
        }
      )
        .then((added) => {
          if (added !== undefined)
            log.info(`Journal de consommation : ${added} tour(s) repris des fils`)
        })
        .catch((error: unknown) =>
          log.warn('Journal de consommation : reprise impossible :', error)
        )
    }, 0)
  }
  return {
    db,
    journal,
    board: usageBoard(db, journal, conversations, board),
    close: () => {
      unsubscribe()
      journal.close()
      db.close()
    }
  }
}
