import { randomUUID } from 'node:crypto'
/**
 * Petites fonctions du gestionnaire de conversations, sans état : délai borné, dépôt git, titre
 * tiré d'un message, suppression de la session d'une conversation vide. Sorties de `manager.ts`
 * pour lui faire de la place (fiche 097).
 */
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { t } from 'i18next'
import { stripAppContext } from '@shared/app-context'
import type {
  AgentEvent,
  AgentSessionView,
  AgentSnapshot,
  ConversationSummary
} from '@shared/agent'
import type { AgentHost } from '../agent/agent-host'
import { findExecutable, type AgentProfile } from '../agent/profiles'
import type { WorktreeInfo } from '../changes/worktrees'
import { log } from '../log'
import { MODE_CONTROL_ID } from '../agent/session-controls'
import { activeRules } from '../agent-config/rules'
import type { RuleFileView } from '@shared/rules'
import { hasFolder } from './agentless'
import type { ConversationRecord } from './store'

const TITLE_LENGTH = 60

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(t('conversations.error.timeout'))), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error)
      }
    )
  })
}

/** Le dossier est-il dans un dépôt git (un `.git` dans lui-même ou un parent) ? */
export function inGitRepo(path: string): boolean {
  let dir = path
  for (;;) {
    if (existsSync(join(dir, '.git'))) return true
    const parent = dirname(dir)
    if (parent === dir) return false
    dir = parent
  }
}

/**
 * Titre d'une conversation d'après son premier message : sa première ligne, raccourcie à un mot
 * entier (fiche 126 : le message de commit proposé reprend le titre).
 */
export function titleFrom(text: string): string {
  const line = text.trim().split('\n')[0] ?? ''
  if (line.length <= TITLE_LENGTH) return line || t('conversations.untitled')
  const cut = line.slice(0, TITLE_LENGTH - 1)
  const space = cut.lastIndexOf(' ')
  const words = space > TITLE_LENGTH / 2 ? cut.slice(0, space) : cut
  return `${words.replace(/[\s,;:.«-]+$/, '')}…`
}

/**
 * Titre proposé par l'agent (`session_info_update`), ou `undefined` pour garder l'actuel (fiche
 * 125) : un renommage, ou le titre posé par l'app (branche, bascule), ne sont pas remplacés ; ce que
 * l'app a joint au message (Bob titre d'après le début du premier message) est retiré, et s'il ne
 * reste rien, le titre ne change pas.
 */
export function agentTitle(
  record: Pick<ConversationRecord, 'titleSource'>,
  proposed: string
): string | undefined {
  if (record.titleSource === 'user' || record.titleSource === 'app') return undefined
  const clean = stripAppContext(proposed)
  return clean ? titleFrom(clean) : undefined
}

/** Titre proposé par l'agent dans un évènement (`session_info_update`), s'il est à prendre. */
export function proposedTitle(
  record: Pick<ConversationRecord, 'titleSource'>,
  event: AgentEvent
): string | undefined {
  const update = event.type === 'update' ? event.update : undefined
  return update?.sessionUpdate === 'session_info_update' && update.title
    ? agentTitle(record, update.title)
    : undefined
}

/** Agent sorti ou en erreur : noté au journal (le statut vient de changer). */
export function warnIfStopped(
  record: Pick<ConversationRecord, 'profileId' | 'id'>,
  { status, detail }: AgentSnapshot
): void {
  if (status === 'exited' || status === 'error') {
    log.warn(`Agent ${record.profileId} (${record.id}) : ${status}`, detail ?? '')
  }
}

/**
 * Conversation vide (jamais écrite) abandonnée : sa session est supprimée chez l'agent s'il le
 * permet, puis l'agent est arrêté. Sinon chaque lancement de l'app, et chaque changement d'agent
 * ou de dossier avant le premier message, laisserait une session vide dans son historique (Bob
 * 2.0.6 : une tâche sans titre). Au mieux, dans un temps borné ; un démarrage en cours est
 * attendu (sa session peut déjà exister chez l'agent).
 */
export async function dropDraftSession(host: AgentHost, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs
  const left = () => Math.max(0, deadline - Date.now())
  try {
    if (host.snapshot().status === 'starting') await withTimeout(host.start(), left())
    if (host.currentSessionId && host.sessionSupport.delete) {
      await withTimeout(host.deleteSession(), left())
    }
  } catch (error) {
    // L'agent refuse, ne répond plus ou a disparu : la session reste chez lui.
    log.warn(
      `Session de la conversation vide non supprimée chez ${host.snapshot().info.profileLabel} :`,
      error
    )
  } finally {
    host.stop()
  }
}

/** Ce que `summaryOf` lit d'une conversation du gestionnaire. */
interface Summarizable {
  record: ConversationRecord
  host?: AgentHost
  snapshot?: AgentSnapshot
  draft: boolean
}

