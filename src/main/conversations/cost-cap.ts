/**
 * Gardien du plafond de coût des conversations (fiche 157, ADR-0035). Abonné au gestionnaire,
 * comme les conversations filles : après chaque évènement qui peut faire franchir le plafond
 * (consommation, fin d'outil, fin de tour), il relit le fil et décide (`capDecision`, partagé).
 *
 * - Franchi pendant un outil : il attend sa fin (l'évènement suivant le redemande).
 * - Franchi sans outil en cours : il interrompt le tour (`session/cancel`, comme ■) et pose la
 *   carte « Plafond atteint » quand le tour est fini, pour qu'elle vienne après lui dans le fil.
 * - Franchi hors d'un tour (jetons comptés à la fin, coût relu après coup) : la carte, sans plus.
 * - Tant que le plafond est atteint, un nouveau message est retenu (`promptGate`) avec une carte :
 *   « Continuer » relève le plafond et l'envoie, « Arrêter » ne l'envoie pas.
 *
 * Le réglage « Plafond par conversation » vaut pour les nouvelles : au premier message d'une
 * conversation, il est figé dans son fil (`settings`). L'état vit dans le fil (`costCap`, éléments
 * `cost-cap`) : persisté, rejoué au renderer. Rien de propre à un agent.
 */
import type { IpcHandlers } from '@shared/ipc'
import type { AgentEvent, ConversationEvent, CostCapAnswer } from '@shared/agent'
import { attachmentName, type PromptAttachment } from '@shared/attachments'
import {
  capDecision,
  capReached,
  capStep,
  nextCap,
  parseConversationCap,
  spentIn,
  type CapPreferences,
  type ConversationCap,
  type CostCap,
  type CostCapReached
} from '@shared/cost-cap'
import { log } from '../log'
import type { PromptOptions } from '../agent/agent-host'
import type { ConversationManager } from './manager'

/**
 * Message envoyé à l'agent par « Continuer » après une interruption. Comme les autres messages de
 * l'app pour l'agent (`AGENT_PROMPTS`), il n'est pas traduit (ADR-0014).
 */
export const CONTINUE_PROMPT = 'Continue là où tu t’es arrêté.'

/** Début du message retenu, montré sur la carte. */
const HELD_PREVIEW = 300

type Manager = Pick<ConversationManager, 'subscribe' | 'view' | 'post' | 'cancel' | 'prompt'> & {
  promptGate?: ConversationManager['promptGate']
}

interface Held {
  text: string
  attachments: PromptAttachment[]
  options: PromptOptions
}

/** Évènement après lequel le plafond peut être franchi : consommation, fin d'outil, fin de tour. */
function watched(event: AgentEvent): boolean {
  if (event.type === 'usage-report' || event.type === 'turn-end' || event.type === 'turn-error') {
    return true
  }
  if (event.type !== 'update') return false
  const update = event.update
  return (
    update.sessionUpdate === 'usage_update' ||
    (update.sessionUpdate === 'tool_call_update' &&
      (update.status === 'completed' || update.status === 'failed'))
  )
}

export class CostCapGuard {
  /** Tours interrompus par le plafond : la carte est posée à leur fin. */
  private readonly due = new Map<string, Omit<CostCapReached, 'interrupted'>>()
  /** Messages retenus au plafond, en attente de « Continuer ». */
  private readonly held = new Map<string, Held>()

  private readonly manager: Manager
  private readonly preferences: () => CapPreferences

  constructor(manager: Manager, preferences: () => CapPreferences) {
    this.manager = manager
    this.preferences = preferences
  }

  /** Commence à suivre les conversations et à garder leurs envois ; rend le désabonnement. */
  start(): () => void {
    // Chaînée : la garde d'avant (lecture seule…) passe d'abord, puis celle-ci.
    const previous = this.manager.promptGate
    this.manager.promptGate = (id, text, attachments = [], options = {}) =>
      (previous?.(id, text, attachments, options) ?? false) ||
      this.hold(id, { text, attachments, options })
    const stop = this.manager.subscribe({
      event: (payload) => this.onEvent(payload),
      deleted: (id) => {
        this.due.delete(id)
        this.held.delete(id)
      }
    })
    return () => {
      stop()
      if (previous) this.manager.promptGate = previous
      else delete this.manager.promptGate
    }
  }

  /** Plafond d'une conversation (le sien, `settings`, `none`) ; `null` : aucun posé. */
  setCap(id: string, cap: ConversationCap | null): void {
    this.manager.post(id, { type: 'cost-cap-set', cap })
  }

