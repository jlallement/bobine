/**
 * Demandes du tour de table à l'agent de la conversation (fiche 285, ADR-0072) : la synthèse, puis
 * la décision après la réplique. Chacune part **au repos** de l'agent (même règle que le réveil
 * groupé : prêt, sans file d'attente ni demande en cours), comme un message de l'app
 * `from: { kind: 'roundtable' }`, avec les avis en contexte caché, construits seulement par
 * `synthesisRequest` et `verdictRequest` du contrat (avis encadrés comme des données).
 *
 * Suivi par les évènements de la conversation, jamais par la promesse de `prompt` (elle se résout
 * à la fin du tour, ou tout de suite quand le plafond retient le message) :
 * - message parti (`user-message` de provenance `roundtable`) : `step-sent` ;
 * - message retenu par le plafond de la conversation (fiche 157) : `step-held`, puis « Continuer »
 *   le renvoie, provenance comprise ;
 * - fin du tour : `step-answered` avec ce que l'agent a communiqué du tour, `step-failed` sur une
 *   erreur ou un arrêt ; coût communiqué après coup (Bob) : `step-usage`.
 */
import { t } from 'i18next'
import type { AgentEvent, ConversationsState, ConversationView } from '@shared/agent'
import type { AttentionState } from '@shared/attention'
import type { MessageOrigin } from '@shared/children'
import { messageOf } from '@shared/errors'
import { shortModelName } from '@shared/models'
import type { Roundtable, RoundtableEvent, RoundtableStepKind } from '@shared/roundtable'
import { synthesisRequest, verdictRequest } from '@shared/roundtable-prompts'
import type { ConversationManager } from '../conversations/manager'
import { log } from '../log'
import { lastTurnDigest, opinionInputs, rebuttalInputs } from './readings'
import type { FolderBaseline, StepFolder } from './step-folder'

/** Titre d'une demande du tour dans le fil (la question, coupée). */
const TITLE_CHARS = 80

export interface StepRef {
  roundtableId: string
  step: RoundtableStepKind
}

/** Ce que les demandes à la conversation demandent à l'orchestrateur. */
export interface StepsHost {
  conversations: Pick<ConversationManager, 'prompt'> & {
    state: () => ConversationsState
    view: (id: string) => Pick<ConversationView, 'snapshot' | 'transcript'>
  }
  attention: () => AttentionState
  apply: (motherId: string, roundtableId: string, event: RoundtableEvent) => Roundtable | undefined
  /** Le tour tel que dans le fil de la conversation, suivi ou non. */
  read: (motherId: string, roundtableId: string) => Roundtable | undefined
  /** Arrête le tour en cours de la conversation. */
  cancel: (motherId: string) => void
  /** Tours suivis de cette conversation, tels que dans son fil. */
  tours: (motherId: string) => Roundtable[]
  /** Texte d'un avis (`opinion`) ou d'une réplique, gardé en mémoire ou relu du fil de la mère. */
  textOf: (rt: Roundtable, kind: 'opinion' | 'rebuttal', letter: string) => string | undefined
  /** Conversation d'un participant absente (corbeille, effacée) : son avis ne part pas. */
  gone: (childId: string | undefined) => boolean
  /** Vérifications de lecture seule des participants finies (l'avertissement part avec l'avis). */
  watchesSettled: (rt: Roundtable) => Promise<void>
  /** L'arbitre est devenu l'un des participants (modèle changé depuis le lancement). */
  arbiterClash?: (motherId: string, rt: Roundtable) => boolean
  /** Empreinte du dossier autour du tour de l'étape (S1) ; absent : rien n'est surveillé. */
  folder?: StepFolder
  now: () => number
}

/** Réessai d'un envoi refusé (l'agent préparait) : 100 ms, puis le double, 5 s au plus. */
export const retryDelay = (tries: number): number => Math.min(100 * 2 ** (tries - 1), 5_000)

/** Titre d'une demande du tour dans le fil : la question, sur une ligne, coupée. */
export const titleOf = (question: string): string => {
  const line = question.replace(/\s+/g, ' ').trim()
  return line.length > TITLE_CHARS ? `${line.slice(0, TITLE_CHARS - 1)}…` : line
}

/** Étape attendue d'un tour : synthèse demandée, ou décision demandée, pas encore partie. */
function waitingStep(rt: Roundtable): RoundtableStepKind | undefined {
  if (rt.phase === 'synthesizing' && rt.synthesis?.state === 'waiting') return 'synthesis'
  if (rt.phase === 'deciding' && rt.verdict?.state === 'waiting') return 'verdict'
  return undefined
}

