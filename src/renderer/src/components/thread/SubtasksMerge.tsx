import { Check, CircleExclamationPoint, GitMerge, LoaderCircle } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ConversationSummary } from '@shared/agent'
import { recommendedIds, type ChildVerdict } from '@shared/children'
import {
  lastChildrenMerge,
  mergeActive,
  mergeable,
  mergedRows,
  mergeSummary,
  settledMerge,
  type ChildrenMerge,
  type ChildrenMergePlan,
  type ChildrenMergeRow,
  type MergeCandidate,
  type MergeRowState
} from '@shared/children-merge'
import { currentLocale } from '@shared/i18n/format'
import { translate } from '@shared/i18n/message'
import type { TranscriptItem } from '@shared/transcript'
import type { StashOutcome } from '@shared/worktree-cycle'
import { ipcErrorText } from '../../ipc-errors'
import { MainDirtyCard, stashSentence } from '../panel/MainDirtyCard'

/**
 * Fusion de toutes les filles finies depuis la carte « Sous-tâches » (fiche 120) : l'état de
 * chaque ligne et le pied de carte (phrase d'état, « Fusionner les N dans main », « Puis
 * nettoyer », progression, « Arrêter », résultat). Le main fait la fusion ; son état arrive dans
 * le fil de la mère (élément `children-merge`).
 */

/** Ce que le pied de carte demande à l'app (main par l'IPC, vue Git d'une fille). */
export interface ChildrenMergeActions {
  plan: (motherId: string) => Promise<ChildrenMergePlan>
  /** `stash` : « Mettre de côté » le dossier principal le temps de la fusion (fiche 123). */
  start: (motherId: string, ids: string[], cleanup: boolean, stash?: true) => Promise<unknown>
  stop: (motherId: string) => Promise<unknown>
  /** « Committer d'abord » : ces fichiers, dans le dossier principal (fiche 123). */
  commitMain: (motherId: string, request: { message: string; files: string[] }) => Promise<unknown>
  /** « Abandonner » : `git merge --abort` dans la fille (fiche 110). */
  abort: (childId: string) => Promise<unknown>
  /** Ouvre la fille et sa vue Git (où la fiche 110 montre le conflit). */
  openGit: (childId: string) => void
}

/** Actions de la fusion branchées sur l'IPC ; `openGit` : ouvrir la fille et sa vue Git. */
export function childrenMergeActions(openGit: (childId: string) => void): ChildrenMergeActions {
  return {
    plan: window.api.children.mergePlan,
    start: (id, ids, cleanup, stash) =>
      window.api.children.merge(id, ids, { cleanup, ...(stash ? { stash } : {}) }),
    stop: window.api.children.mergeStop,
    commitMain: window.api.children.commitMain,
    abort: window.api.worktree.mergeAbort,
    openGit
  }
}

/** État de la fusion pour la carte : dernière fusion du fil, et ce que le main a lu des branches. */
export interface ChildrenMergeState {
  merge?: ChildrenMerge & { interrupted?: true }
  plan?: ChildrenMergePlan
  /** Relire les branches (après « Abandonner »). */
  refresh: () => void
}

/**
 * Lit les branches des filles quand leur état change, ou celui de la fusion : une fille qui
 * finit, une fusion qui avance. Pas à chaque évènement du fil (la mère qui écrit ne compte pas).
 */
