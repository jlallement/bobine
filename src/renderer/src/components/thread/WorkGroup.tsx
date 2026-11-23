import { LoaderCircle, Split } from 'lucide-react'
import { useContext, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { childState, type ChildProposalItem, type ChildVerdict } from '@shared/children'
import type { TranscriptItem } from '@shared/transcript'
import { costText, digestsPartial } from '@shared/usage'
import { groupWorkIds, type WorkGroupData, type WorkGroupRow } from '@shared/work-groups'
import { usePresentation } from '../../presentation'
import { useChildTools } from '../roles/RoleWork'
import { childModelAllowed, useMotherModel } from '../sidebar/child-options'
import {
  outcomeOf,
  ProposalRow,
  useProposalsLaunch,
  type ProposalsInfo,
  type StartRegistry
} from './ChildProposals'
import type { RespondElicitation } from './ElicitationCard'
import { rowMerge, type SubtasksInfo } from './Subtasks'
import { SubtasksMergeFooter, useChildrenMerge, type ChildrenMergeState } from './SubtasksMerge'
import { RoleRequestBubble, useNow } from './WorkCard'
import { LaunchedRow, type RowWork } from './WorkGroupRow'
import { WorkLayoutContext } from './work-layout-context'
import { currentReport, relayOf, workState, workUsage, type WorkState } from './work-card'

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
    // Toutes les filles de la conversation : la même clé que les autres cartes, un seul plan lu.
    useMotherChildren(info),
    items,
    ids
  )
  // Recommandations lues une fois dans le rangement du fil (revue QA).
  const layout = useContext(WorkLayoutContext)
  const verdicts = layout?.verdicts ?? NO_VERDICTS
  const activity = useChildTools(
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
  // Un coût par carte (fiche 266) : « gratuit » seulement si chaque travail l'est ; des travaux
  // qui ont répondu sans coût connu : la somme connue, « + coût inconnu » (revue UX).
  const digests = works
    .filter((w) => !['running', 'waiting', 'pending'].includes(w.state))
    .map((w) => workUsage(currentReport(w.card), w.child))
  const partial = presenting ? undefined : digestsPartial(digests)
  const cost = partial && costText(partial.total, partial.free)
  const costLabel =
    partial && partial.missing > 0 ? t('usage.costPartial', { cost: cost ?? '' }) : cost
  const costTip =
    partial && partial.missing > 0
      ? t('usage.costPartialTip', { count: partial.missing })
      : undefined
  const head = groupCounts(group, works, (id) => rowMerge(merging, id).mergeState === 'merged')
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
        {costLabel && (
          <span className="work-group-cost" data-testid="work-group-cost" title={costTip}>
            {costLabel}
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
              {/* Lancée, son travail pas encore dans le fil : il démarre (une clé le rangera ici) ;
                  son appel `start_child` a échoué (caché derrière la carte) : « pas lancé », la
                  raison en infobulle. */}
              {outcomeOf(row.proposal) === 'start' && row.proposal.prompt.child.key ? (
                launchFailure(items, row.proposal) !== undefined ? (
                  <span
                    className="proposal-state refuse"
                    data-testid="proposal-state"
                    data-failed=""
                    title={launchFailure(items, row.proposal)}
                  >
                    {t('workGroup.row.failed')}
                  </span>
                ) : (
                  <span className="proposal-state start" data-testid="proposal-state">
                    <LoaderCircle size={13} className="spin" aria-hidden />
                    {t('workGroup.row.starting')}
                  </span>
                )
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
                    // Dans l'ordre des lignes, pas celui de l'inscription (une ligne rendue à part
                    // se réinscrit en dernier) : le main les pose dans l'ordre demandé.
                    for (const row of pending) starts.get(row.proposal.requestId)?.()
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
              works={works}
              items={items}
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
  verdicts,
  works,
  items
}: {
  motherId: string
  info: SubtasksInfo
  merging: ChildrenMergeState
  verdicts: ReadonlyMap<string, ChildVerdict>
  works: readonly RowWork[]
  items: readonly TranscriptItem[]
}) {
  const { t } = useTranslation()
  if (!info.merge) return null
  const agent = info.agentLabel ?? t('workCard.mainAgent')
  // Transmission des réponses, en tête du pied (revue UX) : une phrase pour toute la carte.
  // Travaux lancés par l'agent : son réveil (« Tous les travaux ont répondu ») porte leurs
  // réponses ; il compte comme une transmission, même posé avant la dernière (revue UX, fiche 266).
  const woken = (w: RowWork) =>
    !!w.card.byAgent &&
    items.some(
      (x) => x.kind === 'user' && x.from?.kind === 'wake' && x.id > (w.card.anchor ?? Infinity)
    )
  const relays = works.flatMap((w) => {
    // Un travail mis à la corbeille ne transmet plus rien (fiche 272).
    if (w.state === 'gone') return []
    const relay = relayOf(currentReport(w.card), items)
    return relay ? [{ sent: relay.sent || woken(w), byAgent: !!w.card.byAgent }] : []
  })
  const pending = relays.filter((r) => !r.sent)
  const relay =
    relays.length === 0
      ? undefined
      : pending.length === 0
        ? t('workGroup.relayDone', { agent })
        : t(
            pending.every((r) => r.byAgent)
              ? 'workGroup.relayPendingWake'
              : 'workGroup.relayPending',
            { agent }
          )
  return (
    <div className="work-group-merge" data-testid="work-group-merge">
      {relay && (
        <div
          className={`work-group-relay${pending.length === 0 ? ' sent' : ''}`}
          data-testid="work-group-relay"
          data-sent={pending.length === 0}
        >
          {relay}
        </div>
      )}
      <SubtasksMergeFooter
        motherId={motherId}
        state={merging}
        actions={info.merge}
        verdicts={verdicts}
        works
        extra={
          // Rien à voir quand tous les travaux sont en lecture seule (fiche 272, recette).
          info.onShowChanges &&
          !works.every((w) => w.card.role?.readOnly) && (
            <button
              type="button"
              className="btn small work-group-changes"
              onClick={info.onShowChanges}
              data-testid="work-group-changes"
            >
              {t('workGroup.changes')}
            </button>
          )
        }
      />
    </div>
  )
}

/** Les filles de la conversation et leur état : la clé du plan partagé (fiche 264, revue QA). */
export function useMotherChildren(info: SubtasksInfo | undefined) {
  return useMemo(
    () =>
      (info?.children ?? []).map((child) => ({
        child,
        state: childState(child, info?.attention[child.id])
      })),
    [info?.children, info?.attention]
  )
}

/**
 * Échec du lancement d'une ligne (fiche 264) : son appel `start_child`, caché derrière la carte, a
 * fini en erreur ; son texte (la raison donnée à l'agent), sinon une chaîne vide.
 */
function launchFailure(
  items: readonly TranscriptItem[],
  proposal: ChildProposalItem
): string | undefined {
  const id = proposal.prompt.toolCallId
  if (!id) return undefined
  const tool = items.find((i) => i.kind === 'tool' && i.toolCallId === id)
  if (tool?.kind !== 'tool' || tool.status !== 'failed') return undefined
  return tool.content
    .flatMap((c) => (c.type === 'content' && c.content.type === 'text' ? [c.content.text] : []))
    .join('\n')
}

const NO_VERDICTS: ReadonlyMap<string, ChildVerdict> = new Map()

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
      ...(info?.exists && row.work ? { exists: info.exists(row.work.childId) } : {}),
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
  | 'workGroup.count.merged'
  | 'workGroup.count.stopped'
  | 'workGroup.count.error'
  | 'workGroup.count.gone'
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
  merged: (childId: string) => boolean
): { key: CountKey; count: number }[] {
  // Fusionné : la ligne le dit à la place de « a répondu », l'en-tête aussi (recette rc.4, T7).
  const fused = works.filter((w) => merged(w.card.childId))
  const rest = works.filter((w) => !fused.includes(w))
  const of = (states: WorkState[]) => rest.filter((w) => states.includes(w.state)).length
  // Lancée sans clé (conversation d'avant) : son travail s'affiche comme avant, hors de la carte.
  const outcomes = group.rows.flatMap((row) => {
    if (!row.proposal || row.work) return []
    const outcome = outcomeOf(row.proposal)
    return [outcome === 'start' && !row.proposal.prompt.child.key ? 'started' : outcome]
  })
  const decided = (outcome: string) => outcomes.filter((o) => o === outcome).length
  const counts: { key: CountKey; count: number }[] = [
    { key: 'workGroup.count.running', count: of(['running']) },
    { key: 'workGroup.count.waiting', count: of(['waiting']) },
    // Fini, réponse remise à la fin de celle de l'agent (`pending`) : il a répondu (maquette rc4).
    { key: 'workGroup.count.done', count: of(['replied', 'pending', 'silent', 'unknown']) },
    { key: 'workGroup.count.merged', count: fused.length },
    { key: 'workGroup.count.stopped', count: of(['stopped']) },
    { key: 'workGroup.count.error', count: of(['error']) },
    // Sa conversation partie (corbeille) : ni « a répondu », qu'elle ait répondu ou non (T7).
    { key: 'workGroup.count.gone', count: of(['gone']) },
    { key: 'workGroup.count.starting', count: decided('start') },
    { key: 'workGroup.count.started', count: decided('started') },
    { key: 'workGroup.count.here', count: decided('here') },
    { key: 'workGroup.count.refused', count: decided('refuse') },
    { key: 'workGroup.count.expired', count: decided('expired') }
  ]
  // Seuls les états présents se disent (pas « 0 en cours ») ; « a répondu » aussi tant que des
  // lignes restent proposées (maquette rc4 : un travail fini n'est pas tu pour autant).
  return counts.filter((c) => c.count > 0)
}