export class MotherSteps {
  private readonly host: StepsHost
  /** Demande en route (avant son `user-message`), par conversation. */
  private readonly sending = new Map<string, StepRef>()
  /** Demande partie, en attente de la fin du tour de l'agent. */
  private readonly answering = new Map<string, StepRef>()
  /** Dernière demande répondue : un coût communiqué après coup lui revient (Bob, fiche 109). */
  private readonly costWatch = new Map<string, StepRef>()
  private readonly scheduled = new Set<string>()
  /** Envois refusés d'affilée parce que l'agent préparait une réponse : réessai espacé. */
  private readonly retries = new Map<string, number>()
  private readonly checking = new Set<string>()
  /** État du dossier avant le tour de l'étape en cours, par conversation (S1). */
  private readonly baselines = new Map<string, Promise<FolderBaseline | undefined>>()
  /** Comparaisons de fin d'étape en cours (essais). */
  private readonly comparing = new Map<string, Promise<void>>()

  constructor(host: StepsHost) {
    this.host = host
  }

  /** Une demande de ce tour est en route ou attend sa réponse. */
  holds(motherId: string): boolean {
    return this.sending.has(motherId) || this.answering.has(motherId)
  }

  /** Une demande du tour est en route ou en cours de réponse ici : son tour est en lecture seule. */
  stepActive(motherId: string): boolean {
    return this.holds(motherId)
  }

  /** Évènements de cette conversation encore attendus (demande en cours, coût après coup). */
  watches(motherId: string): boolean {
    return this.holds(motherId) || this.costWatch.has(motherId)
  }

  /** La conversation a une demande de ce tour en cours de réponse. */
  answeringFor(motherId: string, roundtableId: string): boolean {
    // Une demande encore en route n'a pas besoin d'être coupée ici : arrivée après l'arrêt, elle
    // est annulée à son départ (`sent`).
    return this.answering.get(motherId)?.roundtableId === roundtableId
  }

  /** Comparaison du dossier de la fin d'étape finie (essais). */
  folderChecked(motherId: string): Promise<void> {
    return this.comparing.get(motherId) ?? Promise.resolve()
  }

  forget(motherId: string): void {
    this.baselines.delete(motherId)
    this.retries.delete(motherId)
    this.sending.delete(motherId)
    this.answering.delete(motherId)
    this.costWatch.delete(motherId)
  }

  /** À revoir après les évènements en cours : une demande peut-elle partir ? */
  schedule(motherId: string): void {
    if (this.scheduled.has(motherId)) return
    this.scheduled.add(motherId)
    setTimeout(() => {
      this.scheduled.delete(motherId)
      void this.check(motherId)
    }, 0)
  }

  /** Évènement de la conversation d'un tour (la « mère »). */
  onEvent(motherId: string, event: AgentEvent): void {
    switch (event.type) {
      case 'user-message':
        return this.sent(motherId, event.from, event.model?.name)
      case 'cost-cap-reached': {
        const ref = this.sending.get(motherId)
        if (!ref || event.reached.held === undefined) return
        this.sending.delete(motherId)
        // Empreinte reprise au départ (« Continuer ») : d'ici là, le dossier peut changer.
        this.baselines.delete(motherId)
        this.host.apply(motherId, ref.roundtableId, { type: 'step-held', step: ref.step })
        return
      }
      case 'turn-end':
      case 'turn-error':
        return this.ended(motherId, event)
      case 'usage-report': {
        const ref = this.costWatch.get(motherId)
        const usage = ref && lastTurnDigest(this.host.conversations.view(motherId).transcript.usage)
        if (ref && usage)
          this.host.apply(motherId, ref.roundtableId, { ...ref, type: 'step-usage', usage })
        return
      }
      case 'status':
        if (event.snapshot.status !== 'busy') this.schedule(motherId)
        return
    }
  }

