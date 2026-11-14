import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { ProfileSummary } from '@shared/agent'
import { matchContextMentions } from '@shared/context-mentions'
import { roleRecipients } from '@shared/role-mentions'
import type { RoleView } from '@shared/roles'
import i18next from 'i18next'
import type { RoleMenuOptions } from '../composer/FileMenu'
import type { RoleMenuEntry } from './RoleMenu'
import { RoleDestination, RoleTokens } from './RoleCompose'
import { useRoleStyle } from './RoleAvatar'
import { readOnlyShown, roleProfile } from './role-view'
import { onRoleInvoked } from '../../roles/roles-store'

/**
 * Ce que la saisie sait des rôles (fiche 223, phase 3B), fourni par l'app : rôles actifs de la
 * conversation, envoi aux rôles, et les entrées croisées de la phase 3A (« + Nouveau rôle »,
 * « Gérer ») — facultatives : absentes, elles ne s'affichent pas.
 */
export interface ComposerRoles {
  /** Rôles actifs ; vide pour une conversation qui ne lance pas de filles (fille, relecteur). */
  list: readonly RoleView[]
  /**
   * La conversation peut confier un travail à un rôle (ni fille ni relecteur) : un rôle invoqué
   * d'ailleurs (section Équipe, Réglages › Rôles, assistant) y devient un jeton, sinon c'est dit.
   */
  invokable?: boolean
  /** Relit les rôles (fichiers changés) : à l'ouverture du menu `@`. */
  refresh: () => void
  /** Lance une fille par rôle ; les rôles lancés et ceux refusés (raison déjà dite). */
  send: (names: string[], text: string) => Promise<{ started: string[]; failed: string[] }>
  /** Relit les rôles et les rend (un `@nom` inconnu à l'envoi : rôle tout juste créé ?). */
  reload?: () => Promise<readonly RoleView[]>
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
  /** Rend le focus à la saisie (rôle invoqué d'ailleurs). */
  focus?: () => void
}) {
  const { roles, draftKey, menuOpen } = options
  const [tokens, setTokens] = useState<string[]>(() => (draftKey && kept.get(draftKey)) || [])
  const [hidden, setHidden] = useState(inviteHidden)
  // Envoi aux rôles en cours (plusieurs secondes : `git worktree add`) : un second envoi attend.
  const [sending, setSending] = useState(false)
  const sendingNow = useRef(false)
  const setBusy = (busy: boolean) => {
    sendingNow.current = busy
    setSending(busy)
  }
  // Jetons et texte à jour, lus à la fin d'un envoi (la saisie a pu changer entre-temps).
  const tokensNow = useRef(tokens)
  const textNow = useRef('')
  const list = roles?.list ?? []
  const update = (next: string[]) => {
    tokensNow.current = next
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
  /**
   * Une fille par rôle. Toutes parties : jetons retirés, saisie vidée si elle n'a pas changé.
   * Certaines refusées : leurs jetons restent (les `@nom` tapés deviennent des jetons) avec la
   * demande, pour réessayer ; aucune partie : rien ne bouge.
   */
  const dispatch = (
    to: { names: string[]; text: string },
    at: {
      text: string
      attachmentCount: number
      changeText: (value: string, caret?: number) => void
    }
  ) => {
    if (!roles || !to.text.trim()) return
    if (at.attachmentCount > 0) {
      options.onWarn(i18next.t('roleWork.destination.attachments'))
      return
    }
    setBusy(true)
    void roles
      .send(to.names, to.text)
      .then(({ started, failed }) => {
        if (started.length === 0) return
        const others = tokensNow.current.filter((t) => !to.names.includes(t))
        update([...others, ...to.names.filter((n) => failed.includes(n))])
        if (textNow.current !== at.text) return
        const rest = failed.length ? to.text : ''
        at.changeText(rest, rest.length)
      })
      .finally(() => setBusy(false))
  }
  useRoleInvoked(roles, (name) => {
    if (!roles?.invokable) return options.onWarn(i18next.t('team.notHere'))
    add(name)
    // Un rôle tout juste créé n'est pas encore dans la liste : son jeton paraît à la relecture.
    roles.refresh()
    // Focus à la saisie tout de suite (section Équipe), et encore après la fermeture d'un dialogue
    // (assistant, Réglages) : Radix y rend le focus à son déclencheur dans une minuterie à 0 ms
    // posée au démontage, après ce geste ; deux tours de minuterie passent derrière elle.
    // (Pas `requestAnimationFrame` : il ne tourne pas dans une fenêtre cachée.)
    const focus = options.focus
    focus?.()
    setTimeout(() => setTimeout(() => focus?.()))
  })
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
     * Envoi : des rôles cités, une fille chacun (rien à la conversation). `false` : aucun rôle,
     * envoi ordinaire ; un `@nom` inconnu fait d'abord relire la liste, et `orElse` fait l'envoi
     * ordinaire s'il ne nomme toujours aucun rôle.
     */
    submit: (
      text: string,
      attachmentCount: number,
      changeText: (value: string, caret?: number) => void,
      orElse: () => void
    ): boolean => {
      if (!roles) return false
      if (sendingNow.current) return true
      const at = { text, attachmentCount, changeText }
      const to = roleRecipients(tokensNow.current, text, list)
      if (to.names.length) {
        dispatch(to, at)
        return true
      }
      if (!roles.reload || !unknownMention(text, list)) return false
      setBusy(true)
      void roles.reload().then(
        (fresh) => {
          setBusy(false)
          const again = roleRecipients(tokensNow.current, text, fresh)
          if (again.names.length) dispatch(again, at)
          else orElse()
        },
        () => {
          setBusy(false)
          orElse()
        }
      )
      return true
    },
    /** Retour arrière en tête de la saisie : le dernier jeton part ; `true` s'il y en avait un. */
    removeLast: () => {
      const last = shownTokens.at(-1)
      if (!last) return false
      update(tokens.filter((t) => t !== last.name))
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
    view: (text: string) => {
      textNow.current = text
      const targets = chosen(text)
      // Rien à demander une fois les `@nom` retirés : l'envoi attend, la ligne le dit.
      const empty = targets.length > 0 && !roleRecipients(tokens, text, list).text.trim()
      return {
        tokens: shownTokens,
        targets,
        empty,
        sending,
        /** L'envoi aux rôles est possible (bouton). */
        ready: targets.length > 0 && !empty && !sending,
        remove: (name: string) => update(tokens.filter((t) => t !== name))
      }
    }
  }
}

/**
 * Un `@nom` qui pourrait être un rôle sans être dans la liste (rôle créé depuis la dernière
 * lecture) : forme d'un identifiant de rôle, ni fichier (`.`, `/`), ni `@git-changes` /
 * `@terminal`.
 */
function unknownMention(text: string, list: readonly Pick<RoleView, 'name'>[]): boolean {
  const known = new Set(list.map((r) => r.name))
  return [...text.matchAll(/(?:^|[\s(,;:])@([a-z0-9][a-z0-9-]*)(?![\w./-])/gi)].some((m) => {
    const name = (m[1] ?? '').toLowerCase()
    return !known.has(name) && !matchContextMentions(name).some((c) => c.name === name)
  })
}

/** Rôle invoqué d'ailleurs (`invokeRole`) : reçu par la saisie qui a des rôles, la plus récente. */
function useRoleInvoked(roles: ComposerRoles | undefined, receive: (name: string) => void): void {
  const latest = useRef(receive)
  useEffect(() => {
    latest.current = receive
  })
  const listening = !!roles
  useEffect(
    () => (listening ? onRoleInvoked((name) => latest.current(name)) : undefined),
    [listening]
  )
}

/** Saisie aux couleurs du rôle (un seul) ou neutre (plusieurs) : le liseré de la maquette 02-3. */
export function useRoleFrame(targets: readonly RoleView[]): {
  className: string
  style: CSSProperties | undefined
} {
  const single = targets.length === 1 ? targets[0] : undefined
  const style = useRoleStyle(single?.color ?? 'graphite')
  if (targets.length === 0) return { className: '', style: undefined }
  return { className: single ? ' to-role' : ' to-roles', style: single ? style : undefined }
}

/** La ligne « Partira à… » sous la saisie, pour les rôles visés. */
export function RoleDestinationFor({
  targets,
  empty,
  sending,
  roles,
  profileId,
  agentLabel,
  fresh
}: {
  targets: readonly RoleView[]
  empty: boolean
  sending: boolean
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
      empty={empty}
      sending={sending}
    />
  )
}

export { RoleTokens }
