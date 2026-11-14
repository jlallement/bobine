import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import type { ProfileSummary } from '@shared/agent'
import { roleRecipients } from '@shared/role-mentions'
import type { RoleView } from '@shared/roles'
import i18next from 'i18next'
import type { RoleMenuOptions } from '../composer/FileMenu'
import type { RoleMenuEntry } from './RoleMenu'
import { RoleDestination, RoleTokens } from './RoleCompose'
import { useRoleTint } from './RoleAvatar'
import { readOnlyShown, roleProfile } from './role-view'

/**
 * Ce que la saisie sait des rôles (fiche 223, phase 3B), fourni par l'app : rôles actifs de la
 * conversation, envoi aux rôles, et les entrées croisées de la phase 3A (« + Nouveau rôle »,
 * « Gérer ») — facultatives : absentes, elles ne s'affichent pas.
 */
export interface ComposerRoles {
  /** Rôles actifs ; vide pour une conversation qui ne lance pas de filles (fille, relecteur). */
  list: readonly RoleView[]
  /** Relit les rôles (fichiers changés) : à l'ouverture du menu `@`. */
  refresh: () => void
  /** Lance une fille par rôle ; `true` si au moins une est partie (sinon le texte reste). */
  send: (names: string[], text: string) => Promise<boolean>
  profiles: readonly ProfileSummary[]
  /** Assistant de création, prérempli du nom tapé (phase 3A). */
  onCreate?: (name?: string) => void
  /** Réglages › Rôles (phase 3A). */
  onManage?: () => void
}

/** Jetons gardés par conversation (brouillon), le temps de la session de la fenêtre. */
const kept = new Map<string, string[]>()
const INVITE_KEY = 'bobine.rolesInviteHidden'

function inviteHidden(): boolean {
  try {
    return localStorage.getItem(INVITE_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Jetons de rôle de la saisie : posés par le menu `@`, retirés par × ou par retour arrière en tête
 * de la saisie ; à l'envoi, avec les `@nom` tapés, ils disent à qui part le message.
 */
export function useRoleCompose(options: {
  roles: ComposerRoles | undefined
  draftKey: string | undefined
  menuOpen: boolean
  onWarn: (message: string) => void
}) {
  const { roles, draftKey, menuOpen } = options
  const [tokens, setTokens] = useState<string[]>(() => (draftKey && kept.get(draftKey)) || [])
  const [hidden, setHidden] = useState(inviteHidden)
  const list = roles?.list ?? []
  const update = (next: string[]) => {
    setTokens(next)
    if (draftKey) kept.set(draftKey, next)
  }
  // Le menu `@` s'ouvre : les rôles sont relus (un fichier a pu changer).
  const refresh = roles?.refresh
  useEffect(() => {
    if (menuOpen) refresh?.()
  }, [menuOpen, refresh])

  const chosen = (text: string) => {
    const { names } = roleRecipients(tokens, text, list)
    return names.flatMap((name) => list.find((r) => r.name === name) ?? [])
  }
  const shownTokens = tokens.flatMap((name) => list.find((r) => r.name === name) ?? [])
  const add = (name: string) => update(tokens.includes(name) ? tokens : [...tokens, name])
  return {
    tokens,
    add,
    /**
     * Entrée de rôle choisie dans le menu `@` : le rôle devient un jeton (`@requête` sort du
     * texte), « Tous les rôles » déplie la liste, « + Nouveau rôle » ouvre l'assistant.
     */
    pick: (
      entry: RoleMenuEntry,
      at: {
        mention: { query: string; start: number }
        text: string
        changeText: (value: string, caret?: number) => void
        mentions: { showAllRoles: () => void; dismiss: () => void }
      }
    ): void => {
      if (entry.kind === 'role-more') at.mentions.showAllRoles()
      else if (entry.kind === 'role-new') {
        at.mentions.dismiss()
        roles?.onCreate?.(entry.query)
      } else {
        const { mention, text } = at
        const rest = text.slice(mention.start + 1 + mention.query.length).replace(/^ /, '')
        at.changeText(text.slice(0, mention.start) + rest, mention.start)
        add(entry.role.name)
      }
    },
    /**
     * Envoi : des rôles cités, une fille chacun (rien à la conversation) ; le texte et les jetons
     * partent quand au moins une fille est lancée. `false` : aucun rôle, envoi ordinaire.
     */
    submit: (
      text: string,
      attachmentCount: number,
      changeText: (value: string, caret?: number) => void
    ): boolean => {
      const to = roles && roleRecipients(tokens, text, list)
      if (!roles || !to?.names.length) return false
      if (!to.text.trim()) return true
      if (attachmentCount > 0) {
        options.onWarn(i18next.t('roleWork.destination.attachments'))
        return true
      }
      void roles.send(to.names, to.text).then((sent) => {
        if (!sent) return
        update([])
        changeText('', 0)
      })
      return true
    },
    /** Retour arrière en tête de la saisie : le dernier jeton part ; `true` s'il y en avait un. */
    removeLast: () => {
      if (shownTokens.length === 0) return false
      update(tokens.slice(0, -1))
      return true
    },
    menu: (query: string | undefined): RoleMenuOptions | undefined =>
      roles
        ? {
            ...(list.length === 0 && !hidden
              ? {
                  invite: {
                    onHide: () => {
                      setHidden(true)
                      try {
                        localStorage.setItem(INVITE_KEY, '1')
                      } catch {
                        // Stockage indisponible : l'invitation reviendra au prochain lancement.
                      }
                    }
                  }
                }
              : {}),
            ...(roles.onCreate ? { onCreate: () => roles.onCreate?.(query || undefined) } : {}),
            ...(roles.onManage ? { onManage: roles.onManage } : {})
          }
        : undefined,
    /** Jetons et ligne « Partira à… » pour ce texte. */
    view: (text: string) => ({
      tokens: shownTokens,
      targets: chosen(text),
      remove: (name: string) => update(tokens.filter((t) => t !== name))
    })
  }
}

/** Saisie aux couleurs du rôle (un seul) ou neutre (plusieurs) : le liseré de la maquette 02-3. */
export function useRoleFrame(targets: readonly RoleView[]): {
  className: string
  style: CSSProperties | undefined
} {
  const single = targets.length === 1 ? targets[0] : undefined
  const style = useRoleTint(single?.color ?? 'graphite')
  if (targets.length === 0) return { className: '', style: undefined }
  return { className: single ? ' to-role' : ' to-roles', style: single ? style : undefined }
}

/** La ligne « Partira à… » sous la saisie, pour les rôles visés. */
export function RoleDestinationFor({
  targets,
  roles,
  profileId,
  agentLabel,
  fresh
}: {
  targets: readonly RoleView[]
  roles: ComposerRoles | undefined
  profileId: string | undefined
  agentLabel: string
  fresh: boolean
}): ReactNode {
  const single = targets.length === 1 ? targets[0] : undefined
  const profile = single ? roleProfile(single, roles?.profiles ?? [], profileId) : undefined
  return (
    <RoleDestination
      roles={targets}
      agentLabel={profile?.label ?? agentLabel}
      readOnly={single ? readOnlyShown(single.readOnly, profile) : undefined}
      draft={fresh}
    />
  )
}

export { RoleTokens }
