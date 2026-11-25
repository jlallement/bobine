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
import { shortModelName } from '@shared/models'
import { t } from 'i18next'
import type { AgentEvent, ConversationEvent, ConversationSummary } from '@shared/agent'
import type { PromptAttachment } from '@shared/attachments'
import type { AttentionState } from '@shared/attention'
import { messageOf } from '@shared/errors'
import {
  canRebut,
  canRelaunch,
  findRoundtable,
  hasQuorum,
  reduceRoundtable,
  roundtableRunning,
  seatFinished,
  selectionProblem,
  settleRoundtable,
  usableSeats,
  type Roundtable,
  type RoundtableEvent,
  type RoundtableItem,
  type RoundtableLetter,
  type RoundtableSeat
} from '@shared/roundtable'
import type {
  RoundtableOptions,
  RoundtableStartRequest,
  RoundtableStartResult
} from '@shared/roundtable-ipc'
import {
  QUESTION_CHARS,
  lastExchangeText,
  participantMessage,
  rebuttalMessage
} from '@shared/roundtable-prompts'
import type { TranscriptItem } from '@shared/transcript'
import type { ChildConversations } from '../conversations/children'
import type { ProvidersList } from '../conversations/handover'
import type { ConversationManager } from '../conversations/manager'
import { log } from '../log'
import type { RoundtableService } from './ipc'
import {
  arbiterInSeats,
  arbiterOf,
  refusalOf,
  releaseWhenIdle,
  roundtableOptions,
  type ParticipantMode
} from './options'
import { participantRole } from './participant-role'
import { reportReply, stepReply, turnReply } from './readings'
import { SeatEvents, type SeatRef } from './seat-events'
import type { StepFolder } from './step-folder'
import { newRoundtable } from './new-roundtable'
import { MotherSteps, titleOf } from './steps'
import { IdleWaiters } from './idle-waiters'

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
  | 'unqueue'
  | 'rename'
  | 'updateRecord'
  | 'releaseIdle'
  | 'profileOf'
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
    | 'watchParticipants'
    | 'watchSettled'
  >
  attention: () => AttentionState
  /** Fournisseurs déclarés chez chaque agent (destinations, fiche 108). */
  providers?: ProvidersList
  /**
   * Oublie le message de ce tour retenu par le plafond de cette conversation (fiche 157) : un tour
   * arrêté ne repart pas par « Continuer ».
   */
  dropHeld?: (conversationId: string, roundtableId: string) => void
  /** Mode installé pour le rôle « Participant » (décision C3) ; absent : aucun. */
  participantMode?: ParticipantMode
  /** Empreinte du dossier autour de la synthèse et de la décision (S1) ; absent : aucune. */
  folder?: StepFolder
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
  /**
   * Lancement en cours de chaque place : son jeton (seul le dernier peut envoyer la question ou
   * mettre la place en erreur) et sa fin (question partie, abandonnée ou en échec).
   */
  launches: Map<RoundtableLetter, { token: number; settled: Promise<void> }>
}

/** Attente, au plus, de la fin d'un lancement avant « Relancer » (agent qui ne démarre pas). */
const RELAUNCH_WAIT_MS = 15_000
/** Attente, au plus, de l'arrêt de chaque participant avant de dire le tour « arrêté ». */
const STOP_WAIT_MS = 10_000

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

/** Phases où les participants travaillent : leurs conversations restent dans la barre latérale. */
const ACTIVE_PHASES: ReadonlySet<Roundtable['phase']> = new Set(['collecting', 'rebutting'])

/** Phases où le tour n'attend plus rien de lui-même. */
const FINISHED_PHASES: ReadonlySet<Roundtable['phase']> = new Set([
  'synthesized',
  'decided',
  'stopped'
])

/**
 * Phases où les participants n'ont plus rien à faire (recette réelle, G1) : leurs agents sont
 * arrêtés proprement. « Faire réagir les participants » les rouvre (reprise de session).
 */
