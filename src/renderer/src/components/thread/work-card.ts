/**
 * Ce que dit une carte-réponse (fiche 263), sans rendu : son état, le début de l'échange en cours,
 * la réponse à montrer, sa transmission à l'agent de la mère et son coût. Pur : essayé à part.
 */
import type { ConversationSummary } from '@shared/agent'
import type { AttentionKind } from '@shared/attention'
import { childState } from '@shared/children'
import type { WorkCardData } from '@shared/role-request'
import type { TranscriptItem } from '@shared/transcript'
import type { UsageDigest } from '@shared/usage'

type Report = Extract<TranscriptItem, { kind: 'child-report' }>

/**
 * État d'un travail : il travaille (ou démarre), attend l'utilisateur, a répondu, s'est arrêté
 * avant la fin, a échoué ; `pending` : il a fini, sa réponse attend la fin de la réponse de la
 * mère pour être posée ; `silent` : au repos sans réponse pour sa dernière demande (envoi qui n'a
 * pas eu lieu, plafond de coût, réponse perdue) ; `gone` : sa conversation n'existe plus et il n'a
 * jamais répondu ; `unknown` : le fil est lu sans la liste des conversations (côte à côte).
 */
export type WorkState =
  | 'running'
  | 'waiting'
  | 'replied'
  | 'pending'
  | 'silent'
  | 'stopped'
  | 'error'
  | 'gone'
  | 'unknown'

/** La dernière réponse du travail, si l'échange en cours en a une (pas de suite sans réponse). */
export function currentReport(card: WorkCardData): Report | undefined {
  const last = card.steps.at(-1)
  return last?.kind === 'report' ? last.item : undefined
}

/**
 * Une suite vient de partir et sa conversation ne dit pas encore « occupée » (empreinte du dossier
 * d'un rôle en lecture seule, démarrage de son agent) : elle travaille pendant ce délai au plus.
 */
export const SENDING_GRACE_MS = 10_000

/**
 * État du travail : la conversation fait foi tant qu'elle travaille ou attend (fiche 258) ; sinon
 * la réponse de l'échange en cours. Une conversation au repos sans réponse posée pour l'échange en
 * cours : une suite qui part (`SENDING_GRACE_MS`) travaille ; sinon elle a répondu et sa réponse
 * attend d'être posée (la mère répondait : elle l'est à la fin de sa réponse).
 */
export function workState(
  card: WorkCardData,
  child: Pick<ConversationSummary, 'status' | 'turnStopped'> | undefined,
  attention: AttentionKind | undefined,
  now: number,
  context: { known: boolean; motherBusy?: boolean } = { known: true }
): WorkState {
  const report = currentReport(card)
  if (child) {
    const state = childState(child, attention)
    if (state === 'running' || state === 'waiting') return state
    if (report) return outcomeState(report)
    if (state === 'error' || state === 'stopped') return state
    const last = card.steps.at(-1)
    const asked = last?.kind === 'ask' ? last.item.at : card.askedAt
    if (now - asked < SENDING_GRACE_MS) return 'running'
    // Au repos sans réponse posée : retenue pendant que la mère répond, ou jamais venue.
    return context.motherBusy ? 'pending' : 'silent'
  }
  if (report) return outcomeState(report)
  return context.known ? 'gone' : 'unknown'
}

function outcomeState(report: Report): WorkState {
  return report.outcome === 'done' ? 'replied' : report.outcome
}

/** Heure de la demande en cours : la dernière bulle de suite, sinon celle qui a lancé le travail. */
export function exchangeStart(card: WorkCardData): number {
  const ask = card.steps.findLast((s) => s.kind === 'ask')
  return ask?.kind === 'ask' ? ask.item.at : card.askedAt
}

/**
 * Transmission de la réponse à l'agent de la mère (décision 3 de la fiche 260) : elle part avec le
 * prochain message de l'utilisateur à la mère (`childContext`) ; transmise dès qu'un message de la
 * mère la suit dans le fil. `undefined` sans réponse.
 */
export function relayOf(
  report: Report | undefined,
  items: readonly TranscriptItem[]
): { sent: false } | { sent: true; at: number | undefined } | undefined {
  if (!report) return undefined
  // Un message dont le tour a fini en erreur sans réponse (ni reprise réussie) ne compte pas : rien
  // ne dit que l'agent a reçu ce qui partait avec lui (revue QA).
  for (let i = items.findIndex((x) => x.id > report.id); i !== -1 && i < items.length; i++) {
    const item = items[i]
    if (item?.kind !== 'user') continue
    if (!failedTurn(items, i)) return { sent: true, at: item.at }
  }
  return { sent: false }
}

