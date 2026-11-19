import { Check, CircleExclamationPoint, GitMerge, LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ConversationSummary } from '@shared/agent'
import { childState } from '@shared/children'
import {
  mergeActive,
  mergeSummary,
  type ChildrenMergeRow,
  type MergeCandidate
} from '@shared/children-merge'
import { currentLocale } from '@shared/i18n/format'
import { translate } from '@shared/i18n/message'
import type { WorkCardData } from '@shared/role-request'
import type { TranscriptItem } from '@shared/transcript'
import { ipcErrorText } from '../../ipc-errors'
import { MainDirtyCard } from '../panel/MainDirtyCard'
import type { SubtasksInfo } from './Subtasks'
import {
  useChildrenMerge,
  type ChildrenMergeActions,
  type ChildrenMergeState
} from './SubtasksMerge'

/**
 * Fusion d'un travail qui écrit, dans sa carte (fiche 264, écran C) : « Fusionner dans main »,
 * puis les étapes que la fusion fait réellement (fusion de la branche, conflit que le travail
 * résout), « Arrêter », et le résultat (« Fusionné dans main · branche supprimée ») ; un conflit
 * qui reste se reprend comme dans « Sous-tâches » (Réessayer, Abandonner, Voir le conflit). Rien
 * d'inventé : ni « main n'a pas bougé », ni « tests de la branche » (décision 8 de la fiche 260).
 *
 * C'est la fusion enchaînée de la fiche 120, sur ce seul travail et avec « Puis nettoyer » : le
 * main la fait, son état arrive dans le fil (élément `children-merge`), la carte le lit.
 */

/** Ce que la carte sait de la fusion de son travail. */
export interface WorkMergeControl {
  motherId: string
  actions: ChildrenMergeActions
  state: ChildrenMergeState
  /** Ce que le main a lu de sa branche ; absent : pas lue, ou pas en worktree. */
  candidate: MergeCandidate | undefined
  /** Sa ligne dans la dernière fusion qui le touche. */
  row: ChildrenMergeRow | undefined
  /** Une fusion qui le touche avance. */
  active: boolean
  /** « Fusionner dans main » se propose : branche prête, rien ne bloque, aucune fusion en cours. */
  startable: boolean
  busy: boolean
  error: string | null
  /** Lance la fusion (`stash` : le dossier principal mis de côté le temps de la fusion). */
  start: (stash?: true) => void
  run: (action: () => Promise<unknown>) => void
}

/**
 * Fusion du travail d'une carte : lue seulement pour un rôle qui écrit (ou un travail sans rôle)
 * dans sa branche, hors d'une carte de groupe (qui a son pied), et seulement si l'app sait fusionner.
 */
export function useWorkMerge(
  card: WorkCardData,
  child: ConversationSummary | undefined,
  info: SubtasksInfo | undefined,
  items: readonly TranscriptItem[],
  enabled: boolean
): WorkMergeControl | undefined {
  const motherId = info?.motherId
  const actions = info?.merge
  const on = enabled && !card.role?.readOnly && !!child?.branch && !!motherId && !!actions
  const rows = on && child ? [{ child, state: childState(child, info?.attention[child.id]) }] : []
  const state = useChildrenMerge(on ? motherId : undefined, on ? actions : undefined, rows, items, [
    card.childId
  ])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!on || !motherId || !actions) return undefined
  const candidate = state.plan?.children.find((c) => c.id === card.childId)
  const row = state.merge?.rows.find((r) => r.childId === card.childId)
  const active = !!state.merge && mergeActive(state.merge) && !!row
  const run = (action: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    void action()
      .catch((e: unknown) => setError(ipcErrorText(e)))
      .finally(() => {
        setBusy(false)
        state.refresh()
      })
  }
  const startable =
    candidate?.state === 'ready' && !state.plan?.blocked && !state.plan?.running && !active
  return {
    motherId,
    actions,
    state,
    candidate,
    row,
    active,
    startable,
    busy,
    error,
    // Une seule branche, puis nettoyée : « Fusionné dans main · branche supprimée » (maquette C).
    start: (stash) => run(() => actions.start(motherId, [card.childId], true, stash)),
    run
  }
}

