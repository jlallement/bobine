/**
 * Documents d'une discussion (fiche 224), branchés par `ipc.ts` : liste, dépôt (copie), ouverture,
 * aperçu, copie ailleurs ; et, à la fin de chaque tour d'une discussion, les documents créés ou
 * modifiés posés dans son fil (élément `documents`, leurs cartes) — que l'agent ait demandé à
 * écrire ou non (OpenCode écrit sans demander, relevé du 2026-11-14).
 *
 * Arguments vérifiés ici : une conversation qui n'est pas une discussion n'a pas de documents, un
 * nom de document ne sort pas de son dossier.
 */
import { execFile } from 'node:child_process'
import { copyFileSync, readFileSync, statSync } from 'node:fs'
import { extname, join } from 'node:path'
import { t } from 'i18next'
import type {
  AgentEvent,
  ConversationEvent,
  ConversationsState,
  ConversationSummary,
  ConversationView
} from '@shared/agent'
import type { PromptAttachment } from '@shared/attachments'
import type { DocumentPreview } from '@shared/documents'
import type { TranscriptItem } from '@shared/transcript'
import type { DocumentsChannel } from '@shared/documents-ipc'
import type { IpcHandlers } from '@shared/ipc'
import {
  addDocuments,
  changedDocuments,
  documentPath,
  documentsFingerprint,
  freeName,
  listDocuments
} from '../conversations/discussion-space'
import { isInside } from '../agent/permission-answers'
import type { ConversationListeners } from '../conversations/conversation'

/** Ce que les documents demandent au gestionnaire des conversations. */
export interface DocumentsHost {
  state(): ConversationsState
  /** Profils (`writesWithoutAsking`) et fil (avis déjà posé), pour dire honnêtement la limite. */
  settingsView(): {
    profiles: readonly { id: string; label: string; writesWithoutAsking?: boolean }[]
  }
  view(id: string): { transcript: { items: readonly TranscriptItem[] } }
  continueInProject(id: string, workspace: string): Promise<ConversationView>
  post(id: string, event: AgentEvent): void
  subscribe(listeners: ConversationListeners): () => void
}

/** Résumé d'une conversation ; `undefined` si elle n'existe plus. */
const summaryOf = (
  host: Pick<DocumentsHost, 'state'>,
  id: string
): ConversationSummary | undefined => host.state().conversations.find((c) => c.id === id)

export interface DocumentsIpcDeps {
  chooseFiles: (defaultPath: string) => Promise<string[]>
  chooseDirectory: (labels?: { title: string; buttonLabel: string }) => Promise<string | null>
  openPath: (path: string) => Promise<string>
  reveal: (path: string) => void
  /** Texte d'un document Word ou RTF (macOS `textutil`) ; remplaçable en essai. */
  toText?: (path: string) => Promise<string | undefined>
}

/** Aperçu texte : au-delà, coupé. */
const TEXT_LIMIT = 200_000
/** Image montrée en aperçu : au-delà, « Ouvrir ». */
const IMAGE_LIMIT = 8_000_000
const TEXT = new Set(['.txt', '.md', '.markdown', '.csv', '.tsv', '.json', '.xml', '.html', '.log'])
const IMAGES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp'
}
/** Formats que `textutil` sait lire (macOS). */
const RICH = new Set(['.docx', '.doc', '.rtf', '.odt'])

function str(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value) throw new Error(`Paramètre invalide : ${name}`)
  return value
}

/** `textutil -convert txt -stdout` (macOS) : le texte d'un document Word ou RTF, sinon rien. */
export function textutilText(path: string): Promise<string | undefined> {
  if (process.platform !== 'darwin') return Promise.resolve(undefined)
  return new Promise((resolve) => {
    execFile(
      '/usr/bin/textutil',
      ['-convert', 'txt', '-stdout', path],
      { maxBuffer: 5_000_000, timeout: 10_000 },
      (error, stdout) => resolve(error ? undefined : stdout)
    )
  })
}

/** Aperçu d'un document, selon son extension. */
export async function previewOf(
  path: string,
  toText: (path: string) => Promise<string | undefined> = textutilText
): Promise<DocumentPreview> {
  const ext = extname(path).toLowerCase()
  const asText = (text: string): DocumentPreview => ({
    kind: 'text',
    text: text.slice(0, TEXT_LIMIT),
    truncated: text.length > TEXT_LIMIT
  })
  if (TEXT.has(ext)) return asText(readFileSync(path, 'utf8'))
  const mimeType = IMAGES[ext]
  if (mimeType && statSync(path).size <= IMAGE_LIMIT) {
    return { kind: 'image', mimeType, data: readFileSync(path).toString('base64') }
  }
  if (RICH.has(ext)) {
    const text = await toText(path)
    if (text) return asText(text)
  }
  return { kind: 'none' }
}

/**
 * Suit les tours des discussions : empreinte des documents au départ du tour (l'agent passe à
 * `busy`), comparée à sa fin ; ce qui a changé est posé dans le fil.
 */
