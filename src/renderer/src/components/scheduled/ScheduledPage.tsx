import * as Dropdown from '@radix-ui/react-dropdown-menu'
import {
  CalendarClock,
  Ellipsis,
  GitBranch,
  Info,
  Pause,
  Pencil,
  Play,
  Plus,
  Trash2
} from 'lucide-react'
import { EmptyState } from '../common/EmptyState'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { HelpLink } from '../help/HelpLink'
import { useTipsContext } from '../../useTips'
import type { TFunction } from 'i18next'
import type { ProfileSummary } from '@shared/agent'
import { formatCap, TOKEN_UNIT } from '@shared/cost-cap'
import { currentLocale } from '@shared/i18n/format'
import {
  estimateCost,
  knownUnit,
  runsPerDay,
  parseLocalDateTime,
  type Schedule,
  type ScheduledTask,
  type ScheduledTaskInput,
  type TaskRun
} from '@shared/schedule'
import { formatCost } from '@shared/usage'
import { ipcErrorText } from '../../ipc-errors'
import { useProfileStatus } from '../common/Profile'
import { TaskForm } from './TaskForm'
import './scheduled.css'

/** Exécutions montrées par tâche (le fichier en garde davantage). */
const SHOWN_RUNS = 5

const dateTime = (date: Date) =>
  new Intl.DateTimeFormat(currentLocale(), { dateStyle: 'medium', timeStyle: 'short' }).format(date)

export function describeSchedule(schedule: Schedule, t: TFunction): string {
  switch (schedule.kind) {
    case 'once': {
      const at = parseLocalDateTime(schedule.at)
      return t('scheduled.schedule.once', { date: at ? dateTime(at) : schedule.at })
    }
    case 'interval':
      return t('scheduled.schedule.interval', { count: schedule.hours })
    default:
      return t(`scheduled.schedule.${schedule.kind}`, { time: schedule.time })
  }
}

function capText(task: ScheduledTask, t: TFunction): string {
  const { amount, tokens } = task.cap ?? {}
  // Unité de l'agent connue d'une exécution passée : le plafond qui s'appliquera, dans cette unité.
  const unit = knownUnit(task.runs)
  if (unit) {
    const limit = unit === TOKEN_UNIT ? tokens : amount
    return limit !== undefined
      ? t('scheduled.cap', { cap: formatCap(limit, unit) })
      : t('scheduled.noCap')
  }
  const amountText =
    amount !== undefined
      ? t('scheduled.capAmount', { amount: new Intl.NumberFormat(currentLocale()).format(amount) })
      : undefined
  const tokensText = tokens !== undefined ? formatCap(tokens, TOKEN_UNIT) : undefined
  if (amountText && tokensText)
    return t('scheduled.capBoth', { amount: amountText, tokens: tokensText })
  const one = amountText ?? tokensText
  return one ? t('scheduled.cap', { cap: one }) : t('scheduled.noCap')
}

/** Coût estimé par exécution et, pour une tâche fréquente, par jour (là où part l'argent). */
function estimateTexts(task: ScheduledTask, t: TFunction): string[] {
  const estimate = estimateCost(task.runs)
  if (!estimate) return [t('scheduled.noEstimate')]
  const [amount, unit] =
    'currency' in estimate ? [estimate.amount, estimate.currency] : [estimate.tokens, TOKEN_UNIT]
  const perRun = t('scheduled.estimate', { cost: formatCap(amount, unit), count: estimate.runs })
  const perDay = runsPerDay(task.schedule)
  if (!perDay) return [perRun]
  const daily = unit === TOKEN_UNIT ? Math.round(amount * perDay) : amount * perDay
  return [perRun, t('scheduled.perDay', { cost: formatCap(daily, unit) })]
}

function RunRow({ run, onOpen }: { run: TaskRun; onOpen: (id: string) => void }) {
  const { t } = useTranslation()
  const tags = [
    ...(run.manual ? [t('scheduled.manual')] : []),
    ...(run.catchUp ? [t('scheduled.catchUp')] : []),
    ...(run.setupNotApproved ? [t('scheduled.setupNotApproved')] : []),
    ...(run.missed && run.missed > 1 ? [t('scheduled.missedCount', { count: run.missed })] : [])
  ]
  const cost = run.cost
    ? formatCost(run.cost)
    : run.tokens !== undefined
      ? formatCap(run.tokens, TOKEN_UNIT)
      : undefined
  return (
    <li className="scheduled-run" data-testid="scheduled-run" data-outcome={run.outcome}>
      <span className="scheduled-run-time">{dateTime(new Date(run.at))}</span>
      <span className={`scheduled-outcome ${run.outcome}`} title={run.error}>
        {t(`scheduled.outcome.${run.outcome}`)}
      </span>
      {tags.length > 0 && <span className="scheduled-run-tags">{tags.join(' · ')}</span>}
      <span className="grow" />
      {cost && <span className="scheduled-run-cost">{cost}</span>}
      {run.conversationId && (
        <button
          className="btn small ghost"
          title={t('scheduled.openTip')}
          onClick={() => run.conversationId && onOpen(run.conversationId)}
          data-testid="scheduled-run-open"
        >
          {t('scheduled.open')}
        </button>
      )}
    </li>
  )
}

