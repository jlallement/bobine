import { useState } from 'react'
import type { Conversations } from './useConversations'

/** Pages de l'app dans la zone principale (ADR-0031) : « Mon activité », « Tâches planifiées ». */
export type AppPage = 'activity' | 'scheduled'

/**
 * Page « Mon activité » (fiche 144), à la place du fil dans la fenêtre principale : ouverte par sa
 * ligne de la barre latérale, ⇧⌘U ou le lien de la puce ; refermée dès qu'une conversation
 * s'ouvre. `conversations` enveloppe donc `select`, `create` et `resumeSession` (la barre latérale,
 * la recherche, les menus, la même conversation choisie à nouveau), et une autre conversation qui
 * devient active (notification, fenêtre rapide) referme aussi la page.
 */
export function useActivityPage(conversations: Conversations) {
  const [page, setPage] = useState<AppPage | null>(null)
  const [active, setActive] = useState(conversations.activeId)
  if (active !== conversations.activeId) {
    setActive(conversations.activeId)
    if (page) setPage(null)
  }
  const close = () => setPage(null)
  return {
    /** Une page de l'app est ouverte (et laquelle : `page`). */
    open: page !== null,
    page,
    show: () => setPage('activity'),
    /** « Tâches planifiées » (fiche 178), même comportement que « Mon activité ». */
    showScheduled: () => setPage('scheduled'),
    close,
    conversations: {
      ...conversations,
      select: (...args: Parameters<Conversations['select']>) => {
        close()
        conversations.select(...args)
      },
      create: (...args: Parameters<Conversations['create']>) => {
        close()
        conversations.create(...args)
      },
      resumeSession: (...args: Parameters<Conversations['resumeSession']>) => {
        close()
        return conversations.resumeSession(...args)
      }
    } satisfies Conversations
  }
}
