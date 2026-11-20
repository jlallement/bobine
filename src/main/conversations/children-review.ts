/**
 * Relecture avant fusion (fiche 177), par le rôle Code reviewer (fiche 265) : « Faire relire… »
 * lance une conversation fille qui relit le travail d'une autre, dans **son** dossier, sans
 * worktree à elle, et rend ses remarques par l'outil `report_findings` (`mcp/review-tools.ts`).
 *
 * - Le relecteur d'une fille est sa sœur (une fille n'a pas de fille, ADR-0019) ; celui d'une
 *   conversation ordinaire, sa fille. Il compte dans le plafond des filles (ADR-0020).
 * - C'est le rôle `code-reviewer` (fiche 265, un seul chemin) : dans le fil de sa mère, une bulle
 *   « @Code reviewer Relis … » (`role-request`, avec le travail relu) et son lancement, donc une
 *   carte-réponse comme tout rôle (fiche 263) ; sa réponse lui part comme celle de tout travail, avec
 *   ses remarques. Dans son propre fil, la consigne de relecture est repliée avec celle du rôle.
 * - Ce qui est relu : une branche de worktree depuis son point de départ (commits et modifications
 *   non commitées), sinon les modifications non commitées. Le point et les fichiers vont dans la
 *   consigne (`reviewBrief`).
 * - Lecture seule annoncée et vérifiée : une empreinte du dossier (HEAD, `git status`, `git diff`)
 *   est prise au départ de chaque tour et comparée à sa fin ; un écart est signalé, rien n'est
 *   défait.
 * - Une seule carte par relecture (élément `review`), remplacée à chaque étape : dans le fil de la
 *   conversation relue (remarques de diff), et dans celui de la mère quand c'est une autre (carte du
 *   Code reviewer).
 */
import { t } from 'i18next'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { relative, resolve, sep } from 'node:path'
import type { ConversationEvent, ConversationSummary } from '@shared/agent'
import { childReport, clip } from '@shared/children'
import { messageOf } from '@shared/errors'
import type { TranscriptItem } from '@shared/transcript'
import { usageDigest } from '@shared/usage'
import {
  FINDING_CODE_LINES,
  REVIEW_REPLY_CHARS,
  parseFindings,
  reviewBrief,
  type ParsedFinding,
  type Review,
  type ReviewFinding,
  type ReviewTarget
} from '@shared/review'
import type { IpcHandlers } from '@shared/ipc'
import { roleBadge, roleStamp, type RoleSnapshot } from '@shared/roles'
import type { RoleRequest } from '@shared/role-request'
import { builtinRoles } from '../roles/builtin'
import { roleFirstMessage } from '../roles/launch'
import type { Run } from '../simulator/run'
import { insideWorkspace } from '../changes/git'
import { log } from '../log'
import { hasFolder } from './agentless'
import type { ChildConversations, ChildRequest } from './children'
import { folderFingerprint } from './folder-fingerprint'
import { reviewTarget } from './review-target'
import { inGitRepo } from './helpers'
import type { ConversationManager } from './manager'

/** Ce que demande « Faire relire… ». */
export interface ReviewRequest {
  /** Points à surveiller, ajoutés à la consigne. */
  focus?: string
  /** Agent du relecteur ; absent : celui de la conversation relue. */
  profileId?: string
  /** Modèle (réglage de catégorie `model` de l'auteur), seulement si le profil le permet. */
  model?: ChildRequest['model']
  /**
   * `@code-reviewer` tapé dans la saisie (fiche 265) : la bulle du message, partagée avec les
   * autres rôles cités (complétée en place), et la portée choisie d'office (`reviewTarget`, `auto`).
   */
  ask?: RoleRequest
}

/** Points à surveiller gardés avec la relecture, au plus. */
const FOCUS_KEEP_CHARS = 4_000

export type ReviewHost = Pick<
  ConversationManager,
  | 'state'
  | 'view'
  | 'createChild'
  | 'ready'
  | 'prompt'
  | 'setControl'
  | 'post'
  | 'rename'
  | 'worktreeOf'
  | 'settingsView'
>

export interface ReviewDeps {
  conversations: ReviewHost
  children: Pick<ChildConversations, 'summary' | 'capacity' | 'modelAllowed' | 'findRole'>
  /** git, par la file du dépôt (`gitRun`). */
  run: Run
}

