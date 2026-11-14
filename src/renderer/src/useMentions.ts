import { useEffect, useState } from 'react'
import { mentionAt, type WorkspaceFile } from '@shared/attachments'
import { matchContextMentions } from '@shared/context-mentions'
import { matchRoles } from '@shared/role-mentions'
import type { RoleView } from '@shared/roles'
import type { MentionEntry } from './components/composer/FileMenu'
import { roleMenuEntries } from './components/roles/RoleMenu'

/** Délai avant de chercher les fichiers du dossier pendant la frappe. */
const SEARCH_DELAY_MS = 120

/**
 * Mentions `@` de la zone de saisie (fiches 005, 057 ; sorti de `Composer`, fiche 089) : au curseur,
 * les rôles (fiche 223, en tête), les mentions de contexte (`@git-changes`, `@terminal`) puis les
 * fichiers du dossier, cherchés pendant la frappe. Pas de menu `@` pendant celui des commandes « / », ni quand la saisie est
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
  /** Rôles actifs (fiche 223) ; `canCreate` : « + Nouveau rôle » proposé. */
  roles?: { list: readonly RoleView[]; canCreate: boolean }
}) {
  const { onSearchFiles } = options
  const [files, setFiles] = useState<WorkspaceFile[]>([])
  const [active, setActive] = useState(0)
  const [dismissed, setDismissed] = useState(false)
  // « Tous les rôles (8) » : la liste entière, pour la mention où il a été choisi.
  const [allRolesAt, setAllRolesAt] = useState<number>()
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
  const roles = options.roles
  const roleEntries =
    mention && roles
      ? roleMenuEntries(matchRoles(roles.list, mention.query), mention.query, {
          all: allRolesAt === mention.start,
          canCreate: roles.canCreate
        })
      : []
  const entries: MentionEntry[] = [
    ...roleEntries,
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
    /** « Tous les rôles » : la liste entière, la même entrée reste surlignée. */
    showAllRoles: () => setAllRolesAt(mention?.start),
    /** Le texte change : le menu peut se rouvrir. */
    textChanged: () => setDismissed(false)
  }
}