  private sent(motherId: string, from: MessageOrigin | undefined, model?: string): void {
    this.costWatch.delete(motherId)
    // La réplique va aux participants, pas à cette conversation (`seat-events.ts`).
    // La réplique va aux participants, pas à cette conversation.
    if (from?.kind !== 'roundtable' || from.step === 'rebuttal') return
    const ref = { roundtableId: from.id, step: from.step }
    this.retries.delete(motherId)
    this.sending.delete(motherId)
    // Tour arrêté entre-temps (message en route, retenu puis « Continuer ») : rien n'est rédigé.
    const state = this.host.read(motherId, ref.roundtableId)?.[ref.step]?.state
    if (state !== 'waiting' && state !== 'held') {
      log.info(`Tour de table ${ref.roundtableId.slice(0, 8)} : ${ref.step} arrivée après l'arrêt`)
      this.host.cancel(motherId)
      return
    }
    this.answering.set(motherId, ref)
    // Demande retenue puis « Continuer » : empreinte prise au départ, avec l'agent (plus lent).
    if (!this.baselines.has(motherId)) void this.prepareFolder(motherId)
    // Qui rédige vraiment : l'agent et le modèle de la conversation au départ de la demande.
    const summary = this.host.conversations.state().conversations.find((c) => c.id === motherId)
    this.host.apply(motherId, ref.roundtableId, {
      type: 'step-sent',
      step: ref.step,
      at: this.host.now(),
      ...(summary
        ? {
            by: {
              profileId: summary.profileId,
              label: summary.profileLabel,
              // Nom court et lisible (« Tidepool Alpha Free », pas « opencode/… », C1).
              ...(model ? { model: shortModelName(model) } : {})
            }
          }
        : {})
    })
  }

  private ended(motherId: string, event: Extract<AgentEvent, { type: 'turn-end' | 'turn-error' }>) {
    const ref = this.answering.get(motherId)
    if (!ref) return
    this.answering.delete(motherId)
    this.compareFolder(motherId, ref)
    const { roundtableId, step } = ref
    // Ce que la tentative a consommé, même en échec ou arrêtée (contre-recette N3) ; un coût
    // communiqué après coup lui revient aussi (`costWatch`).
    const spent = lastTurnDigest(this.host.conversations.view(motherId).transcript.usage)
    const usage = spent ? { usage: spent } : {}
    if (event.type === 'turn-error') {
      this.host.apply(motherId, roundtableId, {
        type: 'step-failed',
        step,
        detail: event.message,
        ...usage
      })
      this.costWatch.set(motherId, ref)
    } else if (event.stopReason === 'cancelled') {
      // Arrêtée par l'utilisateur ou par le plafond : à reprendre d'un geste (« Synthétiser… »).
      this.host.apply(motherId, roundtableId, { type: 'step-failed', step, ...usage })
      this.costWatch.set(motherId, ref)
    } else {
      this.host.apply(motherId, roundtableId, {
        type: 'step-answered',
        step,
        at: this.host.now(),
        ...usage
      })
      this.costWatch.set(motherId, ref)
    }
    log.info(`Tour de table ${roundtableId.slice(0, 8)} : ${step} terminée (${event.type})`)
  }

  /** Au repos : prête (ou arrêtée, relancée à l'envoi), sans file d'attente ni demande en cours. */
  private idle(motherId: string): boolean {
    const summary = this.host.conversations.state().conversations.find((c) => c.id === motherId)
    if (!summary || summary.archived) return false
    if (!['ready', 'stopped', 'idle'].includes(summary.status)) return false
    if (this.host.attention()[motherId] === 'request') return false
    return !this.host.conversations.view(motherId).snapshot?.queued.length
  }

  private pending(motherId: string): { rt: Roundtable; step: RoundtableStepKind } | undefined {
    for (const rt of this.host.tours(motherId)) {
      if (rt.stopping) continue
      const step = waitingStep(rt)
      if (step) return { rt, step }
    }
    return undefined
  }

  private async check(motherId: string): Promise<void> {
    if (this.checking.has(motherId) || this.holds(motherId)) return
    const first = this.pending(motherId)
    if (!first || !this.idle(motherId)) return
    this.checking.add(motherId)
    try {
      // L'avertissement « le dossier a changé » doit partir avec l'avis : vérifications finies.
      await this.host.watchesSettled(first.rt)
    } finally {
      this.checking.delete(motherId)
    }
    const next = this.pending(motherId)
    if (!next || this.holds(motherId) || !this.idle(motherId)) return
    this.send(motherId, next.rt, next.step)
  }

