import { useEffect, useState } from 'react'
import { mentionAt, type WorkspaceFile } from '@shared/attachments'
import { matchContextMentions } from '@shared/context-mentions'
import type { MentionEntry } from './components/composer/FileMenu'

/** Délai avant de chercher les fichiers du dossier pendant la frappe. */
const SEARCH_DELAY_MS = 120

/**
 * Mentions `@` de la zone de saisie (fiches 005, 057 ; sorti de `Composer`, fiche 089) : au curseur,
 * les mentions de contexte (`@git-changes`, `@terminal`) puis les fichiers du dossier, cherchés
 * pendant la frappe. Pas de menu `@` pendant celui des commandes « / », ni quand la saisie est
 * bloquée ; Échap le referme jusqu'au texte suivant.
 */
export function useMentions(options: {
  text: string
  caret: number
  /** Menu des commandes « / » ouvert : il passe avant. */
  commandMenuOpen: boolean
  /** Saisie bloquée (action requise, lecture seule). */
  blocked: boolean
  onSearchFiles: (query: string) => Promise<WorkspaceFile[]>
}) {
  const { onSearchFiles } = options
  const [files, setFiles] = useState<WorkspaceFile[]>([])
  const [active, setActive] = useState(0)
  const [dismissed, setDismissed] = useState(false)
  const mention = options.commandMenuOpen ? undefined : mentionAt(options.text, options.caret)
  const open = mention !== undefined && !dismissed && !options.blocked
  const query = mention?.query
  useEffect(() => {
    if (query === undefined) return
    let stale = false
    const timer = setTimeout(() => {
      void onSearchFiles(query).then((found) => {
        if (!stale) {
          setFiles(found)
          setActive(0)
        }
      })
    }, SEARCH_DELAY_MS)
    return () => {
      stale = true
      clearTimeout(timer)
    }
  }, [query, onSearchFiles])
  const entries: MentionEntry[] = [
    ...(mention ? matchContextMentions(mention.query) : []).map((m) => ({
      kind: 'context' as const,
      mention: m
    })),
    ...files.map((f) => ({ kind: 'file' as const, file: f }))
  ]
  return {
    /** Mention en cours de saisie au curseur. */
    mention,
    open,
    entries,
    active,
    setActive,
    dismiss: () => setDismissed(true),
    /** Le texte change : le menu peut se rouvrir. */
    textChanged: () => setDismissed(false)
  }
}
