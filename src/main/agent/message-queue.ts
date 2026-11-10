/**
 * Messages écrits pendant une réponse (fiche 020) : gardés dans l'ordre, puis envoyés ensemble à la
 * fin du tour, dans la limite des pièces jointes d'un message.
 */
import type { QueuedMessage, QueuedMessageView } from '@shared/agent'
import { attachmentName, MAX_ATTACHMENTS, type PromptAttachment } from '@shared/attachments'
import { sameOrigin, type MessageOrigin } from '@shared/children'
import { t } from 'i18next'
import { CHILDREN_COMMAND } from '@shared/app-commands'

/** Nombre de messages qu'on peut mettre en attente pendant une réponse. */
export const MAX_QUEUED = 20

type Queued = QueuedMessage & { id: string }

export class MessageQueue {
  private items: Queued[] = []
  private nextId = 1

  get length(): number {
    return this.items.length
  }

  /**
   * `from` : message d'une autre conversation (fiche 097), gardé pour l'envoi et l'affichage ;
   * `askChildren` : écrit avec `/split` (fiche 118).
   */
  add(
    text: string,
    attachments: PromptAttachment[],
    from?: MessageOrigin,
    askChildren?: boolean
  ): void {
    if (this.items.length >= MAX_QUEUED) {
      throw new Error(t('queue.tooMany', { max: MAX_QUEUED }))
    }
    this.items.push({
      id: `file-${this.nextId++}`,
      text,
      attachments,
      ...(from ? { from } : {}),
      ...(askChildren ? { askChildren } : {})
    })
  }

  /** Retire un message (pour le supprimer ou le modifier) et le rend. */
  remove(id: string): QueuedMessage {
    const index = this.items.findIndex((m) => m.id === id)
    const [message] = index === -1 ? [] : this.items.splice(index, 1)
    if (!message) throw new Error(t('conversations.error.queuedMissing'))
    // Rendu à la zone de saisie tel qu'il a été tapé : `/split` compris (fiche 118).
    return { text: typed(message), attachments: message.attachments }
  }

  /** Place un message en tête (« Envoyer maintenant »). */
  promote(id: string): void {
    const index = this.items.findIndex((m) => m.id === id)
    if (index === -1) throw new Error(t('conversations.error.queuedMissing'))
    this.items.unshift(...this.items.splice(index, 1))
  }

  /**
   * Retire les messages qui partent ensemble (comme Claude Code) : textes réunis, pièces jointes
   * dans la limite d'un message, et une seule provenance (fiche 097) ; le reste part au tour
   * suivant. `restore` les remet en tête.
   */
  takeBatch(): (QueuedMessage & { restore: () => void }) | undefined {
    const first = this.items[0]
    if (!first) return undefined
    const batch: Queued[] = []
    let count = 0
    for (const next of this.items) {
      if (batch.length > 0 && count + next.attachments.length > MAX_ATTACHMENTS) break
      if (!sameOrigin(next.from, first.from)) break
      if (!next.askChildren !== !first.askChildren) break
      batch.push(next)
      count += next.attachments.length
    }
    this.items.splice(0, batch.length)
    return {
      text: batch
        .map((m) => m.text.trim())
        .filter(Boolean)
        .join('\n\n'),
      attachments: batch.flatMap((m) => m.attachments),
      ...(first.from ? { from: first.from } : {}),
      ...(first.askChildren ? { askChildren: true } : {}),
      restore: () => this.items.unshift(...batch)
    }
  }

  /** Retire tous les messages, pour les confier à un autre hôte (« Relancer », fiche 043). */
  drain(): QueuedMessage[] {
    const items = this.items.map(({ id: _id, ...message }) => message)
    this.items = []
    return items
  }

  /** Remet des messages en attente, dans la limite. */
  restore(messages: readonly QueuedMessage[]): void {
    for (const message of messages) {
      if (this.items.length >= MAX_QUEUED) break
      this.items.push({ id: `file-${this.nextId++}`, ...message })
    }
  }

  views(): QueuedMessageView[] {
    return this.items.map((message) => ({
      id: message.id,
      text: typed(message),
      attachments: message.attachments.map((a) => ({ kind: a.kind, name: attachmentName(a) })),
      ...(message.from ? { from: message.from } : {})
    }))
  }
}

/** Texte d'un message tel que l'utilisateur l'a tapé : `/split` devant s'il l'a écrit avec. */
function typed(message: QueuedMessage): string {
  return message.askChildren ? `/${CHILDREN_COMMAND} ${message.text}` : message.text
}
