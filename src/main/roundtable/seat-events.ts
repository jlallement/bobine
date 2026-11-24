/**
 * Participants d'un tour de table (fiche 285) suivis par les évènements de leur conversation :
 * question partie, avis rendu, erreur de l'agent, arrêt (par l'utilisateur ou par le plafond de la
 * conversation, fiche 157), dossier changé malgré la lecture seule, puis la réplique.
 *
 * Les erreurs de l'agent sont celles que son adaptateur a déjà classées (`turn-error`, raison en
 * clair) ; rien de propre à un agent ici.
 */
import type { AgentEvent } from '@shared/agent'
import type { StopReason } from '@shared/acp-sdk.mts'
import { lastReply } from '@shared/children'
import { messageOf } from '@shared/errors'
import type { CostCapReached } from '@shared/cost-cap'
import {
  seatFinished,
  type Roundtable,
  type RoundtableEvent,
  type RoundtableLetter,
  type RoundtableReadOnly,
  type RoundtableSeat
} from '@shared/roundtable'
import { rebuttalStance } from '@shared/roundtable-prompts'
import type { ChildConversations } from '../conversations/children'
import type { ConversationManager } from '../conversations/manager'
import { expectedReadOnly, folderInGit, modeHeld, type ParticipantMode } from './options'
import { StrictModelError } from './strict-model'

/** La place d'un participant : son tour, dans le fil de sa mère, et sa lettre. */
export interface SeatRef {
  motherId: string
  roundtableId: string
  letter: RoundtableLetter
}

export interface SeatEventsHost {
  conversations: Pick<ConversationManager, 'view' | 'state' | 'settingsView'>
  read: (motherId: string, roundtableId: string) => Roundtable | undefined
  apply: (motherId: string, roundtableId: string, event: RoundtableEvent) => Roundtable | undefined
  live: (
    roundtableId: string
  ) =>
    | { opinions: Map<RoundtableLetter, string>; rebuttals: Map<RoundtableLetter, string> }
    | undefined
  participantMode?: ParticipantMode | undefined
  now: () => number
}

const running = (state: RoundtableSeat['state'] | undefined) => !!state && !seatFinished(state)

export class SeatEvents {
  private readonly host: SeatEventsHost
  /** Réplique envoyée à un participant, pas encore partie (son `user-message` la reconnaît). */
  private readonly pendingRebuttals = new Map<string, string>()

  constructor(host: SeatEventsHost) {
    this.host = host
  }

  private seat(ref: SeatRef): { rt: Roundtable; seat: RoundtableSeat } | undefined {
    const rt = this.host.read(ref.motherId, ref.roundtableId)
    const seat = rt?.seats.find((s) => s.letter === ref.letter)
    return rt && seat ? { rt, seat } : undefined
  }

  private apply(ref: SeatRef, event: RoundtableEvent): void {
    // L'heure d'envoi de la réplique suit chaque évènement de la réplique (il la remplace).
    if (event.type === 'rebuttal-seat' && event.askedAt === undefined) {
      const askedAt = this.seat(ref)?.seat.rebuttal?.askedAt
      if (askedAt !== undefined) event = { ...event, askedAt }
    }
    this.host.apply(ref.motherId, ref.roundtableId, event)
  }

  /** La question peut-elle partir ? Seulement pour une place encore en attente (tour non arrêté). */
  mayStart(ref: SeatRef): boolean {
    const found = this.seat(ref)
    return found?.rt.phase === 'collecting' && found.seat.state === 'waiting'
  }

  folderChanged(ref: SeatRef): RoundtableEvent {
    return { type: 'seat-changed-folder', letter: ref.letter, at: this.host.now() }
  }

  /** Lecture seule attendue au lancement d'un participant de cet agent (décision C3). */
  expectedReadOnly(motherId: string, profileId: string): RoundtableReadOnly {
    const profile = this.host.conversations.settingsView().profiles.find((p) => p.id === profileId)
    const inGit = folderInGit(this.host.conversations.view(motherId).summary.workspace)
    return expectedReadOnly(profile, inGit, this.host.participantMode?.(profileId, motherId))
  }

