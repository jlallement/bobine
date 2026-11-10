/**
 * Remarques en cours sur les pages du navigateur (fiches 132 et 146), par conversation, avec les
 * captures propres prises à chaque remarque : gardées en quittant le mode Annoter, l'onglet ou la
 * conversation, jusqu'à l'envoi ou la corbeille. En mémoire seulement : les captures sont trop
 * lourdes pour le stockage local, et elles ne disent plus rien de la page après un redémarrage.
 */
import { useSyncExternalStore } from 'react'
import type { PageFreeze, PageNote, PagePoint, PageShot } from '@shared/page-notes'

export interface PageNotesSession {
  notes: PageNote[]
  /** Captures dans l'ordre des clics. */
  shots: PageShot[]
}

const sessions = new Map<string, PageNotesSession>()
/** Captures encore attendues (`browser:noteShot`), par remarque. */
const pending = new Map<string, Promise<void>>()
/** Ordre des clics : une capture arrivée en retard garde sa place. */
const clicks = new Map<string, number>()
let nextClick = 1
const listeners = new Set<() => void>()

const changed = () => listeners.forEach((listener) => listener())

function update(conversationId: string, change: (session: PageNotesSession) => PageNotesSession) {
  const session = sessions.get(conversationId)
  if (!session) return
  sessions.set(conversationId, change(session))
  changed()
}

export const pageNotes = {
  get: (conversationId: string): PageNotesSession | undefined => sessions.get(conversationId),
  add(conversationId: string, note: PageNote): void {
    const session = sessions.get(conversationId) ?? { notes: [], shots: [] }
    sessions.set(conversationId, { ...session, notes: [...session.notes, note] })
    changed()
  },
  edit(conversationId: string, id: string, comment: string): void {
    update(conversationId, (s) => ({
      ...s,
      notes: s.notes.map((n) => (n.id === id ? { ...n, comment } : n))
    }))
  },
  remove(conversationId: string, id: string): void {
    update(conversationId, (s) => ({ ...s, notes: s.notes.filter((n) => n.id !== id) }))
  },
  /** Corbeille ou envoi : plus de remarques ni de captures. */
  clear(conversationId: string): void {
    if (sessions.delete(conversationId)) changed()
  },
  /**
   * Capture propre d'une remarque, avec les épingles visibles au clic ; gardée à sa place dans
   * l'ordre des clics. Une capture manquée laisse la remarque sans image.
   */
  shot(
    conversationId: string,
    id: string,
    freeze: Promise<PageFreeze | null>,
    pins: Record<string, PagePoint>
  ): Promise<void> {
    clicks.set(id, nextClick++)
    const done = freeze
      .catch(() => null)
      .then((found) => {
        if (!found) return
        update(conversationId, (s) => ({
          ...s,
          shots: [...s.shots, { id, freeze: found, pins }].sort(
            (a, b) => (clicks.get(a.id) ?? 0) - (clicks.get(b.id) ?? 0)
          )
        }))
      })
      .finally(() => pending.delete(id))
    pending.set(id, done)
    return done
  },
  /** Remarques et captures, une fois les captures arrivées (ou manquées). */
  async settled(conversationId: string): Promise<PageNotesSession | undefined> {
    const ids = new Set(sessions.get(conversationId)?.notes.map((n) => n.id))
    await Promise.all([...pending].filter(([id]) => ids.has(id)).map(([, done]) => done))
    return sessions.get(conversationId)
  }
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Remarques et captures en cours d'une conversation. */
export function usePageNotes(conversationId: string): PageNotesSession | undefined {
  return useSyncExternalStore(subscribe, () => sessions.get(conversationId))
}
