/**
 * Réveil groupé d'une mère (fiche 097, étape 2, ADR-0019) : quand son agent a lancé des filles
 * (`start_child`) ou leur a écrit (`message_child`), il est réveillé une seule fois, quand toutes
 * ont fini leur tour et qu'il est au repos. Leurs comptes rendus partent avec le message de réveil
 * (`childContext`, comme à l'étape 1).
 *
 * Les filles lancées à la main ne sont jamais attendues. L'attente vit en mémoire : un redémarrage
 * de l'app l'oublie (les agents des filles sont arrêtés aussi).
 */
import type { ConversationEvent, ConversationsState, ConversationView } from '@shared/agent'
import type { AttentionState } from '@shared/attention'
import { childNews, childState } from '@shared/children'

export interface WakeHost {
  state: () => ConversationsState
  view: (id: string) => Pick<ConversationView, 'snapshot' | 'transcript'>
  attention: () => AttentionState
  /** Réveille la mère : ses filles attendues ont toutes fini. */
  wake: (motherId: string) => void
}

export class ChildWake {
  private readonly host: WakeHost
  /** Par mère : ses filles attendues, et si chacune a fini son tour. */
  private readonly awaited = new Map<string, Map<string, boolean>>()
  /** Mères dont l'état est à revoir au prochain passage de la boucle. */
  private readonly scheduled = new Set<string>()
  /** Par mère : la fille dont elle traite le message (`message_parent`) pendant ce tour. */
  private readonly answering = new Map<string, string>()
  /**
   * Par mère : filles qui ont fini pendant que la mère traitait leur message. Elle a eu de leurs
   * nouvelles : leur compte rendu seul ne justifie pas un réveil (sinon, un second bilan).
   */
  private readonly informed = new Map<string, Set<string>>()

  constructor(host: WakeHost) {
    this.host = host
  }

  /** L'agent de la mère attend cette fille : il l'a lancée, ou vient de lui écrire. */
  await(motherId: string, childId: string): void {
    const children = this.awaited.get(motherId) ?? new Map<string, boolean>()
    children.set(childId, false)
    this.awaited.set(motherId, children)
  }

  /** La fille n'aura pas de tour (sa consigne n'a pas pu partir) : elle ne bloque pas le réveil. */
  finished(childId: string): void {
    for (const [motherId, children] of this.awaited) {
      if (!children.has(childId)) continue
      children.set(childId, true)
      this.schedule(motherId)
    }
  }

  /** La mère attend des filles : elle doit rester vivante (pas d'éviction). */
  holds(id: string): boolean {
    return this.awaited.has(id)
  }

  /** Conversation supprimée : mère oubliée ; fille qui ne bloque plus le réveil. */
  forget(id: string): void {
    this.release(id)
    this.finished(id)
  }

  /** La liste a changé (fille archivée, statut…) : chaque mère qui attend est revue. */
  listChanged(): void {
    for (const motherId of this.awaited.keys()) this.schedule(motherId)
  }

  onEvent({ conversationId: id, event }: ConversationEvent): void {
    for (const [motherId, children] of this.awaited) {
      if (!children.has(id)) continue
      // Un nouveau tour de la fille : elle travaille de nouveau.
      if (event.type === 'user-message') children.set(id, false)
      if (event.type === 'turn-end' || event.type === 'turn-error') {
        // Un message attend derrière ce tour (de la mère…) : la fille n'a pas fini, sauf arrêt.
        const queued = this.host.view(id).snapshot?.queued.length ?? 0
        const stopped = event.type === 'turn-end' && event.stopReason === 'cancelled'
        if (queued === 0 || stopped) children.set(id, true)
        if (this.answering.get(motherId) === id) {
          this.informed.set(motherId, new Set([...(this.informed.get(motherId) ?? []), id]))
        }
        this.schedule(motherId)
      }
    }
    const children = this.awaited.get(id)
    if (!children) return
    if (event.type === 'user-message') {
      // Un message de la mère emporte les comptes rendus des filles finies.
      for (const [childId, done] of children) if (done) children.delete(childId)
      if (children.size === 0) this.release(id)
      if (event.from?.kind === 'child') this.answering.set(id, event.from.id)
      else this.answering.delete(id)
    } else if (event.type === 'status') {
      if (event.snapshot.status !== 'busy') this.answering.delete(id)
      this.schedule(id)
    }
  }

  /** La mère n'attend plus personne. */
  private release(motherId: string): void {
    this.awaited.delete(motherId)
    this.answering.delete(motherId)
    this.informed.delete(motherId)
  }

  /** Revue après les évènements en cours : la file d'une conversation a pu partir entre-temps. */
  private schedule(motherId: string): void {
    if (this.scheduled.has(motherId)) return
    this.scheduled.add(motherId)
    setTimeout(() => {
      this.scheduled.delete(motherId)
      this.check(motherId)
    }, 0)
  }

  private check(motherId: string): void {
    const children = this.awaited.get(motherId)
    if (!children) return
    const { conversations } = this.host.state()
    const byId = new Map(conversations.map((c) => [c.id, c]))
    const attention = this.host.attention()
    for (const [id, done] of children) {
      const child = byId.get(id)
      // Supprimée, archivée ou détachée de sa mère : elle ne bloque pas le réveil.
      if (!child || child.archived || child.startedFrom?.id !== motherId) continue
      const state = childState(child, attention[id])
      if (!done || state === 'running' || state === 'waiting') return
    }
    const mother = byId.get(motherId)
    if (!mother || mother.archived) {
      this.release(motherId)
      return
    }
    // Au repos : prête, sans file d'attente ni demande en cours.
    if (mother.status !== 'ready' || attention[motherId] === 'request') return
    const view = this.host.view(motherId)
    if (view.snapshot?.queued.length) return
    const informed = this.informed.get(motherId) ?? new Set<string>()
    this.release(motherId)
    // Rien de neuf (comptes rendus partis avec un message, ou d'une fille dont la mère vient de
    // traiter le message) : pas de réveil.
    const news = childNews(view.transcript.items)
    if (news.some((item) => item.kind === 'child-report' && !informed.has(item.childId))) {
      this.host.wake(motherId)
    }
  }
}
