import { ChevronDown, ChevronRight, LoaderCircle, Split } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { ConversationSummary } from '@shared/agent'
import { childRecommendations, childState, type ChildProposalItem } from '@shared/children'
import type { WorkCardData } from '@shared/role-request'
import type { TranscriptItem } from '@shared/transcript'
import { digestsTotal, formatEstimate } from '@shared/usage'
import { groupWorkIds, type WorkGroupData, type WorkGroupRow } from '@shared/work-groups'
import { usePresentation } from '../../presentation'
import { RoleAvatar, useRoleStyle } from '../roles/RoleAvatar'
import { useChildActivity } from '../roles/RoleWork'
import { childModelAllowed, useMotherModel } from '../sidebar/child-options'
import {
  outcomeOf,
  ProposalRow,
  useProposalsLaunch,
  type ProposalsInfo,
  type StartRegistry
} from './ChildProposals'
import type { RespondElicitation } from './ElicitationCard'
import { Branch, FileStats, MergeOrVerdict, rowMerge, type SubtasksInfo } from './Subtasks'
import { SubtasksMergeFooter, useChildrenMerge, type ChildrenMergeState } from './SubtasksMerge'
import {
  AGENT_BADGE,
  AVATAR,
  elapsedText,
  RoleRequestBubble,
  useNow,
  WorkCard,
  workAgent
} from './WorkCard'
import {
  branchChanges,
  currentReport,
  exchangeStart,
  workState,
  workUsage,
  type WorkChanges,
  type WorkState
} from './work-card'

/**
 * Carte de groupe (fiche 264, écran D des maquettes de la fiche 260) : les travaux proposés par
 * l'agent dans un tour, ou lancés ensemble par une bulle à plusieurs rôles, dans une seule carte à
 * la place où ils ont été proposés. Elle change d'état sur place : proposés (Lancer, Faire ici,
 * Refuser, « Tout lancer ») → en cours, finis (chaque ligne se déplie sur la carte-réponse du
 * travail) → pied de fusion (« Fusionner les N prêts dans main »), progression et résultat ici.
 */

/**
 * Une carte de groupe à sa place dans le fil : seule (propositions), ou sous la bulle à plusieurs
 * rôles qui a lancé ses travaux (décision 5 de la fiche 260).
 */
export function WorkGroupEntry(props: Parameters<typeof WorkGroup>[0]) {
  if (!props.group.request) return <WorkGroup {...props} />
  return (
    <div className="role-request-group" data-testid="role-request-group">
      <RoleRequestBubble item={props.group.request} />
      <WorkGroup {...props} />
    </div>
  )
}

/** Ce qu'une ligne lancée sait de son travail. */
interface RowWork {
  card: WorkCardData
  child: ConversationSummary | undefined
  state: WorkState
}