  /**
   * Lecture seule effective, une fois la question partie : le mode installé est-il bien celui de
   * la session ? Sinon, seulement demandée (l'agent ne l'annonçait pas).
   */
  private actualReadOnly(ref: SeatRef, childId: string, seat: RoundtableSeat): RoundtableReadOnly {
    const expected = this.expectedReadOnly(ref.motherId, seat.profileId)
    if (expected !== 'native') return expected
    const installed = this.host.participantMode?.(seat.profileId, ref.motherId)
    const controls = this.host.conversations.view(childId).snapshot?.controls ?? []
    if (installed && modeHeld(controls, installed.id)) return 'native'
    const inGit = folderInGit(this.host.conversations.view(ref.motherId).summary.workspace)
    return inGit ? 'requested' : 'unverified'
  }

  /** Le garde-fou n'a pas pu juger un tour : « lecture seule demandée » n'est plus vérifiée. */
  unjudged(ref: SeatRef, childId: string): void {
    const found = this.seat(ref)
    if (found?.seat.readOnly !== 'requested') return
    this.apply(ref, {
      type: 'seat-launched',
      letter: ref.letter,
      childId,
      readOnly: 'unverified',
      at: found.seat.startedAt ?? this.host.now()
    })
  }

  /** Le premier message n'a pas pu partir : modèle strict refusé, agent qui ne démarre pas… */
  launchFailed(ref: SeatRef, error: unknown): void {
    const found = this.seat(ref)
    if (!found || found.rt.phase !== 'collecting' || !running(found.seat.state)) return
    const strict = error instanceof StrictModelError ? error : undefined
    const reason =
      strict?.reason ?? (found.seat.state === 'working' ? 'agent-error' : 'start-failed')
    const detail = strict ? strict.detail : messageOf(error)
    this.apply(ref, {
      type: 'seat-failed',
      letter: ref.letter,
      error: reason,
      ...(detail ? { detail } : {}),
      at: this.host.now()
    })
  }

  onEvent(childId: string, ref: SeatRef, event: AgentEvent): void {
    switch (event.type) {
      case 'user-message':
        return this.started(childId, ref, event.text, event.at)
      case 'turn-end':
        return this.ended(childId, ref, event.stopReason)
      case 'turn-error':
        return this.failed(ref, event.message)
      case 'cost-cap-reached':
        return this.capped(ref, event.reached)
    }
  }

  private started(childId: string, ref: SeatRef, text: string, sentAt?: number): void {
    const found = this.seat(ref)
    if (!found) return
    const { rt, seat } = found
    const at = this.host.now()
    // Heure du message dans le fil du participant : celle que porte son compte rendu (`askedAt`).
    const askedAt =
      sentAt ??
      this.host.conversations.view(childId).transcript.items.findLast((i) => i.kind === 'user')?.at
    const asked = askedAt !== undefined ? { askedAt } : {}
    if (rt.phase === 'collecting' && seat.state === 'waiting') {
      this.apply(ref, { type: 'seat-working', letter: ref.letter, at, ...asked })
      const readOnly = this.actualReadOnly(ref, childId, seat)
      if (readOnly !== seat.readOnly) {
        this.apply(ref, {
          type: 'seat-launched',
          letter: ref.letter,
          childId,
          readOnly,
          at: seat.startedAt ?? at
        })
      }
      return
    }
    // Réplique : seulement le message envoyé par le tour (pas un message tapé dans la conversation).
    if (rt.phase !== 'rebutting' || this.pendingRebuttals.get(childId) !== text) return
    this.pendingRebuttals.delete(childId)
    if (seat.rebuttal?.state === 'waiting') {
      this.apply(ref, { type: 'rebuttal-seat', letter: ref.letter, state: 'working', at, ...asked })
    }
  }

