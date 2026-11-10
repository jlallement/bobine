import {
  Ban,
  Bot,
  Check,
  ChevronRight,
  LoaderCircle,
  ShieldAlert,
  ShieldX,
  X,
  type LucideIcon
} from 'lucide-react'
import { memo, useContext, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatDuration, subagentResult, type Subagent, type SubagentRun } from '@shared/subagent'
import { subagentsState, type ToolItem } from '@shared/tool-groups'
import type { TranscriptItem } from '@shared/transcript'
import { formatCost } from '@shared/usage'
import { ipcErrorText } from '../../ipc-errors'
import { usePresentation } from '../../presentation'
import { SubagentWorkContext } from '../../subagent-work'
import { Markdown } from './Markdown'
import { PermissionView, ToolCall, type RespondPermission } from './ToolCall'

/**
 * Carte « Sous-agents » (fiche 117, après les fiches 010 et 053) : les sous-agents consécutifs d'un
 * tour, une ligne chacun (état, type, consigne, durée et coût), « Réponse » qui déplie le détail.
 * Distincte des cartes d'outils : un sous-agent est un travail à part, qu'on doit voir dans un fil
 * chargé. L'autorisation de lancer un sous-agent (Bob) reste sous la carte.
 */
export const SubagentsCard = memo(
  function SubagentsCard({
    items,
    onRespond
  }: {
    items: ToolItem[]
    onRespond: RespondPermission
  }) {
    const { t } = useTranslation()
    const presenting = usePresentation()
    const state = subagentsState(items)
    const counts = [
      state.running && t('toolCall.subagents.running', { count: state.running }),
      state.waiting && t('toolCall.subagents.waiting', { count: state.waiting }),
      state.done && t('toolCall.subagents.done', { count: state.done }),
      state.failed && t('toolCall.subagents.failed', { count: state.failed }),
      state.refused && t('toolCall.subagents.refused', { count: state.refused }),
      state.cancelled && t('toolCall.subagents.cancelled', { count: state.cancelled })
    ].filter(Boolean)
    return (
      <div className="subagents-block">
        <div className="subagents" data-testid="subagents" data-count={items.length}>
          <div className="subagents-head">
            <span className="subagents-badge" aria-hidden>
              <Bot size={14} />
            </span>
            <strong>{t('toolCall.subagents.title', { count: items.length })}</strong>
            {counts.length > 0 && (
              <span className="subagents-counts" data-testid="subagents-counts">
                · {counts.join(', ')}
              </span>
            )}
            {state.cost && !presenting && (
              <span
                className="subagents-cost"
                title={t('toolCall.subagents.cost')}
                data-testid="subagents-cost"
              >
                {formatCost(state.cost)}
              </span>
            )}
          </div>
          {items.map((item) => (
            <SubagentRow key={item.id} item={item} onRespond={onRespond} />
          ))}
        </div>
        {items.map((item) =>
          item.subagent && item.permission?.state === 'pending' ? (
            <PermissionView
              key={item.id}
              item={item}
              permission={item.permission}
              onRespond={onRespond}
              body={<SubagentDetails item={item} subagent={item.subagent} />}
            />
          ) : null
        )}
      </div>
    )
  },
  (a, b) =>
    a.onRespond === b.onRespond &&
    a.items.length === b.items.length &&
    a.items.every((item, i) => item === b.items[i])
)

const isRunning = (item: ToolItem) => item.status === 'pending' || item.status === 'in_progress'

