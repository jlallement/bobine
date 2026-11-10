/**
 * Repartir d'un message (fiche 023) et annuler une modification de l'agent (fiche 021, levée par
 * la 043) : ce qui se calcule sur le fil et le dossier, sans toucher aux conversations. Sorti du
 * gestionnaire (fiche 089), qui garde l'orchestration (brouillon, agent, envoi, avis dans le fil).
 */
import { relative } from 'node:path'
import { t } from 'i18next'
import type { BranchPreview } from '@shared/agent'
import type { AttachmentView, PromptAttachment } from '@shared/attachments'
import {
  branchBase,
  branchContext,
  branchPoint,
  commandsSince,
  fileChangesSince,
  inheritedTranscript
} from '@shared/branch'
import { stripAppContext } from '@shared/app-context'
import type { RevertOutcome } from '@shared/changes'
import type { Message } from '@shared/i18n/message'
import type { TranscriptItem, TranscriptState } from '@shared/transcript'
import { applyRestore, planRestore } from './restore-files'

/**
 * Avant de repartir d'un message : fichiers modifiés par l'agent depuis ce point et ce qu'il
 * adviendrait de chacun, commandes lancées depuis.
 */
export async function previewBranch(
  items: readonly TranscriptItem[],
  itemId: number,
  workspace: string
): Promise<BranchPreview> {
  const point = branchPoint(items, itemId)
  if (!point) throw new Error(t('conversations.error.messageMissing'))
  const changes = fileChangesSince(items, point.index)
  const plan = await planRestore(workspace, changes)
  return {
    files: plan.map(({ path, status, created }) => ({ path, status, created })),
    commands: commandsSince(items, point.index)
  }
}

export interface BranchSource {
  id: string
  title: string
  workspace: string
  transcript: TranscriptState
}

export interface PreparedBranch {
  /** Message de l'utilisateur, nettoyé, et ses pièces jointes reprises. */
  text: string
  attachments: PromptAttachment[]
  /** Fil de la branche : l'échange antérieur, puis la marque de la branche. */
  transcript: TranscriptState
  /** Contexte envoyé à l'agent avant le message. */
  context: string
  title: string
}

/**
 * Prépare une branche depuis le message `itemId` de `source`, avec un nouveau texte. `restoreFiles` :
 * les fichiers modifiés par l'agent depuis ce point sont remis dans leur état d'alors (sur le
 * disque, tout de suite).
 */
export async function prepareBranch(
  source: BranchSource,
  itemId: number,
  text: string,
  options: { restoreFiles?: boolean } = {}
): Promise<PreparedBranch> {
  const { items } = source.transcript
  const point = branchPoint(items, itemId)
  if (!point) throw new Error(t('conversations.error.messageMissing'))
  const clean = text.trim()
  const attachments = (point.message.attachments ?? []).flatMap(toPromptAttachment)
  if (!clean && attachments.length === 0) throw new Error(t('conversations.error.emptyMessage'))

  const changes = fileChangesSince(items, point.index)
  const restore = options.restoreFiles && changes.length > 0
  const { restored, skipped } = restore
    ? await applyRestore(source.workspace, changes)
    : { restored: [], skipped: [] }

  const inherited = inheritedTranscript(source.transcript, point.index)
  // Titre d'une conversation remplacé avant la fiche 125 par ce que l'app joint au message.
  const sourceTitle = stripAppContext(source.title) ?? source.title
  return {
    text: clean,
    attachments,
    transcript: {
      ...inherited,
      items: [
        ...inherited.items,
        {
          kind: 'branch',
          id: inherited.nextId,
          fromId: source.id,
          fromTitle: sourceTitle,
          restored: restored.length,
          skipped: skipped.length
        }
      ],
      nextId: inherited.nextId + 1
    },
    context: branchContext(inherited.items, {
      filesRestored: restored.length > 0,
      filesChanged: changes.length > 0 && restored.length === 0
    }),
    title: branchTitle(sourceTitle)
  }
}

export interface RevertResult {
  outcome: RevertOutcome
  /** Avis à mettre dans le fil, dans tous les cas. */
  notice: { level: 'info' | 'warning' | 'error'; message: Message }
}

/**
 * Annule la modification de `path` par l'agent : le fichier revient à son état d'avant la
 * conversation si rien ne l'a modifié depuis ; sinon il n'est pas touché.
 */
export async function revertChange(
  items: readonly TranscriptItem[],
  path: string,
  workspace: string
): Promise<RevertResult> {
  const change = fileChangesSince(items, 0).find((f) => f.path === path)
  if (!change) throw new Error(t('conversations.error.noChange'))
  const rel = relative(workspace, path)
  const shown = rel && !rel.startsWith('..') ? rel : path
  const [plan] = await planRestore(workspace, [change])
  const status = plan?.status ?? 'conflict'
  if (status === 'restore') {
    const { restored } = await applyRestore(workspace, [change])
    if (restored.length > 0) {
      return {
        outcome: 'restored',
        notice: {
          level: 'info',
          message: {
            key: plan?.created
              ? 'conversations.notice.revertedCreated'
              : 'conversations.notice.reverted',
            params: { file: shown }
          }
        }
      }
    }
    return {
      outcome: 'failed',
      notice: {
        level: 'error',
        message: { key: 'conversations.notice.revertFailed', params: { file: shown } }
      }
    }
  }
  return {
    outcome: status,
    notice: {
      level: status === 'unchanged' ? 'info' : 'warning',
      message: {
        key: 'conversations.notice.untouched',
        params: {
          file: shown,
          why: {
            key:
              status === 'conflict'
                ? 'conversations.notice.why.conflict'
                : status === 'outside'
                  ? 'conversations.notice.why.outside'
                  : 'conversations.notice.why.unchanged'
          }
        }
      }
    }
  }
}

/** Titre d'une branche : celui de l'originale, marqué (sans s'allonger de branche en branche). */
export function branchTitle(title: string): string {
  // Marque d'avant la fiche 074 (« branche ») ou celle de la langue du moment.
  const suffix = t('conversations.branchSuffix')
  return `${branchBase(title, suffix)} · ${suffix}`
}

/** Pièce jointe d'un message repris : les images ont leurs données, les fichiers leur chemin. */
function toPromptAttachment(view: AttachmentView): PromptAttachment[] {
  if (view.kind === 'image') return [view]
  // Repartir d'un message : le contenu git ou terminal est relu au nouvel envoi (fiche 057).
  if (view.kind === 'context') return [{ kind: 'context', source: view.source }]
  if (view.kind === 'text') return [{ kind: 'text', name: view.name, text: view.text }]
  return view.path ? [{ kind: 'file', path: view.path }] : []
}