/** Relecteur suivi depuis son lancement (perdu au redémarrage : seule l'empreinte manque alors). */
interface Watch {
  /** Empreinte du dossier au départ du tour (`undefined` : pas pu la prendre). */
  baseline?: Promise<string | undefined>
  reported: boolean
  /**
   * Premier tour pas encore commencé : son empreinte est celle du lancement. Aux tours suivants
   * (« Répondre à Code reviewer »), elle est reprise à leur départ : l'auteur a pu corriger entre-
   * temps, ce n'est pas le relecteur.
   */
  first?: true
  /** Premier message (rôle et consigne), pour « Relancer » un relecteur qui n'a pas démarré. */
  opening?: string
}

/** Nom du rôle intégré qui relit (fiche 265). */
export const REVIEWER_ROLE = 'code-reviewer'

export class ChildReviews {
  private readonly deps: ReviewDeps
  private readonly watching = new Map<string, Watch>()
  /** Fins de tour en cours de traitement, par relecteur. */
  private readonly settling = new Map<string, Promise<void>>()

  constructor(deps: ReviewDeps) {
    this.deps = deps
  }

  /**
   * Lance le relecteur de `authorId` : le rôle Code reviewer (fiche 265), sa bulle et sa carte dans
   * le fil de sa mère ; rend sa conversation (la conversation affichée ne change pas).
   */
  async start(authorId: string, request: ReviewRequest = {}): Promise<ConversationSummary> {
    const { children, conversations } = this.deps
    const author = children.summary(authorId)
    if (author.reviewOf) throw new Error(t('review.error.reviewer'))
    // Depuis la saisie, comme tout `@rôle` : pas depuis la conversation d'un travail (ADR-0019).
    if (request.ask && author.startedFrom) throw new Error(t('children.error.oneLevel'))
    if (author.draft) throw new Error(t('children.error.draft'))
    if (author.archived) throw new Error(t('children.error.archived'))
    if (!hasFolder(author.workspace) || !inGitRepo(author.workspace))
      throw new Error(t('review.error.noGit'))
    if (author.status === 'busy') throw new Error(t('review.error.busy'))
    const profileId = request.profileId ?? author.profileId
    // Jamais de modèle choisi pour un profil qui ne le permet pas (fiche 160).
    if (request.model && !children.modelAllowed(profileId))
      throw new Error(t('children.error.modelNotAllowed'))
    const motherId = author.startedFrom?.id ?? author.id
    const { active, max } = children.capacity(motherId)
    if (active >= max) throw new Error(t('children.limit', { count: max }))

    const target = await this.target(author, !!request.ask)
    if (target.files.length === 0) throw new Error(t('review.error.nothing'))
    const fingerprint = await this.fingerprint(author.workspace).catch(() => undefined)
    const role = this.reviewerRole(motherId)
    const asked = askText(author, target, request.focus)
    const brief = reviewBrief(target, request.focus)
    const created = await conversations.createChild(motherId, asked, request.profileId, undefined, {
      of: author.id,
      role: roleStamp(role)
    })
    conversations.rename(created.id, t('review.title', { title: author.title }))
    const reviewer = children.summary(created.id)
    this.watching.set(reviewer.id, {
      baseline: Promise.resolve(fingerprint),
      reported: false,
      first: true
    })
    // La demande dans le fil de la mère (fiche 265) : la bulle, puis le lancement qui la nomme ;
    // la carte-réponse du Code reviewer se lit de ces deux éléments (fiche 263). Depuis la saisie,
    // la bulle du message (ce que l'utilisateur a tapé), complétée de ce travail.
    const work = { childId: reviewer.id, role: roleBadge(role), review: { of: author.id } }
    const ask: RoleRequest = request.ask ?? {
      requestId: randomUUID(),
      text: asked,
      works: [],
      at: Date.now()
    }
    ask.works = [...ask.works, work]
    conversations.post(motherId, { type: 'role-request', request: { ...ask } })
    conversations.post(motherId, {
      type: 'child-started',
      child: {
        childId: reviewer.id,
        title: reviewer.title,
        prompt: asked,
        role: roleBadge(role),
        request: ask.requestId,
        at: Date.now()
      }
    })
    const review: Review = {
      reviewId: reviewer.id,
      authorId: author.id,
      title: reviewer.title,
      profileLabel: reviewer.profileLabel,
      scope: target.scope,
      ...(target.base ? { base: target.base.slice(0, 7) } : {}),
      ...(target.baseBranch ? { baseBranch: target.baseBranch } : {}),
      files: target.files.length,
      status: 'running',
      findings: [],
      ...(request.focus?.trim() ? { focus: clip(request.focus.trim(), FOCUS_KEEP_CHARS) } : {}),
      at: Date.now()
    }
    this.post(reviewer, author.id, review)
    log.info(`Relecture lancée (${reviewer.id.slice(0, 8)}) de ${author.id.slice(0, 8)}`)
    void this.launch(reviewer, { role, asked, brief }, request.model)
    return reviewer
  }