/** Une ligne : état, type, consigne, durée et coût ; dépliée, le détail du sous-agent. */
function SubagentRow({ item, onRespond }: { item: ToolItem; onRespond: RespondPermission }) {
  const { t } = useTranslation()
  const subagent = item.subagent
  if (!subagent) return null
  const waiting = item.permission?.state === 'pending'
  const row = (
    <>
      <SubagentState item={item} waiting={waiting} />
      {subagent.type && <span className="subagent-type">{subagent.type}</span>}
      <span className="subagent-task" title={subagent.prompt ?? subagent.task}>
        {subagent.task}
      </span>
      {item.subagentRun && <SubagentMeta run={item.subagentRun} running={isRunning(item)} />}
    </>
  )
  const attributes = {
    'data-testid': 'subagent',
    'data-status': waiting ? 'waiting' : item.status,
    'data-subagent': subagent.type ?? ''
  }
  // En attente d'accord : le détail est dans la carte d'autorisation, sous la carte.
  if (waiting) {
    return (
      <div className="subagent-item" {...attributes}>
        <div className="subagent-row">{row}</div>
      </div>
    )
  }
  return (
    <details className="subagent-item" {...attributes}>
      <summary className="subagent-row">
        {row}
        <span className="subagent-toggle" data-testid="subagent-toggle">
          {t('toolCall.subagent.answer')}
          <ChevronRight size={13} className="chevron" />
        </span>
      </summary>
      <div className="subagent-body">
        <SubagentDetails item={item} subagent={subagent} />
        {item.permission && (
          <PermissionView item={item} permission={item.permission} onRespond={onRespond} />
        )}
      </div>
    </details>
  )
}

function SubagentState({ item, waiting }: { item: ToolItem; waiting: boolean }) {
  const { t } = useTranslation()
  const icon = (
    Icon: LucideIcon,
    state: 'waiting' | 'running' | 'completed' | 'failed' | 'refused' | 'cancelled',
    size = 14
  ) => (
    <Icon
      size={size}
      className={`subagent-state ${state}${state === 'running' ? ' spin' : ''}`}
      aria-label={t(`toolCall.state.${state}`)}
    />
  )
  if (waiting) return icon(ShieldAlert, 'waiting')
  switch (item.status) {
    case 'pending':
    case 'in_progress':
      return icon(LoaderCircle, 'running')
    case 'completed':
      return icon(Check, 'completed', 15)
    case 'failed':
      return icon(X, 'failed')
    case 'refused':
      return icon(ShieldX, 'refused')
    case 'cancelled':
      return icon(Ban, 'cancelled', 13)
  }
}

/** Heure courante, rafraîchie chaque seconde tant que `active`. */
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [active])
  return active ? now : 0
}

/**
 * Durée et coût d'un sous-agent (fiche 053) : la durée défile tant qu'il travaille, le coût (Bob)
 * se met à jour à chaque relecture de sa base.
 */
function SubagentMeta({ run, running }: { run: SubagentRun; running: boolean }) {
  const { t } = useTranslation()
  const presenting = usePresentation()
  const ticking = running && run.startedAt !== undefined && run.endedAt === undefined
  const now = useNow(ticking)
  const end = run.endedAt ?? (ticking ? Math.max(now, run.startedAt ?? 0) : undefined)
  const duration =
    run.startedAt !== undefined && end !== undefined
      ? formatDuration(end - run.startedAt)
      : undefined
  const cost = presenting ? undefined : run.cost
  if (!duration && !cost) return null
  return (
    <span className="subagent-meta" data-testid="subagent-meta">
      {duration && <span title={t('toolCall.subagent.duration')}>{duration}</span>}
      {cost && <span title={t('toolCall.subagent.cost')}>{formatCost(cost)}</span>}
    </span>
  )
}

