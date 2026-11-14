/**
 * Espace Discussion (fiche 224) : chaque discussion a son dossier de documents, tenu par Bobine,
 * `<données>/discussions/<id>/`, à côté de `<données>/conversations/`. L'agent y travaille (ACP
 * exige un dossier) ; l'utilisateur n'y voit que des « documents » : les fichiers visibles du
 * premier niveau. Le dossier reste en place tant que la discussion est dans la corbeille ; il est
 * effacé avec elle.
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmdirSync,
  rmSync,
  statSync
} from 'node:fs'
import { basename, dirname, extname, join, relative } from 'node:path'
import { t } from 'i18next'
import type { AgentConfigureRequest, ConversationSpace } from '@shared/agent'
import type { DiscussionDocument } from '@shared/documents'
import type { AgentRef } from '@shared/handover'
import { emptyTranscript, type TranscriptState } from '@shared/transcript'
import { log } from '../log'
import { isDirectory } from '../agent/process-utils'
import { hasFolder, NO_FOLDER } from './agentless'
import { usableFolder } from './folder-fallback'
import { draftRecord } from './helpers'
import { SAFE_ID, type ConversationRecord } from './store'

/** Dossier des discussions, à côté de celui des conversations. */
export function discussionsRoot(conversationsDir: string): string {
  return join(dirname(conversationsDir), 'discussions')
}

/** Dossier d'une discussion ; identifiant refusé s'il n'est pas sûr. */
export function discussionFolder(conversationsDir: string, id: string): string {
  if (!SAFE_ID.test(id)) throw new Error(`Identifiant de conversation invalide : ${id}`)
  return join(discussionsRoot(conversationsDir), id)
}

/** Crée le dossier d'une discussion (vide) et le rend. */
export function createDiscussionFolder(conversationsDir: string, id: string): string {
  const folder = discussionFolder(conversationsDir, id)
  mkdirSync(folder, { recursive: true })
  return folder
}

/** Brouillon de discussion quitté sans message : son dossier part s'il est resté vide. */
export function dropEmptyDiscussionFolder(folder: string): void {
  try {
    rmdirSync(folder)
  } catch {
    // Pas vide (document déposé, trace de l'agent) ou déjà parti : laissé tel quel.
  }
}

/** Efface le dossier d'une discussion (corbeille vidée) ; rien hors de `discussions/`. */
export function eraseDiscussionFolder(conversationsDir: string, id: string): void {
  const folder = discussionFolder(conversationsDir, id)
  if (!existsSync(folder)) return
  rmSync(folder, { recursive: true, force: true })
  log.info(`Documents de la discussion effacés : ${id}`)
}

/** Les documents : fichiers visibles du premier niveau, les plus récents d'abord. */
export function listDocuments(folder: string): DiscussionDocument[] {
  let names: string[]
  try {
    names = readdirSync(folder)
  } catch {
    return []
  }
  return names
    .filter((name) => !name.startsWith('.'))
    .flatMap((name) => {
      try {
        const stat = statSync(join(folder, name))
        return stat.isFile()
          ? [{ name, size: stat.size, modifiedAt: stat.mtime.toISOString() }]
          : []
      } catch {
        return []
      }
    })
    .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt) || a.name.localeCompare(b.name))
}

/** Nom libre dans `folder` : `nom.ext`, sinon `nom (2).ext`, `nom (3).ext`… */
export function freeName(folder: string, name: string): string {
  const ext = extname(name)
  const stem = name.slice(0, name.length - ext.length)
  let candidate = name
  for (let n = 2; existsSync(join(folder, candidate)); n++) candidate = `${stem} (${n})${ext}`
  return candidate
}

/**
 * Copie des fichiers dans les documents d'une discussion ; l'original n'est jamais touché. Un nom
 * déjà pris reçoit un numéro. Rend les noms donnés aux copies.
 */
export function addDocuments(folder: string, paths: readonly string[]): string[] {
  mkdirSync(folder, { recursive: true })
  return paths.flatMap((path) => {
    if (!statSync(path).isFile()) return []
    const name = freeName(folder, basename(path))
    copyFileSync(path, join(folder, name))
    return [name]
  })
}

/** Chemin d'un document de la discussion ; refusé s'il sort du dossier ou est caché. */
export function documentPath(folder: string, name: string): string {
  if (name !== basename(name) || name.startsWith('.') || name.length === 0) {
    throw new Error(`Document invalide : ${name}`)
  }
  return join(folder, name)
}

/** Empreinte des documents (nom → taille et date) : ce qu'un tour a créé ou modifié. */
export function documentsFingerprint(folder: string): Map<string, string> {
  return new Map(listDocuments(folder).map((d) => [d.name, `${d.size}:${d.modifiedAt}`]))
}

