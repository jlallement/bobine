/**
 * Espace Discussion (fiche 224) : chaque discussion a son dossier de documents, tenu par Bobine,
 * `<données>/discussions/<id>/`, à côté de `<données>/conversations/`. L'agent y travaille (ACP
 * exige un dossier) ; l'utilisateur n'y voit que des « documents » : les fichiers visibles du
 * premier niveau. Le dossier reste en place tant que la discussion est dans la corbeille ; il est
 * effacé avec elle.
 */
import {
  closeSync,
  constants,
  copyFileSync,
  existsSync,
  fstatSync,
  lstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  readSync,
  renameSync,
  rmSync,
  statSync,
  writeSync,
  type BigIntStats,
  type Stats
} from 'node:fs'
import { basename, dirname, extname, join, relative } from 'node:path'
import { t } from 'i18next'
import { APP_CONTEXT_OPENINGS } from '@shared/app-context'
import type { AgentConfigureRequest, ConversationSpace } from '@shared/agent'
import type { DiscussionDocument } from '@shared/documents'
import type { AgentRef } from '@shared/handover'
import { emptyTranscript, type TranscriptState } from '@shared/transcript'
import { log } from '../log'
import { sharesContent } from '../agent/hard-links'
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

/**
 * Dossier d'une discussion disparu (supprimé dans le Finder) : recréé, vide, avant que son agent
 * démarre — sinon l'agent refuse de s'ouvrir dans un dossier absent. Seulement le sien.
 */
export function ensureDiscussionFolder(
  conversationsDir: string,
  record: Pick<ConversationRecord, 'id' | 'space' | 'workspace'>
): void {
  if (record.space !== 'discussion' || !SAFE_ID.test(record.id)) return
  if (record.workspace !== discussionFolder(conversationsDir, record.id)) return
  if (existsSync(record.workspace)) return
  mkdirSync(record.workspace, { recursive: true })
  log.warn(`Dossier de discussion recréé (disparu) : ${record.id}`)
}

/** Crée le dossier d'une discussion (vide) et le rend. */
export function createDiscussionFolder(conversationsDir: string, id: string): string {
  const folder = discussionFolder(conversationsDir, id)
  mkdirSync(folder, { recursive: true })
  return folder
}

/**
 * Dossier d'une discussion qu'on peut retirer : exactement `discussions/<id>` (enfant direct, nom
 * sûr, pas un lien symbolique) et sans aucun document visible. Les traces de l'agent (`.bob/`)
 * ne comptent pas : Bob en crée dès son démarrage.
 */
function removableFolder(conversationsDir: string, id: string): string | undefined {
  if (!SAFE_ID.test(id)) return undefined
  const folder = discussionFolder(conversationsDir, id)
  try {
    if (!lstatSync(folder).isDirectory()) return undefined
  } catch {
    return undefined
  }
  return listDocuments(folder).length === 0 ? folder : undefined
}

/** Brouillon de discussion quitté sans message : son dossier part s'il n'a aucun document. */
export function dropDraftFolder(
  conversationsDir: string,
  record: Pick<ConversationRecord, 'id' | 'space' | 'workspace'>
): void {
  if (record.space !== 'discussion') return
  const folder = removableFolder(conversationsDir, record.id)
  // Seulement le dossier de cette discussion, jamais un autre qu'elle désignerait.
  if (folder && folder === record.workspace) removeDraftFolder(folder)
}

/** Délais des nouveaux essais (ms), puis le ménage du prochain démarrage (`sweepDiscussionFolders`). */
const DRAFT_REMOVAL_RETRIES = [200, 500, 1000, 2000, 4000]

/**
 * Supprime le dossier d'un brouillon. Sous Windows, le dossier courant d'un processus vivant ne se
 * supprime pas (`EPERM`, relevé sur `windows-latest`, fiche 229) : l'agent du brouillon est à peine
 * arrêté, et l'erreur faisait échouer « Nouvelle conversation ». Nouvel essai un peu plus tard,
 * sans jamais lever ; à défaut, le prochain démarrage l'emporte (dossier d'aucune conversation).
 * macOS et Linux : supprimé tout de suite, comme avant.
 */