export function WorkGroup({
  group,
  items,
  info,
  proposals,
  onRespond
}: {
  group: WorkGroupData
  items: readonly TranscriptItem[]
  info: SubtasksInfo | undefined
  proposals: ProposalsInfo | undefined
  onRespond: RespondElicitation
}) {
  const { t } = useTranslation()
  const presenting = usePresentation()
  const proposed = useMemo(
    () => group.rows.flatMap((row) => (row.proposal ? [row.proposal] : [])),
    [group.rows]
  )
  // Lignes encore à décider : la carte attend (focus, clavier, « Tout lancer »).
  const pending = group.rows.filter(
    (row): row is WorkGroupRow & { proposal: ChildProposalItem } =>
      !!row.proposal && !row.work && outcomeOf(row.proposal) === undefined
  )
  const launch = useProposalsLaunch(proposed, proposals)
  const model = useMotherModel(
    proposals?.mother.id ?? '',
    !!proposals && childModelAllowed(proposals.profiles, proposals.mother)
  )
  // Lancement de chaque ligne encore proposée, pour « Tout lancer » (un objet stable, pas un état).
  const [starts] = useState<StartRegistry>(() => new Map())
  const card = useRef<HTMLDivElement>(null)
  const [focus, setFocus] = useState(0)
  // La carte prend le focus à l'apparition si elle attend une réponse : on répond sans la souris.
  const askedAtMount = useRef(pending.length > 0)
  useEffect(() => {
    if (askedAtMount.current) card.current?.focus({ preventScroll: true })
  }, [])

  const works = useRowWorks(group, info)
  const ids = useMemo(() => groupWorkIds(group), [group])
  const merging = useChildrenMerge(
    info?.motherId,
    info?.merge,
    works.flatMap(({ child }) =>
      child ? [{ child, state: childState(child, info?.attention[child.id]) }] : []
    ),
    items,
    ids
  )
  const verdicts = useMemo(() => childRecommendations(items), [items])
  const activity = useChildActivity(
    works.filter((w) => w.state === 'running').map((w) => w.card.childId)
  )

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement
    if (target.tagName === 'SELECT' || target.tagName === 'INPUT') return
    if (pending.length === 0) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setFocus((f) => (f + (event.key === 'ArrowDown' ? 1 : pending.length - 1)) % pending.length)
    } else if (event.key === 'Enter' && target.tagName !== 'BUTTON') {
      event.preventDefault()
      const row = pending[Math.min(focus, pending.length - 1)]
      if (row) starts.get(row.proposal.requestId)?.()
    }
  }
  const total = digestsTotal(works.map((w) => workUsage(currentReport(w.card), w.child)))
  const cost =
    total && !presenting
      ? total.amount === 0
        ? t('workCard.free')
        : formatEstimate(total)
      : undefined
  const head = groupCounts(group, works, pending.length)
  return (
    <div
      className="work-group"
      ref={card}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      data-testid="work-group"
      data-pending={pending.length}
      data-stage={pending.length > 0 ? 'proposed' : works.length > 0 ? 'working' : 'decided'}
      aria-keyshortcuts={pending.length > 0 ? 'ArrowUp ArrowDown Enter' : undefined}
      aria-description={pending.length > 0 ? t('workGroup.keys') : undefined}
      // Lignes à lancer : le fil ne défile pas tout seul sous le pointeur (fiche 124).
      data-scroll-hold={pending.length > 0 ? '' : undefined}
    >
      <div className="work-group-head">
        <Split size={16} className="work-group-icon" aria-hidden />
        <strong className="work-group-title" data-testid="work-group-title">
          {pending.length > 0
            ? t('workGroup.titleProposed', { count: group.rows.length })
            : t('workGroup.title', { count: group.rows.length })}
        </strong>
        {pending.length > 0 && info?.agentLabel && (
          <span className="work-group-sub">· {t('workGroup.by', { agent: info.agentLabel })}</span>
        )}
        {head.length > 0 && (
          <span className="work-group-sub" data-testid="work-group-counts">
            · {head.map((c) => t(c.key, { count: c.count })).join(', ')}
          </span>
        )}
        <span className="grow" />
        {cost && (
          <span className="work-group-cost" data-testid="work-group-cost">
            {cost}
          </span>
        )}
      </div>
      {launch.place}
      <div className="work-group-rows">
        {group.rows.map((row) => {
          const work = works.find((w) => w.card.childId === row.work?.childId)
          if (work) {
            return (
              <LaunchedRow
                key={row.key}
                work={work}
                items={items}
                info={info}
                merging={merging}
                verdict={verdicts.get(work.card.childId)}
                activity={activity.get(work.card.childId)}
              />
            )
          }
          if (!row.proposal) return null
          const index = pending.findIndex((p) => p.key === row.key)
          return (
            <ProposalRow
              key={row.key}
              item={row.proposal}
              held={launch.held && !row.proposal.prompt.child.role?.readOnly}
              heldWhy={launch.heldWhy}
              {...(launch.anyway ? { uncommitted: 'anyway' as const } : {})}
              inFolder={launch.inFolder}
              {...(proposals ? { info: proposals } : {})}
              model={model}
              focused={index !== -1 && index === Math.min(focus, pending.length - 1)}
              onFocus={() => setFocus(Math.max(0, index))}
              onRespond={onRespond}
              starts={starts}
            >
              {/* Lancée, son travail pas encore dans le fil : il démarre (une clé le rangera ici). */}
              {outcomeOf(row.proposal) === 'start' && row.proposal.prompt.child.key ? (
                <span className="proposal-state start" data-testid="proposal-state">
                  <LoaderCircle size={13} className="spin" aria-hidden />
                  {t('workGroup.row.starting')}
                </span>
              ) : undefined}
            </ProposalRow>
          )
        })}
      </div>
      {pending.length > 0
        ? // Où partent les travaux, sauf si la ligne de lancement le dit déjà (fiche 262) ;
          // « Tout lancer » dès deux lignes à lancer (une seule : son « Lancer » suffit).
          (!launch.place || pending.length > 1) && (
            <div className="work-group-foot">
              {!launch.place && (
                <span className="work-group-note" data-testid="work-group-where">
                  {t(whereKey(proposed, launch.inFolder))}
                </span>
              )}
              <span className="grow" />
              {pending.length > 1 && (
                <button
                  type="button"
                  className="btn primary small"
                  title={t('workGroup.startAllLabel')}
                  disabled={launch.held}
                  onClick={() => {
                    for (const start of [...starts.values()]) start()
                  }}
                  data-testid="work-group-start-all"
                >
                  {t('workGroup.startAll')}
                </button>
              )}
            </div>
          )
        : info?.motherId &&
          info.merge &&
          ids.length > 0 && (
            <GroupMergeFoot
              motherId={info.motherId}
              info={info}
              merging={merging}
              verdicts={verdicts}
            />
          )}
    </div>
  )
}

