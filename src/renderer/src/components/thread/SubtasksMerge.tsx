import { Check, CircleExclamationPoint, GitMerge, LoaderCircle } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode
} from 'react'
import { useTranslation } from 'react-i18next'
import type { ConversationSummary } from '@shared/agent'
import { recommendedIds, type ChildVerdict } from '@shared/children'
import {
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
import type { CommitRequest, StashOutcome } from '@shared/worktree-cycle'
import { lastMergeFor } from '@shared/work-groups'
import {
  forgetPlans,
  loadPlan,
  planFor,
  planRead,
  plansVersion,
  readPlan,
  subscribePlans
} from './merge-plan-store'
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
  /** `ids` : seulement ces travaux (une carte de groupe ou de travail, fiche 264). */
  plan: (motherId: string, ids?: string[]) => Promise<ChildrenMergePlan>
  /**
   * `stash` : « Mettre de côté » le dossier principal le temps de la fusion (fiche 123) ; `commit` :
   * « Committer puis fusionner », committé par le main seulement si rien ne refuse la fusion
   * (fiche 287).
   */
  start: (
    motherId: string,
    ids: string[],
    cleanup: boolean,
    stash?: true,
    commit?: CommitRequest
  ) => Promise<unknown>
  /** `runId` : la fusion de cette carte seulement (fiche 264). */
  stop: (motherId: string, runId?: string) => Promise<unknown>
  /** « Abandonner » : `git merge --abort` dans la fille (fiche 110). */
  abort: (childId: string) => Promise<unknown>
  /** Ouvre la fille et sa vue Git (où la fiche 110 montre le conflit). */
  openGit: (childId: string) => void
}

/** Actions de la fusion branchées sur l'IPC ; `openGit` : ouvrir la fille et sa vue Git. */
export function childrenMergeActions(openGit: (childId: string) => void): ChildrenMergeActions {
  return {
    plan: window.api.children.mergePlan,
    start: (id, ids, cleanup, stash, commit) =>
      window.api.children.merge(id, ids, {
        cleanup,
        ...(stash ? { stash } : {}),
        ...(commit ? { commit } : {})
      }),
    stop: window.api.children.mergeStop,
    abort: window.api.worktree.mergeAbort,
    openGit
  }
}

/** État de la fusion pour la carte : dernière fusion du fil, et ce que le main a lu des branches. */
export interface ChildrenMergeState {
  merge?: ChildrenMerge & { interrupted?: true }
  plan?: ChildrenMergePlan
  /** Les branches sont lues pour cet état (plan ou branches illisibles), pas seulement l'avant-dernier. */
  read: boolean
  /** Relire les branches (après « Abandonner »). */
  refresh: () => void
}

/**
 * Lit les branches des filles quand leur état change, ou celui d'une fusion : une fille qui finit,
 * une fusion qui avance. Pas à chaque évènement du fil (la mère qui écrit ne compte pas). Une seule
 * lecture par mère et par état, partagée par toutes les cartes (`merge-plan-store`, fiche 264) ; la
 * clé compte toutes les fusions de la mère, pas seulement celle de la carte (revue QA).
 * `ids` (fiche 264) : une carte de groupe ou de travail ne garde que ses travaux, dans l'ordre de ses
 * lignes, et ne montre que la dernière fusion qui les touche ; absent : toutes (« Sous-tâches »).
 */
