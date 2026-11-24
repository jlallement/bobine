/**
 * Orchestrateur du tour de table (fiche 285, ADR-0072) : l'app mène le tour, pas l'agent.
 *
 * - L'état vit dans l'élément `roundtable` du fil de la conversation (« la mère »), remplacé sur
 *   place : chaque changement passe par `reduceRoundtable` du contrat, qui refuse un geste hors de
 *   sa phase (même objet rendu). Rien d'essentiel n'est gardé seulement en mémoire : après un
 *   redémarrage, `settleRoundtable` le rend « à reprendre » à la lecture du fil, et rien ne repart
 *   sans un geste.
 * - Chaque participant est une conversation fille en lecture seule (`ChildConversations.start`,
 *   rôle « Participant » figé, `card = roundtableId`, modèle strict), lancée avec ses sœurs sur des
 *   places réservées ensemble.
 * - Les avis partent à l'agent de la mère une seule fois, par la demande de synthèse (`steps.ts`) ;
 *   la réplique, par un message à chaque participant dans sa propre conversation.
 *
 * Les identifiants venus du renderer sont vérifiés contre l'état réel : un tour se pilote
 * seulement depuis la conversation dont le fil le porte, et une place doit exister.
 */
import { randomUUID } from 'node:crypto'
import { t } from 'i18next'
import type { AgentEvent, ConversationEvent, ConversationSummary } from '@shared/agent'
import { attachmentName, type PromptAttachment } from '@shared/attachments'
import type { AttentionState } from '@shared/attention'
import { messageOf } from '@shared/errors'
import {
  canRebut,
  canRelaunch,
  findRoundtable,
  hasQuorum,
  newSeats,
  reduceRoundtable,
  roundtableRunning,
  selectionProblem,
  settleRoundtable,
  usableSeats,
  type Roundtable,
  type RoundtableEvent,
  type RoundtableItem,
  type RoundtableLetter,
  type RoundtableParticipant,
  type RoundtableSeat
} from '@shared/roundtable'
import type {
  RoundtableOptions,
  RoundtableStartRequest,
  RoundtableStartResult
} from '@shared/roundtable-ipc'
import { lastExchangeText, participantMessage, rebuttalMessage } from '@shared/roundtable-prompts'
import type { TranscriptItem } from '@shared/transcript'
import { modelControl } from '../agent/models-seen'
import type { ChildConversations } from '../conversations/children'
import type { ProvidersList } from '../conversations/handover'
import type { ConversationManager } from '../conversations/manager'
import { log } from '../log'
import type { RoundtableService } from './ipc'
import { refusalOf, roundtableOptions, type ParticipantMode } from './options'
import { participantRole } from './participant-role'
import { reportReply, stepReply } from './readings'
import { SeatEvents, type SeatRef } from './seat-events'
import { MotherSteps } from './steps'

export type RoundtableManager = Pick<
  ConversationManager,
  | 'state'
  | 'view'
  | 'post'
  | 'prompt'
  | 'cancel'
  | 'settingsView'
  | 'settings'
  | 'keepDraft'
  | 'loadedTranscripts'
>

export interface RoundtablesDeps {
  conversations: RoundtableManager
  children: Pick<
    ChildConversations,
    | 'start'
    | 'reserve'
    | 'capacity'
    | 'relaunchParticipant'
    | 'followUp'
    | 'onFolderChanged'
    | 'watchSettled'
  >
  attention: () => AttentionState
  /** Fournisseurs déclarés chez chaque agent (destinations, fiche 108). */
  providers?: ProvidersList
  /** Mode installé pour le rôle « Participant » (décision C3) ; absent : aucun. */
  participantMode?: ParticipantMode
  /** Aléa du tirage des lettres (`Math.random` en vrai). */
  random?: () => number
  now?: () => number
}

/** Ce qu'un tour en cours garde en mémoire, en plus de son élément : rien d'indispensable. */
export interface LiveTour {
  motherId: string
  /** Pièces jointes de la question, pour « Relancer » (jamais écrites dans le fil). */
  attachments: PromptAttachment[]
  /** Avis et répliques lus à la fin de leur tour ; relus du fil de la mère sinon. */
  opinions: Map<RoundtableLetter, string>
  rebuttals: Map<RoundtableLetter, string>
}

