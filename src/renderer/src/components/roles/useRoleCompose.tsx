import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { ProfileSummary } from '@shared/agent'
import { matchContextMentions } from '@shared/context-mentions'
import { roleRecipients, splitRoleMentions } from '@shared/role-mentions'
import type { RoleBadge, RoleView } from '@shared/roles'
import i18next from 'i18next'
import type { RoleMenuOptions } from '../composer/FileMenu'
import type { RoleMenuEntry } from './RoleMenu'
import { RoleDestination, RoleTokens } from './RoleCompose'
import { useRoleStyle } from './RoleAvatar'
import { readOnlyShown, roleProfile } from './role-view'
import { onRoleInvoked, type RoleInvokeOptions } from '../../roles/roles-store'
import type { UncommittedChoice } from '@shared/launch-folder'
import { useLaunchFolder } from '../thread/LaunchLine'
import { uncommittedOf, type LaunchChoice } from '../../launch-choice'

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
   * choix affiché par la ligne sous la saisie (fiches 240, 262), porté explicitement.
   */
  send: (
    names: string[],
    text: string,
    uncommitted?: UncommittedChoice
  ) => Promise<{ started: string[]; failed: string[] }>
  /** La conversation (la mère) : son dossier est lu quand un rôle qui écrit est cité (fiche 262). */
  motherId?: string
  /**
   * « Répondre à <rôle> » (fiche 263) : le message va au travail `childId` déjà lancé ; `false` si
   * l'envoi a échoué (raison déjà dite).
   */
  reply?: (childId: string, text: string) => Promise<boolean>
  /** « Committer d'abord » (fiches 240, 262) : ces fichiers, dans le dépôt de la mère. */
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
  /** Texte de la saisie : un rôle qui écrit fait lire le dossier (fiche 262). */
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
  const { replying, forget, setReplyTo, badge } = useWorkReply(draftKey)
  // Le rôle d'une suite, même désactivé ou supprimé depuis : la suite va à son travail.
  const list = withReplyRole(roles?.list ?? [], badge)
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
  // Fiche 262 : un rôle qui écrit (pas en lecture seule) fait lire le dossier de la mère, pour la
  // ligne sous la saisie. Jamais d'avertissement ni de blocage : Entrée envoie avec le choix
  // affiché (`launch-choice.ts`).
  const writes = (names: readonly string[]) =>
    names.some((name) => list.find((r) => r.name === name)?.readOnly === false)
  const writing = writes(roleRecipients(tokens, options.text ?? '', list).names)
  const folder = useLaunchFolder(roles?.motherId, writing)
  // Dernier état lu, à jour même entre deux rendus (le commit fait, l'envoi part tout de suite).
  const stateNow = useRef(folder.state)
  useEffect(() => {
    stateNow.current = folder.state
  }, [folder.state])
  // « Juste un avis » ne vaut que pour l'envoi en cours : oublié une fois parti, ou quand plus
  // aucun rôle qui écrit n'est cité. Sinon, toujours « Partir sans elles » (décision du tech lead).
  const [choice, setChoiceState] = useState<LaunchChoice>('without')
  const choiceNow = useRef<LaunchChoice>('without')
  const choose = (next: LaunchChoice) => {
    choiceNow.current = next
    setChoiceState(next)
  }
  const [wroteBefore, setWroteBefore] = useState(writing)
  if (wroteBefore !== writing) {
    setWroteBefore(writing)
    if (!writing) setChoiceState('without')
  }
  useEffect(() => {
    choiceNow.current = choice
  }, [choice])
  // « Committer d'abord » : le choix de commit est ouvert sous la ligne ; Entrée y mène.
  const [committing, setCommittingState] = useState(false)
  const committingNow = useRef(false)
  // Entrée pendant « Committer d'abord » : le bouton du commit prend le focus (`LaunchLine`).
  const [focusCommit, setFocusCommit] = useState(0)
  // « Voir les N modifications » : la liste sous la ligne.
  const [showFiles, setShowFiles] = useState(false)
  const setCommitting = (on: boolean) => {
    committingNow.current = on
    setCommittingState(on)
  }
  const add = (name: string) => update(tokens.includes(name) ? tokens : [...tokens, name])
  /** La suite part au travail visé ; même retour qu'un lancement (jetons, saisie remise si échec). */
  const dispatchReply = (
    target: { name: string; childId: string },
    text: string,
    at: Parameters<typeof dispatch>[1]
  ) => {
    const reply = roles?.reply
    if (!reply || !text.trim()) return
    if (at.attachmentCount > 0) return options.onWarn(i18next.t('roleWork.destination.attachments'))
    setBusy(true, [target.name])
    const before = tokensNow.current
    update(before.filter((t) => t !== target.name))
    at.changeText('', 0)
    void reply(target.childId, text)
      .then((sent) => {
        if (sent) {
          // Historique de la saisie : seulement ce qui est vraiment parti (revue QA).
          options.onSent?.({ text: at.text, tokens: before })
          return setReplyTo(undefined)
        }
        update(before)
        if (textNow.current === '') at.changeText(at.text, at.text.length)
      })
      .finally(() => setBusy(false))
  }
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
    },
    uncommitted: UncommittedChoice | undefined
  ) => {
    if (!roles || !to.text.trim()) return
    if (at.attachmentCount > 0) {
      options.onWarn(i18next.t('roleWork.destination.attachments'))
      return
    }
    options.onSent?.({ text: at.text, tokens: tokensNow.current })
    setBusy(true, to.names)
    // Parti : la liste des modifications et le choix de commit se referment (revue UX, 4).
    setShowFiles(false)
    setCommitting(false)
    // Saisie vidée tout de suite, remise en cas d'échec : une conversation neuve entre dans
    // l'historique pendant l'envoi et la saisie est remontée (accueil → fil) ; elle ne doit pas
    // reprendre le texte parti (essai réel de la phase 4).
    const before = tokensNow.current
    const others = before.filter((t) => !to.names.includes(t))
    update(others)
    // Ce qui a été tapé après Entrée (pendant la lecture du dossier, recette N5, fiche 267) reste
    // dans la saisie : seul le texte validé part et s'efface.
    const rest = typedAfter(at.text, textNow.current)
    at.changeText(rest, rest.length)
    /** Remet `text` devant ce qui est dans la saisie, si la saisie n'a pas changé depuis. */
    const restore = (text: string) => {
      if (textNow.current === rest) at.changeText(text + rest, text.length)
    }
    void (uncommitted ? roles.send(to.names, to.text, uncommitted) : roles.send(to.names, to.text))
      .then(({ started, failed }) => {
        // Parti : « Juste un avis » ne vaut pas pour le message suivant.
        if (started.length > 0) choose('without')
        if (started.length === 0) {
          update(before)
          restore(at.text)
          return
        }
        if (!failed.length) return
        update([...others, ...to.names.filter((n) => failed.includes(n))])
        restore(to.text)
      })
      .finally(() => {
        setBusy(false)
        void folder.read()
      })
  }
  /**
   * Envoi à des rôles (fiche 262) : toujours, avec le choix affiché par la ligne. Un rôle qui
   * écrit, dossier pas encore lu : lu d'abord (un instant), pour porter le bon choix. Pendant
   * « Committer d'abord », Entrée mène au bouton du commit : le message part une fois commité.
   */
  const guarded = (to: { names: string[]; text: string }, at: Parameters<typeof dispatch>[1]) => {
    const target = replying(to.names)
    if (target) return dispatchReply(target, to.text, at)
    if (!writes(to.names) || !roles?.motherId) return dispatch(to, at, undefined)
    if (committingNow.current) return setFocusCommit((n) => n + 1)
    const known = stateNow.current
    if (known !== undefined) return dispatch(to, at, uncommittedOf(known, choiceNow.current))
    setBusy(true)
    void folder.read().then((state) => {
      stateNow.current = state
      setBusy(false)
      dispatch(to, at, uncommittedOf(state, choiceNow.current))
    })
  }
  useRoleInvoked(roles, (name, invoked) => {
    // La suite d'un travail d'une autre conversation (affichée côte à côte) : pas pour cette
    // saisie, ni son focus (fiche 267, F8).
    if (invoked.motherId && invoked.motherId !== roles?.motherId) return
    if (!roles?.invokable) return options.onWarn(i18next.t('team.notHere'))
    if (invoked.replyTo && roles.reply) {
      // La suite d'un travail va à lui seul : les autres jetons partent.
      update([name])
      setReplyTo({
        name,
        childId: invoked.replyTo,
        ...(invoked.role ? { role: invoked.role } : {})
      })
    } else add(name)
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
      forget(last.name)
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
      // Suite d'un travail : ni dossier à lire, ni « Changer… » (le travail existe déjà).
      const reply = replying(typed.map((r) => r.name))
      return {
        tokens: shownTokens,
        /** Le jeton du rôle dont on poursuit le travail (« Répondre à … », fiche 263). */
        reply: { replying: reply?.name },
        targets,
        empty,
        /** `@rôle` tapé là où il ne lance pas de fille : il part en texte, c'est dit. */
        notHere:
          !!roles?.elsewhere?.length && splitRoleMentions(text, roles.elsewhere).names.length > 0,
        sending,
        /** L'envoi aux rôles est possible (bouton). */
        ready: typed.length > 0 && !empty && !sending,
        remove: (name: string) => {
          update(tokens.filter((t) => t !== name))
          forget(name)
        },
        /**
         * Où partira un rôle qui écrit (fiche 262) : état du dossier une fois lu, choix affiché,
         * « Committer d'abord » ouvert.
         */
        launch:
          writing && folder.state && !reply
            ? {
                state: folder.state,
                choice,
                committing,
                focusCommit,
                showFiles,
                // Accord : les rôles qui partent vraiment en worktree (ceux qui écrivent).
                many: typed.filter((role) => !role.readOnly).length > 1
              }
            : undefined,
        /** « Juste un avis » choisi pour un rôle qui écrit : la ligne le dit (lecture seule). */
        opinion:
          !reply && writing && folder.state?.place === 'worktree' && choice === 'readOnly'
            ? { sees: folder.state.dirty?.count ?? 0 }
            : undefined
      }
    },
    /** Choix de la ligne (fiche 262) : « Juste un avis » pour l'envoi en cours seulement. */
    choose,
    /** « Committer d'abord » ouvert ou fermé. */
    setCommitting,
    /** Liste des modifications ouverte ou fermée. */
    setShowFiles,
    /** « Committer d'abord » : dans le dépôt de la mère, puis le dossier est relu. */
    commit: async (message: string, files: string[]) => {
      await roles?.commitFolder?.(message, files)
      stateNow.current = await folder.read()
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

/**
 * Suite d'un travail (« Répondre à … », fiche 263) : le rôle et le travail visé, pour ce brouillon.
 * Elle ne vaut que si ce rôle est le seul cité ; retirer son jeton l'oublie.
 */
function useWorkReply(draftKey: string | undefined) {
  const [replyTo, setReplyTo] = useState<{
    key: string | undefined
    name: string
    childId: string
    role?: RoleBadge
  }>()
  return {
    badge: replyTo && replyTo.key === draftKey ? replyTo.role : undefined,
    replying: (names: readonly string[]) =>
      replyTo && replyTo.key === draftKey && names.length === 1 && names[0] === replyTo.name
        ? replyTo
        : undefined,
    forget: (name: string) => {
      if (replyTo?.name === name) setReplyTo(undefined)
    },
    setReplyTo: (target: { name: string; childId: string; role?: RoleBadge } | undefined) =>
      setReplyTo(target && { key: draftKey, ...target })
  }
}

/**
 * Rôles de la saisie, avec celui d'une suite s'il n'y est plus (désactivé, supprimé) : vu depuis
 * le badge de son travail, il garde son jeton et sa ligne.
 */
function withReplyRole(
  list: readonly RoleView[],
  badge: RoleBadge | undefined
): readonly RoleView[] {
  if (!badge || list.some((r) => r.name === badge.name)) return list
  return [
    ...list,
    {
      ...badge,
      readOnly: badge.readOnly === true,
      description: badge.label,
      prompt: '',
      scope: 'user',
      enabled: true
    }
  ]
}

/** Rôle invoqué d'ailleurs (`invokeRole`) : reçu par la saisie qui a des rôles, la plus récente. */
function useRoleInvoked(
  roles: ComposerRoles | undefined,
  receive: (name: string, options: RoleInvokeOptions) => void
): void {
  const latest = useRef(receive)
  useEffect(() => {
    latest.current = receive
  })
  const listening = !!roles
  useEffect(
    () => (listening ? onRoleInvoked((name, invoked) => latest.current(name, invoked)) : undefined),
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
  opinion,
  launch,
  reply = false
}: {
  targets: readonly RoleView[]
  empty: boolean
  sending: boolean
  roles: ComposerRoles | undefined
  profileId: string | undefined
  agentLabel: string
  /** Suite d'un travail déjà lancé (« Répondre à … », fiche 263). */
  reply?: boolean
  /** « Juste un avis » choisi pour un rôle qui écrit (fiche 262). */
  opinion?: { sees: number } | undefined
  /** Où partira un rôle qui écrit, et « Changer… » (fiche 262). */
  launch?: { node: ReactNode } | undefined
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
      {...(launch ? { launch } : {})}
      {...(reply ? { reply } : {})}
    />
  )
}

export { RoleTokens }

/**
 * Ce qui a été tapé dans la saisie après Entrée, pendant que l'envoi attendait (lecture du
 * dossier, fiche 262) : la suite du texte validé, ou tout le texte s'il a été changé autrement —
 * jamais effacé sans être parti (recette N5, fiche 267).
 */
export function typedAfter(sent: string, now: string): string {
  if (now === sent) return ''
  return now.startsWith(sent) ? now.slice(sent.length) : now
}
