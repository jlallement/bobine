import { useCallback, useEffect, useState } from 'react'
import type { ConversationSummary, ProfileSummary } from '@shared/agent'
import type { RoleView } from '@shared/roles'
import i18next from 'i18next'
import type { ComposerRoles } from './components/roles/useRoleCompose'
import { ipcErrorText } from './ipc-errors'

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
  const refresh = useCallback(() => {
    if (!id || !eligible) return
    window.api.roles
      .list(id)
      .then((listing) => setRead({ id, list: listing.roles.filter((role) => role.enabled) }))
      .catch(() => setRead({ id, list: NO_ROLES }))
  }, [id, eligible])
  useEffect(refresh, [refresh])
  const list = eligible && read && read.id === id ? read.list : NO_ROLES
  const send = useCallback(
    async (names: string[], text: string) => {
      if (!id) return false
      try {
        const result = await window.api.roles.startChildren(id, { roles: names, text })
        for (const failed of result.failed) {
          const label = list.find((r) => r.name === failed.role)?.label ?? failed.role
          warn(i18next.t('roleWork.destination.failed', { label, error: failed.error }))
        }
        return result.started.length > 0
      } catch (error) {
        warn(ipcErrorText(error))
        return false
      }
    },
    [id, list, warn]
  )
  return { list, refresh, send, profiles, ...extra }
}