  private send(motherId: string, rt: Roundtable, step: RoundtableStepKind): void {
    if (this.host.arbiterClash?.(motherId, rt)) {
      // L'arbitre jugerait son propre avis : rien ne part, la carte le dit et propose de reprendre
      // (« Synthétiser… » une fois le modèle de la conversation changé).
      log.info(
        `Tour de table ${rt.roundtableId.slice(0, 8)} : ${step} refusée (arbitre participant)`
      )
      this.host.apply(motherId, rt.roundtableId, {
        type: 'step-failed',
        step,
        detail: t('roundtable.error.arbiter')
      })
      return
    }
    const request =
      step === 'synthesis'
        ? synthesisRequest(
            rt.question,
            opinionInputs(
              rt,
              (seat) => this.host.textOf(rt, 'opinion', seat.letter),
              this.host.gone
            ),
            undefined,
            rt.folderChanged?.collecting
          )
        : verdictRequest(
            rt.question,
            rebuttalInputs(
              rt,
              (seat) => this.host.textOf(rt, 'rebuttal', seat.letter),
              this.host.gone
            ),
            undefined,
            rt.folderChanged?.rebuttal
          )
    const from: MessageOrigin = {
      kind: 'roundtable',
      id: rt.roundtableId,
      title: titleOf(rt.question),
      step
    }
    const ref = { roundtableId: rt.roundtableId, step }
    // Posé avant l'empreinte et l'appel : le plafond retient le message pendant l'appel
    // (`step-held`), et rien d'autre ne part entre-temps.
    this.sending.set(motherId, ref)
    void this.prepareFolder(motherId).then(() => {
      if (this.sending.get(motherId) !== ref) return
      // Tour arrêté pendant l'empreinte : la demande ne part pas.
      const now = this.host.tours(motherId).find((r) => r.roundtableId === ref.roundtableId)
      if (!now || waitingStep(now) !== step) {
        this.sending.delete(motherId)
        this.baselines.delete(motherId)
        return
      }
      log.info(`Tour de table ${rt.roundtableId.slice(0, 8)} : ${step} demandée`)
      this.host.conversations
        .prompt(motherId, request.prompt, [], { from, context: request.context })
        .catch((error: unknown) => this.notSent(motherId, ref, error))
    })
  }

  /** Empreinte du dossier avant le tour de l'étape ; ne lève jamais. */
  private async prepareFolder(motherId: string): Promise<void> {
    const folder = this.host.folder
    const workspace = this.host.conversations
      .state()
      .conversations.find((c) => c.id === motherId)?.workspace
    if (!folder || !workspace) return
    const baseline = folder.baseline(workspace)
    this.baselines.set(motherId, baseline)
    await baseline
  }

  /** Fin du tour de l'étape : le dossier a-t-il changé (agent qui écrit sans demander) ? */
  private compareFolder(motherId: string, ref: StepRef): void {
    const baseline = this.baselines.get(motherId)
    this.baselines.delete(motherId)
    const folder = this.host.folder
    if (!baseline || !folder) return
    const done = baseline
      .then((before) => (before ? folder.changes(before) : undefined))
      .then((files) => {
        if (!files) return
        log.warn(
          `Tour de table ${ref.roundtableId.slice(0, 8)} : le dossier a changé (${ref.step})`
        )
        this.host.apply(motherId, ref.roundtableId, {
          type: 'step-changed-folder',
          step: ref.step,
          files
        })
      })
    this.comparing.set(motherId, done)
    void done.finally(() => {
      if (this.comparing.get(motherId) === done) this.comparing.delete(motherId)
    })
  }

  /** L'envoi a échoué : l'agent répondait (réessai au prochain repos), ou une vraie erreur. */
  private notSent(motherId: string, ref: StepRef, error: unknown): void {
    this.baselines.delete(motherId)
    if (this.sending.get(motherId)?.roundtableId === ref.roundtableId) this.sending.delete(motherId)
    const rt = this.host.tours(motherId).find((r) => r.roundtableId === ref.roundtableId)
    if (!rt || waitingStep(rt) !== ref.step) return
    if (messageOf(error) === t('agentHost.busy')) {
      // L'agent prépare un message (rien ne le dit dans son statut) : réessai espacé, borné.
      const tries = (this.retries.get(motherId) ?? 0) + 1
      this.retries.set(motherId, tries)
      setTimeout(() => this.schedule(motherId), retryDelay(tries))
      return
    }
    log.warn(`Tour de table ${ref.roundtableId.slice(0, 8)} : ${ref.step} non envoyée`)
    this.host.apply(motherId, ref.roundtableId, {
      type: 'step-failed',
      step: ref.step,
      detail: messageOf(error)
    })
  }
}