export function useChildrenMerge(
  motherId: string | undefined,
  actions: ChildrenMergeActions | undefined,
  children: readonly { child: ConversationSummary; state: string }[],
  items: readonly TranscriptItem[],
  ids?: readonly string[]
): ChildrenMergeState {
  const idsKey = ids?.join(',')
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `idsKey` résume `ids`, recréé à chaque rendu
  const last = useMemo(() => lastMergeFor(items, ids), [items, idsKey])
  const merges = useMemo(
    () =>
      items
        .flatMap((i) =>
          i.kind === 'children-merge'
            ? [`${i.runId}:${i.status}:${i.rows.map((r) => r.state).join(',')}`]
            : []
        )
        .join(';'),
    [items]
  )
  const key = [
    ...children.map(({ child, state }) => `${child.id}:${state}:${child.branch ?? ''}`),
    merges
  ].join('|')
  const active = !!motherId && !!actions && !(ids && ids.length === 0)
  // Chaque lecture faite (ou demandée, `refresh`) : relu si l'état est à relire, sinon rien.
  const version = useSyncExternalStore(subscribePlans, plansVersion)
  useEffect(() => {
    if (!active || !motherId || !actions) return
    loadPlan(motherId, key, (id) => actions.plan(id))
    // `key` résume ce qui change le plan ; `actions` est recréé à chaque rendu de l'app.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, motherId, key, version])
  const refresh = useCallback(() => {
    if (motherId) forgetPlans(motherId)
  }, [motherId])
  const read = active && motherId ? readPlan(motherId, key) : undefined
  const full = read?.plan
  const plan = full && ids ? planFor(full, ids) : full
  // Une lecture d'avant le départ ne prouve pas que la fusion vient d'être interrompue : seul un
  // plan lu pour cet état constate l'arrêt au redémarrage. Une fusion d'une autre carte qui tourne
  // ne rend pas celle-ci « en cours » (le plan dit laquelle tourne, revue QA).
  const merge =
    last && plan && read?.exact
      ? settledMerge(last, plan.running && (plan.runId === undefined || plan.runId === last.runId))
      : last
  return {
    ...(merge ? { merge } : {}),
    ...(plan ? { plan } : {}),
    read: active && !!motherId && planRead(motherId, key),
    refresh
  }
}

/**
 * Ce plan a été lu après l'arrêt de cette fusion (fiche 250) : une lecture faite pendant (le travail
 * résolvait encore son conflit, ou pas encore) ne dit rien du conflit qui reste. Une fusion d'une
 * autre carte qui tourne ne compte pas.
 */
export function planReadAfter(
  plan: ChildrenMergePlan | undefined,
  merge: Pick<ChildrenMerge, 'runId'> | undefined
): boolean {
  return !!plan && !(plan.running && (plan.runId === undefined || plan.runId === merge?.runId))
}

/**
 * Ligne où la fusion s'est arrêtée sur un conflit qui reste : la branche le dit encore, lue après
 * l'arrêt (`planReadAfter`) ; `undefined` sinon.
 */
export function conflictLeft(
  merge: ChildrenMerge | undefined,
  plan: ChildrenMergePlan | undefined
): ChildrenMergeRow | undefined {
  if (merge?.status !== 'conflict' || !planReadAfter(plan, merge)) return undefined
  const row = merge.rows.find((r) => r.state === 'conflict')
  return row && plan?.children.find((c) => c.id === row.childId)?.state === 'conflict'
    ? row
    : undefined
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

/** Les mêmes, en « travaux » (carte de groupe, fiche 264). */
const WORK_ROW_KEYS = {
  pending: 'workGroup.merge.row.pending',
  merging: 'workGroup.merge.row.merging',
  resolving: 'workGroup.merge.row.resolving',
  merged: 'workGroup.merge.row.merged',
  'up-to-date': 'workGroup.merge.row.upToDate',
  conflict: 'workGroup.merge.row.conflict',
  dirty: 'workGroup.merge.row.dirty',
  failed: 'workGroup.merge.row.failed'
} as const satisfies Record<MergeRowState, string>

/**
 * Textes du pied de fusion : ceux de « Sous-tâches » (fiche 120), ou ceux d'une carte de groupe,
 * en « travaux » (fiche 264). Mêmes variables d'un jeu à l'autre.
 */
const TEXTS = {
  children: {
    action: 'childrenMerge.action',
    recommendedAction: 'childrenMerge.recommended.action',
    others: 'childrenMerge.recommended.others',
    confirm: 'childrenMerge.recommended.confirm',
    confirmAction: 'childrenMerge.recommended.confirmAction',
    none: 'childrenMerge.recommended.none',
    progress: 'childrenMerge.progress',
    done: 'childrenMerge.result.done',
    stopped: 'childrenMerge.result.stopped',
    interrupted: 'childrenMerge.result.interrupted',
    cleaned: 'childrenMerge.row.cleaned'
  },
  works: {
    action: 'workGroup.merge.action',
    recommendedAction: 'workGroup.merge.recommended.action',
    others: 'workGroup.merge.recommended.others',
    confirm: 'workGroup.merge.recommended.confirm',
    confirmAction: 'workGroup.merge.recommended.confirmAction',
    none: 'workGroup.merge.recommended.none',
    progress: 'workGroup.merge.progress',
    done: 'workGroup.merge.result.done',
    stopped: 'workGroup.merge.result.stopped',
    interrupted: 'workGroup.merge.result.interrupted',
    cleaned: 'workGroup.merge.row.cleaned'
  }
} as const
type Vocabulary = keyof typeof TEXTS

/** Pastille de la fusion sur la ligne d'une fille (ou d'un travail d'une carte de groupe). */
export function MergeRowBadge({
  state,
  cleaned,
  works = false
}: {
  state: MergeRowState
  cleaned?: boolean
  works?: boolean
}) {
  const { t } = useTranslation()
  const keys = works ? WORK_ROW_KEYS : ROW_KEYS
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
      {t(keys[state])}
      {cleaned && ` · ${t(TEXTS[works ? 'works' : 'children'].cleaned)}`}
    </span>
  )
}

/** Durée d'une fusion : « < 1 s », « 12 s », « 1 min 5 s ». */
function useDuration(): (ms: number) => string {
  const { t } = useTranslation()
  return (ms) => {
    // Jamais « 0 s » ni « 1 s » pour une fusion éclair : « < 1 s » (fiche 266).
    if (ms < 1000) return t('transcript.duration.underSecond')
    const total = Math.round(ms / 1000)
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
  verdicts,
  works = false,
  extra
}: {
  motherId: string
  state: ChildrenMergeState
  actions: ChildrenMergeActions
  /** Recommandations de la mère (fiche 160). */
  verdicts?: ReadonlyMap<string, ChildVerdict>
  /** Pied d'une carte de groupe (fiche 264) : ses textes, en « travaux ». */
  works?: boolean
  /**
   * Bouton secondaire de la carte de groupe (« Voir les modifications ») : dans la rangée des
   * boutons, avant les autres ; dans sa propre rangée quand il n'y en a pas (revue du lot 264).
   */
  extra?: ReactNode
}) {
  const { t } = useTranslation()
  const titles = useTitles()
  const vocabulary: Vocabulary = works ? 'works' : 'children'
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
      <MergeProgress
        merge={merge}
        vocabulary={vocabulary}
        onStop={() => void run(() => actions.stop(motherId, merge.runId))}
      >
        {errorLine}
      </MergeProgress>
    )
  }
  const ready = plan ? mergeable(plan) : []
  // Arrêtée sur une fille encore en conflit : la reprise remplace « Fusionner les N ».
  const conflictRow = conflictLeft(merge, plan)
  const sentences = plan ? mergeSummary(plan, titles) : []
  const lone = extra ? <div className="subtasks-merge-actions">{extra}</div> : null
  if (!merge && sentences.length === 0) return lone
  const { ids, others, advised } = mergeChoice(ready, verdicts)
  // Le bouton secondaire va dans la rangée de « Fusionner … » ; sinon, dans sa propre rangée.
  const inButtons =
    !conflictRow && sentences.length > 0 && !!plan && plan.blocked?.reason !== 'main-dirty'
  // Carte de groupe (revue UX) : une vraie case, avant le bouton principal, qui dit ce qu'elle fait.
  const cleanupToggle = works ? (
    <label className="merge-cleanup-check" title={t('childrenMerge.cleanupHint')}>
      <input
        type="checkbox"
        checked={cleanup}
        disabled={busy || ids.length === 0}
        onChange={(e) => setCleanup(e.target.checked)}
        data-testid="subtasks-merge-cleanup"
      />
      {t('workGroup.merge.cleanup')}
    </label>
  ) : (
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
        <MergeResult merge={merge} conflict={conflictRow} titles={titles} vocabulary={vocabulary} />
      )}
      {conflictRow ? (
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
              <MergeAdvice
                vocabulary={vocabulary}
                recommended={ready.filter((c) => ids.includes(c.id))}
                others={others}
                verdicts={verdicts}
                titles={titles}
              />
            )}
            {plan.blocked?.reason === 'main-dirty' ? (
              // Fiche 123 : le dossier principal a des modifications, la fusion ne part pas.
              <MainDirtyCard
                conversationId={motherId}
                dirty={{ ...plan.blocked, root: plan.blocked.path }}
                busy={busy || plan.running}
                onCommit={(message, files, left) =>
                  // Fiche 244 : les décochés restent ; mis de côté le temps de la fusion. Fiche 287 :
                  // un seul appel, le main ne committe que si rien ne refuse la fusion.
                  void run(() =>
                    actions.start(motherId, ids, cleanup, left > 0 ? true : undefined, {
                      message,
                      files
                    })
                  )
                }
                onStash={() => void run(() => actions.start(motherId, ids, cleanup, true))}
              >
                {cleanupToggle}
              </MainDirtyCard>
            ) : (
              <MergeButtons
                base={plan.base}
                vocabulary={vocabulary}
                order={ready.map((c) => c.id)}
                ids={ids}
                others={others}
                advised={advised}
                disabled={busy || !!plan.blocked || plan.running}
                titles={titles}
                onStart={(list) => void run(() => actions.start(motherId, list, cleanup))}
                extra={extra}
              >
                {cleanupToggle}
              </MergeButtons>
            )}
          </>
        )
      )}
      {!inButtons && lone}
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
  vocabulary,
  extra,
  order,
  ids,
  others,
  advised,
  disabled,
  titles,
  onStart,
  children
}: {
  base: string
  vocabulary: Vocabulary
  /** Bouton secondaire de la carte de groupe, en tête de la rangée des boutons. */
  extra?: ReactNode
  /** Les prêtes, dans l'ordre des lignes. */
  order: string[]
  ids: string[]
  others: MergeCandidate[]
  advised: boolean
  disabled: boolean
  titles: (list: readonly string[]) => string
  onStart: (ids: string[]) => void
  children: ReactNode
}) {
  const { t } = useTranslation()
  const texts = TEXTS[vocabulary]
  const [confirming, setConfirming] = useState(false)
  if (confirming && others.length > 0) {
    // Dans l'ordre des lignes (le main fusionne dans l'ordre reçu, fiche 264).
    const chosen = new Set([...ids, ...others.map((c) => c.id)])
    const all = order.filter((id) => chosen.has(id))
    return (
      <div className="subtasks-merge-confirm" data-testid="subtasks-merge-confirm">
        <span className="subtasks-merge-text">
          {t(texts.confirm, {
            count: others.length,
            titles: titles(others.map((c) => c.title))
          })}
        </span>
        {vocabulary === 'works' && <div className="subtasks-merge-option">{children}</div>}
        <div className="subtasks-merge-actions">
          {extra}
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
            {t(texts.confirmAction, { count: all.length })}
          </button>
          {vocabulary !== 'works' && children}
        </div>
      </div>
    )
  }
  const row = (
    <div className="subtasks-merge-actions">
      {extra}
      {others.length > 0 && (
        <button
          className="btn small"
          disabled={disabled}
          onClick={() => setConfirming(true)}
          data-testid="subtasks-merge-others"
        >
          {t(texts.others, { count: others.length })}
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
            ? t(texts.recommendedAction, { count: ids.length, base })
            : t(texts.action, { count: ids.length, base })}
        </button>
      )}
      {vocabulary !== 'works' && children}
    </div>
  )
  // Carte de groupe : la case sur sa propre ligne, puis la rangée de boutons, le principal en
  // dernier ; la rangée passe à la ligne dans la carte (revue du lot 264).
  if (vocabulary !== 'works') return row
  return (
    <>
      <div className="subtasks-merge-option">{children}</div>
      {row}
    </>
  )
}