  /**
   * Le rôle Code reviewer de la mère (celui du projet s'il le remplace) ; désactivé ou absent :
   * celui de Bobine. Toujours en lecture seule : une relecture ne modifie rien (fiche 177).
   */
  private reviewerRole(motherId: string): RoleSnapshot {
    let role: RoleSnapshot | undefined
    try {
      role = this.deps.children.findRole(motherId, REVIEWER_ROLE)
    } catch {
      role = builtinRoles().find((r) => r.name === REVIEWER_ROLE)
    }
    if (!role) throw new Error(t('review.error.noRole'))
    return { ...role, readOnly: true }
  }

  /**
   * Carte de la relecture : dans le fil de la conversation relue (remarques de diff, fiche 177), et
   * dans celui de la mère du relecteur quand c'est une autre conversation (sa carte, fiche 265).
   */
  private post(
    reviewer: Pick<ConversationSummary, 'startedFrom'>,
    authorId: string,
    review: Review
  ): void {
    const { conversations } = this.deps
    conversations.post(authorId, { type: 'review', review })
    // Relecture d'avant (sans `authorId`) : dans le fil de la conversation relue seulement.
    const motherId = reviewer.startedFrom?.id
    if (review.authorId && motherId && motherId !== authorId) {
      conversations.post(motherId, { type: 'review', review })
    }
  }

  /** La conversation est-elle un relecteur ? (rôle pour les outils de l'app) */
  isReviewer(id: string): boolean {
    try {
      return !!this.deps.children.summary(id).reviewOf
    } catch {
      return false
    }
  }

  /**
   * `report_findings` : remarques vérifiées, code cité lu dans le fichier, posées sur la carte de
   * l'auteur. Rend le texte de la réponse à l'agent ; une erreur levée lui est renvoyée telle quelle.
   */
  async report(reviewerId: string, args: Record<string, unknown>): Promise<string> {
    const reviewer = this.deps.children.summary(reviewerId)
    if (!reviewer.reviewOf) throw new Error(t('review.error.notReviewer'))
    const { findings, summary } = parseFindings(args)
    const authorId = reviewer.reviewOf.id
    const author = this.deps.children.summary(authorId)
    const previous = this.current(authorId, reviewerId)
    const before = previous?.findings ?? []
    const checked = await Promise.all(
      findings.map((finding, i) =>
        this.withCode(author.workspace, finding, `${reviewerId}:${before.length + i + 1}`)
      )
    )
    const review: Review = {
      ...(previous ?? this.fallback(reviewer)),
      status: 'reported',
      findings: [...before, ...checked],
      ...(summary ? { summary } : {}),
      ...this.usage(reviewerId),
      at: Date.now()
    }
    this.post(reviewer, authorId, review)
    const watch = this.watching.get(reviewerId)
    if (watch) watch.reported = true
    else this.watching.set(reviewerId, { reported: true })
    return checked.length === 0
      ? `Recorded: nothing to report on "${author.title}". End your turn with a one- or two-sentence verdict.`
      : `${checked.length} finding(s) delivered to the user as comments on the diff of "${author.title}" ` +
          `(${review.findings.length} in all). The user decides which ones to send to the author. ` +
          'End your turn with a one- or two-sentence verdict; call report_findings again only for findings you have not reported yet.'
  }

  /**
   * Fin d'un tour d'un relecteur : empreinte comparée (un écart est signalé une fois), et la carte
   * de l'auteur dit si le tour s'est fini sans remarques, ou en échec.
   */
  onEvent(payload: ConversationEvent): void {
    const { conversationId, event } = payload
    if (event.type === 'user-message') {
      this.turnStarted(conversationId)
      return
    }
    if (event.type !== 'turn-end' && event.type !== 'turn-error') return
    let reviewer: ConversationSummary
    try {
      reviewer = this.deps.children.summary(conversationId)
    } catch {
      return
    }
    if (!reviewer.reviewOf) return
    const watch = this.watching.get(conversationId) ?? { reported: false }
    this.watching.set(conversationId, { ...watch, reported: false })
    const error = event.type === 'turn-error' ? event.message : undefined
    const done = this.afterTurn(reviewer, watch, error).catch((e: unknown) =>
      log.warn('Relecture : fin de tour non traitée :', messageOf(e))
    )
    this.settling.set(conversationId, done)
    void done.finally(() => {
      if (this.settling.get(conversationId) === done) this.settling.delete(conversationId)
    })
  }

