/**
 * Relecture avant fusion (fiche 177) : « Faire relire… » lance une conversation fille qui relit le
 * travail d'une autre, dans **son** dossier, sans worktree à elle, et rend ses remarques par
 * l'outil `report_findings` (`mcp/review-tools.ts`).
 *
 * - Le relecteur d'une fille est sa sœur (une fille n'a pas de fille, ADR-0019) ; celui d'une
 *   conversation ordinaire, sa fille. Il compte dans le plafond des filles (ADR-0020).
 * - Ce qui est relu : une branche de worktree depuis son point de départ (commits et modifications
 *   non commitées), sinon les modifications non commitées. Le point et les fichiers vont dans la
 *   consigne (`reviewBrief`).
 * - Lecture seule annoncée et vérifiée : une empreinte du dossier (HEAD, `git status`, `git diff`)
 *   est prise au départ et comparée à chaque fin de tour du relecteur ; un écart est signalé, rien
 *   n'est défait.
 * - Une seule carte par relecture dans le fil de l'auteur (élément `review`), remplacée à chaque
 *   étape : en cours, remarques rendues, fini sans remarques, échec.
 */
import { t } from 'i18next'
import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { join, relative, resolve, sep } from 'node:path'
import type { ConversationEvent, ConversationSummary } from '@shared/agent'
import { clip } from '@shared/children'
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
import type { Run } from '../simulator/run'
import { insideWorkspace } from '../changes/git'
import { log } from '../log'
import { hasFolder } from './agentless'
import type { ChildConversations, ChildRequest } from './children'
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
}

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
>

export interface ReviewDeps {
  conversations: ReviewHost
  children: Pick<ChildConversations, 'summary' | 'capacity' | 'modelAllowed'>
  /** git, par la file du dépôt (`gitRun`). */
  run: Run
}

/** Relecteur suivi depuis son lancement (perdu au redémarrage : seule l'empreinte manque alors). */
interface Watch {
  fingerprint?: string
  reported: boolean
}

const text = (buffer: Buffer) => buffer.toString('utf8')
const lines = (output: string) => output.split('\n').filter(Boolean)

export class ChildReviews {
  private readonly deps: ReviewDeps
  private readonly watching = new Map<string, Watch>()

  constructor(deps: ReviewDeps) {
    this.deps = deps
  }

  /** Lance le relecteur de `authorId` ; rend sa conversation (la conversation affichée ne change pas). */
  async start(authorId: string, request: ReviewRequest = {}): Promise<ConversationSummary> {
    const { children, conversations } = this.deps
    const author = children.summary(authorId)
    if (author.reviewOf) throw new Error(t('review.error.reviewer'))
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

    const target = await this.target(author)
    if (target.files.length === 0) throw new Error(t('review.error.nothing'))
    const fingerprint = await this.fingerprint(author.workspace).catch(() => undefined)
    const brief = reviewBrief(target, request.focus)
    const created = await conversations.createChild(motherId, brief, request.profileId, undefined, {
      of: author.id
    })
    conversations.rename(created.id, t('review.title', { title: author.title }))
    const reviewer = children.summary(created.id)
    this.watching.set(reviewer.id, { ...(fingerprint ? { fingerprint } : {}), reported: false })
    const review: Review = {
      reviewId: reviewer.id,
      title: reviewer.title,
      profileLabel: reviewer.profileLabel,
      scope: target.scope,
      ...(target.base ? { base: target.base.slice(0, 7) } : {}),
      ...(target.baseBranch ? { baseBranch: target.baseBranch } : {}),
      files: target.files.length,
      status: 'running',
      findings: [],
      at: Date.now()
    }
    conversations.post(author.id, { type: 'review', review })
    log.info(`Relecture lancée (${reviewer.id.slice(0, 8)}) de ${author.id.slice(0, 8)}`)
    void this.launch(reviewer.id, brief, request.model)
    return reviewer
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
    this.deps.conversations.post(authorId, { type: 'review', review })
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
    void this.afterTurn(reviewer, watch, error).catch((e: unknown) =>
      log.warn('Relecture : fin de tour non traitée :', messageOf(e))
    )
  }

