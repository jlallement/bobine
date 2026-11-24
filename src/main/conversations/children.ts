/**
 * Conversations filles (fiche 097, ADR-0019, ADR-0020).
 *
 * - Étape 1, « Lancer en parallèle… » : la fille part dans un nouveau worktree depuis le dossier de
 *   sa mère, avec la consigne comme premier message ; la conversation affichée ne change pas.
 * - À chaque fin de tour d'une fille, son compte rendu est posé dans le fil de sa mère. Il part à
 *   l'agent de la mère avec son prochain message (`extraContext` de l'hôte, voir `childNews`).
 * - Étape 2, l'agent (outils de `mcp/children-tools.ts`) : il lance des filles, leur écrit, ou
 *   écrit à sa mère ; le message entre dans la file d'attente de la conversation visée, avec sa
 *   provenance. Il est réveillé une fois quand ses filles ont toutes fini (`children-wake.ts`).
 * - Plafond réglable des filles en cours, pour les deux étapes.
 *
 * Le gestionnaire garde les conversations ; ce module tient les préparations transitoires et
 * l'attente du réveil.
 */
import { t } from 'i18next'
import { randomUUID } from 'node:crypto'
import type {
  ConversationEvent,
  ConversationSummary,
  ProfileSummary,
  SessionControl
} from '@shared/agent'
import type { AttentionState } from '@shared/attention'
import {
  activeChildren,
  childReport,
  childState,
  childWork,
  clip,
  cutReplyChars,
  keptReply,
  lastReply,
  RECOMMENDATION_NOTE_CHARS,
  replyRecap,
  WAKE_TEXT,
  type ChildCapacity,
  type ChildReport,
  type ChildLaunch,
  type ChildLaunchState,
  type ChildState,
  type ChildWork,
  type MessageOrigin
} from '@shared/children'
import { messageOf } from '@shared/errors'
import { usageDigest } from '@shared/usage'
import type { TranscriptItem } from '@shared/transcript'
import { log } from '../log'
import { hasFolder } from './agentless'
import { ChildWake } from './children-wake'
import { applyModel, ChildReviews, REVIEWER_ROLE } from './children-review'
import type { Message } from '@shared/i18n/message'
import { roleBadge, roleStamp, type RoleSnapshot, type RoleView } from '@shared/roles'
import type { RoleLibrary } from '../roles/library'
import { roleFirstMessage, type InstalledMode } from '../roles/launch'
import { ReadOnlyWatch } from '../roles/read-only-watch'
import type { Run } from '../simulator/run'
import { gitRun } from '../git/git-queue'
import { inGitRepo, titleFrom } from './helpers'
import type { ConversationManager } from './manager'
import { detachChild } from './family-delete'
import type { LaunchFolder } from './launch-folder'
import type {
  FolderDirty,
  LaunchFolderState,
  LeftBehind,
  UncommittedChoice
} from '@shared/launch-folder'
import { IN_PLACE_LINE } from '@shared/launch-folder'
import type { CommitOutcome } from '@shared/worktree-cycle'
import type { RoleRequest } from '@shared/role-request'

/** Ce que demande « Lancer en parallèle… », ou `start_child`. */
export interface ChildRequest {
  /** Consigne : le premier message de la fille. */
  text: string
  /** Titre de la fille ; absent : le début de la consigne. */
  title?: string
  /** Agent de la fille ; absent : celui de la mère. */
  profileId?: string
  /** Modèle choisi (réglage de catégorie `model`) ; absent : celui que prend l'agent. */
  model?: { controlId: string; value: string }
  /**
   * Rôle de la fille, par son nom (fiche 223) : sa consigne, son mode, sa lecture seule et ses
   * outils. Son agent et son modèle sont choisis par l'appelant (carte, dialogue).
   */
  role?: string
  /** Rôle figé à la carte de `start_child` (relecture de la fiche 223) : l'emporte sur `role`. */
  roleSnapshot?: RoleSnapshot
  /** Lignes dites dans le fil de la fille dès son lancement (agent du rôle indisponible…). */
  notices?: Message[]
  /**
   * Choix de l'utilisateur devant un dossier modifié (fiche 240, fiche 262) : partir sans elles
   * (`anyway`, le choix affiché par défaut sous la saisie), ou un avis en lecture seule dans le
   * dossier de la mère (rôle seulement). Sans choix explicite, une fille qui partirait en worktree
   * d'un dossier modifié est refusée (outil de l'agent, carte sans réponse) : le main n'en
   * suppose aucun.
   */
  uncommitted?: UncommittedChoice
  /**
   * Bulle « @Rôle … » de la saisie (fiche 263) : posée, ou complétée de ce travail, juste avant son
   * lancement dans le fil de la mère ; `works` : les travaux déjà partis pour la même demande,
   * complété en place par `start` (l'appelant passe le même objet au rôle suivant).
   */
  ask?: RoleRequest
  /**
   * Clé de la carte du travail (fiche 264, `ChildStart.card`) : sa ligne de proposition, ou sa
   * carte seule (« Lancer en parallèle… »). Absente : pas de carte (bulle, relecture).
   */
  card?: string
}

/** Une fille vue par `child_status`. */
export interface ChildStatus extends ChildWork {
  id: string
  title: string
  state: ChildState
  branch?: string
  /** Début de sa dernière réponse (fiche 160) ; `replyChars` : coupée, sa taille (fiche 247). */
  excerpt: string
  replyChars?: number
}

