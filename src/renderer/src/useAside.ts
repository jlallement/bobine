import { useCallback, useEffect, useState } from 'react'
import type { AsideView } from '@shared/aside'
import { ipcErrorText } from './ipc-errors'

/** Choix « Joindre l'échange récent », retenu d'un aparté à l'autre (confort de la fenêtre). */
const CONTEXT_KEY = 'bobine.aside.withContext'

function loadWithContext(): boolean {
  try {
    return localStorage.getItem(CONTEXT_KEY) === 'true'
  } catch {
    return false
  }
}

function saveWithContext(value: boolean): void {
  try {
    localStorage.setItem(CONTEXT_KEY, String(value))
  } catch {
    // Stockage indisponible : l'aparté repartira sans le fil, le choix le moins coûteux.
  }
}

export const focusComposer = () =>
  document.querySelector<HTMLTextAreaElement>('[data-testid=composer-input]')?.focus()

/**
 * Aparté de la conversation affichée (fiche 180) : la carte, ouverte vide (⇧⌘A, `/btw` seul) ou
 * sur une question ; l'état vient du main (`aside:changed`), un aparté par conversation.
 */
export function useAside(conversationId: string | null, warn: (message: string) => void) {
  const [views, setViews] = useState<Record<string, AsideView>>({})
  // Carte ouverte avant toute question (rien encore chez le main).
  const [opened, setOpened] = useState<string | null>(null)
  const [focusTick, setFocusTick] = useState(0)
  const [withContext, setWithContextState] = useState(loadWithContext)

  useEffect(
    () =>
      window.api.aside.onChanged((view) =>
        setViews((all) => {
          const { [view.conversationId]: _previous, ...rest } = all
          return view.status === 'closed' ? rest : { ...rest, [view.conversationId]: view }
        })
      ),
    []
  )
  // Aparté laissé ouvert dans une autre conversation : retrouvé en y revenant.
  useEffect(() => {
    if (!conversationId) return
    window.api.aside
      .view(conversationId)
      .then((view) => view && setViews((all) => ({ ...all, [view.conversationId]: view })))
      .catch(() => {})
  }, [conversationId])

  const view = conversationId ? views[conversationId] : undefined
  const visible = !!conversationId && (!!view || opened === conversationId)

  const ask = useCallback(
    (question: string) => {
      if (!conversationId || !question.trim()) return
      setOpened(conversationId)
      window.api.aside
        .ask(conversationId, { question, withContext })
        .catch((error: unknown) => warn(ipcErrorText(error)))
    },
    [conversationId, withContext, warn]
  )

  /** `/btw [question]`, ⇧⌘A : carte ouverte (et la question posée s'il y en a une). */
  const start = useCallback(
    (question = '') => {
      if (!conversationId) return
      setOpened(conversationId)
      setFocusTick((n) => n + 1)
      if (question.trim()) ask(question)
    },
    [conversationId, ask]
  )

  const close = useCallback(() => {
    if (!conversationId) return
    setOpened(null)
    setViews((all) => {
      const { [conversationId]: _closed, ...rest } = all
      return rest
    })
    window.api.aside.close(conversationId).catch((error: unknown) => warn(ipcErrorText(error)))
    focusComposer()
  }, [conversationId, warn])

  const setWithContext = (value: boolean) => {
    setWithContextState(value)
    saveWithContext(value)
  }

  return {
    conversationId,
    view,
    visible,
    focusTick,
    withContext,
    setWithContext,
    start,
    ask,
    close
  }
}

export type AsideState = ReturnType<typeof useAside>
