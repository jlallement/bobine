import type { PromptAttachment } from '@shared/attachments'
import { useRef, useState, type DragEvent } from 'react'

/** Glisser d'une ligne de l'onglet Fichiers (fiche 271) : son chemin absolu. */
export const FILE_DRAG_TYPE = 'application/x-bobine-file'

/**
 * Ce qu'on envoie à la zone de saisie de l'extérieur : fichiers déposés sur la conversation, texte
 * d'une suggestion de départ. La zone de saisie s'y abonne.
 */
/** Ce que la zone de saisie affichée sait recevoir. */
export interface ComposerHandler {
  files: (files: File[]) => void
  /** Fichiers du dossier joints par leur chemin (« Mentionner », fiche 271). */
  paths?: (paths: string[]) => void
  /** Rend le clavier à la zone de saisie (Échap dans le filtre des fichiers, fiche 271). */
  focus?: () => void
  text: (text: string) => void
  /** Conversation de la zone de saisie, et message à y remettre (fenêtre rapide, fiche 062). */
  conversationId?: string
  restore?: (text: string, attachments: PromptAttachment[]) => void
}

/** Message à remettre dans la zone de saisie d'une conversation, peut-être pas encore affichée. */
export interface ComposerPrefill {
  id: string
  text: string
  attachments: PromptAttachment[]
}

export class ComposerInbox {
  private handler: ComposerHandler | null = null
  private pending: ComposerPrefill | null = null

  /** La zone de saisie reçoit fichiers et texte ; rend de quoi se désabonner. */
  subscribe(handler: ComposerHandler): () => void {
    this.handler = handler
    this.deliverPrefill()
    return () => {
      if (this.handler === handler) this.handler = null
    }
  }

  /** Remis dès que la zone de saisie de cette conversation est là. */
  prefill(message: ComposerPrefill): void {
    this.pending = message
    this.deliverPrefill()
  }

  private deliverPrefill(): void {
    const { handler, pending } = this
    if (!pending || !handler?.restore || handler.conversationId !== pending.id) return
    this.pending = null
    handler.restore(pending.text, pending.attachments)
  }

  deliver(files: File[]): void {
    this.handler?.files(files)
  }

  /** Joint des fichiers par leur chemin absolu (onglet Fichiers, fiche 271, Q51). */
  mention(paths: string[]): void {
    this.handler?.paths?.(paths)
  }

  /** Rend le clavier à la zone de saisie. */
  focus(): void {
    this.handler?.focus?.()
  }

  /** Remplace le texte de la zone de saisie (sans envoyer). */
  fill(text: string): void {
    this.handler?.text(text)
  }
}

/**
 * Glisser-déposer de fichiers sur toute une zone (la conversation, pas seulement la zone de
 * saisie). Les fichiers vont à la zone de saisie par `inbox`. Un compteur d'entrées / sorties
 * évite le clignotement quand le pointeur passe d'un élément enfant à l'autre.
 */
export function useFileDrop(inbox: ComposerInbox) {
  const [dragging, setDragging] = useState(false)
  const depth = useRef(0)
  // Une ligne de l'onglet Fichiers (fiche 271, Q51) se dépose comme un fichier : une mention.
  const hasFiles = (event: DragEvent) =>
    event.dataTransfer.types.includes('Files') || event.dataTransfer.types.includes(FILE_DRAG_TYPE)
  const handlers = {
    onDragEnter: (event: DragEvent) => {
      if (!hasFiles(event)) return
      event.preventDefault()
      depth.current += 1
      setDragging(true)
    },
    onDragOver: (event: DragEvent) => {
      if (!hasFiles(event)) return
      // Sans cela, le navigateur refuse le dépôt.
      event.preventDefault()
      event.dataTransfer.dropEffect = 'copy'
    },
    onDragLeave: (event: DragEvent) => {
      if (!hasFiles(event)) return
      depth.current = Math.max(0, depth.current - 1)
      if (depth.current === 0) setDragging(false)
    },
    onDrop: (event: DragEvent) => {
      if (!hasFiles(event)) return
      event.preventDefault()
      event.stopPropagation()
      depth.current = 0
      setDragging(false)
      const path = event.dataTransfer.getData(FILE_DRAG_TYPE)
      if (path) {
        inbox.mention([path])
        return
      }
      const files = [...event.dataTransfer.files]
      if (files.length) inbox.deliver(files)
    }
  }
  return { dragging, handlers }
}
