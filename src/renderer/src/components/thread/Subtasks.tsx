import {
  Check,
  ChevronRight,
  CircleExclamationPoint,
  CircleDashed,
  CircleStop,
  GitBranch,
  GitPullRequestArrow,
  Send,
  Split
} from 'lucide-react'
import { useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { usePresentation } from '../../presentation'
import type { ConversationSummary } from '@shared/agent'
import type { AttentionState } from '@shared/attention'
import {
  childRecommendations,
  recapLead,
  type ChildState,
  type ChildVerdict
} from '@shared/children'
import { childRows } from '@shared/children-rows'
import type { TranscriptItem } from '@shared/transcript'
import { digestsTotal, formatCost, formatTokens, type UsageDigest } from '@shared/usage'
import { Markdown } from './Markdown'
import { ConversationStateIcon } from '../common/ConversationState'
import { Tip } from '../common/Menus'
export { ConversationStateIcon as ChildStateIcon } from '../common/ConversationState'
import {
  MergeRowBadge,
  rowMergeState,
  SubtasksMergeFooter,
  useChildrenMerge,
  type ChildrenMergeActions
} from './SubtasksMerge'
import { countText } from '@shared/i18n/format'

/**
 * Conversations filles dans le fil de la mère (fiche 097) : la ligne d'un lancement, la carte
 * « Sous-tâches » (une ligne par fille, état en direct) et le compte rendu de fin de tour.
 */

/** Ce que le fil sait des filles de la conversation affichée. */
export interface SubtasksInfo {
  /** Filles encore liées à cette conversation (liste des conversations). */
  children: ConversationSummary[]
  /** Conversations qui attendent l'utilisateur (fiche 024). */
  attention: AttentionState
  onOpen: (id: string) => void
  /** Conversation affichée, mère des filles (fusion de toutes les filles, fiche 120). */
  motherId?: string
  /** Fusion des filles finies depuis la carte (fiche 120) ; absent : pas de pied de carte. */
  merge?: ChildrenMergeActions
}

type Started = Extract<TranscriptItem, { kind: 'child-started' }>
type Instruction = Extract<TranscriptItem, { kind: 'child-instruction' }>
type Report = Extract<TranscriptItem, { kind: 'child-report' }>
type Recommendation = Extract<TranscriptItem, { kind: 'child-recommendation' }>

/**
 * Recommandation de fusion posée par la mère (`recommend_merge`, fiche 160) : une ligne dans son
 * fil, avec sa note. Rien n'est fusionné : c'est l'utilisateur qui fusionne.
 */
export function ChildRecommendationItem({ item }: { item: Recommendation }) {
  const { t } = useTranslation()
  const Icon = item.ready ? GitPullRequestArrow : CircleDashed
  return (
    <div
      className={`child-recommendation ${item.ready ? 'ready' : 'not-ready'}`}
      data-testid="child-recommendation"
      data-child-id={item.childId}
      data-ready={item.ready}
    >
      <Icon size={14} />
      <span>
        {t(
          item.ready ? 'children.recommendation.itemReady' : 'children.recommendation.itemNotReady',
          { title: item.title }
        )}
        {item.note && <span className="child-recommendation-note"> — {item.note}</span>}
      </span>
    </div>
  )
}

/** Pastille de la recommandation sur la ligne d'une fille, sa note en infobulle. */
export function VerdictBadge({ verdict }: { verdict: ChildVerdict }) {
  const { t } = useTranslation()
  const state = verdict.stale ? 'stale' : verdict.ready ? 'ready' : 'not-ready'
  const label = verdict.stale
    ? t('children.recommendation.stale')
    : t(verdict.ready ? 'children.recommendation.ready' : 'children.recommendation.notReady')
  const hint = verdict.stale ? t('children.recommendation.staleHint') : verdict.note
  return (
    <Tip label={hint}>
      <span
        className={`subtask-recommendation ${state}`}
        data-testid="subtask-recommendation"
        data-state={state}
      >
        {verdict.ready && !verdict.stale ? (
          <GitPullRequestArrow size={12} />
        ) : (
          <CircleDashed size={12} />
        )}
        {label}
      </span>
    </Tip>
  )
}

/** Texte exact, sans interprétation Markdown ni troncature, replié par défaut (fiche 150). */
function InstructionDetails({
  childId,
  prompt,
  testId,
  children
}: {
  childId: string
  prompt: string
  testId: string
  children: ReactNode
}) {
  return (
    <details className="child-instruction" data-testid={testId} data-child-id={childId}>
      <summary className="subtask-launch">
        {children}
        <ChevronRight size={14} className="chevron" />
      </summary>
      <div className="child-instruction-text" data-testid="child-instruction-text">
        {prompt}
      </div>
    </details>
  )
}

/** Consigne de reprise ; reste consultable même si l'appel d'outil est regroupé ou opaque. */
export function ChildInstructionItem({ item }: { item: Instruction }) {
  const { t } = useTranslation()
  return (
    <InstructionDetails childId={item.childId} prompt={item.prompt} testId="child-instruction">
      <Send size={14} />
      <span>{t('children.instructionFor', { title: item.title })}</span>
    </InstructionDetails>
  )
}

/** Fichiers modifiés et totaux, comme le compteur de l'en-tête : « 3 fichiers +62 −4 ». */
export function FileStats({ report }: { report: Pick<Report, 'fileCount' | 'added' | 'removed'> }) {
  const { t } = useTranslation()
  if (report.fileCount === 0) return <span>{t('children.report.noFiles')}</span>
  return (
    <span className="subtask-files">
      {t('children.files', { count: report.fileCount })}{' '}
      <span className="diff-added">+{countText(report.added)}</span>{' '}
      <span className="diff-removed">−{countText(report.removed)}</span>
    </span>
  )
}

/**
 * Consommation d'une fille (fiche 117), comme la puce de consommation : son coût dans son unité,
 * sinon ses jetons ; `undefined` sans consommation.
 */
export function useUsageText(): (usage: UsageDigest | undefined) => string | undefined {
  const { t } = useTranslation()
  // Mode présentation (fiche 159) : jetons seulement, aucun montant.
  const presenting = usePresentation()
  return (usage) => {
    if (usage?.cost && !presenting) return formatCost(usage.cost)
    if (usage?.total) return t('children.cost.tokens', { tokens: formatTokens(usage.total, true) })
    return undefined
  }
}

export function Branch({ name }: { name: string }) {
  return (
    <span className="subtask-branch" title={name}>
      <GitBranch size={12} />
      <span>{name}</span>
    </span>
  )
}

/**
 * Lancement d'une fille ; le dernier porte la carte « Sous-tâches » (`info`) : une ligne par fille,
 * dans l'ordre des lancements.
 */
export function ChildStarted({
  item,
  items,
  info
}: {
  item: Started
  items: readonly TranscriptItem[]
  info?: SubtasksInfo
}) {
  const { t } = useTranslation()
  return (
    <>
      <InstructionDetails childId={item.childId} prompt={item.prompt} testId="child-started">
        <Split size={14} />
        <span>
          {t(item.by === 'agent' ? 'children.startedByAgent' : 'children.started', {
            title: item.title
          })}
        </span>
      </InstructionDetails>
      {info && info.children.length > 0 && <SubtasksCard items={items} info={info} />}
    </>
  )
}

function SubtasksCard({ items, info }: { items: readonly TranscriptItem[]; info: SubtasksInfo }) {
  const { t } = useTranslation()
  const usageText = useUsageText()
  const rows = childRows(info.children, info.attention, items)
  const count = (states: ChildState[]) => rows.filter((r) => states.includes(r.state)).length
  const counts = [
    count(['running']) && t('children.card.running', { count: count(['running']) }),
    count(['waiting']) && t('children.card.waiting', { count: count(['waiting']) }),
    count(['done', 'unread']) && t('children.card.done', { count: count(['done', 'unread']) }),
    count(['error']) && t('children.card.error', { count: count(['error']) })
  ].filter(Boolean)
  const total = digestsTotal(rows.map((r) => r.child.usage))
  const presenting = usePresentation()
  const merging = useChildrenMerge(info.motherId, info.merge, rows, items)
  const verdicts = useMemo(() => childRecommendations(items), [items])
  return (
    <div className="subtasks" data-testid="subtasks">
      <div className="subtasks-head">
        <strong>{t('children.card.title')}</strong>
        {counts.length > 0 && <span className="muted"> · {counts.join(', ')}</span>}
        {total && !presenting && (
          <span
            className="subtasks-total"
            title={t('children.cost.total')}
            data-testid="subtasks-total"
          >
            {formatCost(total)}
          </span>
        )}
      </div>
      {rows.map(({ child, state, report }) => {
        const usage = usageText(child.usage)
        const mergeState = rowMergeState(merging, child.id)
        const cleaned = merging.merge?.rows.find((r) => r.childId === child.id)?.cleaned
        const verdict = verdicts.get(child.id)
        return (
          <div
            key={child.id}
            className="subtask-row"
            data-testid="subtask-row"
            data-id={child.id}
            data-state={state}
          >
            <span className="subtask-info">
              <span className="subtask-title">{child.title}</span>
              <span className="subtask-meta">
                {child.branch && <Branch name={child.branch} />}
                {report && <FileStats report={report} />}
                {usage && (
                  <span
                    className="subtask-cost"
                    title={t('children.cost.title')}
                    data-testid="subtask-cost"
                  >
                    {usage}
                  </span>
                )}
                {mergeState && (
                  <MergeRowBadge state={mergeState} {...(cleaned ? { cleaned } : {})} />
                )}
                {!mergeState && verdict && <VerdictBadge verdict={verdict} />}
              </span>
            </span>
            <Tip label={t(`children.state.${state}`)}>
              <button
                className="subtask-status"
                onClick={() => info.onOpen(child.id)}
                aria-label={t('children.openState', {
                  title: child.title,
                  state: t(`children.state.${state}`)
                })}
                data-testid="subtask-status"
              >
                <ConversationStateIcon state={state} />
              </button>
            </Tip>
            <button
              className="btn small"
              onClick={() => info.onOpen(child.id)}
              data-testid="subtask-open"
            >
              {t('children.open')}
            </button>
          </div>
        )
      })}
      {info.motherId && info.merge && (
        <SubtasksMergeFooter
          motherId={info.motherId}
          state={merging}
          actions={info.merge}
          verdicts={verdicts}
        />
      )}
    </div>
  )
}

const OUTCOME_ICONS = { done: Check, stopped: CircleStop, error: CircleExclamationPoint } as const

/**
 * Extrait d'un compte rendu, en hauteur bornée : le fondu n'est posé que s'il coupe vraiment
 * quelque chose (fiche 171) ; sinon un bloc coupé par le masque laissait un bandeau vide.
 */
export function ReportExcerpt({ id, text }: { id: string; text: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [clipped, setClipped] = useState(false)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setClipped(el.scrollHeight > el.clientHeight + 1)
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [text])
  return (
    <div
      ref={ref}
      id={id}
      className="child-report-excerpt"
      data-testid="child-report-excerpt"
      data-clipped={clipped || undefined}
    >
      <Markdown text={text} />
    </div>
  )
}

/**
 * Compte rendu d'une fille à la fin d'un tour, replié sur deux lignes (fiche 171) : titre et coût,
 * puis première phrase ; déplié, l'extrait et les métadonnées (branche, fichiers, échanges).
 * `pending` : pas encore parti à l'agent de la mère (il partira avec le prochain message de
 * l'utilisateur, ou au réveil de l'agent s'il a lancé la fille : `byAgent`).
 */
export function ChildReportItem({
  item,
  pending,
  byAgent = false,
  onOpen
}: {
  item: Report
  pending: boolean
  byAgent?: boolean
  /** Ouvrir la fille ; absent si elle a été supprimée. */
  onOpen?: () => void
}) {
  const { t } = useTranslation()
  const usageText = useUsageText()
  const [open, setOpen] = useState(false)
  const detailsId = useId()
  const Icon = OUTCOME_ICONS[item.outcome]
  // Ce qu'avait coûté la fille à ce compte rendu (fiche 117) ; rien pour un ancien compte rendu.
  const usage = usageText(item.usage)
  const turns = item.usage?.turns
  const headline = t(`children.report.${item.outcome}`, { title: item.title })
  const lead = recapLead(item.excerpt ?? '')
  return (
    <div
      className={`child-report ${item.outcome}`}
      data-testid="child-report"
      data-outcome={item.outcome}
      data-open={open || undefined}
    >
      <Icon size={14} className="child-report-icon" />
      <div className="child-report-body">
        <div className="child-report-head">
          {onOpen ? (
            <button className="link-button child-report-title" onClick={onOpen}>
              {headline}
            </button>
          ) : (
            <strong className="child-report-title">{headline}</strong>
          )}
          {usage && (
            <span
              className="child-report-usage"
              title={t('children.report.usage')}
              data-testid="child-report-usage"
            >
              {usage}
            </span>
          )}
        </div>
        <button
          className="child-report-toggle"
          aria-expanded={open}
          aria-controls={detailsId}
          onClick={() => setOpen((o) => !o)}
          data-testid="child-report-toggle"
        >
          {/* Déplié, l'extrait commence par cette phrase : le bouton ne la répète pas. */}
          {open ? (
            <span className="child-report-lead">{t('children.report.collapse')}</span>
          ) : (
            <span className="child-report-lead" data-testid="child-report-lead">
              {lead || t('children.report.expand')}
            </span>
          )}
          <ChevronRight size={14} className="chevron" aria-hidden />
          {!open && lead && <span className="sr-only">{t('children.report.expand')}</span>}
        </button>
        {open && (
          <div id={detailsId} className="child-report-details">
            {/* Début de la réponse de la fille, rendu comme le reste du fil, en hauteur bornée. */}
            {item.excerpt && <ReportExcerpt id={`${detailsId}-excerpt`} text={item.excerpt} />}
            <div className="child-report-meta">
              {item.branch && <Branch name={item.branch} />}
              <FileStats report={item} />
              {turns ? (
                <span data-testid="child-report-turns">
                  {t('children.report.turns', { count: turns })}
                </span>
              ) : null}
            </div>
          </div>
        )}
        {pending && (
          <div className="child-report-pending" data-testid="child-report-pending">
            {t(byAgent ? 'children.report.pendingWake' : 'children.report.pending')}
          </div>
        )}
      </div>
    </div>
  )
}
