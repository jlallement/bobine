/**
 * Remplissage du contexte après une compaction que l'agent ne chiffre pas (fiche 257). OpenCode
 * 2.3.0 n'envoie aucun `usage_update` après `compaction_update` : sans rien faire, la jauge garde
 * l'ancien total jusqu'au tour suivant (« je compacte à 57 % et ça reste à 57 % »). L'app estime
 * alors le total, marqué comme tel, jusqu'au prochain chiffre de l'agent.
 *
 * Au dernier chiffre de l'agent, `used` couvre les messages alors dans le contexte et le reste
 * (prompt système, outils, mémoire…), qu'un résumé ne touche pas. D'où :
 * `reste = used − messages estimés à ce moment-là`, puis
 * `estimé = reste + messages estimés depuis la compaction` (résumé compris), jamais plus que `used`.
 */
import type { UsageUpdate } from './acp-sdk.mts'
import { messagesTokens } from './context-breakdown'
import type { TranscriptState } from './transcript'
import { withContext } from './usage'

/**
 * Consommation après la compaction repérée par l'élément `markerId` (carte de compaction, ou
 * message de la commande de compaction quand l'agent répond en texte). `undefined` : rien à
 * estimer — pas de total (Bob), ou un chiffre de l'agent lu depuis le début de la compaction.
 * Un chiffre sans `nextItem` a été lu avant la fiche 257, donc avant cette compaction.
 */
export function estimatedAfterCompaction(
  state: TranscriptState,
  markerId: number
): TranscriptState['usage'] {
  const usage = state.usage
  const context = usage?.context
  if (!usage || !context || context.size <= 0) return undefined
  const read = context.nextItem ?? markerId
  if (read > markerId) return undefined
  const { terminals } = state
  const atReading = state.items.filter((item) => item.id < read)
  const rest = Math.max(0, context.used - messagesTokens({ items: atReading, terminals, usage }))
  const now = messagesTokens({ items: state.items, terminals, usage })
  return {
    ...usage,
    context: {
      used: Math.min(context.used, rest + now),
      size: context.size,
      estimated: true,
      nextItem: state.nextId
    }
  }
}

/**
 * Début de la compaction dont la carte est `cardId` : le message de la commande de compaction qui
 * ouvre ce tour, s'il y en a un (un chiffre reçu depuis est gardé tel quel), sinon la carte
 * (compaction décidée par l'agent en cours de tour).
 */
export function compactionMarker(state: TranscriptState, cardId: number): number {
  const user = state.items.findLast((item) => item.kind === 'user' && item.id < cardId)
  return user?.kind === 'user' && user.compaction ? user.id : cardId
}

/**
 * Après un `compaction_update` (`before` → `after`) : estimation quand la compaction
 * `compactionId` vient de se terminer (une mise à jour `completed` répétée ne compte pas).
 */
export function withCompactionDone(
  before: TranscriptState,
  after: TranscriptState,
  compactionId: string
): TranscriptState {
  const card = (state: TranscriptState) =>
    state.items.find((item) => item.kind === 'compaction' && item.compactionId === compactionId)
  const done = card(after)
  const was = card(before)
  if (done?.kind !== 'compaction' || done.status !== 'completed') return after
  if (was?.kind === 'compaction' && was.status === 'completed') return after
  return withCompactionEstimate(after, compactionMarker(after, done.id))
}

/**
 * Compaction terminée (repère `markerId`) : estimation s'il y a lieu ; sinon le chiffre gardé est
 * noté « compaction finie depuis » (`compactedSince`), pour que la baisse suivante ne soit pas
 * prise pour une compaction inconnue.
 */
export function withCompactionEstimate(state: TranscriptState, markerId: number): TranscriptState {
  const estimated = estimatedAfterCompaction(state, markerId)
  if (estimated) return { ...state, usage: estimated }
  const usage = state.usage
  if (!usage?.context) return state
  return { ...state, usage: { ...usage, context: { ...usage.context, compactedSince: true } } }
}

/**
 * Baisse de `used` déjà expliquée par une compaction (fiche 257) : total estimé en cours,
 * compaction terminée depuis le dernier chiffre de l'agent, ou compaction en cours ou terminée
 * commencée depuis. Sa carte fait (ou fera) commencer le contexte ; poser le début sur l'élément
 * suivant ferait sortir du compte les messages échangés depuis (« Messages ≈ 0 » au tour qui suit
 * un `/compact`), ou le résumé lui-même.
 */
export function dropExplained(state: TranscriptState): boolean {
  const context = state.usage?.context
  if (!context) return false
  if (context.estimated || context.compactedSince) return true
  const read = context.nextItem
  return (
    read !== undefined &&
    state.items.some(
      (item) =>
        item.kind === 'compaction' &&
        item.id >= read &&
        (item.status === 'in_progress' || item.status === 'completed')
    )
  )
}

/** `usage_update` : chiffre de l'agent, baisse déjà expliquée ou non par une compaction. */
export function withUsageUpdate(state: TranscriptState, update: UsageUpdate): TranscriptState {
  const usage = withContext(state.usage ?? {}, update, state.nextId, dropExplained(state))
  return { ...state, usage }
}
