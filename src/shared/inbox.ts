/**
 * Conversations qui attendent l'utilisateur : calcul du compteur du Dock et libellés d'attente.
 * L'ancienne section « À traiter » est retirée (fiche 149) ; la liste garde chaque état sur place.
 */
import { t } from 'i18next'
import type { ConversationSummary } from './agent'
import type {
  AttentionDetail,
  AttentionDetails,
  AttentionKind,
  AttentionReason,
  AttentionState
} from './attention'
import { reasonKind } from './attention'

export interface InboxEntry {
  conversation: ConversationSummary
  kind: AttentionKind
  /** `request` : une demande dont le détail n'est pas (encore) connu. */
  reason: AttentionReason | 'request'
  /** Titre de l'outil à autoriser, texte de la question. */
  detail?: string
  /** Début de l'attente (ms). */
  since: number
}

/** Ce qui bloque l'agent d'abord, puis les erreurs, puis ce qui est à lire. */
const RANK: Record<AttentionKind, number> = { request: 0, error: 1, done: 2 }

/** Raison connue, si elle s'accorde avec le type d'attente (sinon : l'état a bougé entre-temps). */
function matching(kind: AttentionKind, detail: AttentionDetail | undefined) {
  return detail && reasonKind(detail.reason) === kind ? detail : undefined
}

/**
 * Les conversations listées (pas les brouillons) qui attendent quelque chose ;
 * triées, le plus ancien d'abord dans chaque groupe. Les filles y sont comme les autres.
 */
export function inboxEntries(
  conversations: readonly ConversationSummary[],
  attention: AttentionState,
  details: AttentionDetails = {}
): InboxEntry[] {
  const entries: InboxEntry[] = []
  for (const conversation of conversations) {
    const kind = attention[conversation.id]
    if (!kind || conversation.draft) continue
    const detail = matching(kind, details[conversation.id])
    entries.push({
      conversation,
      kind,
      reason: detail?.reason ?? (kind === 'request' ? 'request' : kind),
      ...(detail?.detail ? { detail: detail.detail } : {}),
      since: detail?.since ?? (Date.parse(conversation.updatedAt) || 0)
    })
  }
  return entries.sort((a, b) => RANK[a.kind] - RANK[b.kind] || a.since - b.since)
}

/** Nombre de conversations qui attendent l'utilisateur (badge du Dock). */
export function inboxCount(
  conversations: readonly ConversationSummary[],
  attention: AttentionState,
  details?: AttentionDetails
): number {
  return inboxEntries(conversations, attention, details).length
}

/** Longueur maximale du détail (titre d'outil, question) ; la ligne coupe aussi à l'affichage. */
const DETAIL_CHARS = 120

function oneLine(text: string): string {
  const line = text.replace(/\s+/g, ' ').trim()
  return line.length > DETAIL_CHARS ? `${line.slice(0, DETAIL_CHARS - 1)}…` : line
}

/** Raison seule : « Autorisation : écrire app.ts », « Réponse à lire », « Compte rendu à lire »… */
export function inboxReason(entry: InboxEntry): string {
  const { reason, detail } = entry
  if ((reason === 'permission' || reason === 'question') && detail) {
    return t(`inbox.reason.${reason}`, { detail: oneLine(detail) })
  }
  if (reason === 'done' && entry.conversation.startedFrom) return t('inbox.reason.report')
  return t(`inbox.reason.${reason === 'page-dialog' ? 'pageDialog' : reason}Plain`)
}

/** Temps écoulé, court : « à l'instant », « 2 min », « 3 h », « 2 j ». */
export function inboxAgo(ms: number): string {
  const minutes = Math.floor(Math.max(0, ms) / 60_000)
  if (minutes < 1) return t('inbox.ago.now')
  if (minutes < 60) return t('inbox.ago.minutes', { count: minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t('inbox.ago.hours', { count: hours })
  return t('inbox.ago.days', { count: Math.floor(hours / 24) })
}

/**
 * Section figée tant que le pointeur est sur la liste (fiche 095) : les lignes du moment où elle
 * l'est devenue, dans le même ordre. Une ligne qui n'attend plus reste (avec ce qu'elle disait)
 * jusqu'à la sortie du pointeur ; une conversation qui se met à attendre garde sa place habituelle
 * en attendant. Une conversation supprimée disparaît. `null` : rien ne retient la section.
 */
export function heldInbox(
  current: readonly InboxEntry[],
  held: readonly InboxEntry[] | null,
  listed: ReadonlyMap<string, ConversationSummary>
): InboxEntry[] {
  if (!held) return [...current]
  const now = new Map(current.map((entry) => [entry.conversation.id, entry]))
  return held.flatMap((entry) => {
    const conversation = listed.get(entry.conversation.id)
    if (!conversation) return []
    return [now.get(conversation.id) ?? { ...entry, conversation }]
  })
}
