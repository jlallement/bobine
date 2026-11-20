import { ChevronDown, ChevronRight, LoaderCircle } from 'lucide-react'
import { Fragment, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { ConversationSummary } from '@shared/agent'
import type { ChildVerdict } from '@shared/children'
import { mergeActive } from '@shared/children-merge'
import type { WorkCardData } from '@shared/role-request'
import type { TranscriptItem } from '@shared/transcript'
import { RoleAvatar, useRoleStyle } from '../roles/RoleAvatar'
import { FileStats, MergeOrVerdict, rowMerge, type SubtasksInfo } from './Subtasks'
import type { ChildrenMergeState } from './SubtasksMerge'
import { AGENT_BADGE, AVATAR, elapsedText, useNow, WorkCard, WorkReviews } from './WorkCard'
import {
  branchChanges,
  currentReport,
  exchangeStart,
  type WorkChanges,
  type WorkState
} from './work-card'

/**
 * Ligne lancée d'une carte de groupe (fiche 264, revue UX) : le titre seul en gras ; dessous, une
 * méta en texte gris séparée par « · » (rôle, ce qu'il fait ou sa branche, ses fichiers) ; une
 * seule colonne d'état à droite — la fusion, sinon la recommandation, sinon l'état — ; dépliable sur
 * la carte-réponse du travail.
 */

/** Ce qu'une ligne lancée sait de son travail. */
export interface RowWork {
  card: WorkCardData
  child: ConversationSummary | undefined
  state: WorkState
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

export function LaunchedRow({
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
  verdict: ChildVerdict | undefined
  activity: string | undefined
}) {
  const { t } = useTranslation()
  const { card, child, state } = work
  const [open, setOpen] = useState(false)
  const style = useRoleStyle(card.role?.color ?? AGENT_BADGE.color)
  const { mergeState } = rowMerge(merging, card.childId)
  const report = currentReport(card)
  const merged = mergeState === 'merged'
  // Sa fusion avance : ni « Répondre », ni « Relancer », ni l'« Arrêter » du tour (revue QA).
  const mergeBusy =
    !!merging.merge &&
    mergeActive(merging.merge) &&
    (mergeState === 'pending' || mergeState === 'merging' || mergeState === 'resolving')
  const changes = branchChanges(child?.branch ? merging.plan : undefined, card.childId, merged)
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
              {card.title}
            </span>
            <span className="work-group-meta" data-testid="work-row-meta">
              <RowMeta
                card={card}
                child={child}
                state={state}
                report={report}
                activity={activity}
                changes={changes}
              />
            </span>
          </span>
        </button>
        <span className="work-group-state" data-testid="work-row-state" data-state={state}>
          {mergeState || (verdict && state === 'replied') ? (
            // La fusion (« fusionné »), sinon la recommandation, remplacent « a répondu ».
            <MergeOrVerdict mergeState={mergeState} cleaned={false} verdict={verdict} works />
          ) : (
            stateKey && (
              <>
                {state === 'running' && <LoaderCircle size={13} className="spin" aria-hidden />}
                {t(stateKey)}
              </>
            )
          )}
        </span>
      </div>
      {open && (
        <div className="work-group-open" data-testid="work-row-open">
          <WorkCard
            card={card}
            items={items}
            info={info}
            inGroup
            plan={merging.plan}
            merged={merged}
            merging={mergeBusy}
          />
        </div>
      )}
      {/* Ses relectures (fiche 265) : juste sous sa ligne, dépliée ou non. */}
      <WorkReviews childId={card.childId} items={items} info={info} />
    </div>
  )
}

/** Des morceaux de texte séparés par « · ». */
function Dotted({ parts }: { parts: ReactNode[] }) {
  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {i > 0 && <span aria-hidden> · </span>}
          {part}
        </Fragment>
      ))}
    </>
  )
}

/**
 * Sous le titre : son rôle, puis en cours l'outil en cours et le temps écoulé ; fini, « lecture
 * seule », ou sa branche (coupée si longue) et ce qu'elle apporte contre sa base.
 */
function RowMeta({
  card,
  child,
  state,
  report,
  activity,
  changes
}: {
  card: WorkCardData
  child: ConversationSummary | undefined
  state: WorkState
  report: ReturnType<typeof currentReport>
  activity: string | undefined
  /** Sa branche contre sa base (fiche 264) ; `null` : rien à dire ; absent : sa dernière réponse. */
  changes: WorkChanges | null | undefined
}) {
  const { t } = useTranslation()
  const now = useNow(state === 'running')
  const role = card.role?.label
  const parts: ReactNode[] = role ? [role] : []
  if (state === 'running') {
    parts.push(activity ?? t('workCard.working'), elapsedText(now - exchangeStart(card)))
    return <Dotted parts={parts} />
  }
  if (card.role?.readOnly) {
    parts.push(t('workGroup.place.readOnly'))
    return <Dotted parts={parts} />
  }
  const branch = child?.branch ?? report?.branch ?? card.started?.branch
  if (branch) {
    parts.push(
      <span className="work-group-branch" title={branch}>
        {branch}
      </span>
    )
  } else parts.push(t('workGroup.place.folder'))
  const stats = changes === null ? undefined : (changes ?? report)
  if (changes?.empty && !changes.dirty) parts.push(t('workGroup.row.nothing'))
  // Rien de commité mais des modifications : seules elles sont dites (pas « rien modifié »).
  else if (stats && !(changes?.dirty && stats.fileCount === 0)) {
    parts.push(<FileStats report={stats} />)
  }
  if (changes?.dirty) parts.push(t('workCard.dirty', { count: changes.dirty }))
  return <Dotted parts={parts} />
}