function removeDraftFolder(folder: string, retries = DRAFT_REMOVAL_RETRIES): void {
  try {
    rmSync(folder, { recursive: true, force: true })
  } catch (error) {
    const [delay, ...rest] = retries
    if (delay === undefined) {
      log.warn(`Dossier d'une discussion vide laissé (supprimé au prochain démarrage) :`, error)
      return
    }
    setTimeout(() => removeDraftFolder(folder, rest), delay).unref()
  }
}

/**
 * Au lancement : dossiers de `discussions/` qu'aucune conversation (index ou corbeille) ne connaît
 * plus — brouillons laissés par un arrêt de l'app. Retirés seulement sans document visible (un
 * document déposé dans un brouillon n'est jamais effacé : il reste, et le journal le dit).
 */
export function sweepDiscussionFolders(conversationsDir: string, known: ReadonlySet<string>): void {
  let names: string[]
  try {
    names = readdirSync(discussionsRoot(conversationsDir))
  } catch {
    return
  }
  for (const id of names.filter((name) => !known.has(name))) {
    const folder = removableFolder(conversationsDir, id)
    if (folder) rmSync(folder, { recursive: true, force: true })
    else log.warn(`Dossier de discussion inconnu gardé (documents dedans) : ${id}`)
  }
}

/** Efface le dossier d'une discussion (corbeille vidée) ; rien hors de `discussions/`. */
export function eraseDiscussionFolder(conversationsDir: string, id: string): void {
  const folder = discussionFolder(conversationsDir, id)
  if (!existsSync(folder)) return
  rmSync(folder, { recursive: true, force: true })
  log.info(`Documents de la discussion effacés : ${id}`)
}

/**
 * Un document : fichier ordinaire, ni lien symbolique (il mènerait hors du dossier), ni fichier à
 * plusieurs noms (lien physique, fiche 230 : son contenu est celui d'un autre fichier, peut-être hors
 * du dossier — le montrer, le copier ou l'ouvrir lirait ce fichier-là).
 */
const isDocumentFile = (stat: Pick<Stats, 'isFile' | 'nlink'>): boolean =>
  stat.isFile() && !sharesContent(stat)

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
        // Ni lien symbolique ni lien physique : `isDocumentFile`.
        const stat = lstatSync(join(folder, name))
        return isDocumentFile(stat)
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
 * Ouvre un document en lecture, sans suivre de lien symbolique (`O_NOFOLLOW`), et vérifie sur le
 * descripteur ouvert (`fstat`) que c'est un document : un lien symbolique ou physique posé entre le
 * contrôle du nom et la lecture ne fait pas lire un fichier extérieur (fiches 224, 230).
 * `O_NONBLOCK` : un tube nommé posé à la place du document n'attend pas un écrivain. Rend le
 * descripteur (à fermer) ; lève une erreur sinon.
 *
 * Sous Windows, `O_NOFOLLOW` n'existe pas (relevé dans la VM, fiche 229 : l'ouverture suit un lien
 * symbolique ou une jonction et lit le fichier visé) : le nom est d'abord lu par `lstat` (ni lien,
 * ni plusieurs noms), puis le descripteur ouvert doit désigner ce même fichier (`dev`, `ino`) — un
 * lien posé entre les deux mène à un autre fichier, refusé. `noFollow` : injecté par les essais.
 */
export function openDocument(
  path: string,
  noFollow: number | undefined = constants.O_NOFOLLOW
): number {
  const named = noFollow === undefined ? lstatSync(path, { bigint: true }) : undefined
  if (named && !(named.isFile() && named.nlink === 1n)) throw invalidDocument(path)
  const fd = openSync(path, constants.O_RDONLY | (noFollow ?? 0) | (constants.O_NONBLOCK ?? 0))
  try {
    const opened = isDocumentFile(fstatSync(fd))
    if (opened && (!named || sameFile(named, fstatSync(fd, { bigint: true })))) return fd
  } catch {
    // Fermé ci-dessous.
  }
  closeSync(fd)
  throw invalidDocument(path)
}

const invalidDocument = (path: string) => new Error(`Document invalide : ${basename(path)}`)

const sameFile = (a: BigIntStats, b: BigIntStats) => a.dev === b.dev && a.ino === b.ino

/**
 * Copie un document de la discussion vers `target` (qui ne doit pas exister), par le descripteur
 * vérifié d'`openDocument` : jamais le contenu d'un fichier extérieur.
 */
