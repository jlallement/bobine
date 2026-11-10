/**
 * Aparté (fiche 180) : une question à côté de la conversation, posée au même agent dans une session
 * neuve et courte (ADR-0030), sans rien ajouter au fil ni au contexte de la session principale.
 * Générique : ce module ne connaît aucun agent.
 */
import { APP_CONTEXT_OPENINGS } from './app-context'
import { conversationText } from './branch'
import type { TranscriptItem } from './transcript'

/** Fin du fil jointe à l'aparté quand l'utilisateur le demande (≈ 2 000 jetons). */
export const ASIDE_CONTEXT_CHARS = 8_000

/** Une question de l'aparté et sa réponse. */
export interface AsideExchange {
  question: string
  /** Réponse de l'agent (Markdown), au fil de l'eau. */
  answer: string
  /** Demandes d'autorisation refusées d'office (lecture seule). */
  refused: number
  /** Outils que l'agent a lancés pour répondre (lecture de fichiers…). */
  tools: number
}

export type AsideStatus = 'starting' | 'answering' | 'ready' | 'error' | 'closed'

/** Ce que la carte « Aparté » affiche, poussé par le main (`aside:changed`). */
export interface AsideView {
  conversationId: string
  status: AsideStatus
  agentLabel?: string
  exchanges: AsideExchange[]
  /** Coût cumulé de la session d'aparté, s'il est connu (compté dans la conversation). */
  cost?: { amount: number; currency: string }
  /** Panne de l'aparté (agent arrêté, connexion requise…), affichée telle quelle. */
  error?: string
}

/** Demande de l'utilisateur. */
export interface AsideRequest {
  question: string
  /** Joindre la fin du fil (coûte des jetons) ; sinon l'aparté ne reçoit rien. */
  withContext: boolean
}

/** Fin du fil, en texte, telle qu'elle partirait avec l'aparté ; vide s'il n'y a rien. */
export function asideExcerpt(items: readonly TranscriptItem[]): string {
  const text = conversationText(items)
  return text.length > ASIDE_CONTEXT_CHARS
    ? `[… earlier part omitted …]\n${text.slice(-ASIDE_CONTEXT_CHARS)}`
    : text
}

/** Estimation grossière (4 caractères par jeton), pour que l'utilisateur mesure le coût. */
export const estimatedTokens = (text: string): number => Math.ceil(text.length / 4)

/**
 * Consigne jointe après la question (fiche 125) : lecture seule, réponse courte. En anglais, comme
 * les autres consignes de l'app à l'agent (ADR-0014) ; l'échange joint reste dans sa langue.
 */
export function asideContext(excerpt?: string): string {
  const lines = [
    APP_CONTEXT_OPENINGS.aside,
    'The message above is a quick side question from the user, asked aside from their main',
    'conversation with you, in a separate short-lived session. Answer briefly and directly.',
    'Read only: do not modify, create or delete any file, and do not run commands that change',
    'anything. If answering would need a change, say what you would do instead.'
  ]
  if (excerpt) {
    lines.push(
      'For context only, the recent part of the main conversation:',
      '<main_conversation>',
      excerpt,
      '</main_conversation>'
    )
  }
  lines.push('</bobine_aside>')
  return lines.join('\n')
}

/** « Ajouter au fil » : question et réponse en citation Markdown, à la suite de la saisie. */
export function asideQuote(label: string, exchange: Pick<AsideExchange, 'question' | 'answer'>) {
  const quote = (text: string) =>
    text
      .trim()
      .split('\n')
      .map((line) => (line ? `> ${line}` : '>'))
      .join('\n')
  return `${quote(`**${label}** — ${exchange.question}`)}\n>\n${quote(exchange.answer)}\n`
}
