/**
 * Canaux IPC de la fusion des filles depuis la carte « Sous-tâches » (fiche 120), branchés par
 * `ipc.ts` (près de son plafond de lignes), comme `worktreeHandlers`. Les arguments viennent du
 * renderer : vérifiés ici. L'état d'une fusion part par l'évènement de conversation habituel.
 */
import { t } from 'i18next'
import type { AttentionState } from '@shared/attention'
import type { IpcHandlers } from '@shared/ipc'
import { WorktreeCycle } from '../changes/worktree-cycle'
import type { Worktrees } from '../changes/worktrees'
import { agentLog } from '../log'
import type { Run } from '../simulator/run'
import { ChildrenMerger, type ChildrenMergeHost } from './children-merge'

/** Branchement réel (`index.ts`) : git en ligne de commande, chaque commande dans `agents.log`. */
export function childrenMerger(
  run: Run,
  conversations: ChildrenMergeHost,
  worktrees: Pick<Worktrees, 'remove'>,
  attention: () => AttentionState
): ChildrenMerger {
  const log = (id: string | undefined, line: string) =>
    agentLog.line({ ...(id ? { conversation: id } : {}), agent: 'git' }, line)
  return new ChildrenMerger({
    conversations,
    cycle: new WorktreeCycle(run, { log }),
    worktrees,
    attention,
    log
  })
}

type ChildrenMergeChannel = Extract<keyof IpcHandlers, `children:${string}`>

const str = (value: unknown, name: string): string => {
  if (typeof value !== 'string' || !value) throw new Error(`Paramètre invalide : ${name}`)
  return value
}

export function childrenMergeHandlers(
  merger: Pick<ChildrenMerger, 'plan' | 'start' | 'stop' | 'commitMain'> | undefined
): Pick<IpcHandlers, ChildrenMergeChannel> {
  const available = () => {
    if (!merger) throw new Error(t('ipc.unavailable.childrenMerge'))
    return merger
  }
  return {
    'children:mergePlan': (motherId) => available().plan(str(motherId, 'motherId')),
    'children:merge': (motherId, ids, options) => {
      if (!Array.isArray(ids) || !ids.every((id) => typeof id === 'string' && id)) {
        throw new Error('Paramètre invalide : ids')
      }
      const set = typeof options === 'object' && options !== null ? options : undefined
      return available().start(
        str(motherId, 'motherId'),
        ids,
        set?.cleanup === true,
        set?.stash === true
      )
    },
    'children:mergeStop': (motherId) => {
      available().stop(str(motherId, 'motherId'))
      return undefined
    },
    'children:commitMain': (motherId, request) => {
      if (typeof request !== 'object' || request === null) throw new Error('Requête invalide')
      const { message, files } = request as Record<string, unknown>
      if (typeof message !== 'string') throw new Error('Paramètre invalide : message')
      if (!Array.isArray(files) || !files.every((f) => typeof f === 'string' && f)) {
        throw new Error('Paramètre invalide : files')
      }
      return available().commitMain(str(motherId, 'motherId'), {
        message,
        files: files as string[]
      })
    }
  }
}
