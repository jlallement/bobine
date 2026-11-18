import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { ProfileSummary } from '@shared/agent'
import { matchContextMentions } from '@shared/context-mentions'
import { roleRecipients, splitRoleMentions } from '@shared/role-mentions'
import type { RoleView } from '@shared/roles'
import i18next from 'i18next'
import type { RoleMenuOptions } from '../composer/FileMenu'
import type { RoleMenuEntry } from './RoleMenu'
import { RoleDestination, RoleTokens } from './RoleCompose'
import { useRoleStyle } from './RoleAvatar'
import { readOnlyShown, roleProfile } from './role-view'
import { onRoleInvoked } from '../../roles/roles-store'
import type { UncommittedChoice } from '@shared/launch-folder'
import { useFolderDirty } from '../thread/LaunchDirty'

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
  /**
   * Conversation qui ne confie pas de travail à un rôle (fille, relecteur) : les rôles du projet,
   * pour dire qu'un `@rôle` tapé part en texte à son agent (`team.notHere`) — l'envoi n'est pas
   * intercepté.
   */
  elsewhere?: readonly RoleView[]
  /** Relit les rôles (fichiers changés) : à l'ouverture du menu `@`. */
  refresh: () => void
  /**
   * Lance une fille par rôle ; les rôles lancés et ceux refusés (raison déjà dite). `uncommitted` :
   * choix devant un dossier modifié (fiche 240).
   */
  send: (
    names: string[],
    text: string,
    uncommitted?: UncommittedChoice
  ) => Promise<{ started: string[]; failed: string[] }>
  /** La conversation (la mère) : son dossier est lu avant un lancement en worktree (fiche 240). */
  motherId?: string
  /** « Committer d'abord » (fiche 240) : ces fichiers, dans le dépôt de la mère. */
  commitFolder?: (message: string, files: string[]) => Promise<unknown>
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
  /** Message parti aux rôles, tel que tapé, avec ses jetons : historique de la saisie (fiche 227). */
  onSent?: (sent: { text: string; tokens: string[] }) => void
  /** Texte de la saisie : un rôle qui partira en worktree fait lire le dossier (fiche 240). */
  text?: string
}) {
  const { roles, draftKey, menuOpen } = options
  const [tokens, setTokens] = useState<string[]>(() => (draftKey && kept.get(draftKey)) || [])
  const [hidden, setHidden] = useState(inviteHidden)
  // Envoi aux rôles en cours (plusieurs secondes : `git worktree add`) : un second envoi attend.
  const [sending, setSending] = useState(false)
  // Rôles en cours de lancement : la ligne « Partira à… » les montre, saisie déjà vidée.
  const [sendingTo, setSendingTo] = useState<string[]>([])
  const sendingNow = useRef(false)
  const setBusy = (busy: boolean, names: string[] = []) => {
    sendingNow.current = busy
    setSending(busy)
    setSendingTo(busy ? names : [])
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
  // Fiche 240 : un rôle qui partira en worktree (pas en lecture seule) fait lire le dossier de la
  // mère ; s'il a du non commité, l'envoi attend le choix de l'utilisateur.
  const toWorktree = (names: readonly string[]) =>
    names.some((name) => list.find((r) => r.name === name)?.readOnly === false)
  const worktreeBound = toWorktree(roleRecipients(tokens, options.text ?? '', list).names)
  const folder = useFolderDirty(roles?.motherId, worktreeBound)
  // Dernier état lu, à jour même entre deux rendus (« Committer puis lancer » envoie tout de suite).
  const dirtyNow = useRef(folder.dirty)
  useEffect(() => {
    dirtyNow.current = folder.dirty
  }, [folder.dirty])
  const [choice, setChoiceState] = useState<UncommittedChoice>()
  const choiceNow = useRef<UncommittedChoice | undefined>(undefined)
  const setChoice = (next: UncommittedChoice | undefined) => {
    choiceNow.current = next
    setChoiceState(next)
  }
  // Envoi retenu faute de choix : le bloc d'avertissement prend le focus.
  const [attention, setAttention] = useState(0)
  // Plus de rôle en worktree : le choix est oublié (un prochain envoi redemande).
  const [boundBefore, setBoundBefore] = useState(worktreeBound)
  if (boundBefore !== worktreeBound) {
    setBoundBefore(worktreeBound)
    if (!worktreeBound) setChoiceState(undefined)
  }
  useEffect(() => {
    choiceNow.current = choice
  }, [choice])
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
    options.onSent?.({ text: at.text, tokens: tokensNow.current })
    setBusy(true, to.names)
    const uncommitted = choiceNow.current
    setChoice(undefined)
    // Saisie vidée tout de suite, remise en cas d'échec : une conversation neuve entre dans
    // l'historique pendant l'envoi et la saisie est remontée (accueil → fil) ; elle ne doit pas
    // reprendre le texte parti (essai réel de la phase 4).
    const before = tokensNow.current
    const others = before.filter((t) => !to.names.includes(t))
    update(others)
    at.changeText('', 0)
    void (uncommitted ? roles.send(to.names, to.text, uncommitted) : roles.send(to.names, to.text))
      .then(({ started, failed }) => {
        if (started.length === 0) {
          update(before)
          if (textNow.current === '') at.changeText(at.text, at.text.length)
          return
        }
        if (!failed.length) return
        update([...others, ...to.names.filter((n) => failed.includes(n))])
        if (textNow.current === '') at.changeText(to.text, to.text.length)
      })
      .finally(() => {
        setBusy(false)
        void folder.read()
      })
  }
  /**
   * Envoi à des rôles, ou retenu (fiche 240) : un rôle partirait en worktree d'un dossier modifié
   * sans choix ; le dossier pas encore lu est lu d'abord.
   */
  const guarded = (to: { names: string[]; text: string }, at: Parameters<typeof dispatch>[1]) => {
    if (!toWorktree(to.names) || choiceNow.current || !roles?.motherId) return dispatch(to, at)
    if (dirtyNow.current === null) return dispatch(to, at)
    if (dirtyNow.current) return setAttention((n) => n + 1)
    setBusy(true)
    void folder.read().then((dirty) => {
      dirtyNow.current = dirty
      setBusy(false)
      if (dirty && !choiceNow.current) setAttention((n) => n + 1)
      else dispatch(to, at)
    })
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
    /** Jetons d'un message repris de l'historique de la saisie (fiche 227). */
    replace: (names: readonly string[]) => update([...names]),
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
        guarded(to, at)
        return true
      }
      if (!roles.reload || !roles.invokable || !unknownMention(text, list)) return false
      setBusy(true)
      void roles.reload().then(
        (fresh) => {
          setBusy(false)
          const again = roleRecipients(tokensNow.current, text, fresh)
          if (again.names.length) guarded(again, at)
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
            ...(list.length === 0 && !hidden && roles.invokable !== false
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
      const typed = chosen(text)
      const targets =
        typed.length || !sending
          ? typed
          : sendingTo.flatMap((name) => list.find((r) => r.name === name) ?? [])
      // Rien à demander une fois les `@nom` retirés : l'envoi attend, la ligne le dit.
      const empty = typed.length > 0 && !roleRecipients(tokens, text, list).text.trim()
      return {
        tokens: shownTokens,
        targets,
        empty,
        /** `@rôle` tapé là où il ne lance pas de fille : il part en texte, c'est dit. */
        notHere:
          !!roles?.elsewhere?.length && splitRoleMentions(text, roles.elsewhere).names.length > 0,
        sending,
        /** L'envoi aux rôles est possible (bouton). */
        ready: typed.length > 0 && !empty && !sending,
        remove: (name: string) => update(tokens.filter((t) => t !== name)),
        /** Non commité à montrer avant l'envoi (fiche 240), tant qu'aucun choix n'est fait. */
        dirty: worktreeBound && folder.dirty && !choice ? folder.dirty : undefined,
        /** Avis en lecture seule choisi : la ligne « Partira à… » le dit. */
        opinion:
          worktreeBound && choice === 'readOnly' ? { sees: folder.dirty?.count ?? 0 } : undefined,
        attention
      }
    },
    /** Choix devant un dossier modifié (fiche 240) ; `undefined` : revenir à l'avertissement. */
    choose: setChoice,
    /** « Committer d'abord » : dans le dépôt de la mère, puis le dossier est relu (propre). */
    commit: async (message: string, files: string[]) => {
      await roles?.commitFolder?.(message, files)
      dirtyNow.current = await folder.read()
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
  opinion
}: {
  targets: readonly RoleView[]
  empty: boolean
  sending: boolean
  roles: ComposerRoles | undefined
  profileId: string | undefined
  agentLabel: string
  /** Avis en lecture seule choisi devant un dossier modifié (fiche 240). */
  opinion?: { sees: number; onWork: () => void } | undefined
}): ReactNode {
  const single = targets.length === 1 ? targets[0] : undefined
  const profile = single ? roleProfile(single, roles?.profiles ?? [], profileId) : undefined
  // Avis : la lecture seule vaut pour chaque rôle, imposée ou demandée selon l'agent de la mère.
  const mother = roles?.profiles.find((p) => p.id === profileId)
  return (
    <RoleDestination
      roles={targets}
      agentLabel={profile?.label ?? agentLabel}
      readOnly={
        opinion
          ? readOnlyShown(true, profile ?? mother)
          : single
            ? readOnlyShown(single.readOnly, profile)
            : undefined
      }
      empty={empty}
      sending={sending}
      {...(opinion ? { opinion } : {})}
    />
  )
}

export { RoleTokens }