/** Le tour ouvert par le message `start` a-t-il fini en erreur, sans aucune réponse de l'agent ? */
function failedTurn(items: readonly TranscriptItem[], start: number): boolean {
  let failed = false
  for (let i = start + 1; i < items.length; i++) {
    const item = items[i]
    if (!item || item.kind === 'user') break
    if (item.kind === 'agent' && item.text.trim()) return false
    if (
      item.kind === 'notice' &&
      item.level === 'error' &&
      item.message?.key === 'transcript.notice.error'
    ) {
      failed = true
    }
  }
  return failed
}

/**
 * Consommation à afficher au pied : celle de la conversation au repos (un agent peut rapporter son
 * coût juste après sa réponse, fiche 117), sinon celle de la dernière réponse.
 */
export function workUsage(
  report: Report | undefined,
  child: Pick<ConversationSummary, 'status' | 'usage'> | undefined
): UsageDigest | undefined {
  if (child?.usage && child.status !== 'busy') return child.usage
  return report?.usage
}

/** Texte de la réponse pour la carte : entier (`reply`), sinon l'extrait d'une ancienne réponse. */
export function answerText(report: Report): string {
  return report.reply ?? report.excerpt
}

/** Début de l'échange qui a donné cette réponse : la bulle de suite d'avant, sinon la demande. */
export function stepStart(card: WorkCardData, report: Report): number {
  const index = card.steps.findIndex((s) => s.kind === 'report' && s.item.id === report.id)
  const ask = card.steps.slice(0, Math.max(0, index)).findLast((s) => s.kind === 'ask')
  return ask?.kind === 'ask' ? ask.item.at : card.askedAt
}

/** La réponse d'avant celle-ci, dans la carte (son coût cumulé se retranche). */
export function previousReport(card: WorkCardData, report: Report): Report | undefined {
  const index = card.steps.findIndex((s) => s.kind === 'report' && s.item.id === report.id)
  const before = card.steps.slice(0, Math.max(0, index)).findLast((s) => s.kind === 'report')
  return before?.kind === 'report' ? before.item : undefined
}

/**
 * Consommation d'un seul échange : celle de la conversation à cette réponse, moins celle de la
 * réponse d'avant (les comptes rendus portent le cumul, fiche 117). Coût dans une autre unité
 * qu'avant : le cumul n'est pas retranché, rien n'est inventé.
 */
export function exchangeUsage(
  usage: UsageDigest | undefined,
  before: UsageDigest | undefined
): UsageDigest | undefined {
  if (!usage || !before) return usage
  const minus = (a: number | undefined, b: number | undefined) =>
    a === undefined ? undefined : Math.max(0, a - (b ?? 0))
  const cost =
    usage.cost && before.cost && usage.cost.currency === before.cost.currency
      ? { ...usage.cost, amount: Math.max(0, usage.cost.amount - before.cost.amount) }
      : usage.cost
  const input = minus(usage.input, before.input)
  const output = minus(usage.output, before.output)
  const total = minus(usage.total, before.total)
  return {
    ...(input === undefined ? {} : { input }),
    ...(output === undefined ? {} : { output }),
    ...(total === undefined ? {} : { total }),
    ...(cost ? { cost } : {})
  }
}

/**
 * Titre d'une réponse qui commence par un titre Markdown (« ### Direction : … »), pour le message
 * préparé ; `undefined` sinon.
 */
export function answerTitle(text: string): string | undefined {
  const first = text.trim().split('\n')[0] ?? ''
  const heading = /^#{1,6}\s+(.+?)\s*#*$/.exec(first)?.[1]?.trim()
  if (!heading) return undefined
  // « Direction : « Le carnet… » » → « Le carnet… » : le préfixe avant les deux-points, puis les
  // guillemets qui entourent le titre, sans rien couper d'autre.
  const named = /^[^:«»"“”]{1,40}?\s*:\s+(.+)$/.exec(heading)?.[1] ?? heading
  const bare = /^[«"“]\s*(.+?)\s*[»"”]$/.exec(named)?.[1] ?? named
  return bare.trim() || undefined
}