  /** Conversation supprimée. */
  forget(id: string): void {
    this.watching.delete(id)
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
    if (watch.fingerprint) {
      const now = await this.fingerprint(author.workspace).catch(() => watch.fingerprint)
      if (now !== watch.fingerprint && !current.changed) {
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
    this.deps.conversations.post(authorId, { type: 'review', review: next })
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

  /** Démarrage, modèle choisi, puis la consigne ; un échec est dit sur la carte de l'auteur. */
  private async launch(
    reviewerId: string,
    brief: string,
    model: ReviewRequest['model']
  ): Promise<void> {
    const { conversations } = this.deps
    try {
      if (model) {
        await conversations.ready(reviewerId)
        await applyModel(conversations, reviewerId, model)
      }
      await conversations.prompt(reviewerId, brief)
    } catch (error) {
      const reviewer = this.deps.children.summary(reviewerId)
      const authorId = reviewer.reviewOf?.id
      if (!authorId) return
      const current = this.current(authorId, reviewerId) ?? this.fallback(reviewer)
      conversations.post(authorId, {
        type: 'review',
        review: { ...current, status: 'failed', error: messageOf(error) }
      })
    }
  }

  /** Ce qui est relu : la branche d'un worktree depuis son départ, sinon le non commité. */
  private async target(author: ConversationSummary): Promise<ReviewTarget> {
    const { workspace } = author
    const worktree = this.deps.conversations.worktreeOf(author.id)?.worktree
    const untracked = lines(
      text((await this.git(workspace, ['ls-files', '--others', '--exclude-standard'])).stdout)
    )
    if (worktree) {
      const merged = worktree.baseBranch
        ? await this.git(workspace, ['merge-base', 'HEAD', worktree.baseBranch])
        : undefined
      const base = merged?.code === 0 ? text(merged.stdout).trim() : worktree.base
      const changed = await this.git(workspace, ['diff', '--name-only', '--relative', base])
      if (changed.code === 0) {
        return {
          scope: 'branch',
          base,
          ...(worktree.baseBranch ? { baseBranch: worktree.baseBranch } : {}),
          files: unique([...lines(text(changed.stdout)), ...untracked]),
          authorTitle: author.title
        }
      }
    }
    const changed = await this.git(workspace, ['diff', '--name-only', '--relative', 'HEAD'])
    return {
      scope: 'uncommitted',
      files: unique([...(changed.code === 0 ? lines(text(changed.stdout)) : []), ...untracked]),
      authorTitle: author.title
    }
  }

  /**
   * Empreinte du dossier : HEAD, état, diff des fichiers suivis, taille et date des fichiers
   * nouveaux (leur contenu n'est pas dans le diff).
   */
  async fingerprint(workspace: string): Promise<string> {
    const hash = createHash('sha256')
    const head = await this.git(workspace, ['rev-parse', 'HEAD'])
    hash.update(head.stdout)
    const status = await this.git(workspace, ['status', '--porcelain=v1', '-z', '-uall', '--', '.'])
    if (status.code !== 0) throw new Error(status.stderr)
    hash.update(status.stdout)
    hash.update((await this.git(workspace, ['diff', 'HEAD', '--binary', '--', '.'])).stdout)
    const untracked = lines(
      text((await this.git(workspace, ['ls-files', '--others', '--exclude-standard'])).stdout)
    )
    for (const file of untracked) {
      const info = await stat(join(workspace, file)).catch(() => null)
      hash.update(`${file}\0${info?.size ?? -1}\0${info?.mtimeMs ?? -1}\0`)
    }
    return hash.digest('hex')
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

  private git(cwd: string, args: string[]) {
    return this.deps.run('git', args, { cwd, timeoutMs: 30_000 })
  }
}

const unique = (files: string[]) => [...new Set(files)]

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
  await conversations.setControl(childId, model.controlId, model.value).catch((error) => {
    // La fille part quand même, avec le modèle que l'agent a pris.
    log.warn('Modèle de la conversation fille non appliqué :', error)
  })
}
