/**
 * Notifications macOS (fiche 024), via Electron. Les notifications affichées sont gardées (sinon
 * leur clic est perdu) et retirées quand la conversation a été vue ; une bannière groupée (fiche
 * 119) l'est quand toutes ses conversations l'ont été. Un refus de macOS (app signée « ad hoc »)
 * est signalé une fois, pour que l'interface le dise. Le compteur du Dock : `dock-badge.ts`.
 */
import { Notification, shell } from 'electron'
import type { AttentionNotice } from './attention'

export class SystemNotifier {
  private readonly shown = new Map<string, Set<Notification>>()
  /** Conversations d'une bannière pas encore vues. */
  private readonly unseen = new WeakMap<Notification, Set<string>>()
  private readonly onClick: (conversationId: string) => void
  private readonly onBlocked: (reason: string) => void
  private blocked: string | undefined

  constructor(options: {
    onClick: (conversationId: string) => void
    onBlocked: (reason: string) => void
  }) {
    this.onClick = options.onClick
    this.onBlocked = options.onBlocked
  }

  /** Refus de macOS, s'il y en a eu un. */
  get blockedReason(): string | undefined {
    return this.blocked
  }

  /** Pour l'IPC (Réglages › Notifications) : refus de macOS, et ouvrir ses réglages. */
  controls(): { status: () => { blocked?: string }; openSettings: () => Promise<void> } {
    return {
      status: () => (this.blocked ? { blocked: this.blocked } : {}),
      openSettings: () =>
        shell.openExternal('x-apple.systempreferences:com.apple.Notifications-Settings.extension')
    }
  }

  notify(notice: AttentionNotice): void {
    if (!Notification.isSupported()) return
    const ids = notice.conversationIds ?? [notice.conversationId]
    const notification = new Notification({ title: notice.title, body: notice.body })
    const lists = ids.map((id) => {
      const list = this.shown.get(id) ?? new Set()
      this.shown.set(id, list)
      list.add(notification)
      return list
    })
    this.unseen.set(notification, new Set(ids))
    const forget = () => lists.forEach((list) => list.delete(notification))
    notification.on('click', () => {
      ids.forEach((id) => this.withdraw(id))
      this.onClick(notice.conversationId)
    })
    notification.on('close', forget)
    notification.on('failed', (_event, error) => {
      forget()
      if (this.blocked) return
      this.blocked = error
      this.onBlocked(error)
    })
    notification.show()
  }

  withdraw(conversationId: string): void {
    const list = this.shown.get(conversationId)
    if (!list) return
    this.shown.delete(conversationId)
    for (const notification of list) {
      const unseen = this.unseen.get(notification)
      unseen?.delete(conversationId)
      if (!unseen?.size) notification.close()
    }
  }
}