function TaskCard({
  task,
  agent,
  onOpen,
  onEdit,
  act
}: {
  task: ScheduledTask
  agent: string
  onOpen: (id: string) => void
  onEdit: () => void
  act: (call: () => Promise<ScheduledTask[]>) => void
}) {
  const { t } = useTranslation()
  const [confirming, setConfirming] = useState(false)
  const running = task.runs.some((r) => r.outcome === 'running')
  const next = task.paused
    ? t('scheduled.paused')
    : task.nextRunAt
      ? t('scheduled.next', { date: dateTime(new Date(task.nextRunAt)) })
      : t('scheduled.noNext')
  const folder = task.folder.split('/').filter(Boolean).at(-1) ?? task.folder
  return (
    <article
      className={`settings-card scheduled-task${task.paused ? ' paused' : ''}`}
      data-testid="scheduled-task"
      data-id={task.id}
    >
      <header className="scheduled-task-head">
        <CalendarClock size={16} className="scheduled-task-icon" />
        <div className="scheduled-task-title">
          <h3 data-testid="scheduled-task-name">{task.name}</h3>
          <p className="scheduled-meta">
            <span>{describeSchedule(task.schedule, t)}</span>
            <span>{agent}</span>
            <span title={task.folder}>{folder}</span>
            {task.worktree && (
              <span className="scheduled-worktree">
                <GitBranch size={12} /> {t('scheduled.worktree')}
              </span>
            )}
          </p>
        </div>
        <span
          className={`scheduled-next${task.paused ? ' paused' : ''}`}
          data-testid="scheduled-next"
        >
          {next}
        </span>
      </header>
      <p className="scheduled-instruction-preview">{task.instruction}</p>
      <p className="scheduled-cost" data-testid="scheduled-cost">
        {estimateTexts(task, t).map((text) => (
          <span key={text}>{text}</span>
        ))}
        <span>{capText(task, t)}</span>
      </p>
      <div className="scheduled-runs">
        <h4>{t('scheduled.runs')}</h4>
        {task.runs.length === 0 ? (
          <p className="field-help">{t('scheduled.noRuns')}</p>
        ) : (
          <ul>
            {task.runs.slice(0, SHOWN_RUNS).map((run) => (
              <RunRow key={run.id} run={run} onOpen={onOpen} />
            ))}
          </ul>
        )}
      </div>
      {confirming ? (
        <div className="scheduled-actions confirm" data-testid="scheduled-confirm-delete">
          <span>{t('scheduled.actions.confirmDelete', { name: task.name })}</span>
          <span className="grow" />
          <button className="btn small ghost" onClick={() => setConfirming(false)}>
            {t('scheduled.actions.cancel')}
          </button>
          <button
            className="btn small danger"
            onClick={() => act(() => window.api.schedule.remove(task.id))}
            data-testid="scheduled-delete-confirm"
          >
            {t('scheduled.actions.delete')}
          </button>
        </div>
      ) : (
        <div className="scheduled-actions">
          <button
            className="btn small"
            disabled={running}
            onClick={() => act(() => window.api.schedule.runNow(task.id))}
            data-testid="scheduled-run-now"
          >
            <Play size={13} /> {t('scheduled.actions.runNow')}
          </button>
          <button
            className="btn small ghost"
            onClick={() => act(() => window.api.schedule.setPaused(task.id, !task.paused))}
            data-testid="scheduled-pause"
          >
            <Pause size={13} />{' '}
            {t(task.paused ? 'scheduled.actions.resume' : 'scheduled.actions.pause')}
          </button>
          <button className="btn small ghost" onClick={onEdit} data-testid="scheduled-edit">
            <Pencil size={13} /> {t('scheduled.actions.edit')}
          </button>
          <span className="grow" />
          {/* Supprimer dans « … » : la rangée tient sur une ligne, et l'action demande confirmation. */}
          <Dropdown.Root modal={false}>
            <Dropdown.Trigger
              className="btn small ghost scheduled-more"
              aria-label={t('scheduled.actions.more')}
              data-testid="scheduled-more"
            >
              <Ellipsis size={15} />
            </Dropdown.Trigger>
            <Dropdown.Portal>
              <Dropdown.Content className="menu" align="end" sideOffset={4}>
                <Dropdown.Item
                  className="menu-item danger"
                  onSelect={() => setConfirming(true)}
                  data-testid="scheduled-delete"
                >
                  <Trash2 size={15} className="menu-icon" />
                  {t('scheduled.actions.delete')}…
                </Dropdown.Item>
              </Dropdown.Content>
            </Dropdown.Portal>
          </Dropdown.Root>
        </div>
      )}
    </article>
  )
}

