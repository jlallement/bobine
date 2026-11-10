import { useEffect, useRef } from 'react'
import type { PromptAttachment } from '@shared/attachments'
import { INSERT_TEXT_EVENT } from './components/panel/TerminalTab'
import type { ComposerInbox } from './useFileDrop'

export interface ComposerArrivals {
  /** Fichiers déposés n'importe où sur la conversation (`useFileDrop`). */
  files: (files: File[]) => void
  /** Texte d'une suggestion de départ : mis dans la zone de saisie, sans envoyer. */
  text: (text: string) => void
  /** Message de la fenêtre rapide que l'agent n'a pas pu recevoir (fiche 062). */
  restore: (text: string, attachments: PromptAttachment[]) => void
  /** Extrait du terminal joint au message (fiche 034). */
  insert: (text: string) => void
}

/**
 * Ce qui arrive dans la zone de saisie depuis ailleurs (sorti de `Composer`, fiche 089) : boîte de la
 * conversation (`ComposerInbox`) et extraits du terminal. Un seul abonnement ; les fonctions les plus
 * récentes sont appelées.
 */
export function useComposerInbox(
  inbox: ComposerInbox | undefined,
  conversationId: string | undefined,
  arrivals: ComposerArrivals
): void {
  const latest = useRef(arrivals)
  useEffect(() => {
    latest.current = arrivals
  })
  useEffect(
    () =>
      inbox?.subscribe({
        files: (files) => latest.current.files(files),
        text: (value) => latest.current.text(value),
        ...(conversationId ? { conversationId } : {}),
        restore: (value, items) => latest.current.restore(value, items)
      }),
    [inbox, conversationId]
  )
  useEffect(() => {
    const onInsert = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail
      if (typeof detail === 'string') latest.current.insert(detail)
    }
    window.addEventListener(INSERT_TEXT_EVENT, onInsert)
    return () => window.removeEventListener(INSERT_TEXT_EVENT, onInsert)
  }, [])
}