/**
 * Agents et modèles qu'une mère peut choisir pour une fille (`start_child`, fiche 160) : les
 * profils, l'agent de la mère, et son réglage de catégorie `model` (le seul dont on connaisse les
 * options ; un autre agent prend son dernier modèle choisi, comme dans « Lancer en parallèle… »).
 */
export interface ChildChoices {
  profileId: string
  profiles: Pick<ProfileSummary, 'id' | 'label' | 'available' | 'reason'>[]
  /** Réglage `model` de la mère, seulement si son profil permet de le choisir (`childModel`). */
  model?: SessionControl
}

/**
 * Rôle d'une conversation pour les outils de l'app : mère possible, fille, relecteur (fiche 177),
 * ni l'une ni l'autre.
 */
export type ChildRole = 'mother' | 'child' | 'reviewer' | undefined

/** Ce dont le module a besoin du gestionnaire. */
export type ChildHost = Pick<
  ConversationManager,
  | 'state'
  | 'view'
  | 'createChild'
  | 'ready'
  | 'holdStarting'
  | 'prompt'
  | 'setControl'
  | 'post'
  | 'rename'
  | 'settings'
  | 'settingsView'
  | 'worktreeOf'
  | 'updateRecord'
>

export interface ChildOptions {
  /** Conversations qui attendent l'utilisateur (fiche 024) : une fille qui attend compte. */
  attention?: () => AttentionState
  /** Préparations en cours, avant la publication des conversations dans la liste (fiche 149). */
  launchesChanged?: (state: ChildLaunchState) => void
  /** git des relectures (fiche 177) ; par défaut, la file de l'app. */
  run?: Run
  /** Rôles (fiche 223) ; absent : aucun rôle. */
  roles?: Pick<RoleLibrary, 'active' | 'find'>
  /**
   * Mode installé par Bobine pour ce rôle dans l'agent de ce profil, avec « lancer dans ce mode »
   * (fiche 223, phase 4) ; `conversationId` : la fille (son projet est celui de sa mère).
   */
  nativeRoleMode?: (
    profileId: string,
    role: RoleSnapshot,
    conversationId: string
  ) => InstalledMode | undefined
  /** Dossier de la mère avant un lancement en worktree (fiche 240) ; absent : pas de vérification. */
  folder?: LaunchFolder
}

export class ChildConversations {
  private readonly conversations: ChildHost
  private readonly attention: () => AttentionState
  private readonly waking: ChildWake
  private readonly preparing = new Map<string, ChildLaunch>()
  private launchRevision = 0
  private readonly launchesChanged: (state: ChildLaunchState) => void
  /** Dernier message entier de chaque fille à sa mère (`message_parent` le coupe, fiche 247). */
  private readonly parentMessages = new Map<string, string>()
  /** Comptes rendus retenus pendant une réponse de la mère, par mère. */
  private readonly held = new Map<string, ChildReport[]>()
  /** Conversations à qui ce module a envoyé un message (consigne, message, réveil) pas encore parti. */
  private readonly sending = new Set<string>()
  /**
   * Filles dont la consigne n'est pas encore partie (agent qui démarre, modèle à régler) : un
   * message de la mère attend derrière elle, sinon il arriverait avant la consigne (fiche 112).
   */
  private readonly launching = new Map<string, Promise<void>>()
  /** Relectures avant fusion (fiche 177) : des filles d'un genre à part. */
  readonly reviews: ChildReviews
  private readonly roles: ChildOptions['roles']
  private readonly nativeRoleMode: ChildOptions['nativeRoleMode']
  /** Garde-fou des rôles en lecture seule (fiche 223). */
  private readonly readOnly: ReadOnlyWatch
  private readonly folder: LaunchFolder | undefined

  constructor(conversations: ChildHost, options: ChildOptions = {}) {
    this.conversations = conversations
    this.roles = options.roles
    this.nativeRoleMode = options.nativeRoleMode
    this.folder = options.folder
    // Le Code reviewer (fiche 265) a le même garde-fou que tout rôle en lecture seule ; un écart
    // est aussi dit sur sa carte de relecture.
    this.readOnly = new ReadOnlyWatch({
      conversations,
      summary: (id) => this.summary(id),
      run: options.run ?? gitRun,
      changed: (id) => this.reviews.changed(id)
    })
    this.reviews = new ChildReviews({
      conversations,
      children: this,
      run: options.run ?? gitRun,
      watch: this.readOnly,
      ...(options.nativeRoleMode ? { nativeRoleMode: options.nativeRoleMode } : {})
    })
    this.attention = options.attention ?? (() => ({}))
    this.launchesChanged = options.launchesChanged ?? (() => {})
    this.waking = new ChildWake({
      state: () => conversations.state(),
      view: (id) => conversations.view(id),
      attention: this.attention,
      wake: (motherId) => this.wake(motherId)
    })
  }

