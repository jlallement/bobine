import { useMemo, useRef, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { closeFile, loadFilesState, saveFilesState } from '../../files-state'
import { fileIcon } from './file-icons'

/**
 * Titre de l'onglet Fichiers dans la rangée du panneau (fiche 271, Q9) : le nom et l'icône du
 * fichier ouvert, lus dans l'état retenu de la conversation (même quand l'onglet n'est pas affiché).
 * Son ✕ ramène d'abord à l'arbre, puis ferme l'onglet (point 3).
 */
export function useFilesTabTitle(conversationId: string | null) {
  // Change à chaque ouverture ou fermeture d'un fichier : l'état retenu est relu.
  const [seq, setSeq] = useState(0)
  const close = useRef<(() => boolean) | null>(null)
  const path = useMemo(
    () => (conversationId ? loadFilesState(conversationId).open?.path : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `seq` dit que l'état a changé
    [conversationId, seq]
  )
  const name = path?.split('/').at(-1)
  return {
    name,
    icon: (name ? fileIcon(name) : undefined) as LucideIcon | undefined,
    /** L'onglet a ouvert ou fermé un fichier. */
    changed: () => setSeq((n) => n + 1),
    /** Ce que l'onglet monté fait de son ✕ (`true` : un fichier a été fermé). */
    close,
    /** ✕ de l'onglet : un fichier ouvert revient d'abord à l'arbre. */
    backToTree: (): boolean => {
      if (close.current) return close.current()
      if (!conversationId) return false
      const state = loadFilesState(conversationId)
      if (!state.open) return false
      saveFilesState(conversationId, closeFile(state))
      setSeq((n) => n + 1)
      return true
    }
  }
}
