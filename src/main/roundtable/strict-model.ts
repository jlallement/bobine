/**
 * Modèle strict d'un participant (fiche 285, décision C4 ; lot 0, O3 à O6) : le modèle affiché est
 * celui qui répond, ou le participant est en erreur avant l'envoi de la question. Jamais le repli
 * silencieux d'`applyModel` (une fille ordinaire part avec le modèle que l'agent a pris).
 *
 * - un seul réglage de modèle par session, et seulement s'il n'est pas déjà en place ;
 * - valeur absente des options annoncées par la session : « modèle introuvable » ;
 * - réglage refusé par l'agent (OpenCode : `-32602` « model not found », la session gardant
 *   l'ancien modèle), réglage absent, ou valeur relue différente : « modèle non appliqué » ;
 * - la valeur est relue **après** un court délai, le temps que les `config_option_update` qui
 *   suivent la réponse arrivent (la réponse peut porter la valeur d'avant, lot 0, O5).
 *
 * Générique : le réglage de catégorie `model` de la session, rien de propre à un agent.
 */
import { t } from 'i18next'
import type { SessionControl } from '@shared/agent'
import { messageOf } from '@shared/errors'
import type { RoundtableSeatError } from '@shared/roundtable'
import type { ConversationManager } from '../conversations/manager'

/** Attente des `config_option_update` qui suivent un réglage, avant de relire la valeur. */
export const STRICT_SETTLE_MS = 250

export type StrictModelReason = Extract<
  RoundtableSeatError,
  'model-not-found' | 'model-not-applied'
>

/** Le modèle demandé n'est pas celui de la session : la question ne part pas. */
export class StrictModelError extends Error {
  readonly reason: StrictModelReason
  /** Raison donnée par l'agent (refus du réglage), bornée par le contrat à l'affichage. */
  readonly detail?: string

  constructor(reason: StrictModelReason, detail?: string) {
    const label = t(`roundtable.state.reason.${reason}`)
    super(detail ? `${label} (${detail})` : label)
    this.name = 'StrictModelError'
    this.reason = reason
    if (detail) this.detail = detail
  }
}

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * Le réglage de modèle de la session : de catégorie `model` (un `controlId` venu du renderer ne
 * règle jamais autre chose, un mode par exemple).
 */
const modelSetting = (controls: readonly SessionControl[] | undefined, controlId: string) =>
  controls?.find((c) => c.id === controlId && c.type === 'select' && c.category === 'model')

/** Modèle courant de la session, d'après son réglage de catégorie `model` ; `undefined` sans. */
export function sessionModel(
  controls: readonly SessionControl[] | undefined,
  controlId: string
): string | undefined {
  const value = modelSetting(controls, controlId)?.currentValue
  return typeof value === 'string' ? value : undefined
}

/**
 * Règle le modèle d'une conversation sans repli : rend quand la session est sur `model.value`,
 * lève `StrictModelError` sinon. Le réglage reste propre à cette conversation (`remember: false`).
 */
export async function applyModelStrict(
  host: Pick<ConversationManager, 'view' | 'setControl'>,
  conversationId: string,
  model: { controlId: string; value: string },
  /** Attente des `config_option_update` après le réglage ; `STRICT_SETTLE_MS` par défaut. */
  settle?: number
): Promise<void> {
  const settleMs = settle ?? STRICT_SETTLE_MS
  const control = modelSetting(host.view(conversationId).snapshot?.controls, model.controlId)
  if (control?.type !== 'select') throw new StrictModelError('model-not-applied')
  if (!control.options.some((o) => o.value === model.value)) {
    throw new StrictModelError('model-not-found')
  }
  if (control.currentValue !== model.value) {
    try {
      await host.setControl(conversationId, model.controlId, model.value, { remember: false })
    } catch (error) {
      throw new StrictModelError('model-not-applied', messageOf(error))
    }
    await delay(settleMs)
  }
  const after = modelSetting(host.view(conversationId).snapshot?.controls, model.controlId)
  if (after?.currentValue !== model.value) throw new StrictModelError('model-not-applied')
}