/** Documents nouveaux ou modifiés entre deux empreintes. */
export function changedDocuments(
  before: ReadonlyMap<string, string>,
  after: ReadonlyMap<string, string>
): string[] {
  return [...after].filter(([name, mark]) => before.get(name) !== mark).map(([name]) => name)
}

/**
 * Espace d'une nouvelle conversation : celui demandé ; sinon, quand seul l'agent change (pas de
 * dossier demandé, profil demandé), celui de la conversation active ; l'espace Code sinon.
 */
export function spaceOf(
  request: AgentConfigureRequest,
  active: Pick<ConversationRecord, 'space'>
): ConversationSpace {
  if (request.space) return request.space
  const agentOnly = request.profileId !== undefined && request.workspace === undefined
  return agentOnly && active.space === 'discussion' ? 'discussion' : 'code'
}

/** Dossier hérité par une conversation de l'espace Code : jamais celui d'une discussion. */
export function inheritedFolder(
  active: Pick<ConversationRecord, 'space' | 'workspace'>,
  settings: { workspace?: string | undefined }
): string {
  return active.space === 'discussion' ? (settings.workspace ?? NO_FOLDER) : active.workspace
}

/** Dossier d'une nouvelle conversation : espace, dossier voulu, dossier retenu. */
export interface FolderPlan {
  discussion: boolean
  wanted: string
  workspace: string
}

/**
 * Dossier d'une nouvelle conversation (fiche 224 pour l'espace) : demandé, sinon celui du réglage
 * « Nouvelle conversation » (rien de demandé), sinon hérité. Dossier demandé introuvable : refusé.
 * Hérité et disparu (worktree nettoyé, 0.9.1, D21) : un dossier qui existe (`usableFolder`).
 */
export function folderPlan(
  request: AgentConfigureRequest,
  active: Pick<ConversationRecord, 'space' | 'workspace'>,
  settings: {
    workspace?: string | undefined
    newConversation?: { workspace?: string } | undefined
  },
  fallbacks: (string | undefined)[]
): FolderPlan {
  const fresh = request.profileId === undefined && request.workspace === undefined
  const defaults = fresh ? settings.newConversation : undefined
  const discussion = spaceOf(request, active) === 'discussion'
  const wanted = request.workspace ?? defaults?.workspace ?? inheritedFolder(active, settings)
  if (!discussion && request.workspace !== undefined && hasFolder(wanted) && !isDirectory(wanted))
    throw new Error(t('conversations.error.folderMissing', { folder: wanted }))
  return { discussion, wanted, workspace: usableFolder(wanted, fallbacks).workspace }
}

/** Le brouillon actif est déjà la conversation demandée (même agent, même espace et dossier). */
export function sameDraft(
  active: Pick<ConversationRecord, 'space' | 'workspace' | 'profileId'>,
  profileId: string,
  plan: FolderPlan
): boolean {
  if (active.profileId !== profileId) return false
  if (plan.discussion) return active.space === 'discussion'
  return active.space !== 'discussion' && active.workspace === plan.workspace
}

/** Brouillon de discussion, dans son dossier neuf. */
export function discussionDraft(profileId: string, conversationsDir: string): ConversationRecord {
  const record = draftRecord(profileId, NO_FOLDER, t('conversations.newDiscussionTitle'))
  return {
    ...record,
    workspace: createDiscussionFolder(conversationsDir, record.id),
    space: 'discussion'
  }
}

/**
 * Fil d'une conversation qui continue une discussion dans un projet (fiche 224) : les éléments de
 * la discussion, puis une bascule (`handover`, raison `discussion`) ; l'échange d'avant elle part
 * en texte avec le premier message (`handoverContext`).
 */
export function continuedTranscript(source: TranscriptState, agent: AgentRef): TranscriptState {
  const items = source.items.filter((item) => item.kind === 'user' || item.kind === 'agent')
  const nextId = items.reduce((max, item) => Math.max(max, item.id), 0) + 1
  return {
    ...emptyTranscript,
    items: [
      ...items,
      { kind: 'handover', id: nextId, from: agent, to: agent, reason: 'discussion' }
    ],
    nextId: nextId + 1
  }
}

/**
 * Dossier du brouillon qui remplace une conversation de l'espace Code supprimée (`gone`) ou
 * archivée : le sien ; supprimée en worktree, le dépôt principal (même sous-dossier) ; disparu, le
 * dossier par défaut, sinon aucun (fiche 093).
 */
export function nextFolder(
  record: Pick<ConversationRecord, 'workspace' | 'worktree'>,
  gone: boolean,
  defaultWorkspace: string | undefined
): string {
  const { workspace, worktree } = record
  if (!gone) return workspace
  const next = worktree ? join(worktree.root, relative(worktree.path, workspace)) : workspace
  return isDirectory(next) ? next : (defaultWorkspace ?? NO_FOLDER)
}