  private ended(childId: string, ref: SeatRef, stopReason: StopReason): void {
    if (stopReason === 'cancelled') {
      // Plafond de la conversation ou utilisateur : la carte du plafond, posée à la fin du tour,
      // le dit d'abord ; sinon c'est l'utilisateur qui a arrêté.
      setTimeout(() => this.stoppedByUser(ref), 0)
      return
    }
    const found = this.seat(ref)
    if (!found) return
    const { rt, seat } = found
    const text = lastReply(this.host.conversations.view(childId).transcript.items).trim()
    const at = this.host.now()
    const letter = ref.letter
    if (rt.phase === 'collecting' && seat.state === 'working') {
      if (text) this.host.live(ref.roundtableId)?.opinions.set(letter, text)
      this.apply(
        ref,
        text
          ? { type: 'seat-answered', letter, at }
          : { type: 'seat-failed', letter, error: 'agent-error', at }
      )
    } else if (rt.phase === 'rebutting' && seat.rebuttal?.state === 'working') {
      if (text) this.host.live(ref.roundtableId)?.rebuttals.set(letter, text)
      const stance = text ? rebuttalStance(text) : undefined
      this.apply(ref, {
        type: 'rebuttal-seat',
        letter,
        state: text ? 'answered' : 'error',
        ...(stance ? { stance } : {}),
        ...(text ? {} : { error: 'agent-error' as const }),
        at
      })
    }
  }

  private stoppedByUser(ref: SeatRef): void {
    const found = this.seat(ref)
    if (!found) return
    const { rt, seat } = found
    const at = this.host.now()
    if (rt.phase === 'collecting' && running(seat.state)) {
      this.apply(ref, { type: 'seat-stopped', letter: ref.letter, reason: 'user', at })
    } else if (rt.phase === 'rebutting' && running(seat.rebuttal?.state)) {
      this.apply(ref, {
        type: 'rebuttal-seat',
        letter: ref.letter,
        state: 'stopped',
        stopped: 'user',
        at
      })
    }
  }

  private failed(ref: SeatRef, message: string): void {
    const found = this.seat(ref)
    if (!found) return
    const { rt, seat } = found
    const at = this.host.now()
    const letter = ref.letter
    if (rt.phase === 'collecting' && running(seat.state)) {
      this.apply(ref, { type: 'seat-failed', letter, error: 'agent-error', detail: message, at })
    } else if (rt.phase === 'rebutting' && running(seat.rebuttal?.state)) {
      this.apply(ref, {
        type: 'rebuttal-seat',
        letter,
        state: 'error',
        error: 'agent-error',
        detail: message,
        at
      })
    }
  }

  /** Plafond de la conversation du participant (fiche 157, inchangé) : arrêté, ou réplique retenue. */
  private capped(ref: SeatRef, reached: CostCapReached): void {
    const found = this.seat(ref)
    if (!found) return
    const { rt, seat } = found
    const at = this.host.now()
    const letter = ref.letter
    if (rt.phase === 'collecting' && running(seat.state)) {
      this.apply(ref, { type: 'seat-stopped', letter, reason: 'cost-cap', at })
    } else if (rt.phase === 'rebutting' && running(seat.rebuttal?.state)) {
      this.apply(
        ref,
        reached.held !== undefined
          ? { type: 'rebuttal-seat', letter, state: 'waiting', held: true, at }
          : { type: 'rebuttal-seat', letter, state: 'stopped', stopped: 'cost-cap', at }
      )
    }
  }

  /** Réplique à un participant, dans sa conversation ; un échec d'envoi met sa réplique en erreur. */
  sendRebuttal(
    ref: SeatRef,
    childId: string,
    text: string,
    children: Pick<ChildConversations, 'followUp'>
  ): void {
    const failed = (detail?: string) =>
      this.apply(ref, {
        type: 'rebuttal-seat',
        letter: ref.letter,
        state: 'error',
        error: 'agent-error',
        ...(detail ? { detail } : {}),
        at: this.host.now()
      })
    this.pendingRebuttals.set(childId, text)
    try {
      children.followUp(childId, text, () => {
        this.pendingRebuttals.delete(childId)
        failed()
      })
    } catch (error) {
      this.pendingRebuttals.delete(childId)
      failed(messageOf(error))
    }
  }
}