  /**
   * Lance une fille de `motherId` : worktree, agent, modèle, puis la consigne, envoyée sans
   * attendre la fin du tour ni même le démarrage de l'agent. `by: 'agent'` : par `start_child`,
   * la mère sera réveillée quand ses filles auront fini. Rend la fille.
   */
  async start(motherId: string, request: ChildRequest, by?: 'agent'): Promise<ConversationSummary> {
    const text = request.text.trim()
    if (!text) throw new Error(t('children.error.emptyPrompt'))
    const mother = this.summary(motherId)
    if (mother.draft) throw new Error(t('children.error.draft'))
    if (mother.startedFrom) throw new Error(t('children.error.oneLevel'))
    if (mother.archived) throw new Error(t('children.error.archived'))
    // Jamais de modèle pour une fille dont le profil ne le permet pas (fiche 160), quel que soit
    // le chemin (carte, « Lancer en parallèle… », IPC) : le renderer ne fait pas foi.
    if (request.model && !this.modelAllowed(request.profileId ?? mother.profileId)) {
      throw new Error(t('children.error.modelNotAllowed'))
    }
    const { active, max } = this.capacity(motherId)
    if (active >= max) throw new Error(t('children.limit', { count: max }))
    const role = launchRole(
      request,
      request.roleSnapshot ?? (request.role ? this.findRole(motherId, request.role) : undefined)
    )
    // Code reviewer (fiche 265, un seul chemin) : `@code-reviewer` de la saisie, `start_child` de
    // l'agent, « Lancer en parallèle… » — la relecture de cette conversation, portée d'office, la
    // consigne en points à surveiller.
    if (role?.name === REVIEWER_ROLE) return this.startReview(motherId, request, text, by)

    // Lancements d'une même mère posés dans l'ordre demandé (seconde chasse rc.4) : « Tout
    // lancer » les demande ensemble, et chaque worktree se prépare plus ou moins vite (en parallèle,
    // visibles tout de suite, fiche 149) ; sans ce tour, les `child-started` arrivaient au hasard,
    // et la carte de groupe et la fusion changeaient d'ordre d'un essai à l'autre.
    const turn = this.launchTurn(motherId)
    const { child, inPlace, posted } = await this.born(
      motherId,
      text,
      request,
      role,
      by,
      turn.ready
    ).finally(turn.done)
    if (!posted) {
      this.waking.forget(motherId)
      detachChild(this.conversations, child.id, mother.title)
    }
    // Historique de la saisie de la fille (fiche 227) : il commence par sa consigne.
    this.conversations.post(child.id, { type: 'sent-recorded', entry: { text } })
    for (const message of request.notices ?? []) {
      this.conversations.post(child.id, { type: 'notice', level: 'info', message })
    }
    let launched = () => {}
    this.launching.set(child.id, new Promise<void>((resolve) => (launched = resolve)))
    void this.launch(child, text, { model: request.model, role, inPlace }, () => {
      launched()
      this.launching.delete(child.id)
    })
    return child
  }

  /** Le Code reviewer lancé comme un rôle : par `ChildReviews.start`, sur cette conversation. */
  private async startReview(
    motherId: string,
    request: ChildRequest,
    text: string,
    by: 'agent' | undefined
  ): Promise<ConversationSummary> {
    const reviewer = await this.reviews.start(motherId, {
      focus: text,
      auto: true,
      ...(request.ask ? { ask: request.ask } : {}),
      ...(request.card ? { card: request.card } : {}),
      ...(by ? { by } : {}),
      ...(request.profileId ? { profileId: request.profileId } : {}),
      ...(request.model ? { model: request.model } : {})
    })
    if (by) this.waking.await(motherId, reviewer.id)
    // Agent ou modèle du rôle laissés de côté (`@code-reviewer`) : dit dans son fil, comme tout rôle.
    for (const message of request.notices ?? []) {
      this.conversations.post(reviewer.id, { type: 'notice', level: 'info', message })
    }
    return reviewer
  }

  /**
   * Où part une fille (fiche 262, garde finale du main) : un rôle en lecture seule, dans le
   * dossier de la mère (`childDetachedRequest`) ; dépôt sans commit, dans le dossier aussi —
   * jamais de commit pour en fabriquer un ; hors dépôt, refusée (pas de worktree) ; sinon en
   * worktree depuis le dernier commit, sans le non commité (fiche 240, ADR-0055) : d'un dossier
   * modifié, sans choix explicite (`anyway`), elle est refusée. Lu après la réservation de la place
   * (`prepare`). Rend `true` : dans le dossier de la mère.
   */
  private async inPlace(
    motherId: string,
    request: ChildRequest,
    role: RoleSnapshot | undefined
  ): Promise<boolean> {
    if (role?.readOnly) return false
    const state = await this.folderState(motherId)
    // Dépôt sans commit : dans le dossier. Hors dépôt : refusé comme avant (pas de worktree
    // possible, `worktrees.notRepo` à la création) — décision du tech lead.
    if (state?.place === 'here') return state.reason === 'noCommit'
    if (request.uncommitted === 'anyway' || !state?.dirty) return false
    throw new Error(t('children.error.uncommitted', { count: state.dirty.count }))
  }

  /**
   * Où partirait une fille qui écrit, depuis le dossier d'une mère (fiche 262) ; `undefined` :
   * sans dossier, ou sans lecture du dossier (essais).
   */
  async folderState(motherId: string): Promise<LaunchFolderState | undefined> {
    const mother = this.summary(motherId)
    if (!this.folder || !hasFolder(mother.workspace)) return undefined
    if (!inGitRepo(mother.workspace)) return { place: 'here', reason: 'notRepo' }
    const state = await this.folder.state(mother.workspace, motherId)
    return state.place === 'worktree' && state.dirty
      ? { ...state, dirty: { ...state.dirty, title: mother.title } }
      : state
  }

  /**
   * Modifications non commitées du dossier d'une mère qu'une fille en worktree n'aurait pas (fiche
   * 240) ; `undefined` s'il est propre, ou si la fille travaillerait dans le dossier (fiche 262).
   */
  async uncommitted(motherId: string): Promise<FolderDirty | undefined> {
    const state = await this.folderState(motherId)
    return state?.place === 'worktree' ? state.dirty : undefined
  }