export function copyDocument(source: string, target: string): void {
  const from = openDocument(source)
  try {
    const to = openSync(target, 'wx')
    try {
      const buffer = Buffer.alloc(1 << 20)
      for (let read = readSync(from, buffer); read > 0; read = readSync(from, buffer)) {
        for (let at = 0; at < read;) at += writeSync(to, buffer, at, read - at)
      }
    } catch (error) {
      // Copie à moitié faite : retirée (`target` vient d'être créé ici, `wx`).
      closeSync(to)
      rmSync(target, { force: true })
      throw error
    }
    closeSync(to)
  } finally {
    closeSync(from)
  }
}

/**
 * Copie des fichiers dans les documents d'une discussion ; l'original n'est jamais touché. Un nom
 * déjà pris reçoit un numéro. Rend les noms donnés aux copies.
 *
 * `fromDocuments` : les sources sont des documents d'une discussion (branche, « Continuer dans un
 * projet ») ; elles sont lues par `copyDocument`, et un lien physique ou symbolique est sauté.
 * Sinon, ce sont des fichiers choisis par l'utilisateur, copiés tels quels.
 */
export function addDocuments(
  folder: string,
  paths: readonly string[],
  options: { fromDocuments?: boolean } = {}
): string[] {
  mkdirSync(folder, { recursive: true })
  return paths.flatMap((path) => {
    // Fichier absent ou qui n'en est pas un : sauté (l'appelant le dit).
    if (!existsSync(path) || !statSync(path).isFile()) return []
    if (options.fromDocuments && !isDocumentFile(lstatSync(path))) return []
    const name = freeName(folder, basename(path))
    // Copié sous un nom caché puis renommé : jamais de document à moitié copié dans la liste.
    const partial = join(folder, `.${name}.${process.pid}.tmp`)
    try {
      if (options.fromDocuments) copyDocument(path, partial)
      else copyFileSync(path, partial, constants.COPYFILE_EXCL)
      renameSync(partial, join(folder, name))
    } catch (error) {
      rmSync(partial, { force: true })
      throw error
    }
    return [name]
  })
}

/**
 * Chemin d'un document de la discussion : un nom simple (ni dossier, ni `..`, ni fichier caché),
 * un fichier ordinaire du dossier (ni lien symbolique ni lien physique, qui mèneraient ailleurs).
 * Sinon refusé.
 */
export function documentPath(folder: string, name: string): string {
  if (name !== basename(name) || name.startsWith('.') || name.length === 0) {
    throw new Error(`Document invalide : ${name}`)
  }
  const path = join(folder, name)
  if (!isDocumentFile(lstatSync(path))) throw new Error(`Document invalide : ${name}`)
  return path
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

/**
 * Consigne de session d'une discussion (fiche 224), en anglais comme tout ce qui part à l'agent
 * (ADR-0014) : où il est, et rien d'écrit hors des documents. C'est ce qui « demande » la limite à
 * un agent qui écrit sans demander d'autorisation ; pour les autres, Bobine la tient aussi
 * (`writeArea`).
 */
export const DISCUSSION_CONTEXT = [
  APP_CONTEXT_OPENINGS.discussion,
  'For context, about where this conversation happens (Bobine). This is not a task.',
  'The user is chatting with you outside any project. Your working directory is this chat’s',
  'documents folder: the files the user attaches are copied there, and the files you make for the',
  'user belong there. Write only inside this folder: do not create, change or delete files anywhere',
  'else, not even temporary ones, and do not install anything. Bobine allows the writes you ask for',
  'inside this folder and refuses the others.',
  '</bobine_discussion>'
].join('\n')

/**
 * Branche d'une discussion (« Repartir d'un message », fiche 023) : son propre dossier, avec une
 * copie des documents de l'originale — jamais le même dossier (l'effacer emporterait l'autre).
 */
export function forkDiscussionFolder(
  conversationsDir: string,
  record: Pick<ConversationRecord, 'id' | 'space' | 'workspace'>,
  sourceFolder: string
): void {
  if (record.space !== 'discussion') return
  const folder = createDiscussionFolder(conversationsDir, record.id)
  addDocuments(
    folder,
    listDocuments(sourceFolder).map((d) => join(sourceFolder, d.name)),
    { fromDocuments: true }
  )
  record.workspace = folder
}