/** Pied de fusion de la carte : seulement ses travaux, en « travaux ». */
function GroupMergeFoot({
  motherId,
  info,
  merging,
  verdicts
}: {
  motherId: string
  info: SubtasksInfo
  merging: ChildrenMergeState
  verdicts: ReturnType<typeof childRecommendations>
}) {
  if (!info.merge) return null
  return (
    <div className="work-group-merge" data-testid="work-group-merge">
      <SubtasksMergeFooter
        motherId={motherId}
        state={merging}
        actions={info.merge}
        verdicts={verdicts}
        works
      />
    </div>
  )
}

/** Où partent les travaux proposés, dit au pied de la carte. */
function whereKey(proposed: readonly ChildProposalItem[], inFolder: boolean) {
  if (inFolder) return 'workGroup.whereHere' as const
  const readers = proposed.filter((p) => p.prompt.child.role?.readOnly).length
  if (readers === 0) return 'workGroup.whereWorktree' as const
  return readers === proposed.length
    ? ('workGroup.whereReadOnly' as const)
    : ('workGroup.whereMixed' as const)
}

/** Travaux lancés de la carte, leur conversation et leur état ; l'heure avance pendant le travail. */
function useRowWorks(group: WorkGroupData, info: SubtasksInfo | undefined): RowWork[] {
  const [ticking, setTicking] = useState(true)
  const now = useNow(ticking)
  const works = group.rows.flatMap((row) => {
    if (!row.work) return []
    const child = info?.children.find((c) => c.id === row.work?.childId)
    const attention = child ? info?.attention[child.id] : undefined
    const state = workState(row.work, child, attention, now, {
      known: !!info,
      ...(info?.motherBusy ? { motherBusy: true } : {})
    })
    return [{ card: row.work, child, state }]
  })
  const running = works.some((w) => w.state === 'running')
  if (running !== ticking) setTicking(running)
  return works
}

type CountKey =
  | 'workGroup.count.running'
  | 'workGroup.count.waiting'
  | 'workGroup.count.done'
  | 'workGroup.count.stopped'
  | 'workGroup.count.error'
  | 'workGroup.count.starting'
  | 'workGroup.count.started'
  | 'workGroup.count.here'
  | 'workGroup.count.refused'
  | 'workGroup.count.expired'

/**
 * « 1 en cours, 2 finis » : les travaux lancés par état, puis les lignes décidées autrement
 * (faites ici, refusées, expirées). Les lignes encore proposées sont dites par le titre.
 */
function groupCounts(
  group: WorkGroupData,
  works: readonly RowWork[],
  pending: number
): { key: CountKey; count: number }[] {
  const of = (states: WorkState[]) => works.filter((w) => states.includes(w.state)).length
  // Lancée sans clé (conversation d'avant) : son travail s'affiche comme avant, hors de la carte.
  const outcomes = group.rows.flatMap((row) => {
    if (!row.proposal || row.work) return []
    const outcome = outcomeOf(row.proposal)
    return [outcome === 'start' && !row.proposal.prompt.child.key ? 'started' : outcome]
  })
  const decided = (outcome: string) => outcomes.filter((o) => o === outcome).length
  const counts: { key: CountKey; count: number }[] = [
    { key: 'workGroup.count.running', count: of(['running', 'pending']) },
    { key: 'workGroup.count.waiting', count: of(['waiting']) },
    { key: 'workGroup.count.done', count: of(['replied', 'silent', 'unknown', 'gone']) },
    { key: 'workGroup.count.stopped', count: of(['stopped']) },
    { key: 'workGroup.count.error', count: of(['error']) },
    { key: 'workGroup.count.starting', count: decided('start') },
    { key: 'workGroup.count.started', count: decided('started') },
    { key: 'workGroup.count.here', count: decided('here') },
    { key: 'workGroup.count.refused', count: decided('refuse') },
    { key: 'workGroup.count.expired', count: decided('expired') }
  ]
  // Tant que des lignes attendent, seules les décisions prises se disent (pas « 0 en cours »).
  return counts.filter((c) => c.count > 0 && (pending === 0 || c.key !== 'workGroup.count.done'))
}