  /** « Committer d'abord » avant un lancement (fiche 240) : dans le dépôt du dossier de la mère. */
  commitFolder(
    motherId: string,
    request: { message: string; files: string[] }
  ): Promise<CommitOutcome> {
    if (!this.folder) throw new Error(t('ipc.unavailable.children'))
    return this.folder.commit(this.summary(motherId).workspace, request, motherId)
  }

  /** Ce qu'une fille en worktree a laissé derrière elle en partant (fiche 240), pour la mère. */
  private leftBehind(childId: string): { leftBehind?: LeftBehind } {
    const worktree = this.conversations.worktreeOf(childId)?.worktree
    if (!worktree?.dirtyAtStart) return {}
    return { leftBehind: { count: worktree.dirtyAtStart, commit: worktree.base.slice(0, 7) } }
  }

  /** Filles en cours d'une conversation et plafond réglé (menu, `start_child`). */
  capacity(id: string): ChildCapacity {
    const { workspace } = this.summary(id)
    return {
      inRepo: hasFolder(workspace) && inGitRepo(workspace),
      active:
        activeChildren(id, this.conversations.state().conversations, this.attention()) +
        [...this.preparing.values()].filter(
          (launch) =>
            launch.motherId === id &&
            !this.conversations.state().conversations.some((c) => c.id === launch.conversationId)
        ).length,
      max: this.conversations.settings.preferences().maxChildren
    }
  }

  launchState(): ChildLaunchState {
    return { revision: this.launchRevision, entries: [...this.preparing.values()] }
  }

  private publishLaunches(): void {
    this.launchRevision++
    this.launchesChanged(this.launchState())
  }

  /**
   * Naissance d'une fille : préparée (en parallèle des autres), puis, à son tour (voir `start`),
   * nommée, sa bulle et son lancement posés dans le fil de la mère. `posted` : la mère était là.
   */
  private async born(
    motherId: string,
    text: string,
    request: ChildRequest,
    role: RoleSnapshot | undefined,
    by: 'agent' | undefined,
    /** Les lancements demandés avant celui-ci sont posés (ou en échec). */
    turn: Promise<void>
  ): Promise<{ child: ConversationSummary; inPlace: boolean; posted: boolean }> {
    const { created, inPlace } = await this.prepare(motherId, text, request, role)
    await turn
    const title = request.title?.trim()
    if (title) this.conversations.rename(created.id, title)
    const child = title ? { ...created, title: this.summary(created.id).title } : created
    if (by) this.waking.await(motherId, child.id)
    this.sending.add(child.id)
    // Bulle de la demande (fiche 263), avant le lancement : seulement pour un travail parti.
    const ask = request.ask && role ? request.ask : undefined
    if (ask && role) {
      // La demande est complétée en place : le travail suivant du même message s'y ajoute.
      ask.works = [...ask.works, { childId: child.id, role: roleBadge(role) }]
      this.conversations.post(motherId, { type: 'role-request', request: { ...ask } })
    }
    // Mère supprimée pendant la préparation (fiche 228) : la fille continue seule, jamais orpheline.
    const posted = this.conversations.post(motherId, {
      type: 'child-started',
      child: {
        childId: child.id,
        title: child.title,
        ...(child.branch ? { branch: child.branch } : {}),
        prompt: text,
        ...(by ? { by } : {}),
        ...(role ? { role: roleBadge(role) } : {}),
        ...this.leftBehind(child.id),
        ...(ask ? { request: ask.requestId } : request.card ? { card: request.card } : {}),
        at: Date.now()
      }
    })
    return { child, inPlace, posted }
  }

  /** Tour de lancement par mère (voir `start`) : le dernier demandé. */
  private readonly launchTurns = new Map<string, Promise<void>>()

  /**
   * Prend son tour, sans attendre : `ready` quand les lancements demandés avant sont posés, `done`
   * à appeler une fois le sien posé (ou en échec), quoi qu'il arrive.
   */
  private launchTurn(motherId: string): { ready: Promise<void>; done: () => void } {
    const ready = this.launchTurns.get(motherId) ?? Promise.resolve()
    let release = () => {}
    const mine = new Promise<void>((resolve) => (release = resolve))
    const tail = ready.then(() => mine)
    this.launchTurns.set(motherId, tail)
    return {
      ready,
      done: () => {
        release()
        if (this.launchTurns.get(motherId) === tail) this.launchTurns.delete(motherId)
      }
    }
  }

  private async prepare(
    motherId: string,
    text: string,
    request: ChildRequest,
    role: RoleSnapshot | undefined
  ): Promise<{ created: ConversationSummary; inPlace: boolean }> {
    const id = randomUUID()
    const launch: ChildLaunch = { id, motherId, title: request.title?.trim() || titleFrom(text) }
    this.preparing.set(id, launch)
    this.publishLaunches()
    try {
      const inPlace = await this.inPlace(motherId, request, role)
      const created = await this.conversations.createChild(
        motherId,
        text,
        request.profileId,
        (child) => {
          this.preparing.set(id, { ...launch, conversationId: child.id })
          this.publishLaunches()
          // « Démarre » jusqu'au départ de sa consigne : jamais « a fini » entre-temps (fiche 223).
          this.conversations.holdStarting(child.id, true)
        },
        { ...(role ? { role: roleStamp(role) } : {}), ...(inPlace ? { inPlace } : {}) }
      )
      return { created, inPlace }
    } finally {
      this.preparing.delete(id)
      this.publishLaunches()
    }
  }

