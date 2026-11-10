/**
 * État du profil vu par l'interface (fiches 196, 197) : lecture seule, et avis du lancement (un
 * fichier mis de côté, la liste des conversations refaite, une restauration…). Chaque avis est
 * montré jusqu'à ce que l'utilisateur le ferme ; son fichier reste côté main, l'interface ne
 * demande que « l'afficher dans le Finder » par son identifiant.
 */
import type { Message } from '@shared/i18n/message'
import type { ProfileNotice, ProfileNoticeLevel, ProfileStatus } from '@shared/profile'

interface Held extends ProfileNotice {
  path?: string
}

export class ProfileStatusStore {
  private readonly held: Held[] = []
  private readonly listeners = new Set<() => void>()
  private next = 1
  /** Lecture seule (fiche 196) : profil d'un format plus récent, ou marque illisible. */
  readOnly: false | 'newer' | 'unreadable' = false

  add(
    level: ProfileNoticeLevel,
    message: Message,
    options: { path?: string | undefined; detail?: string | undefined } = {}
  ): void {
    this.held.push({
      id: `n${this.next++}`,
      level,
      message,
      ...(options.path ? { path: options.path, reveal: true } : {}),
      ...(options.detail ? { detail: options.detail } : {})
    })
    this.changed()
  }

  status(): ProfileStatus {
    return {
      readOnly: this.readOnly !== false,
      ...(this.readOnly ? { readOnlyReason: this.readOnly } : {}),
      notices: this.held.map(({ path: _path, ...notice }) => notice)
    }
  }

  dismiss(id: string): void {
    const i = this.held.findIndex((n) => n.id === id)
    if (i < 0) return
    this.held.splice(i, 1)
    this.changed()
  }

  pathOf(id: string): string | undefined {
    return this.held.find((n) => n.id === id)?.path
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private changed(): void {
    for (const listener of [...this.listeners]) listener()
  }
}

/** Raison d'un échec d'écriture en clair (sans code), pour un avis ; le détail va à part. */
export function plainError(error: unknown): Message {
  const code = (error as { code?: unknown } | null)?.code
  if (code === 'ENOSPC' || code === 'EDQUOT') return { key: 'profile.error.diskFull' }
  if (code === 'EACCES' || code === 'EPERM' || code === 'EROFS') {
    return { key: 'profile.error.noPermission' }
  }
  return { key: 'profile.error.other' }
}