  /** Fin de tour du relecteur traitée (empreinte comparée, carte à jour) ; essais. */
  settled(reviewerId: string): Promise<void> {
    return this.settling.get(reviewerId) ?? Promise.resolve()
  }

  /** Conversation supprimée. */
  forget(id: string): void {
    this.watching.delete(id)
  }

  /**
   * Un tour du relecteur commence : le premier garde l'empreinte prise au lancement ; un suivant
   * (« Répondre à Code reviewer », fiche 265) part de l'état du dossier à ce moment-là — l'auteur a
   * pu corriger entre-temps. Aussi après un redémarrage, où le suivi était perdu.
   */
  private turnStarted(id: string): void {
    const watch = this.watching.get(id)
    if (watch?.first) {
      delete watch.first
      return
    }
    let workspace: string
    try {
      const reviewer = this.deps.children.summary(id)
      if (!reviewer.reviewOf) return
      workspace = this.deps.children.summary(reviewer.reviewOf.id).workspace
    } catch {
      return
    }
    // Attendue par la fin du tour : un agent rapide ne fait pas sauter la vérification.
    this.watching.set(id, {
      ...(watch ?? { reported: false }),
      baseline: this.fingerprint(workspace).catch(() => undefined)
    })
  }

  private async afterTurn(
    reviewer: ConversationSummary,
    watch: Watch,
    error: string | undefined
  ): Promise<void> {
    const authorId = reviewer.reviewOf?.id
    if (!authorId) return
    let author: ConversationSummary
    try {
      author = this.deps.children.summary(authorId)
    } catch {
      return // Conversation relue supprimée : plus de carte où écrire.
    }
    const current = this.current(authorId, reviewer.id) ?? this.fallback(reviewer)
    let next: Review = current
    const before = await watch.baseline
    if (before) {
      const now = await this.fingerprint(author.workspace).catch(() => before)
      if (now !== before && !current.changed) {
        next = { ...next, changed: true }
        this.deps.conversations.post(reviewer.id, {
          type: 'notice',
          level: 'warning',
          message: { key: 'review.notice.changed' }
        })
      }
    }
    if (!watch.reported && current.status === 'running') {
      // Relecture rendue en texte libre (agent qui n'appelle pas l'outil) : sa réponse reste sur la
      // carte, pour ne pas la perdre.
      const reply = turnReply(this.deps.conversations.view(reviewer.id).transcript.items)
      next = {
        ...next,
        ...(error ? { status: 'failed', error } : { status: 'silent' }),
        ...(reply ? { reply: clip(reply, REVIEW_REPLY_CHARS) } : {})
      }
    }
    // Le coût suit chaque tour, même sans autre changement.
    next = { ...next, ...this.usage(reviewer.id) }
    this.post(reviewer, authorId, next)
  }

  /** Coût du relecteur selon son fil, à joindre à la carte. */
  private usage(reviewerId: string): Pick<Review, 'usage'> {
    const digest = usageDigest(this.deps.conversations.view(reviewerId).transcript.usage)
    return digest ? { usage: digest } : {}
  }

  /** Carte actuelle de cette relecture dans le fil de l'auteur. */
  private current(authorId: string, reviewId: string): Review | undefined {
    const item = this.deps.conversations
      .view(authorId)
      .transcript.items.findLast((i) => i.kind === 'review' && i.reviewId === reviewId)
    if (item?.kind !== 'review') return undefined
    const { kind: _kind, id: _id, ...review } = item
    return review
  }

  /** Carte refaite quand le fil de l'auteur ne l'a plus (fil vidé, relecture d'avant). */
  private fallback(reviewer: ConversationSummary): Review {
    return {
      reviewId: reviewer.id,
      title: reviewer.title,
      profileLabel: reviewer.profileLabel,
      scope: 'uncommitted',
      files: 0,
      status: 'running',
      findings: [],
      at: Date.now()
    }
  }