  /**
   * Rôle d'une conversation au début d'une session d'agent : fille (sa mère existe), mère possible
   * (dans un dépôt git : une fille a besoin d'un worktree), sinon aucun.
   */
  role(id: string): ChildRole {
    const summary = this.summary(id)
    if (summary.reviewOf) return 'reviewer'
    if (summary.startedFrom) return 'child'
    return hasFolder(summary.workspace) && inGitRepo(summary.workspace) ? 'mother' : undefined
  }

  /**
   * Résumé d'une conversation : celui de la liste, sinon (brouillon qui n'est pas affiché) celui de
   * sa vue, qui lit son fil.
   */
  summary(id: string): ConversationSummary {
    const listed = this.conversations.state().conversations.find((c) => c.id === id)
    return listed ?? this.conversations.view(id).summary
  }

  /**
   * Rôles actifs pour une conversation (fiche 223) : ceux du dossier de la mère pour une fille (un
   * rôle non commité n'est pas dans son worktree), sinon ceux de son propre dossier.
   */
  rolesFor(id: string): RoleView[] {
    if (!this.roles) return []
    const summary = this.summary(id)
    const folder = summary.startedFrom
      ? this.conversations.state().conversations.find((c) => c.id === summary.startedFrom?.id)
          ?.workspace
      : summary.workspace
    return this.roles.active(folder && hasFolder(folder) ? folder : undefined)
  }

  /** Rôle actif de ce nom pour une mère ; sinon une erreur qui cite les rôles connus. */
  findRole(motherId: string, name: string): RoleView {
    const wanted = name.trim().replace(/^@/, '').toLowerCase()
    const roles = this.rolesFor(motherId)
    const role = roles.find((r) => r.name === wanted)
    if (role) return role
    throw new Error(
      t('roles.error.unknownRole', {
        name,
        roles: roles.map((r) => r.name).join(', ') || t('roles.none')
      })
    )
  }

  /** Filles d'une conversation, dans l'ordre de la liste (hors archivées). */
  children(motherId: string): ConversationSummary[] {
    return this.conversations
      .state()
      .conversations.filter((c) => c.startedFrom?.id === motherId && !c.archived)
  }

  /** `child_status` : état, branche, fichiers et fin de la dernière réponse de chaque fille. */
  status(motherId: string): ChildStatus[] {
    const attention = this.attention()
    return this.children(motherId).map((child) => {
      const { items } = this.conversations.view(child.id).transcript
      const replyChars = cutReplyChars(lastReply(items))
      return {
        id: child.id,
        title: child.title,
        state: childState(child, attention[child.id]),
        ...(child.branch ? { branch: child.branch } : {}),
        ...childWork(child, items),
        excerpt: replyRecap(lastReply(items)),
        ...(replyChars === undefined ? {} : { replyChars })
      }
    })
  }

  /** `child_status` `full` (fiche 247) : dernière réponse et dernier message à la mère, entiers. */
  fullText(childId: string): { reply: string; message?: string } {
    const message = this.parentMessages.get(childId)
    const reply = lastReply(this.conversations.view(childId).transcript.items).trim()
    return { reply, ...(message === undefined ? {} : { message }) }
  }

  /**
   * `message_child` : le message entre dans la file de la fille (envoyé tout de suite si elle est
   * au repos), marqué « De la conversation mère ». La mère attend de nouveau cette fille.
   * Rend `queued` si la fille répondait.
   */
  messageChild(motherId: string, child: ConversationSummary, text: string): 'queued' | 'sent' {
    const mother = this.summary(motherId)
    this.waking.await(motherId, child.id)
    const delivery = this.deliver(child, text, {
      kind: 'parent',
      id: mother.id,
      title: mother.title
    })
    this.conversations.post(motherId, {
      type: 'child-instruction',
      instruction: { childId: child.id, title: child.title, prompt: text, at: Date.now() }
    })
    return delivery
  }

  /** Le profil permet-il de choisir le modèle d'une fille (`childModelChoice`, fiche 160) ? */
  modelAllowed(profileId: string): boolean {
    return !!this.conversations.settingsView().profiles.find((p) => p.id === profileId)?.childModel
  }

  /** Agents et modèle de l'agent de la mère, pour valider `start_child` (fiche 160). */
  choices(motherId: string): ChildChoices {
    const mother = this.summary(motherId)
    const profiles = this.conversations.settingsView().profiles
    // Un profil sans `childModelChoice` (fiche 160) : jamais de modèle choisi pour une fille.
    const model = this.modelAllowed(mother.profileId)
      ? this.conversations
          .view(motherId)
          .snapshot?.controls.find((c) => c.category === 'model' && c.type === 'select')
      : undefined
    return {
      profileId: mother.profileId,
      profiles: profiles.map(({ id, label, available, reason }) => ({
        id,
        label,
        available,
        ...(reason ? { reason } : {})
      })),
      ...(model ? { model } : {})
    }
  }

  /**
   * `recommend_merge` (fiche 160) : la recommandation de la mère, posée dans son fil, s'affiche
   * sur la ligne de la fille. Rien n'est fusionné : c'est l'utilisateur qui fusionne.
   */
  recommend(motherId: string, child: ConversationSummary, ready: boolean, note: string): void {
    this.conversations.post(motherId, {
      type: 'child-recommendation',
      recommendation: {
        childId: child.id,
        title: child.title,
        ready,
        note: clip(note.trim(), RECOMMENDATION_NOTE_CHARS),
        at: Date.now()
      }
    })
  }