const asRoundtable = ({ kind: _kind, id: _id, ...rt }: RoundtableItem): Roundtable => rt

/** Phases après lesquelles plus aucun participant ne repart : pièces jointes oubliées. */
const PAST_COLLECTING: ReadonlySet<Roundtable['phase']> = new Set([
  'synthesizing',
  'synthesized',
  'rebutting',
  'deciding',
  'decided',
  'stopped'
])

/** Arrêts décidés ici : la conversation du participant est arrêtée aussi. */
const STOPS_HERE = new Set(['user', 'early-synthesis', 'roundtable-stopped'])

export class Roundtables implements RoundtableService {
  private readonly deps: RoundtablesDeps
  private readonly live = new Map<string, LiveTour>()
  /** Conversation d'un participant → sa place (tours vus depuis le lancement de l'app). */
  private readonly seatsByChild = new Map<string, SeatRef>()
  /** Conversations dont un tour est en train de partir (deux lancements rapprochés). */
  private readonly starting = new Set<string>()
  private readonly steps: MotherSteps
  private readonly seats: SeatEvents

  constructor(deps: RoundtablesDeps) {
    this.deps = deps
    const apply = (motherId: string, roundtableId: string, event: RoundtableEvent) =>
      this.apply(motherId, roundtableId, event)
    this.steps = new MotherSteps({
      conversations: deps.conversations,
      attention: deps.attention,
      apply,
      tours: (motherId) => this.tours(motherId),
      textOf: (rt, kind, letter) => this.textOf(rt, kind, letter as RoundtableLetter),
      watchesSettled: (rt) => this.watchesSettled(rt),
      now: () => this.now()
    })
    this.seats = new SeatEvents({
      conversations: deps.conversations,
      read: (motherId, roundtableId) => this.read(motherId, roundtableId),
      apply,
      live: (roundtableId) => this.live.get(roundtableId),
      participantMode: deps.participantMode,
      now: () => this.now()
    })
    deps.children.onFolderChanged((childId) => {
      const ref = this.seatsByChild.get(childId)
      if (ref) apply(ref.motherId, ref.roundtableId, this.seats.folderChanged(ref))
    })
  }

  private now(): number {
    return this.deps.now?.() ?? Date.now()
  }

  // -------------------------------------------------------------------------------------------
  // Lecture et changements de l'élément

  /** Le tour `roundtableId` tel que dans le fil de `motherId` ; `undefined` s'il n'y est pas. */
  private read(motherId: string, roundtableId: string): Roundtable | undefined {
    try {
      const item = findRoundtable(
        this.deps.conversations.view(motherId).transcript.items,
        roundtableId
      )
      return item ? asRoundtable(item) : undefined
    } catch {
      return undefined
    }
  }

  /** Tours suivis d'une conversation, tels que dans son fil. */
  private tours(motherId: string): Roundtable[] {
    return [...this.live.entries()].flatMap(([roundtableId, tour]) => {
      const rt = tour.motherId === motherId ? this.read(motherId, roundtableId) : undefined
      return rt ? [rt] : []
    })
  }

  /**
   * Applique un évènement du contrat et pose l'élément obtenu ; rend le tour changé, `undefined`
   * si l'évènement était hors de sa phase (rien n'est posé).
   */
  private apply(
    motherId: string,
    roundtableId: string,
    event: RoundtableEvent
  ): Roundtable | undefined {
    const before = this.read(motherId, roundtableId)
    if (!before) return undefined
    const after = reduceRoundtable(before, event)
    if (after === before) return undefined
    this.deps.conversations.post(motherId, { type: 'roundtable', roundtable: after })
    this.changed(motherId, before, after)
    return after
  }

