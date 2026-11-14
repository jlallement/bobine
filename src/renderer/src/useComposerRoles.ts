import { useCallback, useEffect, useRef, useState } from 'react'
import type { ConversationSummary, ProfileSummary } from '@shared/agent'
import type { RoleView } from '@shared/roles'
import i18next from 'i18next'
import type { ComposerRoles } from './components/roles/useRoleCompose'
import { ipcErrorText } from './ipc-errors'
import { useRolesUi } from './roles/roles-store'

const NO_ROLES: RoleView[] = []

/**
 * Rôles de la conversation affichée pour la saisie (fiche 223, phase 3B) : les rôles actifs
 * (fournis, personnels, du projet), relus à l'ouverture du menu `@`, et l'envoi d'une fille par
 * rôle cité. Une fille ou un relecteur ne lance pas de fille : aucun rôle.
 */
export function useComposerRoles(
  conversation: ConversationSummary | null,
  profiles: readonly ProfileSummary[],
  warn: (message: string) => void,
  extra: Pick<ComposerRoles, 'onCreate' | 'onManage'> = {}
): ComposerRoles {
  const id = conversation?.id
  const eligible = !!conversation && !conversation.startedFrom && !conversation.reviewOf
  // Rôles lus, avec la conversation pour laquelle ils l'ont été : rien d'une autre conversation.
  const [read, setRead] = useState<{ id: string; list: RoleView[] }>()
  const load = useCallback((): Promise<RoleView[]> => {
    if (!id || !eligible) return Promise.resolve(NO_ROLES)
    return window.api.roles.list(id).then(
      (listing) => {
        const list = listing.roles.filter((role) => role.enabled)
        setRead({ id, list })
        return list
      },
      () => {
        setRead({ id, list: NO_ROLES })
        return NO_ROLES
      }
    )
  }, [id, eligible])
  const refresh = useCallback(() => void load(), [load])
  // Relue à l'ouverture, après chaque rôle enregistré, supprimé ou (dés)activé dans l'app
  // (`rolesChanged`), et au retour du focus (un fichier changé à la main, un `git pull`).
  const { version } = useRolesUi()
  useEffect(() => {
    void load()
  }, [load, version])
  const latest = useRef(refresh)
  useEffect(() => {
    latest.current = refresh
  })
  useEffect(() => {
    const onFocus = () => latest.current()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])
  const list = eligible && read && read.id === id ? read.list : NO_ROLES
  const send = useCallback(
    async (names: string[], text: string) => {
      if (!id) return { started: [], failed: names }
      try {
        const result = await window.api.roles.startChildren(id, { roles: names, text })
        for (const failed of result.failed) {
          const label = list.find((r) => r.name === failed.role)?.label ?? failed.role
          warn(i18next.t('roleWork.destination.failed', { label, error: failed.error }))
        }
        return {
          started: result.started.map((s) => s.role),
          failed: result.failed.map((f) => f.role)
        }
      } catch (error) {
        warn(ipcErrorText(error))
        return { started: [], failed: names }
      }
    },
    [id, list, warn]
  )
  return { list, invokable: eligible, refresh, reload: load, send, profiles, ...extra }
}
