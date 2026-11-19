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
 * avant la fin, a échoué ; `gone` : sa conversation n'existe plus et il n'a jamais répondu.
 */
export type WorkState = 'running' | 'waiting' | 'replied' | 'stopped' | 'error' | 'gone'

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
  now: number
): WorkState {
  const report = currentReport(card)
  if (child) {
    const state = childState(child, attention)
    if (state === 'running' || state === 'waiting') return state
    if (report) return outcomeState(report)
    if (state === 'error' || state === 'stopped') return state
    const last = card.steps.at(-1)
    return last?.kind === 'ask' && now - last.item.at < SENDING_GRACE_MS ? 'running' : 'replied'
  }
  return report ? outcomeState(report) : 'gone'
}

function outcomeState(report: Report): WorkState {
  return report.outcome === 'done' ? 'replied' : report.outcome
}

/** Heure de la demande en cours : la dernière bulle de suite, sinon celle qui a lancé le travail. */
export function exchangeStart(card: WorkCardData): number {
  const ask = card.steps.findLast((s) => s.kind === 'ask')
  return ask?.kind === 'ask' ? ask.item.at : card.request.at
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
  const next = items.find((i) => i.kind === 'user' && i.id > report.id)
  return next?.kind === 'user' ? { sent: true, at: next.at } : { sent: false }
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
