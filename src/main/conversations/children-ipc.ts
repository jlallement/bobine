/**
 * Canaux IPC des conversations filles (fiche 097), sortis de `children.ts` (taille bornée, fiche
 * 089). Les arguments viennent du renderer : on ne fait confiance qu'à ce qu'on vérifie.
 */
import { randomUUID } from 'node:crypto'
import { t } from 'i18next'
import type { IpcHandlers } from '@shared/ipc'
import { parseUncommittedChoice } from '@shared/launch-folder'
import type { ChildConversations, ChildRequest } from './children'

/** Canaux IPC des conversations filles, branchés par `ipc.ts` (fiche 097). */
export function childHandlers(
  children:
    | Pick<
        ChildConversations,
        'start' | 'capacity' | 'launchState' | 'folderState' | 'commitFolder'
      >
    | undefined
): Pick<
  IpcHandlers,
  | 'conversation:startChild'
  | 'conversation:childCapacity'
  | 'conversation:childLaunches'
  | 'conversation:childFolder'
  | 'conversation:commitForChildren'
> {
  const available = () => {
    if (!children) throw new Error(t('ipc.unavailable.children'))
    return children
  }
  const idOf = (id: unknown) => {
    if (typeof id !== 'string' || !id) throw new Error('Paramètre invalide : id')
    return id
  }
  return {
    'conversation:childLaunches': () => available().launchState(),
    // Carte du travail (fiche 264) : celle de sa proposition expirée, sinon une carte seule.
    'conversation:startChild': (id, request) => {
      const parsed = parseChildRequest(request)
      return available().start(idOf(id), { ...parsed, card: parsed.card ?? randomUUID() })
    },
    'conversation:childCapacity': (id) => available().capacity(idOf(id)),
    'conversation:childFolder': async (id) => (await available().folderState(idOf(id))) ?? null,
    'conversation:commitForChildren': (id, request) =>
      available().commitFolder(idOf(id), parseCommitRequest(request))
  }
}

function parseCommitRequest(value: unknown): { message: string; files: string[] } {
  if (typeof value !== 'object' || value === null) throw new Error('Requête invalide')
  const { message, files } = value as Record<string, unknown>
  if (typeof message !== 'string') throw new Error('Paramètre invalide : message')
  if (!Array.isArray(files) || !files.every((f) => typeof f === 'string' && f)) {
    throw new Error('Paramètre invalide : files')
  }
  return { message, files: files as string[] }
}

/* Les arguments IPC viennent du renderer : on ne fait confiance qu'à ce qu'on vérifie. */
function parseChildRequest(value: unknown): ChildRequest {
  if (typeof value !== 'object' || value === null) throw new Error('Requête invalide')
  const { text, title, profileId, model, role, uncommitted, card } = value as Record<
    string,
    unknown
  >
  if (typeof text !== 'string') throw new Error('Paramètre invalide : text')
  if (card !== undefined && (typeof card !== 'string' || !card || card.length > MAX_CARD_KEY)) {
    throw new Error('Paramètre invalide : card')
  }
  if (title !== undefined && typeof title !== 'string')
    throw new Error('Paramètre invalide : title')
  if (profileId !== undefined && (typeof profileId !== 'string' || !profileId)) {
    throw new Error('Paramètre invalide : profileId')
  }
  if (role !== undefined && (typeof role !== 'string' || !role.trim())) {
    throw new Error('Paramètre invalide : role')
  }
  const choice =
    typeof model === 'object' && model !== null ? (model as Record<string, unknown>) : {}
  if (
    model !== undefined &&
    (typeof choice.controlId !== 'string' || typeof choice.value !== 'string')
  ) {
    throw new Error('Paramètre invalide : model')
  }
  return {
    text,
    ...(typeof title === 'string' && title.trim() ? { title } : {}),
    ...(typeof profileId === 'string' ? { profileId } : {}),
    ...(model !== undefined
      ? { model: { controlId: String(choice.controlId), value: String(choice.value) } }
      : {}),
    ...(typeof role === 'string' ? { role: role.trim() } : {}),
    ...(uncommitted !== undefined ? { uncommitted: parseUncommittedChoice(uncommitted) } : {}),
    ...(typeof card === 'string' ? { card } : {})
  }
}

/** Clé de carte reçue du renderer : un identifiant, jamais un texte (fiche 264). */
const MAX_CARD_KEY = 100