  /** `message_parent` : le message entre dans la file de la mère, marqué « De la conversation fille ». */
  messageParent(
    child: ConversationSummary,
    mother: ConversationSummary,
    text: string,
    whole = text
  ): 'queued' | 'sent' {
    this.parentMessages.set(child.id, whole)
    return this.deliver(mother, text, { kind: 'child', id: child.id, title: child.title })
  }

  /**
   * Évènement d'une conversation : à la fin d'un tour d'une fille encore liée à sa mère, son compte
   * rendu est posé dans le fil de la mère ; si la mère répond, à la fin de sa réponse (posé au
   * milieu, il couperait son texte en deux). Puis le réveil groupé suit l'évènement.
   */
  onEvent(payload: ConversationEvent): void {
    const { conversationId, event } = payload
    if (event.type === 'user-message') this.sending.delete(conversationId)
    // Son agent n'est plus « prêt » (il répond, attend, échoue) : la fille montre son vrai statut.
    if (event.type === 'status' && !['starting', 'ready'].includes(event.snapshot.status)) {
      this.conversations.holdStarting(conversationId, false)
    }
    const conversations = this.conversations.state().conversations
    if (event.type === 'turn-end' || event.type === 'turn-error') {
      const child = conversations.find((c) => c.id === conversationId)
      // Un relecteur d'avant (fiche 177) rend ses remarques à la conversation relue, sans compte
      // rendu ; le Code reviewer (fiche 265) a sa carte-réponse, et sa réponse comme tout travail.
      const parentId = child?.startedFrom?.id
      const motherId =
        child?.reviewOf && parentId && !this.hasCard(parentId, child.id) ? undefined : parentId
      if (child && motherId) {
        const { items, usage } = this.conversations.view(conversationId).transcript
        const end =
          event.type === 'turn-end' ? { stopReason: event.stopReason } : { error: event.message }
        // Ce qu'a coûté la fille jusque-là (fiche 117), tel que son fil le sait à la fin du tour.
        const digest = usageDigest(usage)
        const seen = child.reviewOf ? this.reviews.findingCount(child.id) : undefined
        const report = {
          ...childReport(child, items, end),
          ...(seen === undefined ? {} : { findingsSeen: seen }),
          ...(digest ? { usage: digest } : {}),
          ...this.leftBehind(child.id),
          // Carte-réponse (fiches 263, 264) : la réponse entière, pour un travail qui a sa carte.
          ...(!('error' in end) && this.hasCard(motherId, child.id) ? keptReply(items) : {})
        }
        const mother = conversations.find((c) => c.id === motherId)
        if (mother?.status === 'busy') {
          this.held.set(motherId, [...(this.held.get(motherId) ?? []), report])
        } else this.conversations.post(motherId, { type: 'child-report', report })
      }
    }
    // La mère ne répond plus : les comptes rendus retenus sont posés, avant le réveil.
    if (event.type === 'status' && event.snapshot.status !== 'busy') {
      const held = this.held.get(conversationId) ?? []
      this.held.delete(conversationId)
      for (const report of held) {
        this.conversations.post(conversationId, { type: 'child-report', report })
      }
    }
    this.waking.onEvent(payload)
    this.reviews.onEvent(payload)
    this.readOnly.onEvent(payload)
  }

  /**
   * Travail qui a sa carte-réponse : lancé par une bulle « @Rôle … » (fiche 263) ou avec une clé de
   * carte (proposition, « Lancer en parallèle… », fiche 264) ; son lancement le dit, dans le fil de
   * la mère. Mère disparue entre-temps : non, sans lever (revue QA).
   */
  private hasCard(motherId: string, childId: string): boolean {
    if (!this.conversations.state().conversations.some((c) => c.id === motherId)) return false
    try {
      return this.conversations
        .view(motherId)
        .transcript.items.some(
          (i) => i.kind === 'child-started' && i.childId === childId && !!(i.request || i.card)
        )
    } catch {
      return false
    }
  }

  /**
   * Un travail à relancer : au repos, et sa dernière demande sans réponse ou à une réponse en échec
   * ou arrêtée (les états « Relancer » de sa carte).
   */
  private retryable(motherId: string, child: ConversationSummary): boolean {
    if (child.status === 'busy' || child.status === 'starting' || child.status === 'needs-action')
      return false
    const items = this.conversations.view(motherId).transcript.items
    const asks = (i: TranscriptItem) =>
      (i.kind === 'child-started' && i.childId === child.id) ||
      (i.kind === 'role-request' && i.works.some((w) => w.childId === child.id))
    const report = items.findLast((i) => i.kind === 'child-report' && i.childId === child.id)
    if (report?.kind !== 'child-report') return true
    if (report.outcome !== 'done' || child.turnStopped) return true
    const ask = items.findLast(asks)
    return !!ask && ask.id > report.id
  }