/**
 * « Tâches planifiées » (fiche 178) : une page de la fenêtre principale, comme « Mon activité »
 * (ADR-0031). Le main garde les tâches et les lance ; la page les liste et les modifie.
 */
export function ScheduledPage({
  onOpenConversation,
  profiles,
  defaultProfileId
}: {
  onOpenConversation: (id: string) => void
  profiles: readonly ProfileSummary[]
  defaultProfileId?: string
}) {
  const { t } = useTranslation()
  const { readOnly } = useProfileStatus()
  const [tasks, setTasks] = useState<ScheduledTask[] | null>(null)
  // Astuce « Planifier… » (fiche 191) : la page s'ouvre sur une nouvelle tâche préremplie.
  const tips = useTipsContext()
  const [prefill] = useState(() => tips?.plan)
  const clearPlan = tips?.clearPlan
  useEffect(() => {
    if (prefill) clearPlan?.()
  }, [prefill, clearPlan])
  const [editing, setEditing] = useState<string | 'new' | null>(prefill ? 'new' : null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    window.api.schedule.list().then(
      (list) => live && setTasks(list),
      (e: unknown) => live && setError(ipcErrorText(e))
    )
    const stop = window.api.schedule.onChanged(setTasks)
    return () => {
      live = false
      stop()
    }
  }, [])
  const act = (call: () => Promise<ScheduledTask[]>) => {
    setError(null)
    call().then(setTasks, (e: unknown) => setError(ipcErrorText(e)))
  }
  const save = (id: string | null, input: ScheduledTaskInput) => {
    setError(null)
    window.api.schedule.save(id, input).then(
      (list) => {
        setTasks(list)
        setEditing(null)
        // Une tâche créée : l'astuce « Planifier… » n'a plus lieu d'être.
        if (!id) tips?.used('scheduled')
      },
      (e: unknown) => setError(ipcErrorText(e))
    )
  }
  const agentOf = (id: string) => profiles.find((p) => p.id === id)?.label ?? id
  const edited = tasks?.find((task) => task.id === editing)

  return (
    <div className="activity-scroll" data-testid="scheduled-page">
      <section className="activity scheduled">
        <div className="scheduled-intro">
          <p>{t('scheduled.intro')}</p>
          {/* Profil en lecture seule (fiche 196) : aucune tâche ne se lance, rien ne se change. */}
          {readOnly && (
            <p className="readonly-line" data-testid="scheduled-readonly">
              {t('profile.readOnly.scheduled')}{' '}
              <button
                className="link-button"
                onClick={() => void window.api.profile.openReleases()}
              >
                {t('profile.readOnly.update')}
              </button>
            </p>
          )}
          <p className="settings-note scheduled-open-only" data-testid="scheduled-open-only">
            <Info size={14} />
            <span>
              {t('scheduled.openOnly')} {t('scheduled.keepAwake')}
            </span>
          </p>
        </div>
        {error && (
          <p className="field-error" role="alert" data-testid="scheduled-error">
            {error}
          </p>
        )}
        {editing === 'new' || edited ? (
          <TaskForm
            key={editing}
            task={edited}
            {...(editing === 'new' && prefill ? { prefill } : {})}
            profiles={profiles}
            defaultProfileId={defaultProfileId}
            onSave={(input) => save(edited?.id ?? null, input)}
            onCancel={() => {
              setEditing(null)
              // Tâche préremplie par l'astuce, pas enregistrée : retour à la conversation.
              if (editing === 'new' && prefill) tips?.leavePlan?.()
            }}
          />
        ) : (
          <div className="scheduled-toolbar">
            <h2>
              {t('scheduled.list')}
              <HelpLink topic="scheduledTasks" section={t('scheduled.title')} />
            </h2>
            <span className="grow" />
            <button
              className="btn small primary"
              onClick={() => setEditing('new')}
              disabled={readOnly}
              data-testid="scheduled-new"
            >
              <Plus size={13} /> {t('scheduled.new')}
            </button>
          </div>
        )}
        {tasks && tasks.length === 0 && editing === null && (
          <EmptyState
            level={3}
            icon={CalendarClock}
            accent
            title={t('scheduled.empty')}
            text={t('scheduled.emptyHint')}
            testId="scheduled-empty"
          />
        )}
        {editing === null &&
          tasks?.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              agent={agentOf(task.profileId)}
              onOpen={onOpenConversation}
              onEdit={() => setEditing(task.id)}
              act={act}
            />
          ))}
      </section>
    </div>
  )
}