  /** Suites d'un changement : arrêter ce qui doit l'être, envoyer ce qui attend l'agent. */
  private changed(motherId: string, before: Roundtable, after: Roundtable): void {
    for (const seat of after.seats) {
      const old = before.seats.find((s) => s.letter === seat.letter)
      const stoppedNow =
        (seat.state === 'stopped' &&
          old?.state !== 'stopped' &&
          STOPS_HERE.has(seat.stopped ?? '')) ||
        (seat.rebuttal?.state === 'stopped' &&
          old?.rebuttal?.state !== 'stopped' &&
          STOPS_HERE.has(seat.rebuttal.stopped ?? ''))
      if (stoppedNow && seat.childId) this.cancel(seat.childId)
    }
    if (before.phase !== after.phase) {
      log.info(`Tour de table ${after.roundtableId.slice(0, 8)} : ${before.phase} → ${after.phase}`)
    }
    if (PAST_COLLECTING.has(after.phase)) {
      const tour = this.live.get(after.roundtableId)
      if (tour) tour.attachments = []
    }
    if (after.phase === 'synthesizing' || after.phase === 'deciding') this.steps.schedule(motherId)
  }

  private cancel(conversationId: string): void {
    try {
      void this.deps.conversations.cancel(conversationId).catch((error: unknown) => {
        log.warn(`Tour de table : arrêt de ${conversationId.slice(0, 8)} impossible :`, error)
      })
    } catch {
      // Conversation partie entre-temps : plus rien à arrêter.
    }
  }

  /** Le tour est mené par ce processus : ses places sont suivies, il n'est plus « à régler ». */
  private track(motherId: string, rt: Roundtable): LiveTour {
    let tour = this.live.get(rt.roundtableId)
    if (!tour) {
      tour = { motherId, attachments: [], opinions: new Map(), rebuttals: new Map() }
      this.live.set(rt.roundtableId, tour)
    }
    this.index(motherId, rt)
    return tour
  }

  private index(motherId: string, rt: Roundtable): void {
    for (const seat of rt.seats) {
      if (seat.childId) {
        this.seatsByChild.set(seat.childId, {
          motherId,
          roundtableId: rt.roundtableId,
          letter: seat.letter
        })
      }
    }
  }

  private textOf(
    rt: Roundtable,
    kind: 'opinion' | 'rebuttal',
    letter: RoundtableLetter
  ): string | undefined {
    const tour = this.live.get(rt.roundtableId)
    const kept = (kind === 'opinion' ? tour?.opinions : tour?.rebuttals)?.get(letter)
    if (kept) return kept
    const seat = rt.seats.find((s) => s.letter === letter)
    const askedAt = kind === 'opinion' ? seat?.askedAt : seat?.rebuttal?.askedAt
    const motherId = tour?.motherId
    if (!motherId) return undefined
    try {
      const items = this.deps.conversations.view(motherId).transcript.items
      return reportReply(items, seat?.childId, askedAt)
    } catch {
      return undefined
    }
  }

  private async watchesSettled(rt: Roundtable): Promise<void> {
    await Promise.all(
      rt.seats.flatMap((s) => (s.childId ? [this.deps.children.watchSettled(s.childId)] : []))
    )
  }

  // -------------------------------------------------------------------------------------------
  // Évènements des conversations

  /**
   * Fil lu du disque (`settleLoaded` du gestionnaire) : un tour en cours que ce processus ne mène
   * pas a été interrompu par un redémarrage ; il est réglé (`settleRoundtable`), sans rien relancer.
   */
  settleLoaded(motherId: string, items: readonly TranscriptItem[]): AgentEvent[] {
    const events: AgentEvent[] = []
    for (const item of items) {
      if (item.kind !== 'roundtable') continue
      const rt = asRoundtable(item)
      this.index(motherId, rt)
      if (this.live.has(rt.roundtableId)) continue
      const settled = settleRoundtable(rt, this.now())
      if (settled === rt) continue
      log.info(`Tour de table ${rt.roundtableId.slice(0, 8)} interrompu par un redémarrage`)
      events.push({ type: 'roundtable', roundtable: settled })
    }
    return events
  }

  /** Fils déjà lus avant la création de l'orchestrateur : réglés de la même façon. */
  settleAlreadyLoaded(): void {
    for (const id of this.deps.conversations.loadedTranscripts()) {
      try {
        const items = this.deps.conversations.view(id).transcript.items
        for (const event of this.settleLoaded(id, items)) this.deps.conversations.post(id, event)
      } catch {
        // Conversation partie entre-temps.
      }
    }
  }