function MergeProgress({
  merge,
  vocabulary,
  onStop,
  children
}: {
  merge: ChildrenMerge
  vocabulary: Vocabulary
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
          : t(TEXTS[vocabulary].progress, {
              count: done,
              total: merge.rows.length,
              base: merge.base
            })}
      </div>
      {/* Carte de groupe (revue UX) : la phrase du conflit seulement quand il y en a un. */}
      {vocabulary === 'works' && merge.rows.some((r) => r.state === 'resolving') && (
        <div className="subtasks-merge-text" data-testid="subtasks-merge-resolving">
          {t('workGroup.merge.resolving')}
        </div>
      )}
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
  titles,
  vocabulary
}: {
  merge: ChildrenMerge & { interrupted?: true }
  conflict: ChildrenMergeRow | undefined
  titles: (list: readonly string[]) => string
  vocabulary: Vocabulary
}) {
  const { t } = useTranslation()
  const texts = TEXTS[vocabulary]
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
      t(texts.done, {
        count: merged,
        base: merge.base,
        duration: duration((merge.endedAt ?? merge.startedAt) - merge.startedAt)
      })
    )
  } else {
    sentences.push(
      t(merge.interrupted ? texts.interrupted : texts.stopped, {
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

/** Le conseil de la mère sous le bilan : rien de recommandé, ou ce qu'elle recommande (fiche 160). */
function MergeAdvice({
  vocabulary,
  recommended,
  others,
  verdicts,
  titles
}: {
  vocabulary: Vocabulary
  recommended: readonly MergeCandidate[]
  others: readonly MergeCandidate[]
  verdicts: ReadonlyMap<string, ChildVerdict> | undefined
  titles: (list: readonly string[]) => string
}) {
  const { t } = useTranslation()
  const names = titles(recommended.map((c) => c.title))
  return (
    <div className="subtasks-merge-text" data-testid="subtasks-merge-advice">
      {recommended.length === 0
        ? t(TEXTS[vocabulary].none)
        : others.length > 0 &&
          (vocabulary === 'works' ? (
            <WorkAdvice recommended={names} others={others} verdicts={verdicts} titles={titles} />
          ) : (
            t('childrenMerge.recommended.only', { count: others.length, titles: names })
          ))}
    </div>
  )
}

/**
 * Conseil de la mère pour une carte de groupe : ce qu'elle recommande, puis, pour les autres,
 * ce qu'elle en a vraiment dit — « pas encore prêt » ou rien du tout. Rien ne la réveille pour
 * donner un avis plus tard : la phrase ne le promet pas (constat D9 de la recette, lot 264).
 */
function WorkAdvice({
  recommended,
  others,
  verdicts,
  titles
}: {
  recommended: string
  others: readonly MergeCandidate[]
  verdicts: ReadonlyMap<string, ChildVerdict> | undefined
  titles: (list: readonly string[]) => string
}) {
  const { t } = useTranslation()
  const notReady = others.filter((c) => {
    const v = verdicts?.get(c.id)
    return v !== undefined && !v.stale && !v.ready
  })
  const unadvised = others.filter((c) => !notReady.includes(c))
  const parts: string[] = [t('workGroup.merge.advice.recommended', { titles: recommended })]
  if (notReady.length > 0)
    parts.push(
      t('workGroup.merge.advice.notReady', {
        count: notReady.length,
        titles: titles(notReady.map((c) => c.title))
      })
    )
  if (unadvised.length > 0)
    parts.push(
      t('workGroup.merge.advice.unadvised', {
        count: unadvised.length,
        titles: titles(unadvised.map((c) => c.title))
      })
    )
  return <>{parts.join(t('workGroup.merge.advice.separator')) + t('workGroup.merge.advice.end')}</>
}