export function useChildrenMerge(
  motherId: string | undefined,
  actions: ChildrenMergeActions | undefined,
  children: readonly { child: ConversationSummary; state: string }[],
  items: readonly TranscriptItem[]
): ChildrenMergeState {
  const last = useMemo(() => lastChildrenMerge(items), [items])
  const [read, setRead] = useState<{
    motherId: string
    key: string
    plan: ChildrenMergePlan
  }>()
  const [round, setRound] = useState(0)
  const refresh = useCallback(() => setRound((n) => n + 1), [])
  const key = [
    ...children.map(({ child, state }) => `${child.id}:${state}:${child.branch ?? ''}`),
    last ? `${last.runId}:${last.status}:${last.rows.map((r) => r.state).join(',')}` : '',
    round
  ].join('|')
  useEffect(() => {
    if (!motherId || !actions) return
    let current = true
    actions.plan(motherId).then(
      (plan) => current && setRead({ motherId, key, plan }),
      // Branches illisibles : pas de pied de carte.
      () => current && setRead(undefined)
    )
    return () => {
      current = false
    }
    // `key` résume ce qui change le plan ; `actions` est recréé à chaque rendu de l'app.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [motherId, key])
  const plan = motherId && actions && read?.motherId === motherId ? read.plan : undefined
  // Une lecture d'avant le départ ne prouve pas que la fusion vient d'être interrompue.
  // Seul un plan lu pour cette conversation et cet état peut constater l'arrêt au redémarrage.
  const merge = last && plan && read?.key === key ? settledMerge(last, plan.running) : last
  return { ...(merge ? { merge } : {}), ...(plan ? { plan } : {}), refresh }
}

/** Ce que la ligne d'une fille montre de la fusion ; `undefined` : rien. */
export function rowMergeState(
  { merge, plan }: ChildrenMergeState,
  childId: string
): MergeRowState | undefined {
  const row = merge?.rows.find((r) => r.childId === childId)
  const candidate = plan?.children.find((c) => c.id === childId)
  if (merge && mergeActive(merge) && row) return row.state
  if (candidate?.state === 'merged') return 'merged'
  if (candidate?.state === 'conflict') return 'conflict'
  if (!row) return undefined
  if (row.state === 'pending') return merge?.status === 'done' ? undefined : 'pending'
  // Fusion finie : son issue reste sur la ligne, tant que la fille n'a pas de nouveau travail.
  return candidate?.state === 'ready' ? undefined : row.state
}

const ROW_KEYS = {
  pending: 'childrenMerge.row.pending',
  merging: 'childrenMerge.row.merging',
  resolving: 'childrenMerge.row.resolving',
  merged: 'childrenMerge.row.merged',
  'up-to-date': 'childrenMerge.row.upToDate',
  conflict: 'childrenMerge.row.conflict',
  dirty: 'childrenMerge.row.dirty',
  failed: 'childrenMerge.row.failed'
} as const satisfies Record<MergeRowState, string>

/** Pastille de la fusion sur la ligne d'une fille. */
export function MergeRowBadge({ state, cleaned }: { state: MergeRowState; cleaned?: boolean }) {
  const { t } = useTranslation()
  const busy = state === 'merging' || state === 'resolving'
  const Icon = busy ? LoaderCircle : state === 'merged' || state === 'up-to-date' ? Check : null
  const failed = state === 'conflict' || state === 'failed'
  return (
    <span
      className={`subtask-merge-state ${state}`}
      data-testid="subtask-merge-state"
      data-state={state}
    >
      {Icon && <Icon size={12} className={busy ? 'spin' : undefined} />}
      {failed && <CircleExclamationPoint size={12} />}
      {t(ROW_KEYS[state])}
      {cleaned && ` · ${t('childrenMerge.row.cleaned')}`}
    </span>
  )
}

/** Durée d'une fusion : « 12 s », « 1 min 5 s ». */
function useDuration(): (ms: number) => string {
  const { t } = useTranslation()
  return (ms) => {
    const total = Math.max(1, Math.round(ms / 1000))
    if (total < 60) return t('childrenMerge.duration.seconds', { count: total })
    return t('childrenMerge.duration.minutes', {
      minutes: Math.floor(total / 60),
      seconds: total % 60
    })
  }
}

/** Liste de titres entre guillemets de la langue : « A » et « B ». */
function useTitles(): (titles: readonly string[]) => string {
  const { t } = useTranslation()
  return (titles) =>
    new Intl.ListFormat(currentLocale(), { type: 'conjunction' }).format(
      titles.map((title) => t('childrenMerge.quote', { title }))
    )
}

/**
 * Filles à fusionner d'abord (fiche 160) : quand la mère a donné au moins une recommandation,
 * seulement celles qu'elle recommande (recommandation à jour) ; les autres, après confirmation.
 * Sans recommandation (filles lancées par l'utilisateur…), toutes, comme avant.
 */
export function mergeChoice(
  ready: readonly MergeCandidate[],
  verdicts: ReadonlyMap<string, ChildVerdict> | undefined
): { ids: string[]; others: MergeCandidate[]; advised: boolean } {
  const advised = !!verdicts && ready.some((c) => verdicts.has(c.id))
  if (!advised) return { ids: ready.map((c) => c.id), others: [], advised }
  const recommended = recommendedIds(verdicts)
  return {
    ids: ready.filter((c) => recommended.has(c.id)).map((c) => c.id),
    others: ready.filter((c) => !recommended.has(c.id)),
    advised
  }
}

/** Pied de la carte « Sous-tâches » : rien s'il n'y a ni fusion ni fille à fusionner. */
export function SubtasksMergeFooter({
  motherId,
  state,
  actions,
  verdicts
}: {
  motherId: string
  state: ChildrenMergeState
  actions: ChildrenMergeActions
  /** Recommandations de la mère (fiche 160). */
  verdicts?: ReadonlyMap<string, ChildVerdict>
}) {
  const { t } = useTranslation()
  const titles = useTitles()
  const [cleanup, setCleanup] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { merge, plan } = state
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (e: unknown) {
      setError(ipcErrorText(e))
    } finally {
      setBusy(false)
      state.refresh()
    }
  }
  const errorLine = error && (
    <div className="browser-error git-error" data-testid="subtasks-merge-error">
      {error}
    </div>
  )

  if (merge && mergeActive(merge)) {
    return (
      <MergeProgress merge={merge} onStop={() => void run(() => actions.stop(motherId))}>
        {errorLine}
      </MergeProgress>
    )
  }
  const ready = plan ? mergeable(plan) : []
  // Arrêtée sur une fille encore en conflit : la reprise remplace « Fusionner les N ».
  const conflictRow =
    merge?.status === 'conflict' ? merge.rows.find((r) => r.state === 'conflict') : undefined
  const live =
    conflictRow && plan?.children.find((c) => c.id === conflictRow.childId)?.state === 'conflict'
  const sentences = plan ? mergeSummary(plan, titles) : []
  if (!merge && sentences.length === 0) return null
  const { ids, others, advised } = mergeChoice(ready, verdicts)
  const cleanupToggle = (
    <button
      className={`btn small merge-cleanup${cleanup ? ' on' : ''}`}
      aria-pressed={cleanup}
      title={t('childrenMerge.cleanupHint')}
      disabled={busy || ids.length === 0}
      onClick={() => setCleanup((on) => !on)}
      data-testid="subtasks-merge-cleanup"
    >
      {cleanup && <Check size={13} />}
      {t('childrenMerge.cleanup')}
    </button>
  )
  return (
    <div className="subtasks-merge" data-testid="subtasks-merge">
      {merge && (
        <MergeResult merge={merge} conflict={live ? conflictRow : undefined} titles={titles} />
      )}
      {live && conflictRow ? (
        <div className="subtasks-merge-actions">
          <button
            className="btn small primary"
            disabled={busy || ids.length === 0}
            onClick={() => void run(() => actions.start(motherId, ids, merge?.cleanup ?? false))}
            data-testid="subtasks-merge-retry"
          >
            {t('childrenMerge.retry')}
          </button>
          <button
            className="btn small ghost"
            disabled={busy}
            onClick={() => void run(() => actions.abort(conflictRow.childId))}
            data-testid="subtasks-merge-abort"
          >
            {t('childrenMerge.abort')}
          </button>
          <button
            className="btn small"
            onClick={() => actions.openGit(conflictRow.childId)}
            data-testid="subtasks-merge-show"
          >
            {t('childrenMerge.showConflict')}
          </button>
        </div>
      ) : (
        sentences.length > 0 &&
        plan && (
          <>
            <div className="subtasks-merge-text" data-testid="subtasks-merge-summary">
              {sentences.map(translate).join(' ')}
            </div>
            {advised && (
              <div className="subtasks-merge-text" data-testid="subtasks-merge-advice">
                {ids.length === 0
                  ? t('childrenMerge.recommended.none')
                  : others.length > 0 &&
                    t('childrenMerge.recommended.only', {
                      count: others.length,
                      titles: titles(ready.filter((c) => ids.includes(c.id)).map((c) => c.title))
                    })}
              </div>
            )}
            {plan.blocked?.reason === 'main-dirty' ? (
              // Fiche 123 : le dossier principal a des modifications, la fusion ne part pas.
              <MainDirtyCard
                dirty={{ ...plan.blocked, root: plan.blocked.path }}
                busy={busy || plan.running}
                onCommit={(message, files) =>
                  void run(async () => {
                    await actions.commitMain(motherId, { message, files })
                    await actions.start(motherId, ids, cleanup)
                  })
                }
                onStash={() => void run(() => actions.start(motherId, ids, cleanup, true))}
              >
                {cleanupToggle}
              </MainDirtyCard>
            ) : (
              <MergeButtons
                base={plan.base}
                ids={ids}
                others={others}
                advised={advised}
                disabled={busy || !!plan.blocked || plan.running}
                titles={titles}
                onStart={(list) => void run(() => actions.start(motherId, list, cleanup))}
              >
                {cleanupToggle}
              </MergeButtons>
            )}
          </>
        )
      )}
      {errorLine}
    </div>
  )
}

/**
 * « Fusionner les N (recommandées) dans main » et, si la mère n'en recommande pas certaines,
 * « Inclure les M autres… » qui demande confirmation (fiche 160). Ordre de lancement gardé.
 */
function MergeButtons({
  base,
  ids,
  others,
  advised,
  disabled,
  titles,
  onStart,
  children
}: {
  base: string
  ids: string[]
  others: MergeCandidate[]
  advised: boolean
  disabled: boolean
  titles: (list: readonly string[]) => string
  onStart: (ids: string[]) => void
  children: React.ReactNode
}) {
  const { t } = useTranslation()
  const [confirming, setConfirming] = useState(false)
  if (confirming && others.length > 0) {
    const all = [...ids, ...others.map((c) => c.id)]
    return (
      <div className="subtasks-merge-confirm" data-testid="subtasks-merge-confirm">
        <span className="subtasks-merge-text">
          {t('childrenMerge.recommended.confirm', {
            count: others.length,
            titles: titles(others.map((c) => c.title))
          })}
        </span>
        <div className="subtasks-merge-actions">
          <button
            className="btn small ghost"
            onClick={() => setConfirming(false)}
            data-testid="subtasks-merge-confirm-cancel"
          >
            {t('childrenMerge.recommended.cancel')}
          </button>
          <button
            className="btn small primary"
            disabled={disabled}
            onClick={() => {
              setConfirming(false)
              onStart(all)
            }}
            data-testid="subtasks-merge-confirm-go"
          >
            <GitMerge size={13} />
            {t('childrenMerge.recommended.confirmAction', { count: all.length })}
          </button>
          {children}
        </div>
      </div>
    )
  }
  return (
    <div className="subtasks-merge-actions">
      {others.length > 0 && (
        <button
          className="btn small"
          disabled={disabled}
          onClick={() => setConfirming(true)}
          data-testid="subtasks-merge-others"
        >
          {t('childrenMerge.recommended.others', { count: others.length })}
        </button>
      )}
      {(!advised || ids.length > 0) && (
        <button
          className="btn small primary"
          disabled={disabled || ids.length === 0}
          onClick={() => onStart(ids)}
          data-testid="subtasks-merge-start"
        >
          <GitMerge size={13} />
          {advised
            ? t('childrenMerge.recommended.action', { count: ids.length, base })
            : t('childrenMerge.action', { count: ids.length, base })}
        </button>
      )}
      {children}
    </div>
  )
}

function MergeProgress({
  merge,
  onStop,
  children
}: {
  merge: ChildrenMerge
  onStop: () => void
  children?: React.ReactNode
}) {
  const { t } = useTranslation()
  const done = merge.rows.filter(
    (r) => r.state !== 'pending' && r.state !== 'merging' && r.state !== 'resolving'
  ).length
  const stopping = merge.status === 'stopping'
  return (
    <div className="subtasks-merge" data-testid="subtasks-merge" data-status={merge.status}>
      <div className="subtasks-merge-text" data-testid="subtasks-merge-progress">
        {stopping
          ? t('childrenMerge.stopping')
          : t('childrenMerge.progress', {
              count: done,
              total: merge.rows.length,
              base: merge.base
            })}
      </div>
      {merge.stash?.state === 'kept' && (
        <div className="subtasks-merge-text muted" data-testid="subtasks-merge-stash">
          {t('childrenMerge.stashKept', { count: merge.stash.count })}
        </div>
      )}
      <div className="subtasks-merge-actions">
        <button
          className="btn small"
          disabled={stopping}
          onClick={onStop}
          data-testid="subtasks-merge-stop"
        >
          {t('childrenMerge.stop')}
        </button>
      </div>
      {children}
    </div>
  )
}

/** Issue de la dernière fusion : fusionnées et durée, arrêt, conflit ou échec. */
function MergeResult({
  merge,
  conflict,
  titles
}: {
  merge: ChildrenMerge & { interrupted?: true }
  conflict: ChildrenMergeRow | undefined
  titles: (list: readonly string[]) => string
}) {
  const { t } = useTranslation()
  const duration = useDuration()
  const merged = merge.rows.filter((r) => r.state === 'merged').length
  const upToDate = merge.rows.filter((r) => r.state === 'up-to-date').length
  const cleaned = mergedRows(merge).filter((r) => r.cleaned).length
  const failed = merge.rows.find((r) => r.state === 'failed' && merge.status === 'failed')
  const sentences: string[] = []
  if (conflict) {
    sentences.push(
      t('childrenMerge.result.conflict', {
        title: titles([conflict.title]),
        files: (conflict.files ?? []).join(', ')
      })
    )
  } else if (failed) {
    sentences.push(
      t('childrenMerge.result.failed', { title: titles([failed.title]), error: failed.error ?? '' })
    )
  } else if (merge.status === 'done') {
    sentences.push(
      t('childrenMerge.result.done', {
        count: merged,
        base: merge.base,
        duration: duration((merge.endedAt ?? merge.startedAt) - merge.startedAt)
      })
    )
  } else {
    sentences.push(
      t(merge.interrupted ? 'childrenMerge.result.interrupted' : 'childrenMerge.result.stopped', {
        count: merged,
        base: merge.base
      })
    )
  }
  if (upToDate > 0) sentences.push(t('childrenMerge.result.upToDate', { count: upToDate }))
  if (cleaned > 0) sentences.push(t('childrenMerge.result.cleaned', { count: cleaned }))
  const stash = stashOutcome(merge)
  if (stash) sentences.push(stashSentence(stash))
  const ok = merge.status === 'done'
  return (
    <div
      className={`subtasks-merge-result${ok ? ' ok' : conflict || failed ? ' err' : ''}`}
      data-testid="subtasks-merge-result"
      data-status={merge.status}
    >
      {ok ? <Check size={13} /> : conflict || failed ? <CircleExclamationPoint size={13} /> : null}
      <span>{sentences.join(' ')}</span>
    </div>
  )
}

/** Issue de la mise de côté d'une fusion finie (fiche 123), telle que la barre du worktree la dit. */
function stashOutcome(merge: ChildrenMerge): StashOutcome | undefined {
  const { stash } = merge
  if (stash?.state === 'failed') {
    return { restored: false, count: stash.count, ref: stash.ref, conflicts: stash.conflicts }
  }
  return stash?.state === 'restored' ? { restored: true, count: stash.count } : undefined
}
