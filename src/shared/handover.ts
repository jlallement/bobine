/**
 * Continuer une conversation avec un autre agent (fiche 108, ADR-0024). La conversation garde son
 * fil (il fait foi, ADR-0021) et ouvre une nouvelle session chez l'autre agent ; une bascule est
 * posée dans le fil. L'échange d'avant part avec le prochain message de l'utilisateur, en texte :
 * il se déduit du fil (dernière bascule qu'aucun message ne suit), rien n'est à retenir à part.
 * Même chose, vers le même agent, quand il ne sait pas reprendre sa session ou l'a perdue
 * (ADR-0030).
 */
import { APP_CONTEXT_OPENINGS } from './app-context'
import { conversationText } from './branch'
import { shortModelName } from './models'
import type { TranscriptItem } from './transcript'

/** Un agent, tel qu'il s'appelait au moment de la bascule. */
export interface AgentRef {
  profileId: string
  label: string
}

/** Bascule posée dans le fil : d'un agent à l'autre, avec le modèle choisi s'il y en a un. */
export interface Handover {
  from: AgentRef
  to: AgentRef
  /** Nom du modèle choisi (tel que l'agent le nomme). */
  model?: string
  /**
   * Session neuve du même agent (ADR-0030) : il ne sait pas reprendre (`no-resume`, ni
   * `session/load` ni `session/resume`), il a perdu la session (`session-lost`), ou il refusait
   * d'y continuer, sa limite d'étapes atteinte (`turn-limit`, fiche 209). Absent : bascule vers un
   * autre agent, choisie par l'utilisateur.
   */
  reason?: 'no-resume' | 'session-lost' | 'turn-limit'
}

/** Où partent les messages, du plus précis au plus vague. */
export type DataDestination =
  /** Fournisseur déclaré dans le fichier de l'agent (fiche 104) : son nom et son adresse. */
  | { kind: 'provider'; name: string; url: string }
  /** Préfixe du modèle (`openai/…`) : fournisseur configuré chez l'agent, adresse inconnue. */
  | { kind: 'prefix'; provider: string }
  /** Ce que le profil dit de l'agent (Bob : son service en ligne). */
  | { kind: 'agent'; text: string }
  /** Rien de connu : l'agent seul (son modèle par défaut, ou un modèle sans fournisseur connu). */
  | { kind: 'unknown' }

export interface HandoverModel {
  value: string
  name: string
  /** Mis en avant dans le menu : utilisé récemment, ou modèle d'un fournisseur déclaré. */
  featured?: 'recent' | 'provider'
  destination: DataDestination
}

/** Un agent vers qui continuer, avec ses modèles connus. */
export interface HandoverTarget {
  profileId: string
  label: string
  /**
   * Modèles connus : ceux mis en avant d'abord, puis ceux vus à sa dernière session. Vide : pas de
   * choix (agent sans réglage de modèle, ou jamais lancé).
   */
  models: HandoverModel[]
  /** Destination sans modèle choisi : ce que dit le profil, sinon le modèle par défaut. */
  destination: DataDestination
}

/** Nom de l'agent d'après la bascule, avec le nom court du modèle : « OpenCode · Qwen3 32B ». */
export function handoverName(handover: Pick<Handover, 'to' | 'model'>): string {
  return handover.model
    ? `${handover.to.label} · ${shortModelName(handover.model)}`
    : handover.to.label
}

/** Lignes mises en avant par agent dans le menu, au plus. */
export const FEATURED_MODELS = 4

/** Position de la dernière bascule du fil, -1 s'il n'y en a pas. */
export function lastHandoverIndex(items: readonly TranscriptItem[]): number {
  return items.findLastIndex((item) => item.kind === 'handover')
}

/** Ce qui appartient à la session en cours : ce qui suit la dernière bascule. */
export function sinceLastHandover<T extends TranscriptItem>(items: readonly T[]): readonly T[] {
  return items.slice(lastHandoverIndex(items) + 1)
}

/** Messages de l'échange qui partiraient à l'autre agent (ceux de l'utilisateur et de l'agent). */
export function handoverMessageCount(items: readonly TranscriptItem[]): number {
  return items.filter((item) => item.kind === 'user' || item.kind === 'agent').length
}

/** Pourquoi la session d'avant a été quittée, dans le contexte joint (en anglais, ADR-0014). */
const RENEWAL_CAUSE: Record<NonNullable<Handover['reason']>, string> = {
  'no-resume': 'that could not be resumed',
  'session-lost': 'that could not be resumed',
  'turn-limit': 'that had reached its step limit'
}

/**
 * Contexte à joindre au prochain message, après lui (fiche 125) : l'échange d'avant la dernière bascule, tant qu'aucun
 * message de l'utilisateur ne la suit. Consignes en anglais (ADR-0014), échange dans sa langue.
 */
export function handoverContext(items: readonly TranscriptItem[]): string | undefined {
  const at = lastHandoverIndex(items)
  const handover = items[at]
  if (handover?.kind !== 'handover') return undefined
  if (items.slice(at + 1).some((item) => item.kind === 'user')) return undefined
  return [
    handover.reason
      ? `${APP_CONTEXT_OPENINGS.renewal} ${RENEWAL_CAUSE[handover.reason]}, and continues here: my new`
      : `${APP_CONTEXT_OPENINGS.handover} (${handover.from.label}) and continues with you: my new`,
    'message is above. Here is the exchange before it, for context only: do not redo or repeat it.',
    'Tool results are summarized: read the files again if you need their content.',
    '',
    '<earlier_conversation>',
    conversationText(items.slice(0, at)) || '(no earlier messages)',
    '</earlier_conversation>'
  ].join('\n')
}