  /**
   * Démarrage, modèle choisi, puis le premier message : la demande, avec la consigne du rôle et
   * celle de la relecture dans le bloc du rôle (repliées dans son fil, fiche 265). Un échec est dit
   * sur la carte de l'auteur, et dans le fil de la mère comme pour tout travail.
   */
  private async launch(
    reviewer: ConversationSummary,
    opening: { role: RoleSnapshot; asked: string; brief: string },
    model: ReviewRequest['model']
  ): Promise<void> {
    const { conversations } = this.deps
    const reviewerId = reviewer.id
    try {
      await conversations.ready(reviewerId)
      if (model) await applyModel(conversations, reviewerId, model)
      const { role, asked, brief } = opening
      const first = await roleFirstMessage(
        conversations,
        reviewer,
        { ...role, prompt: `${role.prompt.trim()}\n\n${brief}` },
        asked
      )
      const watch = this.watching.get(reviewerId)
      if (watch) watch.opening = first
      await conversations.prompt(reviewerId, first)
    } catch (error) {
      this.failed(reviewerId, messageOf(error))
    }
  }

  /** Le premier message n'a pas pu partir : la carte de l'auteur et celle de la mère le disent. */
  private failed(reviewerId: string, message: string): void {
    let reviewer: ConversationSummary
    try {
      reviewer = this.deps.children.summary(reviewerId)
    } catch {
      return // Relecteur supprimé entre-temps.
    }
    const authorId = reviewer.reviewOf?.id
    if (!authorId) return
    const current = this.current(authorId, reviewerId) ?? this.fallback(reviewer)
    this.post(reviewer, authorId, { ...current, status: 'failed', error: message })
    const motherId = reviewer.startedFrom?.id
    if (motherId && current.authorId) {
      this.deps.conversations.post(motherId, {
        type: 'child-report',
        report: childReport(reviewer, [], { error: message })
      })
    }
  }

  /**
   * « Relancer » un relecteur dont le premier message n'est jamais parti (fiche 263) : le même
   * premier message (rôle et consigne), sinon (redémarrage) la consigne refaite, avec la même portée
   * et les points à surveiller gardés sur sa carte ; `asked` : la demande de la bulle.
   */
  async relaunch(reviewerId: string, asked: string): Promise<void> {
    const reviewer = this.deps.children.summary(reviewerId)
    const author = reviewer.reviewOf ? this.deps.children.summary(reviewer.reviewOf.id) : undefined
    if (!author) throw new Error(t('review.error.notReviewer'))
    const watch = this.watching.get(reviewerId) ?? { reported: false }
    const fingerprint = await this.fingerprint(author.workspace).catch(() => undefined)
    this.watching.set(reviewerId, {
      ...watch,
      baseline: Promise.resolve(fingerprint),
      reported: false,
      first: true
    })
    if (watch.opening) {
      void this.deps.conversations
        .prompt(reviewerId, watch.opening)
        .catch((error: unknown) => this.failed(reviewerId, messageOf(error)))
      return
    }
    const kept = this.current(author.id, reviewerId)
    const target = await this.target(author, !!kept && kept.scope !== 'uncommitted')
    const role = this.reviewerRole(reviewer.startedFrom?.id ?? author.id)
    void this.launch(reviewer, { role, asked, brief: reviewBrief(target, kept?.focus) }, undefined)
  }

  /** Ce qui est relu (`review-target.ts`) ; `auto` : portée d'office de `@code-reviewer`. */
  private target(author: ConversationSummary, auto: boolean): Promise<ReviewTarget> {
    const worktree = this.deps.conversations.worktreeOf(author.id)?.worktree
    return reviewTarget(
      this.deps.run,
      { workspace: author.workspace, title: author.title, worktree },
      auto
    )
  }

  /** Empreinte du dossier (`folder-fingerprint.ts`). */
  fingerprint(workspace: string): Promise<string> {
    return folderFingerprint(this.deps.run, workspace)
  }

  /** Chemin vérifié (dans le dossier, rendu relatif) et code cité, lu dans le fichier. */
  private async withCode(
    workspace: string,
    finding: ParsedFinding,
    id: string
  ): Promise<ReviewFinding> {
    let absolute: string
    try {
      absolute = insideWorkspace(workspace, finding.file)
    } catch {
      throw new Error(`\`${finding.file}\`: the path must be inside the reviewed folder`)
    }
    const file = relative(resolve(workspace), absolute).split(sep).join('/')
    const content = await readFile(absolute, 'utf8').catch(() => '')
    const last = Math.min(finding.endLine ?? finding.line, finding.line + FINDING_CODE_LINES - 1)
    const code = content
      .split('\n')
      .slice(finding.line - 1, last)
      .join('\n')
    return { ...finding, id, file, code }
  }
}