  /**
   * « Répondre à <rôle> » et « Relancer » (fiche 263, décision 2 de la fiche 260) : la bulle de
   * suite dans le fil de la mère (elle s'affiche dans la carte du travail), puis le message à la
   * même conversation, comme si l'utilisateur l'y écrivait (sans provenance, sans réveil de la
   * mère). Seulement un travail qui a sa carte (bulle, proposition, fiche 264) et un rôle, d'une mère et d'un travail non archivés. Un
   * travail qui n'a jamais reçu son premier message (démarrage raté) repart comme au lancement :
   * consigne du rôle, lecture seule, travail dans le dossier. `retry` (« Relancer », fiche 267,
   * recette N9) : la demande est déjà dans la carte, pas de nouvelle bulle.
   */
  reply(
    motherId: string,
    childId: string,
    text: string,
    options: { retry?: true } = {}
  ): 'queued' | 'sent' {
    const body = text.trim()
    if (!body) throw new Error(t('children.error.emptyPrompt'))
    const mother = this.conversations.state().conversations.find((c) => c.id === motherId)
    const child = this.conversations.state().conversations.find((c) => c.id === childId)
    // Un relecteur d'avant la fiche 265 n'a pas de carte : refusé comme un travail sans carte.
    if (
      !mother ||
      !child ||
      child.startedFrom?.id !== motherId ||
      !child.role ||
      !this.hasCard(motherId, childId)
    ) {
      throw new Error(t('workCard.error.gone'))
    }
    if (mother.archived || child.archived) throw new Error(t('children.error.archived'))
    // « Relancer » seulement ce qui a échoué, s'est arrêté ou n'a pas répondu (revue QA, fiche 267).
    if (options.retry && !this.retryable(motherId, child))
      throw new Error(t('workCard.error.notRetryable'))
    const { mcp: _mcp, ...role } = child.role
    const fresh = !this.conversations.view(childId).transcript.items.some((i) => i.kind === 'user')
    // Le rôle d'aujourd'hui, avec la lecture seule du lancement (« Juste un avis », fiche 262).
    const snapshot =
      fresh && !child.reviewOf
        ? { ...this.findRole(motherId, role.name), ...(role.readOnly ? { readOnly: true } : {}) }
        : undefined
    if (!options.retry) {
      this.conversations.post(motherId, {
        type: 'role-request',
        request: {
          requestId: randomUUID(),
          text: body,
          works: [{ childId, role }],
          followUp: true,
          at: Date.now()
        }
      })
    }
    if (snapshot) return this.relaunch(child, body, snapshot)
    // Code reviewer qui n'a pas démarré (fiche 265) : son premier message, consigne de relecture
    // comprise ; jamais la demande seule.
    if (fresh && child.reviewOf) {
      void this.reviews.relaunch(childId, body).catch((error: unknown) => {
        this.conversations.post(childId, {
          type: 'notice',
          level: 'error',
          message: { key: 'children.notice.messageFailed', params: { error: messageOf(error) } }
        })
      })
      return 'sent'
    }
    const fail = () =>
      this.conversations.post(motherId, {
        type: 'notice',
        level: 'error',
        message: { key: 'workCard.notice.replyFailed', params: { role: role.label } }
      })
    return this.deliver(child, body, undefined, fail)
  }

  /** Premier message d'un travail qui n'a pas démarré, refait comme au lancement (`launch`). */
  private relaunch(
    child: ConversationSummary,
    text: string,
    role: RoleSnapshot
  ): 'queued' | 'sent' {
    this.sending.add(child.id)
    this.conversations.holdStarting(child.id, true)
    let launched = () => {}
    this.launching.set(child.id, new Promise<void>((resolve) => (launched = resolve)))
    const inPlace = !role.readOnly && !child.branch
    void this.launch(child, text, { model: undefined, role, inPlace }, () => {
      launched()
      this.launching.delete(child.id)
    })
    return 'sent'
  }

  /** Liste changée (fille archivée…) : le réveil groupé revoit les mères qui attendent. */
  listChanged(): void {
    this.waking.listChanged()
  }

  /** Conversation supprimée. */
  forget(id: string): void {
    const held = this.held.get(id)?.length
    if (held)
      log.warn(
        `${held} compte(s) rendu(s) écarté(s) : conversation mère ${id.slice(0, 8)} supprimée`
      )
    this.held.delete(id)
    this.parentMessages.delete(id)
    this.sending.delete(id)
    this.waking.forget(id)
    this.reviews.forget(id)
    this.readOnly.forget(id)
  }

  /** Mère qui attend ses filles. */
  holds(id: string): boolean {
    return this.waking.holds(id)
  }

  /**
   * À ne pas évincer (option `keepLive` du gestionnaire, fiche 043) : une mère qui attend ses
   * filles, une fille en cours (son agent démarre, travaille, attend un accord ou une réponse), une
   * conversation dont le message envoyé par ce module n'est pas encore parti.
   */
  keepLive(id: string): boolean {
    if (this.waking.holds(id) || this.sending.has(id)) return true
    const child = this.conversations.state().conversations.find((c) => c.id === id)
    if (!child?.startedFrom) return false
    const state = childState(child, this.attention()[id])
    return state === 'running' || state === 'waiting'
  }

  /** Message d'une autre conversation : file d'attente si l'agent répond, sinon envoyé. */
  private deliver(
    target: ConversationSummary,
    text: string,
    from?: MessageOrigin,
    /** Échec de l'envoi, dit aussi ailleurs (« Répondre », dans le fil de la mère, fiche 263). */
    failed?: () => void
  ): 'queued' | 'sent' {
    // Prête ou arrêtée (relancée pour l'occasion) : le message part tout de suite ; sinon il attend
    // la fin de la réponse, ou la consigne d'une fille qui démarre.
    const launching = this.launching.get(target.id)
    const queued = !!launching || (target.status !== 'ready' && target.status !== 'stopped')
    this.sending.add(target.id)
    // Rôle en lecture seule au repos : empreinte du dossier avant l'envoi (en file d'attente, elle
    // se prend au départ du tour).
    const send = () =>
      (queued ? Promise.resolve() : this.readOnly.prepare(target.id)).then(() =>
        this.conversations.prompt(target.id, text, [], from ? { from } : {})
      )
    // `prompt` se résout à la fin du tour : rien à attendre ici. Un échec est dit dans le fil visé.
    void (launching ? launching.then(send) : send()).catch((error: unknown) => {
      this.sending.delete(target.id)
      this.readOnly.unprepare(target.id)
      this.conversations.post(target.id, {
        type: 'notice',
        level: 'error',
        message: { key: 'children.notice.messageFailed', params: { error: messageOf(error) } }
      })
      failed?.()
    })
    return queued ? 'queued' : 'sent'
  }