/** « Fusionner dans main » au pied de la carte. */
export function WorkMergeButton({ control }: { control: WorkMergeControl }) {
  const { t } = useTranslation()
  if (!control.startable || !control.candidate) return null
  return (
    <button
      type="button"
      className="btn primary small"
      disabled={control.busy}
      onClick={() => control.start()}
      data-testid="work-merge-start"
    >
      <GitMerge size={13} aria-hidden />
      {t('workMerge.action', { base: control.candidate.base })}
    </button>
  )
}

/** Fichiers cités, dans la langue : « a.ts, b.ts et c.ts ». */
const fileList = (files: readonly string[] | undefined): string =>
  new Intl.ListFormat(currentLocale(), { type: 'conjunction' }).format(files ?? [])

/**
 * La boîte de fusion de la carte : progression, résultat, conflit ou ce qui bloque. Rien tant que
 * la fusion n'a pas été demandée et que rien ne la bloque.
 */
export function WorkMergeBox({
  control,
  card,
  name
}: {
  control: WorkMergeControl
  card: WorkCardData
  /** Nom du travail, dit pendant qu'il résout un conflit. */
  name: string
}) {
  const { t } = useTranslation()
  const { state, row, candidate, motherId, actions } = control
  const merge = state.merge
  const errorLine = control.error && (
    <div className="browser-error git-error" data-testid="work-merge-error">
      {control.error}
    </div>
  )
  if (merge && row && control.active) {
    return (
      <div className="work-merge-box" data-testid="work-merge" data-status="running">
        <MergeSteps row={row} base={merge.base} name={name} />
        <div className="work-merge-actions">
          <button
            type="button"
            className="btn ghost small"
            disabled={merge.status === 'stopping' || control.busy}
            onClick={() => control.run(() => actions.stop(motherId))}
            data-testid="work-merge-stop"
          >
            {merge.status === 'stopping' ? t('childrenMerge.stopping') : t('childrenMerge.stop')}
          </button>
        </div>
        {errorLine}
      </div>
    )
  }
  // Conflit encore là (la branche le dit) : reprise, abandon, ou le voir.
  if (merge && row?.state === 'conflict' && candidate?.state === 'conflict') {
    return (
      <div className="work-merge-box err" data-testid="work-merge" data-status="conflict">
        <div className="work-merge-row">
          <CircleExclamationPoint size={13} aria-hidden />
          <span>{t('workMerge.conflict', { files: fileList(row.files) })}</span>
        </div>
        <div className="work-merge-actions">
          <button
            type="button"
            className="btn small primary"
            disabled={control.busy || !!state.plan?.running}
            onClick={() => control.start()}
            data-testid="work-merge-retry"
          >
            {t('childrenMerge.retry')}
          </button>
          <button
            type="button"
            className="btn small ghost"
            disabled={control.busy}
            onClick={() => control.run(() => actions.abort(card.childId))}
            data-testid="work-merge-abort"
          >
            {t('childrenMerge.abort')}
          </button>
          <button
            type="button"
            className="btn small"
            onClick={() => actions.openGit(card.childId)}
            data-testid="work-merge-show"
          >
            {t('childrenMerge.showConflict')}
          </button>
        </div>
        {errorLine}
      </div>
    )
  }
  // Branche de nouveau prête (nouveaux commits, conflit abandonné, fusion arrêtée avant elle) :
  // l'issue d'avant n'est plus d'actualité ; un échec, si (il dit pourquoi).
  const stale = candidate?.state === 'ready' && row?.state !== 'failed' && row?.state !== 'dirty'
  const outcome = merge && row && !stale ? <MergeOutcome row={row} merge={merge} /> : null
  // Avant toute fusion (ou après une issue) : ce qui empêcherait « Fusionner dans main ».
  const blocked = candidate?.state === 'ready' && !control.active && state.plan?.blocked
  const otherRunning = candidate?.state === 'ready' && state.plan?.running && !control.active
  if (!outcome && !blocked && !otherRunning && !errorLine) return null
  return (
    <>
      {outcome}
      {otherRunning && (
        <div className="work-merge-note" data-testid="work-merge-busy">
          {t('workMerge.busy')}
        </div>
      )}
      {blocked && state.plan && (
        <div className="work-merge-box" data-testid="work-merge-blocked">
          {state.plan.blocked?.reason === 'main-dirty' ? (
            <MainDirtyCard
              conversationId={motherId}
              dirty={{ ...state.plan.blocked, root: state.plan.blocked.path }}
              busy={control.busy || state.plan.running}
              onCommit={(message, files, left) =>
                control.run(async () => {
                  await actions.commitMain(motherId, { message, files })
                  // Fiche 244 : les décochés restent ; mis de côté le temps de la fusion.
                  await (left > 0
                    ? actions.start(motherId, [card.childId], true, true)
                    : actions.start(motherId, [card.childId], true))
                })
              }
              onStash={() => control.start(true)}
            />
          ) : (
            <div className="work-merge-row">
              {mergeSummary(state.plan, (titles) => titles.join(', '))
                .filter((m) => m.key === 'childrenMerge.summary.baseElsewhere')
                .map(translate)
                .join(' ')}
            </div>
          )}
        </div>
      )}
      {errorLine}
    </>
  )
}