export function watchTurns(host: DocumentsHost): () => void {
  const before = new Map<string, Map<string, string>>()
  const told = new Set<string>()
  return host.subscribe({
    event: ({ conversationId: id, event }: ConversationEvent) => {
      if (event.type !== 'status') return
      const summary = summaryOf(host, id)
      if (summary?.space !== 'discussion') return
      const busy = event.snapshot.status === 'busy'
      const start = before.get(id)
      if (busy && !start) before.set(id, documentsFingerprint(summary.workspace))
      if (busy && !told.has(id)) {
        told.add(id)
        tellRequestedOnly(host, id, summary.profileId)
      }
      if (busy || !start) return
      before.delete(id)
      const names = changedDocuments(start, documentsFingerprint(summary.workspace))
      if (names.length > 0) host.post(id, { type: 'documents', names })
    },
    deleted: (id) => before.delete(id)
  })
}

const REQUESTED_ONLY = 'discussion.notice.limitRequestedOnly'

/**
 * Agent qui écrit sans demander d'autorisation (profil `writesWithoutAsking`, comme pour la lecture
 * seule d'un rôle, fiche 223) : la limite aux documents ne lui est que demandée (consigne de
 * session) ; le fil le dit une fois, au premier tour.
 */
function tellRequestedOnly(host: DocumentsHost, id: string, profileId: string): void {
  const profile = host.settingsView().profiles.find((p) => p.id === profileId)
  if (!profile?.writesWithoutAsking) return
  const said = host
    .view(id)
    .transcript.items.some(
      (i) => i.kind === 'notice' && i.message !== undefined && i.message.key === REQUESTED_ONLY
    )
  if (said) return
  host.post(id, {
    type: 'notice',
    level: 'warning',
    message: { key: REQUESTED_ONLY, params: { agent: profile.label } }
  })
}

/**
 * Les canaux des documents ; les tours des discussions sont suivis dès leur création (une fois,
 * avec les autres canaux, au lancement).
 */
export function documentsHandlers(
  host: DocumentsHost,
  deps: DocumentsIpcDeps
): Pick<IpcHandlers, DocumentsChannel> {
  watchTurns(host)
  /** Dossier de la discussion `id` ; refusé pour une autre conversation. */
  const folderOf = (id: unknown): string => {
    const summary = summaryOf(host, str(id, 'id'))
    if (summary?.space !== 'discussion') throw new Error(t('discussion.error.notDiscussion'))
    return summary.workspace
  }
  const pathOf = (id: unknown, name: unknown) => documentPath(folderOf(id), str(name, 'name'))
  return {
    'documents:list': (id) => {
      const summary = summaryOf(host, str(id, 'id'))
      return summary?.space === 'discussion' ? listDocuments(summary.workspace) : []
    },
    'documents:add': (id, paths) => {
      if (!Array.isArray(paths) || paths.some((p) => typeof p !== 'string' || !p))
        throw new Error('Paramètre invalide : paths')
      return addDocuments(folderOf(id), paths as string[])
    },
    'documents:pick': async (id) => {
      const folder = folderOf(id)
      return addDocuments(folder, await deps.chooseFiles(folder))
    },
    'documents:open': (id, name) => deps.openPath(pathOf(id, name)),
    'documents:reveal': (id, name) => {
      deps.reveal(pathOf(id, name))
      return undefined
    },
    'documents:saveCopy': async (id, name) => {
      const source = pathOf(id, name)
      const target = await deps.chooseDirectory({
        title: t('dialogs.saveDocument.title'),
        buttonLabel: t('dialogs.saveDocument.button')
      })
      if (!target) return null
      const path = join(target, freeName(target, str(name, 'name')))
      copyFileSync(source, path)
      return path
    },
    'documents:preview': (id, name) => previewOf(pathOf(id, name), deps.toText),
    'discussion:continueInProject': async (id, options) => {
      const folder = folderOf(id)
      const target = await deps.chooseDirectory({
        title: t('dialogs.continueInProject.title'),
        buttonLabel: t('dialogs.continueInProject.button')
      })
      if (!target) return null
      const copy = typeof options === 'object' && options !== null && options.copyDocuments === true
      const documents = listDocuments(folder).map((d) => join(folder, d.name))
      if (copy && documents.length > 0) addDocuments(join(target, 'documents'), documents)
      return host.continueInProject(str(id, 'id'), target)
    }
  }
}

/**
 * Fichiers joints à un message d'une discussion : copiés dans ses documents (l'original n'est pas
 * touché), et c'est la copie que l'agent reçoit. Un fichier déjà dans les documents reste tel quel ;
 * une autre conversation garde ses pièces jointes.
 */
export function attachToDocuments(
  host: Pick<DocumentsHost, 'state'>,
  id: string,
  attachments: PromptAttachment[]
): PromptAttachment[] {
  const summary = summaryOf(host, id)
  if (summary?.space !== 'discussion') return attachments
  const folder = summary.workspace
  return attachments.map((a) => {
    if (a.kind !== 'file' || isInside(folder, a.path)) return a
    const [name] = addDocuments(folder, [a.path])
    return name ? { kind: 'file', path: join(folder, name) } : a
  })
}