  /**
   * Réponse à la carte : « Continuer » relève le plafond, puis envoie le message retenu ou relance
   * l'agent arrêté — sans attendre la fin de ce tour ; « Arrêter » oublie le message retenu.
   */
  answer(id: string, itemId: number, answer: CostCapAnswer): void {
    const { transcript } = this.manager.view(id)
    const item = transcript.items.find((i) => i.id === itemId)
    if (item?.kind !== 'cost-cap' || item.answer || item.superseded) return
    const held = item.held !== undefined ? this.held.get(id) : undefined
    this.held.delete(id)
    let raisedTo: number | undefined
    if (answer === 'continue') {
      const spent = spentIn(transcript.usage, item.unit) ?? item.spent
      const cap = nextCap({ limit: item.limit, unit: item.unit }, spent, item.step)
      this.manager.post(id, { type: 'cost-cap-set', cap })
      raisedTo = cap.limit
    }
    this.manager.post(id, {
      type: 'cost-cap-answer',
      itemId,
      answer,
      ...(raisedTo !== undefined ? { raisedTo } : {})
    })
    if (answer !== 'continue') return
    const send = held
      ? this.manager.prompt(id, held.text, held.attachments, held.options)
      : item.interrupted
        ? this.manager.prompt(id, CONTINUE_PROMPT)
        : undefined
    send?.catch((error: unknown) => log.warn(`Envoi après le plafond impossible (${id}) :`, error))
  }

  /** Plafond atteint à l'envoi d'un message : il est retenu, et une carte demande quoi faire. */
  private hold(id: string, message: Held): boolean {
    let view: ReturnType<Manager['view']>
    try {
      view = this.manager.view(id)
    } catch {
      return false
    }
    const prefs = this.preferences()
    const reached = capReached(view.transcript, prefs)
    if (!reached) return false
    this.held.set(id, message)
    const preview = message.text.trim() || message.attachments.map(attachmentName).join(', ')
    this.post(id, reached.cap, reached.spent, prefs, false, preview.slice(0, HELD_PREVIEW))
    return true
  }

  private post(
    id: string,
    cap: CostCap,
    spent: number,
    prefs: CapPreferences,
    interrupted: boolean,
    held?: string
  ): void {
    const reached: CostCapReached = {
      limit: cap.limit,
      unit: cap.unit,
      spent,
      step: capStep(prefs, cap.unit),
      interrupted,
      ...(held !== undefined ? { held } : {})
    }
    this.manager.post(id, { type: 'cost-cap-reached', reached })
  }

  private onEvent({ conversationId: id, event }: ConversationEvent): void {
    if (event.type === 'user-message') return this.freeze(id)
    const due = this.due.get(id)
    if (due) {
      // Tour interrompu par le plafond : la carte vient après sa fin (ou l'arrêt de l'agent).
      const ended =
        event.type === 'turn-end' ||
        event.type === 'turn-error' ||
        (event.type === 'status' && event.snapshot.status !== 'busy')
      if (ended) {
        this.due.delete(id)
        this.manager.post(id, { type: 'cost-cap-reached', reached: { ...due, interrupted: true } })
      }
      return
    }
    if (!watched(event)) return
    let view: ReturnType<Manager['view']>
    try {
      view = this.manager.view(id)
    } catch {
      return // Conversation supprimée entre-temps.
    }
    const ended = event.type === 'turn-end' || event.type === 'turn-error'
    const busy = !ended && view.snapshot?.status === 'busy'
    const prefs = this.preferences()
    const decision = capDecision(view.transcript, prefs, busy)
    if (decision.kind === 'ask') this.post(id, decision.cap, decision.spent, prefs, false)
    if (decision.kind !== 'interrupt') return
    log.info(
      `Plafond de coût franchi (${id}) : ${decision.spent} / ${decision.cap.limit} ${decision.cap.unit}, tour interrompu`
    )
    this.due.set(id, {
      limit: decision.cap.limit,
      unit: decision.cap.unit,
      spent: decision.spent,
      step: capStep(prefs, decision.cap.unit)
    })
    this.manager.cancel(id).catch((error: unknown) => {
      log.warn(`Interruption au plafond impossible (${id}) :`, error)
    })
  }

  /** Premier message : le réglage du moment (activé ou non) est figé dans le fil. */
  private freeze(id: string): void {
    if (!this.preferences().costCapEnabled) return
    let view: ReturnType<Manager['view']>
    try {
      view = this.manager.view(id)
    } catch {
      return
    }
    const { items, costCap } = view.transcript
    if (costCap === undefined && items.filter((i) => i.kind === 'user').length === 1) {
      this.manager.post(id, { type: 'cost-cap-set', cap: 'settings' })
    }
  }
}

type CostCapChannel = 'conversation:setCostCap' | 'conversation:answerCostCap'

const str = (value: unknown, name: string): string => {
  if (typeof value !== 'string' || !value) throw new Error(`Paramètre invalide : ${name}`)
  return value
}

/** Canaux du plafond (branchés par `ipc.ts`) ; les arguments viennent du renderer : vérifiés ici. */
export function costCapHandlers(
  guard: Pick<CostCapGuard, 'setCap' | 'answer'> | undefined
): Pick<IpcHandlers, CostCapChannel> {
  return {
    'conversation:setCostCap': (id, cap) => {
      guard?.setCap(str(id, 'id'), parseConversationCap(cap))
      return undefined
    },
    'conversation:answerCostCap': (id, itemId, answer) => {
      if (typeof itemId !== 'number' || !Number.isInteger(itemId)) {
        throw new Error('Paramètre invalide : itemId')
      }
      if (answer !== 'continue' && answer !== 'stop') throw new Error('Paramètre invalide : answer')
      guard?.answer(str(id, 'id'), itemId, answer)
      return undefined
    }
  }
}