/** Conversation telle que la barre latérale la liste. */
/** Enregistrement d'une nouvelle conversation (brouillon) : un identifiant neuf, daté de maintenant. */
export function draftRecord(
  profileId: string,
  workspace: string,
  title: string
): ConversationRecord {
  const now = new Date().toISOString()
  return {
    id: randomUUID(),
    title,
    titleSource: 'message',
    profileId,
    workspace,
    createdAt: now,
    updatedAt: now
  }
}

export function summaryOf(
  conversation: Summarizable,
  profiles: readonly Pick<AgentProfile, 'id' | 'label'>[],
  find: (id: string) => Summarizable | undefined,
  /** Dernière annonce de chaque agent (fiche 054) : sait-il supprimer une session ? */
  agentsSeen?: Record<string, { delete?: boolean }>
): ConversationSummary {
  const { record } = conversation
  const profile = profiles.find((p) => p.id === record.profileId)
  return {
    ...(agentsSeen?.[record.profileId]?.delete ? { agentDeletes: true } : {}),
    id: record.id,
    title: record.title,
    profileId: record.profileId,
    profileLabel: profile?.label ?? record.profileId,
    workspace: record.workspace,
    ...(record.additionalDirectories?.length
      ? { additionalDirectories: record.additionalDirectories }
      : {}),
    // Le dossier est le projet (fiche 131) : une conversation en worktree reste dans son dépôt.
    project: record.worktree?.root ?? record.workspace,
    updatedAt: record.updatedAt,
    createdAt: record.createdAt,
    status: conversation.host ? (conversation.snapshot?.status ?? 'starting') : 'stopped',
    draft: conversation.draft,
    ...(record.pinned ? { pinned: true } : {}),
    ...(record.worktree ? { branch: record.worktree.branch } : {}),
    ...(record.branchedFrom ? { branchedFrom: record.branchedFrom } : {}),
    ...motherOf(record, find),
    ...(record.reviewOf ? { reviewOf: record.reviewOf } : {}),
    ...(record.archived ? { archived: true } : {}),
    ...(record.scheduled ? { scheduled: record.scheduled } : {}),
    ...(record.usage ? { usage: record.usage } : {}),
    ...(record.memoryPending ? { memoryPending: record.memoryPending } : {})
  }
}

/** Lien vers la mère d'une fille (fiche 097), tant que la mère existe et n'est pas archivée. */
function motherOf(
  record: ConversationRecord,
  find: (id: string) => Summarizable | undefined
): Pick<ConversationSummary, 'startedFrom'> {
  const mother = record.startedFrom && find(record.startedFrom.id)
  if (!mother || mother.draft || mother.record.archived) return {}
  return { startedFrom: { id: mother.record.id, title: mother.record.title } }
}

/**
 * Départ d'une conversation qui démarre dans un worktree (fiches 110, 117), posé en tête de son fil :
 * d'où il part (branche, commit, date, sujet), et les modifications non commitées du dossier
 * d'origine qui n'y sont pas. La date est mise en forme à l'affichage, dans la langue de l'app.
 */
export function worktreeStartEvent(worktree: WorktreeInfo, now = new Date()): AgentEvent {
  const date = worktree.baseDate ? new Date(worktree.baseDate) : now
  return {
    type: 'worktree-start',
    start: {
      ...(worktree.baseBranch ? { branch: worktree.baseBranch } : {}),
      commit: worktree.base,
      date: (Number.isNaN(date.getTime()) ? now : date).toISOString(),
      ...(worktree.baseSubject ? { subject: worktree.baseSubject } : {}),
      ...(worktree.dirtyAtStart ? { dirty: worktree.dirtyAtStart } : {})
    }
  }
}

/** Avis « fil illisible mis de côté » (fiche 041) : les fichiers copiés à part. */
export function damagedTranscriptNotice(files: readonly string[]): AgentEvent {
  return {
    type: 'notice',
    level: 'warning',
    message: { key: 'conversations.notice.transcriptDamaged', params: { files: files.join(', ') } }
  }
}

/** Enregistrement d'une session de l'agent reprise dans l'historique (fiche 055). */
export function resumedRecord(
  id: string,
  profileId: string,
  session: AgentSessionView
): ConversationRecord {
  const now = new Date().toISOString()
  return {
    id,
    // Une session d'avant la fiche 125 a pu être titrée avec ce que l'app joint au message.
    title: titleFrom(stripAppContext(session.title ?? '') ?? ''),
    titleSource: 'agent',
    profileId,
    workspace: session.cwd,
    sessionId: session.sessionId,
    createdAt: session.updatedAt ?? now,
    // Reprise maintenant : en tête des « Récents ».
    updatedAt: now
  }
}