  onEvent({ conversationId: id, event }: ConversationEvent): void {
    const seat = this.seatsByChild.get(id)
    if (seat) this.seats.onEvent(id, seat, event)
    const fromTour = event.type === 'user-message' && event.from?.kind === 'roundtable'
    if (fromTour || this.steps.holds(id) || this.mothers().has(id)) this.steps.onEvent(id, event)
  }

  private mothers(): Set<string> {
    return new Set([...this.live.values()].map((tour) => tour.motherId))
  }

  /** Conversation supprimée (corbeille comprise) : place d'un participant, ou tours d'une mère. */
  deleted(id: string): void {
    const seat = this.seatsByChild.get(id)
    if (seat) {
      this.seatsByChild.delete(id)
      this.apply(seat.motherId, seat.roundtableId, {
        type: 'seat-removed',
        letter: seat.letter,
        at: this.now()
      })
    }
    if (!this.mothers().has(id)) return
    // Mère partie : ses participants détachés encore au travail sont arrêtés (famille, fiche 228).
    const alive = new Set(this.deps.conversations.state().conversations.map((c) => c.id))
    for (const [childId, ref] of this.seatsByChild) {
      if (ref.motherId !== id) continue
      this.seatsByChild.delete(childId)
      if (alive.has(childId)) this.cancel(childId)
    }
    for (const [roundtableId, tour] of this.live)
      if (tour.motherId === id) this.live.delete(roundtableId)
    this.steps.forget(id)
    log.info(`Tour de table : conversation ${id.slice(0, 8)} supprimée, ses tours abandonnés`)
  }

  /** Liste changée : un tour en cours dans une conversation archivée est arrêté. */
  listChanged(): void {
    const archived = new Set(
      this.deps.conversations
        .state()
        .conversations.filter((c) => c.archived)
        .map((c) => c.id)
    )
    for (const [roundtableId, tour] of this.live) {
      if (!archived.has(tour.motherId)) continue
      const rt = this.read(tour.motherId, roundtableId)
      if (rt && roundtableRunning(rt) && rt.phase !== 'interrupted') {
        this.apply(tour.motherId, roundtableId, { type: 'stop', at: this.now() })
      }
    }
  }

  // -------------------------------------------------------------------------------------------
  // Canaux

  options(conversationId: string): RoundtableOptions {
    return roundtableOptions(
      {
        conversations: this.deps.conversations,
        children: this.deps.children,
        providers: this.deps.providers ?? (() => []),
        ...(this.deps.participantMode ? { participantMode: this.deps.participantMode } : {})
      },
      conversationId
    )
  }

  private summary(id: string): ConversationSummary {
    const found = this.deps.conversations.state().conversations.find((c) => c.id === id)
    if (found) return found
    try {
      return this.deps.conversations.view(id).summary
    } catch {
      throw new Error(t('roundtable.error.unknown'))
    }
  }

  async start(motherId: string, request: RoundtableStartRequest): Promise<RoundtableStartResult> {
    const summary = this.summary(motherId)
    const items = this.deps.conversations.view(motherId).transcript.items
    const refused = this.starting.has(motherId) ? 'running' : refusalOf(summary, items)
    if (refused) return { ok: false, error: refused }
    const profiles = this.deps.conversations.settingsView().profiles
    const facts = profiles.map((p) => ({
      id: p.id,
      available: p.available,
      modelChoice: !!p.childModel
    }))
    const problem = selectionProblem(request.participants, facts)
    if (problem) return { ok: false, error: 'selection', problem: problem.problem }
    const reservation = this.deps.children.reserve(motherId, request.participants.length)
    if ('missing' in reservation) return { ok: false, error: 'slots', missing: reservation.missing }
    this.starting.add(motherId)
    try {
      const rt = this.newRoundtable(summary, request)
      if (summary.draft) this.deps.conversations.keepDraft(motherId, request.question)
      const exchange = lastExchangeText(items)
      if (exchange) rt.withLastExchange = true
      this.deps.conversations.post(motherId, { type: 'roundtable', roundtable: rt })
      const tour = this.track(motherId, rt)
      tour.attachments = request.attachments ?? []
      log.info(
        `Tour de table ${rt.roundtableId.slice(0, 8)} lancé : ${rt.seats.length} participants`
      )
      const text = participantMessage(request.question, exchange)
      for (const seat of rt.seats)
        await this.launchSeat(motherId, rt.roundtableId, seat, text, true)
      return { ok: true, roundtableId: rt.roundtableId }
    } finally {
      reservation.release()
      this.starting.delete(motherId)
    }
  }