/** Les étapes réelles d'une fusion en cours : la branche, puis le conflit que le travail résout. */
function MergeSteps({ row, base, name }: { row: ChildrenMergeRow; base: string; name: string }) {
  const { t } = useTranslation()
  const branch = row.branch ?? ''
  if (row.state === 'pending') {
    return (
      <div className="work-merge-row" data-testid="work-merge-step" data-step="pending">
        <LoaderCircle size={13} className="spin" aria-hidden />
        <span>{t('workMerge.step.pending')}</span>
      </div>
    )
  }
  const resolving = row.state === 'resolving'
  return (
    <>
      <div
        className={`work-merge-row${resolving ? ' done' : ''}`}
        data-testid="work-merge-step"
        data-step="merge"
      >
        {resolving ? (
          <CircleExclamationPoint size={13} aria-hidden />
        ) : (
          <LoaderCircle size={13} className="spin" aria-hidden />
        )}
        <span>
          {resolving
            ? t('workMerge.step.conflict', { files: fileList(row.files) })
            : t('workMerge.step.merging', { branch, base })}
        </span>
      </div>
      {resolving && (
        <div className="work-merge-row" data-testid="work-merge-step" data-step="resolving">
          <LoaderCircle size={13} className="spin" aria-hidden />
          <span>{t('workMerge.step.resolving', { name })}</span>
        </div>
      )}
    </>
  )
}

/** Issue de la dernière fusion de ce travail. */
function MergeOutcome({
  row,
  merge
}: {
  row: ChildrenMergeRow
  merge: NonNullable<ChildrenMergeState['merge']>
}) {
  const { t } = useTranslation()
  const ok = row.state === 'merged' || row.state === 'up-to-date'
  const lines: string[] = []
  if (row.state === 'merged') {
    lines.push(t(row.cleaned ? 'workMerge.doneCleaned' : 'workMerge.done', { base: merge.base }))
  } else if (row.state === 'up-to-date') lines.push(t('workMerge.upToDate', { base: merge.base }))
  else if (row.state === 'dirty') lines.push(t('workMerge.dirty'))
  else if (row.state === 'failed') lines.push(t('workMerge.failed', { error: row.error ?? '' }))
  else if (row.state === 'conflict') {
    lines.push(t('workMerge.conflict', { files: fileList(row.files) }))
  } else if (row.state === 'pending') {
    lines.push(t(merge.interrupted ? 'workMerge.interrupted' : 'workMerge.stopped'))
  }
  if (ok && row.cleaned) lines.push(t('workMerge.archived'))
  if (ok && !row.cleaned && row.error) {
    lines.push(t('workMerge.cleanupFailed', { error: row.error }))
  }
  if (lines.length === 0) return null
  const [first, ...rest] = lines
  return (
    <div
      className={`work-merge-box${ok ? ' ok' : ' err'}`}
      data-testid="work-merge-result"
      data-state={row.state}
    >
      <div className="work-merge-row strong">
        {ok ? <Check size={13} aria-hidden /> : <CircleExclamationPoint size={13} aria-hidden />}
        <span>{first}</span>
      </div>
      {rest.map((line) => (
        <div key={line} className="work-merge-row muted">
          {line}
        </div>
      ))}
    </div>
  )
}
