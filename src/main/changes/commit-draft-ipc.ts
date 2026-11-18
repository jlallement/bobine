/**
 * Canaux IPC du message de commit rédigé par l'agent (fiche 246) : arguments du renderer vérifiés
 * ici ; la rédaction ne lève jamais (le repli porte la raison).
 */
import { t } from 'i18next'
import type { CommitDraftPlace, CommitDraftRequest } from '@shared/commit-draft'
import type { IpcHandlers } from '@shared/ipc'
import type { CommitFile } from '@shared/worktree-cycle'
import type { CommitDrafts } from '../conversations/commit-draft'

type CommitDraftChannel = Extract<keyof IpcHandlers, `commit:${string}`>

const STATUSES: readonly CommitFile['status'][] = [
  'modified',
  'added',
  'deleted',
  'renamed',
  'untracked'
]
const PLACES: readonly CommitDraftPlace[] = ['conversation', 'root']

const str = (value: unknown, name: string): string => {
  if (typeof value !== 'string' || !value) throw new Error(`Paramètre invalide : ${name}`)
  return value
}

export function parseDraftRequest(value: unknown): CommitDraftRequest {
  if (typeof value !== 'object' || value === null) throw new Error('Requête invalide')
  const { files, place } = value as Record<string, unknown>
  if (!PLACES.includes(place as CommitDraftPlace)) throw new Error('Paramètre invalide : place')
  if (!Array.isArray(files) || files.length === 0) throw new Error('Paramètre invalide : files')
  return {
    place: place as CommitDraftPlace,
    files: files.map((f) => {
      const file = (typeof f === 'object' && f !== null ? f : {}) as Record<string, unknown>
      const status = file['status'] as CommitFile['status']
      if (!STATUSES.includes(status)) throw new Error('Paramètre invalide : status')
      return { path: str(file['path'], 'path'), status }
    })
  }
}

export function commitDraftHandlers(
  drafts: Pick<CommitDrafts, 'draft' | 'stop'> | undefined
): Pick<IpcHandlers, CommitDraftChannel> {
  const available = () => {
    if (!drafts) throw new Error(t('ipc.unavailable.commitDraft'))
    return drafts
  }
  return {
    'commit:draft': (id, request) => available().draft(str(id, 'id'), parseDraftRequest(request)),
    'commit:draftStop': async (id) => {
      available().stop(str(id, 'id'))
      return undefined
    }
  }
}