  private newRoundtable(summary: ConversationSummary, request: RoundtableStartRequest): Roundtable {
    const profiles = this.deps.conversations.settingsView().profiles
    const participants: RoundtableParticipant[] = request.participants.map((choice) => {
      const agentLabel = profiles.find((p) => p.id === choice.profileId)?.label ?? choice.profileId
      return { ...choice, label: choice.model?.name ?? agentLabel, agentLabel }
    })
    const control = modelControl(this.deps.conversations.view(summary.id).snapshot?.controls ?? [])
    const model = control?.options.find((o) => o.value === control.currentValue)?.name
    const names = (request.attachments ?? []).map(attachmentName)
    return {
      roundtableId: randomUUID(),
      question: request.question,
      ...(names.length ? { attachments: names } : {}),
      synthesizer: {
        profileId: summary.profileId,
        label: summary.profileLabel,
        ...(model ? { model } : {})
      },
      seats: newSeats(participants, this.deps.random ?? Math.random),
      phase: 'collecting',
      at: this.now()
    }
  }

  /**
   * Lance (ou relance) un participant : sa conversation fille en lecture seule, son modèle strict,
   * puis la question. `childId` : relancé dans sa conversation existante.
   */
  private async launchSeat(
    motherId: string,
    roundtableId: string,
    seat: RoundtableSeat,
    text: string,
    reserved: boolean,
    childId?: string
  ): Promise<void> {
    const ref: SeatRef = { motherId, roundtableId, letter: seat.letter }
    const attachments = this.live.get(roundtableId)?.attachments ?? []
    const extras = {
      ...(seat.model
        ? {
            model: { controlId: seat.model.controlId, value: seat.model.value },
            strictModel: true as const
          }
        : {}),
      ...(attachments.length ? { attachments } : {}),
      proceed: () => this.seats.mayStart(ref),
      launchFailed: (error: unknown) => this.seats.launchFailed(ref, error)
    }
    try {
      if (childId) {
        this.deps.children.relaunchParticipant(childId, text, {
          ...extras,
          role: participantRole()
        })
        return
      }
      const child = await this.deps.children.start(motherId, {
        ...extras,
        text,
        title: `${t('roundtable.name')} · ${seat.label}`,
        profileId: seat.profileId,
        roleSnapshot: participantRole(),
        card: roundtableId,
        ...(reserved ? { reserved: true } : {})
      })
      this.seatsByChild.set(child.id, ref)
      this.apply(motherId, roundtableId, {
        type: 'seat-launched',
        letter: seat.letter,
        childId: child.id,
        readOnly: this.seats.expectedReadOnly(motherId, seat.profileId),
        at: this.now()
      })
    } catch (error) {
      log.warn(`Tour de table ${roundtableId.slice(0, 8)} : participant ${seat.letter} non lancé`)
      this.apply(motherId, roundtableId, {
        type: 'seat-failed',
        letter: seat.letter,
        error: 'start-failed',
        detail: messageOf(error),
        at: this.now()
      })
    }
  }

  /** Un geste sur un tour : la conversation existe, le tour est dans son fil ; il est suivi. */
  private gesture(motherId: string, roundtableId: string, archivedToo = false): Roundtable {
    const summary = this.summary(motherId)
    if (summary.archived && !archivedToo) throw new Error(t('roundtable.error.archived'))
    const rt = this.read(motherId, roundtableId)
    if (!rt) throw new Error(t('roundtable.error.unknown'))
    this.track(motherId, rt)
    return rt
  }

  private seatOf(rt: Roundtable, letter: RoundtableLetter): RoundtableSeat {
    const seat = rt.seats.find((s) => s.letter === letter)
    if (!seat) throw new Error(t('roundtable.error.unknown'))
    return seat
  }