const STATE_KEYS = {
  running: 'workGroup.state.running',
  pending: 'workGroup.state.running',
  waiting: 'workGroup.state.waiting',
  replied: 'workGroup.state.replied',
  silent: 'workGroup.state.silent',
  stopped: 'workGroup.state.stopped',
  error: 'workGroup.state.error',
  gone: 'workGroup.state.gone'
} as const satisfies Partial<Record<WorkState, string>>

/** Une ligne lancée : en-tête du travail, dépliable sur sa carte-réponse. */
function LaunchedRow({
  work,
  items,
  info,
  merging,
  verdict,
  activity
}: {
  work: RowWork
  items: readonly TranscriptItem[]
  info: SubtasksInfo | undefined
  merging: ChildrenMergeState
  verdict: ReturnType<ReturnType<typeof childRecommendations>['get']>
  activity: string | undefined
}) {
  const { t } = useTranslation()
  const { card, child, state } = work
  const [open, setOpen] = useState(false)
  const style = useRoleStyle(card.role?.color ?? AGENT_BADGE.color)
  const { mergeState, cleaned } = rowMerge(merging, card.childId)
  const report = currentReport(card)
  const name = card.role ? `${card.role.label} — ${card.title}` : card.title
  const stateKey = state === 'unknown' ? undefined : STATE_KEYS[state]
  return (
    <div
      className={`work-group-item${open ? ' open' : ''}`}
      style={style}
      data-testid="work-row"
      data-child-id={card.childId}
      data-state={state}
      data-role={card.role?.name}
      data-work-anchor={card.anchor}
    >
      <div className="work-group-row">
        <button
          type="button"
          className="work-group-toggle"
          aria-expanded={open}
          aria-label={t('workGroup.row.toggle', { title: card.title })}
          onClick={() => setOpen((o) => !o)}
          data-testid="work-row-toggle"
        >
          {open ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />}
          <RoleAvatar role={card.role ?? AGENT_BADGE} size={22} state={AVATAR[state]} />
          <span className="work-group-text">
            <span className="work-group-name" data-testid="work-row-name">
              {name}
            </span>
            <span className="work-group-meta" data-testid="work-row-meta">
              <RowMeta
                card={card}
                child={child}
                info={info}
                state={state}
                report={report}
                activity={activity}
                changes={branchChanges(
                  child?.branch ? merging.plan : undefined,
                  card.childId,
                  mergeState === 'merged'
                )}
              />
            </span>
          </span>
        </button>
        <MergeOrVerdict mergeState={mergeState} cleaned={cleaned} verdict={verdict} works />
        {stateKey && (
          <span className="work-group-state" data-testid="work-row-state" data-state={state}>
            {state === 'running' && <LoaderCircle size={13} className="spin" aria-hidden />}
            {t(stateKey)}
          </span>
        )}
      </div>
      {open && (
        <div className="work-group-open" data-testid="work-row-open">
          <WorkCard
            card={card}
            items={items}
            info={info}
            inGroup
            plan={merging.plan}
            merged={mergeState === 'merged'}
          />
        </div>
      )}
    </div>
  )
}

/**
 * Sous le nom : en cours, l'outil en cours et le temps écoulé ; fini, sa branche et ses fichiers
 * (ou « lecture seule ») ; sans rôle, l'agent qui le fait.
 */
function RowMeta({
  card,
  child,
  info,
  state,
  report,
  activity,
  changes
}: {
  card: WorkCardData
  child: ConversationSummary | undefined
  info: SubtasksInfo | undefined
  state: WorkState
  report: ReturnType<typeof currentReport>
  activity: string | undefined
  /** Sa branche contre sa base (fiche 264) ; `null` : rien à dire ; absent : sa dernière réponse. */
  changes: WorkChanges | null | undefined
}) {
  const { t } = useTranslation()
  const now = useNow(state === 'running')
  const agent = card.role ? undefined : workAgent(child, info)
  const who = agent ? t('workCard.otherAgent', { agent }) : undefined
  if (state === 'running') {
    return (
      <>{[activity ?? t('workCard.working'), elapsedText(now - exchangeStart(card))].join(' · ')}</>
    )
  }
  if (card.role?.readOnly) {
    return <>{[who, t('workGroup.place.readOnly')].filter(Boolean).join(' · ')}</>
  }
  const branch = child?.branch ?? report?.branch ?? card.started?.branch
  return (
    <>
      {who && <span>{who}</span>}
      {branch && <Branch name={branch} />}
      {changes !== null && (changes ?? report) && (
        <FileStats report={(changes ?? report) as WorkChanges} />
      )}
      {!branch && !report && !who && t('workGroup.place.folder')}
    </>
  )
}