  /** Toutes les filles attendues ont fini : la mère reçoit leurs comptes rendus. */
  private wake(motherId: string): void {
    log.info(`Conversation mère réveillée (${motherId.slice(0, 8)}) : ses filles ont fini`)
    this.sending.add(motherId)
    this.conversations
      .prompt(motherId, WAKE_TEXT, [], { from: { kind: 'wake' } })
      .catch((error) => {
        this.sending.delete(motherId)
        log.warn('Réveil de la conversation mère impossible :', error)
      })
  }

  /**
   * Démarrage de l'agent de la fille, modèle choisi, puis la consigne. `launched` : la consigne
   * est partie (ou n'a pas pu partir) ; les messages qui l'attendaient peuvent suivre.
   */
  private async launch(
    child: ConversationSummary,
    text: string,
    {
      model,
      role,
      inPlace
    }: { model: ChildRequest['model']; role: RoleSnapshot | undefined; inPlace: boolean },
    launched: () => void
  ): Promise<void> {
    const childId = child.id
    try {
      if (model || role) await this.conversations.ready(childId)
      if (model) await applyModel(this.conversations, childId, model)
      // Rôle (fiche 223) : mode natif si l'agent l'a, sinon sa consigne en tête du message.
      const found = role && this.nativeRoleMode?.(child.profileId, role, childId)
      // Mode installé qui ne correspond plus au rôle (fiche 262) : jamais posé, et dit.
      if (found?.stale) {
        this.conversations.post(childId, {
          type: 'notice',
          level: 'warning',
          message: { key: `roles.notice.installedStale.${found.stale}`, params: { mode: found.id } }
        })
      }
      const installed = found && !found.stale ? found : undefined
      const opening = role
        ? await roleFirstMessage(this.conversations, child, role, text, installed)
        : text
      // Sans branche (dépôt sans commit, fiche 262) : la fille ne committe pas.
      const first = inPlace ? `${opening}\n\n${IN_PLACE_LINE}` : opening
      // Lecture seule : l'empreinte du dossier avant que la consigne ne parte (garde-fou).
      if (role?.readOnly) await this.readOnly.prepare(childId)
      // Le tour de la fille ne se termine pas avant longtemps : `launch` n'est pas attendu.
      const turn = this.conversations.prompt(childId, first)
      launched()
      await turn
      // Envoi retenu sans tour (plafond de coût, fiche 157) : la fille n'est plus « démarre ».
      this.conversations.holdStarting(childId, false)
    } catch (error) {
      this.conversations.holdStarting(childId, false, true)
      launched()
      this.readOnly.unprepare(childId)
      // La consigne n'a pas pu partir (agent à connecter…) : rendue dans le fil de la fille, et
      // la mère le sait par un compte rendu en erreur (son agent ne l'attend plus). Mère ou fille
      // supprimées entre-temps (fiche 228) : lues maintenant, pas au lancement.
      this.sending.delete(childId)
      const current = this.conversations.state().conversations.find((c) => c.id === childId)
      // Fille supprimée pendant son lancement (mère supprimée avec ses filles juste après « Tout
      // lancer », chasse rc.4) : sa consigne a échoué parce qu'elle est partie ; plus de fil où le
      // dire, et sa mère (partie avec elle, ou qui l'a vue supprimer) n'attend plus de compte rendu.
      if (!current) {
        log.info(
          `Fille ${childId.slice(0, 8)} supprimée pendant son lancement : consigne abandonnée`
        )
        return
      }
      const reason = this.startFailure(childId) ?? messageOf(error)
      const motherId = current?.startedFrom?.id
      if (motherId) {
        this.conversations.post(motherId, {
          type: 'child-report',
          report: childReport(child, [], { error: reason })
        })
      }
      this.waking.finished(childId)
      this.conversations.post(childId, {
        type: 'notice',
        level: 'error',
        message: { key: 'children.notice.promptFailed', params: { error: reason, prompt: text } }
      })
    }
  }

  /** Pourquoi l'agent d'une fille n'a pas démarré, d'après son état ; `undefined` sinon. */
  private startFailure(childId: string): string | undefined {
    // Fille supprimée entre-temps : plus d'état à lire.
    if (!this.conversations.state().conversations.some((c) => c.id === childId)) return undefined
    const snapshot = this.conversations.view(childId).snapshot
    if (snapshot?.status === 'needs-action') return t('children.error.needsAction')
    if (snapshot?.status !== 'error' && snapshot?.status !== 'exited') return undefined
    return t('children.error.agentFailed', { detail: snapshot.detail ?? snapshot.status })
  }
}

/**
 * Avis demandé devant un dossier modifié (`readOnly`, fiche 240) : le rôle part en lecture seule
 * dans le dossier de la mère, qui voit tout ; seulement pour un rôle.
 */
function launchRole<R extends RoleSnapshot>(request: ChildRequest, role: R | undefined) {
  if (request.uncommitted !== 'readOnly') return role
  if (!role) throw new Error('Paramètre invalide : uncommitted')
  return { ...role, readOnly: true }
}

export { childHandlers } from './children-ipc'