/**
 * La demande au Code reviewer, telle que la bulle la montre et que son premier message la porte
 * (fiche 265, maquette G) : « Relis la branche bobine/rayons-a3f2 », « Relis les modifications non
 * commitées (2 fichiers). », et les points à surveiller.
 */
export function askText(
  author: Pick<ConversationSummary, 'title' | 'branch' | 'startedFrom'>,
  target: Pick<ReviewTarget, 'scope' | 'files' | 'baseBranch' | 'branch' | 'base'>,
  focus?: string
): string {
  const count = target.files.length
  const branch = author.branch ?? target.branch
  const what =
    target.scope === 'commit' && target.base
      ? t('review.ask.commit', { commit: target.base.slice(0, 7), count })
      : target.scope === 'branch' && branch
        ? t('review.ask.branch', { branch, count })
        : author.startedFrom
          ? t('review.ask.uncommittedOf', { title: author.title, count })
          : t('review.ask.uncommitted', { count })
  const points = focus?.trim()
  return points ? `${what}\n\n${t('review.ask.focus', { focus: points })}` : what
}

/** Texte de l'agent depuis le dernier message reçu (tout le tour, coupé par ses outils). */
export function turnReply(items: readonly TranscriptItem[]): string {
  const start = items.findLastIndex((i) => i.kind === 'user')
  return items
    .slice(start + 1)
    .flatMap((i) => (i.kind === 'agent' ? [i.text] : []))
    .join('')
    .trim()
}

/** Canal IPC de « Faire relire… », branché par `ipc.ts`. Arguments du renderer vérifiés ici. */
export function reviewHandlers(
  reviews: Pick<ChildReviews, 'start'> | undefined
): Pick<IpcHandlers, 'conversation:startReview'> {
  return {
    'conversation:startReview': (id, request) => {
      if (!reviews) throw new Error(t('ipc.unavailable.children'))
      if (typeof id !== 'string' || !id) throw new Error('Paramètre invalide : id')
      return reviews.start(id, parseReviewRequest(request))
    }
  }
}

function parseReviewRequest(value: unknown): ReviewRequest {
  if (value === undefined) return {}
  if (typeof value !== 'object' || value === null) throw new Error('Requête invalide')
  const { focus, profileId, model } = value as Record<string, unknown>
  if (focus !== undefined && typeof focus !== 'string')
    throw new Error('Paramètre invalide : focus')
  if (profileId !== undefined && (typeof profileId !== 'string' || !profileId))
    throw new Error('Paramètre invalide : profileId')
  const choice =
    typeof model === 'object' && model !== null ? (model as Record<string, unknown>) : {}
  if (
    model !== undefined &&
    (typeof choice.controlId !== 'string' || typeof choice.value !== 'string')
  )
    throw new Error('Paramètre invalide : model')
  return {
    ...(typeof focus === 'string' && focus.trim() ? { focus } : {}),
    ...(typeof profileId === 'string' ? { profileId } : {}),
    ...(model !== undefined
      ? { model: { controlId: String(choice.controlId), value: String(choice.value) } }
      : {})
  }
}

/**
 * Le modèle choisi dans « Lancer en parallèle… » (ou « Faire relire… », fiche 177), s'il est
 * proposé et pas déjà en place.
 */
export async function applyModel(
  conversations: Pick<ConversationManager, 'view' | 'setControl'>,
  childId: string,
  model: { controlId: string; value: string }
): Promise<void> {
  const control = conversations
    .view(childId)
    .snapshot?.controls.find((c) => c.id === model.controlId)
  if (control?.type !== 'select' || control.currentValue === model.value) return
  if (!control.options.some((o) => o.value === model.value)) return
  // Pour cette fille seulement : le défaut du profil reste celui de l'utilisateur (fiche 223).
  await conversations
    .setControl(childId, model.controlId, model.value, { remember: false })
    .catch((error) => {
      // La fille part quand même, avec le modèle que l'agent a pris.
      log.warn('Modèle de la conversation fille non appliqué :', error)
    })
}