  synthesize(motherId: string, roundtableId: string): void {
    const rt = this.gesture(motherId, roundtableId)
    if (this.apply(motherId, roundtableId, { type: 'synthesize', at: this.now() })) return
    const quorum = hasQuorum(usableSeats(rt).length)
    throw new Error(t(quorum ? 'roundtable.error.phase' : 'roundtable.error.quorum'))
  }

  rebuttal(motherId: string, roundtableId: string): void {
    const rt = this.gesture(motherId, roundtableId)
    const from = rt.phase === 'interrupted' ? rt.interruptedFrom : rt.phase
    if (rt.verdict || from === 'rebutting' || from === 'deciding' || from === 'decided') {
      throw new Error(t('roundtable.error.rebuttalOnce'))
    }
    const items = this.deps.conversations.view(motherId).transcript.items
    const synthesis = stepReply(items, roundtableId, 'synthesis')
    if (!canRebut(rt) || !synthesis) throw new Error(t('roundtable.error.phase'))
    const next = this.apply(motherId, roundtableId, { type: 'rebuttal', at: this.now() })
    if (!next) throw new Error(t('roundtable.error.phase'))
    log.info(`Tour de table ${roundtableId.slice(0, 8)} : réplique demandée`)
    for (const seat of next.seats) {
      if (seat.rebuttal?.state !== 'waiting' || !seat.childId) continue
      this.seats.sendRebuttal(
        { motherId, roundtableId, letter: seat.letter },
        seat.childId,
        rebuttalMessage(seat.letter, synthesis),
        this.deps.children
      )
    }
  }

  decide(motherId: string, roundtableId: string): void {
    this.gesture(motherId, roundtableId)
    if (!this.apply(motherId, roundtableId, { type: 'decide', at: this.now() })) {
      throw new Error(t('roundtable.error.phase'))
    }
  }

  async relaunch(motherId: string, roundtableId: string, letter: RoundtableLetter): Promise<void> {
    const rt = this.gesture(motherId, roundtableId)
    const seat = this.seatOf(rt, letter)
    if (!canRelaunch(rt, letter)) throw new Error(t('roundtable.error.phase'))
    const tour = this.track(motherId, rt)
    // Pièces jointes perdues au redémarrage : jamais un participant relancé sans elles.
    if (rt.attachments?.length && tour.attachments.length === 0) {
      throw new Error(t('roundtable.error.attachmentsLost'))
    }
    const items = this.deps.conversations.view(motherId).transcript.items
    const at = items.findIndex((i) => i.kind === 'roundtable' && i.roundtableId === roundtableId)
    const exchange = rt.withLastExchange ? lastExchangeText(items.slice(0, at)) : undefined
    const next = this.apply(motherId, roundtableId, {
      type: 'seat-relaunched',
      letter,
      at: this.now()
    })
    if (!next) throw new Error(t('roundtable.error.phase'))
    tour.opinions.delete(letter)
    const exists = !!seat.childId && this.exists(seat.childId)
    const text = participantMessage(rt.question, exchange)
    await this.launchSeat(
      motherId,
      roundtableId,
      this.seatOf(next, letter),
      text,
      false,
      exists ? seat.childId : undefined
    )
  }

  private exists(id: string): boolean {
    return this.deps.conversations.state().conversations.some((c) => c.id === id)
  }

  stop(motherId: string, roundtableId: string, letter?: RoundtableLetter): void {
    const rt = this.gesture(motherId, roundtableId, true)
    const at = this.now()
    if (!letter) {
      if (!this.apply(motherId, roundtableId, { type: 'stop', at })) {
        throw new Error(t('roundtable.error.phase'))
      }
      // La synthèse ou la décision en cours de réponse s'arrête avec le tour.
      if (this.steps.answeringFor(motherId, roundtableId)) this.cancel(motherId)
      return
    }
    const seat = this.seatOf(rt, letter)
    const event: RoundtableEvent | undefined =
      rt.phase === 'collecting'
        ? { type: 'seat-stopped', letter, reason: 'user', at }
        : rt.phase === 'rebutting' && seat.rebuttal
          ? { type: 'rebuttal-seat', letter, state: 'stopped', stopped: 'user', at }
          : undefined
    if (!event || !this.apply(motherId, roundtableId, event)) {
      throw new Error(t('roundtable.error.phase'))
    }
  }
}