/**
 * `dropDraftSession` suivie dans `dropping` : en quittant, l'app l'attend au lieu de couper l'agent
 * en pleine suppression. Conversation vide quittée, ou rouverte avant le premier message (un autre
 * dossier ajouté, fiche 179 D14 : sinon l'ancienne session restait vide chez l'agent).
 */
export function trackDraftDrop(
  dropping: Set<Promise<void>>,
  host: AgentHost,
  timeoutMs: number
): void {
  const drop = dropDraftSession(host, timeoutMs).finally(() => dropping.delete(drop))
  dropping.add(drop)
}

/** Contextes joints au prochain message (bascule, fiche 108 ; filles, fiche 097), s'il y en a. */
export function joinContext(...contexts: (string | undefined)[]): string | undefined {
  return contexts.filter(Boolean).join('\n\n') || undefined
}

/**
 * Profil demandé, sinon (premier lancement, sans choix) le premier agent installé, Bob avant
 * OpenCode, sinon le premier proposé.
 */
export function profileOrDefault(
  profiles: readonly AgentProfile[],
  id: string | undefined,
  pathEnv: string | undefined
): AgentProfile {
  const found =
    profiles.find((p) => p.id === id) ??
    profiles.find((p) => findExecutable(p.command, pathEnv)) ??
    profiles[0]
  if (!found) throw new Error(t('conversations.error.noProfile'))
  return found
}

/** Dossier et agent d'où part une conversation (`createDetached`, worktree). */
export type Origin = Pick<ConversationRecord, 'workspace' | 'profileId'>

/** Conversation créée hors de l'active (`createDetached`). */
export interface DetachedRequest {
  /**
   * Dossier et agent de départ (la mère d'une fille, la tâche planifiée) ; `profileId`, s'il est
   * donné, choisit un autre agent.
   */
  from: Origin
  profileId?: string
  /** Dans un nouveau worktree du dossier de départ (fiche 036), sinon dans ce dossier. */
  worktree: boolean
  title: string
  /** Lien posé dans l'enregistrement : mère (fiche 097), relue (fiche 177), tâche planifiée (fiche 178). */
  record?: Pick<ConversationRecord, 'startedFrom' | 'reviewOf' | 'scheduled'>
  onCreated?: (summary: ConversationSummary) => void
}

/** Ce qui lie une fille à autre chose que sa mère : la conversation qu'elle relit (fiche 177). */
export interface ChildLink {
  /** Relecteur : identifiant de la conversation relue. */
  of?: string
}

/**
 * Création d'une fille de `mother` (fiche 097) : dans un nouveau worktree du dossier de la mère ;
 * relecteur (fiche 177) dans le dossier de la conversation relue, sans worktree à lui (le supprimer
 * ne supprime rien d'autre), avec l'agent demandé, sinon celui de l'auteur.
 */
export function childDetachedRequest(
  mother: ConversationRecord,
  author: ConversationRecord | undefined,
  request: { text: string; profileId?: string; onCreated?: DetachedRequest['onCreated'] }
): DetachedRequest {
  const { profileId, onCreated } = request
  return {
    from: author
      ? { workspace: author.workspace, profileId: profileId ?? author.profileId }
      : mother,
    ...(profileId ? { profileId } : {}),
    worktree: !author,
    title: titleFrom(request.text),
    record: {
      startedFrom: { id: mother.id, title: mother.title },
      ...(author ? { reviewOf: { id: author.id, title: author.title } } : {})
    },
    ...(onCreated ? { onCreated } : {})
  }
}

/**
 * Règles actives d'une conversation (fiche 056) : selon le profil et le mode actif. Les règles
 * peuvent changer d'une version de l'agent à l'autre : celle de son dernier démarrage (`version`).
 */
export async function rulesOf(
  workspace: string,
  profile: AgentProfile | undefined,
  snapshot: AgentSnapshot | undefined,
  version: string | undefined,
  agentHome: string | undefined
): Promise<RuleFileView[]> {
  const source = profile?.rules
  if (!profile || !source || !hasFolder(workspace)) return []
  const mode = snapshot?.controls.find((c) => c.id === MODE_CONTROL_ID)
  return activeRules(source, {
    workspace,
    home: agentHome ?? homedir(),
    ...(typeof mode?.currentValue === 'string' ? { mode: mode.currentValue } : {}),
    env: process.env,
    ...(version ? { version } : {})
  })
}

/** Une autre conversation (branche, fiche 023) travaille dans le même worktree. */
export function sharesWorktree(
  conversation: { record: ConversationRecord; draft: boolean },
  all: Iterable<{ record: ConversationRecord; draft: boolean }>
): boolean {
  const path = conversation.record.worktree?.path
  return (
    !!path &&
    [...all].some((c) => c !== conversation && !c.draft && c.record.worktree?.path === path)
  )
}