/** Détail d'un sous-agent : sa consigne, puis sa réponse (sans les balises de l'agent). */
function SubagentDetails({ item, subagent }: { item: ToolItem; subagent: Subagent }) {
  const { t } = useTranslation()
  const load = useContext(SubagentWorkContext)
  // Lancé en arrière-plan (fiche 122) : son outil n'a rendu qu'un accusé de lancement ; la
  // réponse est celle lue dans sa session à sa fin, rien tant qu'il travaille.
  const run = item.subagentRun
  const answer = run?.background
    ? (run.answer ?? '')
    : item.content
        .flatMap((c) => (c.type === 'content' && c.content.type === 'text' ? [c.content.text] : []))
        .map(subagentResult)
        .filter(Boolean)
        .join('\n\n')
  return (
    <div className="subagent-details" data-testid="subagent-details">
      <div className="subagent-section">
        <div className="subagent-heading">{t('toolCall.subagent.prompt')}</div>
        <p className="subagent-prompt">{subagent.prompt ?? subagent.task}</p>
      </div>
      {answer && (
        <div className="subagent-section">
          <div className="subagent-heading">{t('toolCall.subagent.answer')}</div>
          <div className="subagent-answer" data-testid="subagent-answer">
            <Markdown text={answer} />
          </div>
        </div>
      )}
      {item.work ? (
        // Travail reçu en direct (OpenCode 2, fiche 078) : rien à rejouer.
        <WorkList items={item.work} answer={answer} />
      ) : item.subagentRun?.sessionId && load ? (
        <SubagentWork toolCallId={item.toolCallId} load={load} answer={answer} />
      ) : (
        <p className="subagent-note">{t('toolCall.subagent.noWork')}</p>
      )}
    </div>
  )
}

/**
 * « Voir son travail » (fiche 053) : la session du sous-agent est rejouée à part, à la demande, sans
 * appel au modèle ; ses outils et ses messages s'affichent comme dans le fil.
 */
function SubagentWork({
  toolCallId,
  load,
  answer
}: {
  toolCallId: string
  load: (toolCallId: string) => Promise<TranscriptItem[]>
  /** Réponse déjà affichée au-dessus : son dernier message, s'il la répète, n'est pas redonné. */
  answer: string
}) {
  const { t } = useTranslation()
  const [state, setState] = useState<
    | { kind: 'idle' }
    | { kind: 'loading' }
    | { kind: 'done'; items: TranscriptItem[] }
    | { kind: 'error'; message: string }
  >({ kind: 'idle' })
  const fetchWork = () => {
    setState({ kind: 'loading' })
    load(toolCallId).then(
      (items) => setState({ kind: 'done', items }),
      (error: unknown) => setState({ kind: 'error', message: ipcErrorText(error) })
    )
  }
  if (state.kind === 'done') return <WorkList items={state.items} answer={answer} />
  return (
    <div className="subagent-work-actions">
      <button
        type="button"
        className="link-button"
        onClick={fetchWork}
        disabled={state.kind === 'loading'}
        data-testid="subagent-work-show"
      >
        {state.kind === 'loading' ? (
          <>
            <LoaderCircle size={13} className="spin" /> {t('toolCall.subagent.loading')}
          </>
        ) : (
          t('toolCall.subagent.showWork')
        )}
      </button>
      {state.kind === 'error' && (
        <span className="subagent-work-error" role="alert">
          {state.message}
        </span>
      )}
    </div>
  )
}

const noRespond: RespondPermission = () => {}

/** Outils et messages d'un sous-agent, comme dans le fil ; sa réponse n'est pas redonnée. */
function WorkList({ items, answer }: { items: TranscriptItem[]; answer: string }) {
  const { t } = useTranslation()
  const shown = items.filter(
    (i) => i.kind === 'tool' || (i.kind === 'agent' && i.text.trim() !== answer.trim())
  )
  return (
    <div className="subagent-section">
      <div className="subagent-heading">{t('toolCall.subagent.work')}</div>
      <div className="subagent-work" data-testid="subagent-work">
        {shown.length === 0 && (
          <p className="subagent-note">{t('toolCall.subagent.nothingElse')}</p>
        )}
        {shown.map((child) =>
          child.kind === 'tool' ? (
            child.subagent ? (
              <SubagentsCard key={child.id} items={[child]} onRespond={noRespond} />
            ) : (
              <ToolCall key={child.id} item={child} onRespond={noRespond} />
            )
          ) : child.kind === 'agent' ? (
            <div key={child.id} className="subagent-work-text">
              <Markdown text={child.text} />
            </div>
          ) : null
        )}
      </div>
    </div>
  )
}