const AGENTS_RELEASED: ReadonlySet<Roundtable['phase']> = new Set([
  'synthesized',
  'decided',
  'insufficient',
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
  private launchCount = 0
  private readonly steps: MotherSteps
  private readonly idle: IdleWaiters
  private readonly seats: SeatEvents

  constructor(deps: RoundtablesDeps) {
    this.deps = deps
    this.idle = new IdleWaiters(
      (id) => deps.conversations.state().conversations.find((c) => c.id === id)?.status
    )
    const apply = (motherId: string, roundtableId: string, event: RoundtableEvent) =>
      this.apply(motherId, roundtableId, event)
    this.steps = new MotherSteps({
      conversations: deps.conversations,
      attention: deps.attention,
      apply,
      read: (motherId, roundtableId) => this.read(motherId, roundtableId),
      cancel: (motherId) => this.cancel(motherId),
      tours: (motherId) => this.tours(motherId),
      textOf: (rt, kind, letter) => this.textOf(rt, kind, letter as RoundtableLetter),
      watchesSettled: (rt) => this.watchesSettled(rt),
      ...(deps.folder ? { folder: deps.folder } : {}),
      arbiterClash: (motherId, rt) =>
        arbiterInSeats(this.deps.conversations, this.summary(motherId).profileId, motherId, rt),
      gone: (childId) => !!childId && !this.exists(childId),
      now: () => this.now()
    })
    this.seats = new SeatEvents({
      conversations: deps.conversations,
      read: (motherId, roundtableId) => this.read(motherId, roundtableId),
      apply,
      live: (roundtableId) => this.live.get(roundtableId),
      participantMode: deps.participantMode,
      cancel: (conversationId) => this.cancel(conversationId),
      rename: (conversationId, title) => {
        try {
          this.deps.conversations.rename(conversationId, title)
        } catch {
          // Conversation partie entre-temps.
        }
      },
      now: () => this.now()
    })
    // Garde-fou de lecture seule : les participants d'un même tour forment un groupe ; un tour
    // qu'il n'a pas pu juger ramène la lecture seule « demandée » à « non vérifiée ».
    deps.children.watchParticipants({
      group: (childId) => this.seatsByChild.get(childId)?.roundtableId,
      changed: (childId) => {
        const ref = this.seatsByChild.get(childId)
        if (ref) apply(ref.motherId, ref.roundtableId, this.seats.folderChanged(ref))
      },
      unjudged: (childId) => {
        const ref = this.seatsByChild.get(childId)
        if (ref) this.seats.unjudged(ref, childId)
      }
    })
  }

  /** Synthèse ou décision en cours dans cette conversation (son tour est en lecture seule). */
  stepActive(motherId: string): boolean {
    return this.steps.stepActive(motherId)
  }

  /** Comparaison du dossier de la dernière étape finie (essais). */
  stepFolderChecked(motherId: string): Promise<void> {
    return this.steps.folderChecked(motherId)
  }

  /** Tours et places suivis en mémoire (essais : rien ne reste après la fin d'un tour). */
  tracked(): { tours: number; seats: number } {
    return { tours: this.live.size, seats: this.seatsByChild.size }
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
  /**
   * Fiche de chaque participant tenue à jour (fiche 285) : l'état de sa place et le tour en cours
   * ou non (la barre latérale ne le montre que pendant le recueil ou la réplique).
   */
  private syncSeats(rt: Roundtable): void {
    const active = ACTIVE_PHASES.has(rt.phase) && !rt.stopping
    const list = this.deps.conversations.state().conversations
    for (const seat of rt.seats) {
      const summary = seat.childId ? list.find((c) => c.id === seat.childId) : undefined
      if (!summary?.roundtable) continue
      // Début du travail en cours : l'avis, puis la réplique (G3).
      const since = rt.phase === 'rebutting' ? seat.rebuttal?.askedAt : seat.startedAt
      const { roundtable: now } = summary
      if (now.active === active && now.state === seat.state && now.since === since) continue
      this.deps.conversations.updateRecord(summary.id, (record) => {
        record.roundtableSeat = { state: seat.state, active, ...(since ? { since } : {}) }
      })
    }
  }

  private changed(motherId: string, before: Roundtable, after: Roundtable): void {
    this.syncSeats(after)
    for (const seat of after.seats) {
      const old = before.seats.find((s) => s.letter === seat.letter)
      if (!seat.childId) continue
      const seatStopped =
        seat.state === 'stopped' && old?.state !== 'stopped' && STOPS_HERE.has(seat.stopped ?? '')
      const rebuttalStopped =
        seat.rebuttal?.state === 'stopped' &&
        old?.rebuttal?.state !== 'stopped' &&
        STOPS_HERE.has(seat.rebuttal.stopped ?? '')
      if (seatStopped) {
        this.cancel(seat.childId)
        // Question retenue par le plafond de sa conversation : oubliée, « Continuer » ne la
        // renverra plus (contre-revue, N1).
        this.deps.dropHeld?.(seat.childId, after.roundtableId)
      }
      if (rebuttalStopped) {
        // La réplique en cours s'arrête ; en file ou retenue, elle est retirée. Un tour que
        // l'utilisateur a lancé lui-même dans cette conversation continue.
        if (old?.rebuttal?.state === 'working') this.cancel(seat.childId)
        this.dropPending(seat.childId, after.roundtableId)
      }
    }
    if (after.phase === 'stopped' && before.phase !== 'stopped') {
      this.deps.dropHeld?.(motherId, after.roundtableId)
    }
    if (before.phase !== after.phase) {
      log.info(`Tour de table ${after.roundtableId.slice(0, 8)} : ${before.phase} → ${after.phase}`)
    }
    if (PAST_COLLECTING.has(after.phase)) {
      const tour = this.live.get(after.roundtableId)
      if (tour) tour.attachments = []
    }
    if (after.phase === 'synthesizing' || after.phase === 'deciding') this.steps.schedule(motherId)
    if (AGENTS_RELEASED.has(after.phase) && before.phase !== after.phase) {
      releaseWhenIdle(
        after,
        (childId) => this.idle.wait(childId, STOP_WAIT_MS),
        (childId) => {
          const now = this.read(motherId, after.roundtableId)
          if (now && AGENTS_RELEASED.has(now.phase) && this.exists(childId))
            this.deps.conversations.releaseIdle(childId)
        },
        (childId) => !!this.deps.conversations.profileOf(childId)?.costSource
      )
    }
    if (FINISHED_PHASES.has(after.phase)) this.release(after.roundtableId)
  }

  /**
   * Tour fini (synthèse rendue, décision rendue, arrêté) : plus rien en mémoire. Un geste suivant
   * (« Faire réagir les participants ») le suit de nouveau (`track`).
   */
  private release(roundtableId: string): void {
    this.live.delete(roundtableId)
    for (const [childId, ref] of this.seatsByChild) {
      if (ref.roundtableId === roundtableId) this.seatsByChild.delete(childId)
    }
  }

  /** Réplique de ce tour encore en file ou retenue au plafond chez ce participant : retirée. */
  private dropPending(childId: string, roundtableId: string): void {
    this.deps.dropHeld?.(childId, roundtableId)
    try {
      const queued = this.deps.conversations.view(childId).snapshot?.queued ?? []
      for (const message of queued) {
        if (message.from?.kind === 'roundtable' && message.from.id === roundtableId) {
          this.deps.conversations.unqueue(childId, message.id)
        }
      }
    } catch {
      // Conversation partie entre-temps : plus rien en file.
    }
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
      tour = {
        motherId,
        attachments: [],
        opinions: new Map(),
        rebuttals: new Map(),
        launches: new Map()
      }
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
    // Relu de la conversation du participant : la réponse entière au message `askedAt`.
    const own = seat?.childId && askedAt !== undefined ? this.replyIn(seat.childId, askedAt) : ''
    if (own) return own
    const motherId = tour?.motherId
    if (!motherId) return undefined
    try {
      // Sinon, le compte rendu gardé dans le fil de la mère (conversation partie, fil abîmé).
      const items = this.deps.conversations.view(motherId).transcript.items
      return reportReply(items, seat?.childId, askedAt)
    } catch {
      return undefined
    }
  }

  private replyIn(childId: string, askedAt: number): string {
    try {
      return turnReply(this.deps.conversations.view(childId).transcript.items, askedAt)
    } catch {
      return ''
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
      if (this.live.has(rt.roundtableId)) continue
      // Seulement les tours qui attendent encore un geste : rien des tours finis en mémoire.
      if (roundtableRunning(rt) || rt.phase === 'insufficient') this.index(motherId, rt)
      const settled = settleRoundtable(rt, this.now())
      if (settled === rt) continue
      log.info(`Tour de table ${rt.roundtableId.slice(0, 8)} interrompu par un redémarrage`)
      events.push({ type: 'roundtable', roundtable: settled })
      // Fiches des participants mises à jour hors de la lecture du fil (qui ne doit rien émettre).
      setTimeout(() => this.syncSeats(settled), 0)
    }
    return events
  }

  /** Fils déjà lus avant la création de l'orchestrateur : réglés de la même façon. */
  settleAlreadyLoaded(): void {
    // Au lancement de l'app, aucun tour ne tourne : aucun participant n'est « en cours ».
    for (const summary of this.deps.conversations.state().conversations) {
      if (!summary.roundtable?.active) continue
      this.deps.conversations.updateRecord(summary.id, (record) => {
        if (record.roundtableSeat)
          record.roundtableSeat = { ...record.roundtableSeat, active: false }
      })
    }
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
    this.idle.onEvent(id, event)
    const seat = this.seatsByChild.get(id)
    if (seat) this.seats.onEvent(id, seat, event)
    const fromTour = event.type === 'user-message' && event.from?.kind === 'roundtable'
    if (fromTour || this.steps.watches(id) || this.mothers().has(id)) this.steps.onEvent(id, event)
  }

  private mothers(): Set<string> {
    return new Set([...this.live.values()].map((tour) => tour.motherId))
  }

  /** Conversation supprimée (corbeille comprise) : place d'un participant, ou tours d'une mère. */
  deleted(id: string): void {
    this.idle.release(id)
    const seat = this.seatsByChild.get(id)
    if (seat) {
      // Rien de figé dans l'élément (corbeille, restauration, effacement) : l'absence se constate
      // à la construction de la synthèse, et l'interface lit l'existence de la conversation. Un
      // participant au travail est seulement arrêté (son agent l'est avec sa conversation).
      const rt = this.read(seat.motherId, seat.roundtableId)
      const at = this.now()
      if (rt?.phase === 'collecting') {
        this.apply(seat.motherId, seat.roundtableId, {
          type: 'seat-stopped',
          letter: seat.letter,
          reason: 'user',
          at
        })
      } else if (rt?.phase === 'rebutting') {
        this.apply(seat.motherId, seat.roundtableId, {
          type: 'rebuttal-seat',
          letter: seat.letter,
          state: 'stopped',
          stopped: 'user',
          at
        })
      }
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
    // Même question, entière, pour les participants et pour l'arbitre : jamais coupée en silence.
    if (request.question.length > QUESTION_CHARS) return { ok: false, error: 'question' }
    const profiles = this.deps.conversations.settingsView().profiles
    const facts = profiles.map((p) => ({
      id: p.id,
      available: p.available,
      modelChoice: !!p.childModel
    }))
    const controls = this.deps.conversations.view(motherId).snapshot?.controls ?? []
    const problem = selectionProblem(
      request.participants,
      facts,
      arbiterOf(summary.profileId, controls, profiles)
    )
    if (problem) return { ok: false, error: 'selection', problem: problem.problem }
    const reservation = this.deps.children.reserve(motherId, request.participants.length)
    if ('missing' in reservation) return { ok: false, error: 'slots', missing: reservation.missing }
    this.starting.add(motherId)
    try {
      const rt = newRoundtable(
        {
          conversations: this.deps.conversations,
          random: this.deps.random ?? Math.random,
          now: this.now()
        },
        summary,
        request
      )
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
    const tour = this.live.get(roundtableId)
    const attachments = tour?.attachments ?? []
    // Un jeton par lancement : après « Arrêter » puis « Relancer », l'ancien ne peut plus rien.
    const token = ++this.launchCount
    let settle = () => {}
    tour?.launches.set(seat.letter, {
      token,
      settled: new Promise((resolve) => (settle = resolve))
    })
    const current = () => this.live.get(roundtableId)?.launches.get(seat.letter)?.token === token
    // Tour arrêté pendant le lancement des places précédentes : celle-ci ne part pas.
    if (!this.seats.mayStart(ref)) return settle()
    const extras = {
      ...(seat.model
        ? {
            model: { controlId: seat.model.controlId, value: seat.model.value },
            strictModel: true as const
          }
        : {}),
      ...(attachments.length ? { attachments } : {}),
      // La question de ce tour : oubliée si elle est retenue par le plafond puis le tour arrêté.
      roundtableQuestion: roundtableId,
      proceed: () => {
        settle()
        return current() && this.seats.mayStart(ref)
      },
      launchFailed: (error: unknown) => {
        settle()
        if (current()) this.seats.launchFailed(ref, error)
      }
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
        // Nom court seul (« Fx/Alpha » → « Alpha ») : l'icône dit déjà « tour de table ».
        title: seat.model ? shortModelName(seat.label) : seat.label,
        profileId: seat.profileId,
        roleSnapshot: participantRole(),
        card: roundtableId,
        roundtable: roundtableId,
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
      settle()
      if (!current()) return
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
    if (summary.archived && !archivedToo) throw new Error(t('roundtable.error.archivedGesture'))
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

  // Gestes : le tour est suivi le temps du geste ; s'il est fini ensuite (ou que le geste est
  // refusé sur un tour fini), plus rien n'en reste en mémoire.
  synthesize(motherId: string, roundtableId: string): void {
    this.gestureOn(motherId, roundtableId, () => this.synthesizeNow(motherId, roundtableId))
  }

  rebuttal(motherId: string, roundtableId: string): void {
    this.gestureOn(motherId, roundtableId, () => this.rebuttalNow(motherId, roundtableId))
  }

  decide(motherId: string, roundtableId: string): void {
    this.gestureOn(motherId, roundtableId, () => this.decideNow(motherId, roundtableId))
  }

  async stop(motherId: string, roundtableId: string, letter?: RoundtableLetter): Promise<void> {
    try {
      if (letter) this.stopSeat(motherId, roundtableId, letter)
      else await this.stopAll(motherId, roundtableId)
    } finally {
      this.releaseIfFinished(motherId, roundtableId)
    }
  }

  async relaunch(motherId: string, roundtableId: string, letter: RoundtableLetter): Promise<void> {
    try {
      await this.relaunchNow(motherId, roundtableId, letter)
    } finally {
      this.releaseIfFinished(motherId, roundtableId)
    }
  }

  private gestureOn(motherId: string, roundtableId: string, run: () => void): void {
    try {
      run()
    } finally {
      this.releaseIfFinished(motherId, roundtableId)
    }
  }

  private releaseIfFinished(motherId: string, roundtableId: string): void {
    const rt = this.read(motherId, roundtableId)
    // Seulement un tour de cette conversation : un identifiant d’ailleurs ne libère rien.
    if (rt && FINISHED_PHASES.has(rt.phase)) this.release(roundtableId)
  }

  private synthesizeNow(motherId: string, roundtableId: string): void {
    const rt = this.gesture(motherId, roundtableId)
    if (this.apply(motherId, roundtableId, { type: 'synthesize', at: this.now() })) return
    const quorum = hasQuorum(usableSeats(rt).length)
    throw new Error(t(quorum ? 'roundtable.error.phase' : 'roundtable.error.quorum'))
  }

  private rebuttalNow(motherId: string, roundtableId: string): void {
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
      // Conversation à la corbeille : pas de réplique, sans erreur.
      if (!this.exists(seat.childId)) {
        this.apply(motherId, roundtableId, {
          type: 'rebuttal-seat',
          letter: seat.letter,
          state: 'stopped',
          stopped: 'removed',
          at: this.now()
        })
        continue
      }
      this.seats.sendRebuttal(
        { motherId, roundtableId, letter: seat.letter },
        seat.childId,
        rebuttalMessage(seat.letter, synthesis),
        titleOf(rt.question),
        this.deps.children
      )
    }
  }

  private decideNow(motherId: string, roundtableId: string): void {
    this.gesture(motherId, roundtableId)
    if (!this.apply(motherId, roundtableId, { type: 'decide', at: this.now() })) {
      throw new Error(t('roundtable.error.phase'))
    }
  }

  private async relaunchNow(
    motherId: string,
    roundtableId: string,
    letter: RoundtableLetter
  ): Promise<void> {
    const rt = this.gesture(motherId, roundtableId)
    this.seatOf(rt, letter)
    if (!canRelaunch(rt, letter)) throw new Error(t('roundtable.error.phase'))
    const tour = this.track(motherId, rt)
    // Pièces jointes perdues au redémarrage : jamais un participant relancé sans elles.
    if (rt.attachments?.length && tour.attachments.length === 0) {
      throw new Error(t('roundtable.error.attachmentsLost'))
    }
    // Le lancement précédent finit d'abord (jamais deux réglages de modèle à la fois).
    if (!(await this.launchSettled(tour, letter))) throw new Error(t('roundtable.error.phase'))
    const seat = this.seatOf(this.gesture(motherId, roundtableId), letter)
    if (!canRelaunch(this.gesture(motherId, roundtableId), letter)) {
      throw new Error(t('roundtable.error.phase'))
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

  /** Le lancement en cours de cette place a fini (`false` : toujours en cours après l'attente). */
  private async launchSettled(tour: LiveTour, letter: RoundtableLetter): Promise<boolean> {
    const launch = tour.launches.get(letter)
    if (!launch) return true
    let timer: ReturnType<typeof setTimeout> | undefined
    const late = new Promise<false>(
      (resolve) => (timer = setTimeout(() => resolve(false), RELAUNCH_WAIT_MS))
    )
    const done = await Promise.race([launch.settled.then(() => true as const), late])
    clearTimeout(timer)
    return done
  }

  private exists(id: string): boolean {
    return this.deps.conversations.state().conversations.some((c) => c.id === id)
  }

  /**
   * « Arrêter le tour de table » (B5a) : « arrêt en cours », puis les participants et la demande
   * en cours sont arrêtés et attendus (au plus `STOP_WAIT_MS`), leurs fiches marquées « arrêté » ;
   * seulement ensuite le tour passe à « arrêté ».
   */
  private async stopAll(motherId: string, roundtableId: string): Promise<void> {
    const rt = this.gesture(motherId, roundtableId, true)
    if (!this.apply(motherId, roundtableId, { type: 'stopping', at: this.now() })) {
      throw new Error(t('roundtable.error.phase'))
    }
    const busy = rt.seats.flatMap((seat) => {
      // Une réplique encore en file n'est pas un tour à couper : elle est retirée (`changed`).
      const working = !seatFinished(seat.state) || seat.rebuttal?.state === 'working'
      return seat.childId && working ? [seat.childId] : []
    })
    for (const childId of busy) this.cancel(childId)
    // La synthèse ou la décision en route ou en cours de réponse s'arrête avec le tour.
    if (this.steps.answeringFor(motherId, roundtableId)) {
      this.cancel(motherId)
      busy.push(motherId)
    }
    await Promise.all(busy.map((id) => this.idle.wait(id, STOP_WAIT_MS)))
    const current = this.read(motherId, roundtableId)
    if (!current) return
    const at = this.now()
    this.syncSeats(reduceRoundtable(current, { type: 'stop', at }))
    this.apply(motherId, roundtableId, { type: 'stop', at })
  }

  private stopSeat(motherId: string, roundtableId: string, letter: RoundtableLetter): void {
    const rt = this.gesture(motherId, roundtableId, true)
    const at = this.now()
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
