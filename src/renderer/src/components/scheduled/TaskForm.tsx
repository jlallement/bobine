import { TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ProfileSummary } from '@shared/agent'
import {
  parseLocalDateTime,
  runsPerDay,
  toLocalDateTime,
  type Schedule,
  type ScheduleKind,
  type ScheduledTask,
  type ScheduledTaskInput
} from '@shared/schedule'

const KINDS: readonly ScheduleKind[] = ['daily', 'weekdays', 'interval', 'once']

interface Draft {
  name: string
  instruction: string
  folder: string
  profileId: string
  kind: ScheduleKind
  time: string
  at: string
  hours: string
  worktree: boolean
  catchUp: boolean
  capAmount: string
  capTokens: string
}

function draftOf(
  task: ScheduledTask | undefined,
  profiles: readonly ProfileSummary[],
  defaultProfileId: string | undefined
): Draft {
  const s = task?.schedule
  const inAnHour = new Date(Date.now() + 3_600_000)
  return {
    name: task?.name ?? '',
    instruction: task?.instruction ?? '',
    folder: task?.folder ?? '',
    // Agent des nouvelles conversations (jamais « le premier de la liste », qui peut être payant).
    profileId: task?.profileId ?? defaultProfileId ?? profiles[0]?.id ?? '',
    kind: s?.kind ?? 'daily',
    time: s && 'time' in s ? s.time : '09:00',
    at: s?.kind === 'once' ? s.at : toLocalDateTime(inAnHour),
    hours: s?.kind === 'interval' ? String(s.hours) : '4',
    worktree: task?.worktree ?? false,
    catchUp: task?.catchUp ?? true,
    capAmount: task?.cap?.amount !== undefined ? String(task.cap.amount) : '',
    capTokens: task?.cap?.tokens !== undefined ? String(task.cap.tokens) : ''
  }
}

function scheduleOf(d: Draft): Schedule {
  switch (d.kind) {
    case 'once':
      return { kind: 'once', at: d.at }
    case 'interval':
      return { kind: 'interval', hours: Number(d.hours) }
    default:
      return { kind: d.kind, time: d.time }
  }
}

const positive = (text: string) => {
  const n = Number(text.replace(',', '.'))
  return text.trim() && Number.isFinite(n) && n > 0 ? n : undefined
}

/** Saisie d'une tâche planifiée (fiche 178) : nouvelle, ou modification d'une tâche. */
export function TaskForm({
  task,
  prefill,
  profiles,
  defaultProfileId,
  onSave,
  onCancel
}: {
  task?: ScheduledTask
  /** Nouvelle tâche préremplie (astuce « Planifier… », fiche 191) : consigne et dossier. */
  prefill?: { instruction: string; folder: string }
  profiles: readonly ProfileSummary[]
  /** Agent des nouvelles conversations : choisi d'office pour une nouvelle tâche. */
  defaultProfileId?: string
  onSave: (input: ScheduledTaskInput) => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const [d, setD] = useState<Draft>(() => ({
    ...draftOf(task, profiles, defaultProfileId),
    ...(!task && prefill ? prefill : {})
  }))
  // Heure à l'ouverture du formulaire : une date « une fois » doit être après elle.
  const [openedAt] = useState(() => Date.now())
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setD({ ...d, [key]: value })
  const hours = Number(d.hours)
  const pastDate = d.kind === 'once' && (parseLocalDateTime(d.at)?.getTime() ?? 0) <= openedAt
  const perDay =
    d.kind === 'interval' && Number.isInteger(hours) && hours >= 1
      ? runsPerDay({ kind: 'interval', hours })
      : undefined
  const valid =
    d.instruction.trim() !== '' &&
    d.folder !== '' &&
    Boolean(d.profileId) &&
    !pastDate &&
    (d.kind !== 'interval' || (Number.isInteger(hours) && hours >= 1 && hours <= 24))
  const save = () => {
    const amount = positive(d.capAmount)
    const tokens = positive(d.capTokens)
    onSave({
      name: d.name.trim(),
      instruction: d.instruction.trim(),
      folder: d.folder,
      profileId: d.profileId,
      schedule: scheduleOf(d),
      worktree: d.worktree,
      catchUp: d.catchUp,
      ...(amount || tokens
        ? {
            cap: {
              ...(amount ? { amount } : {}),
              ...(tokens ? { tokens: Math.round(tokens) } : {})
            }
          }
        : {})
    })
  }
  const chooseFolder = () =>
    void window.api.workspace.choose().then((folder) => folder && set('folder', folder))

  return (
    <form
      className="settings-card scheduled-form"
      data-testid="scheduled-form"
      onSubmit={(e) => {
        e.preventDefault()
        if (valid) save()
      }}
    >
      <h3>{t(task ? 'scheduled.form.titleEdit' : 'scheduled.form.titleNew')}</h3>
      <label className="form-field">
        <span className="field-label">{t('scheduled.form.instruction')}</span>
        <textarea
          className="field-input scheduled-instruction"
          value={d.instruction}
          rows={3}
          placeholder={t('scheduled.form.instructionPlaceholder')}
          onChange={(e) => set('instruction', e.target.value)}
          data-testid="scheduled-instruction"
          autoFocus
        />
      </label>
      <label className="form-field">
        <span className="field-label">{t('scheduled.form.name')}</span>
        <input
          className="field-input"
          value={d.name}
          placeholder={t('scheduled.form.namePlaceholder')}
          onChange={(e) => set('name', e.target.value)}
          data-testid="scheduled-name"
        />
      </label>
      <div className="scheduled-form-row">
        <div className="form-field scheduled-folder">
          <span className="field-label">{t('scheduled.form.folder')}</span>
          <div className="scheduled-folder-line">
            <span className="scheduled-path" title={d.folder} data-testid="scheduled-folder">
              {/* Isolé : le début du chemin est coupé, sans renvoyer ses « / » à l'autre bout. */}
              <bdi>{d.folder || t('scheduled.form.noFolder')}</bdi>
            </span>
            <button type="button" className="btn small" onClick={chooseFolder}>
              {t('scheduled.form.chooseFolder')}
            </button>
          </div>
        </div>
        <label className="form-field">
          <span className="field-label">{t('scheduled.form.agent')}</span>
          <select
            className="field-input"
            value={d.profileId}
            onChange={(e) => set('profileId', e.target.value)}
            data-testid="scheduled-agent"
          >
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="scheduled-form-row">
        <label className="form-field">
          <span className="field-label">{t('scheduled.form.frequency')}</span>
          <select
            className="field-input"
            value={d.kind}
            onChange={(e) => set('kind', e.target.value as ScheduleKind)}
            data-testid="scheduled-kind"
          >
            {KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {t(`scheduled.form.kind.${kind}`)}
              </option>
            ))}
          </select>
        </label>
        {d.kind === 'once' ? (
          <label className={`form-field${pastDate ? ' invalid' : ''}`}>
            <span className="field-label">{t('scheduled.form.at')}</span>
            <input
              type="datetime-local"
              className="field-input"
              value={d.at}
              onChange={(e) => set('at', e.target.value)}
              data-testid="scheduled-at"
            />
            {pastDate && <span className="field-error">{t('scheduled.form.pastDate')}</span>}
          </label>
        ) : d.kind === 'interval' ? (
          <label className="form-field">
            <span className="field-label">{t('scheduled.form.hours')}</span>
            <input
              type="number"
              min={1}
              max={24}
              className="field-input scheduled-number"
              value={d.hours}
              onChange={(e) => set('hours', e.target.value)}
              data-testid="scheduled-hours"
            />
          </label>
        ) : (
          <label className="form-field">
            <span className="field-label">{t('scheduled.form.time')}</span>
            <input
              type="time"
              className="field-input"
              value={d.time}
              onChange={(e) => set('time', e.target.value)}
              data-testid="scheduled-time"
            />
          </label>
        )}
      </div>
      <label className="field-check">
        <input
          type="checkbox"
          checked={d.worktree}
          onChange={(e) => set('worktree', e.target.checked)}
          data-testid="scheduled-worktree"
        />
        {t('scheduled.form.worktree')}
      </label>
      {d.worktree && <p className="field-help">{t('scheduled.form.worktreeHint')}</p>}
      <label className="field-check">
        <input
          type="checkbox"
          checked={d.catchUp}
          onChange={(e) => set('catchUp', e.target.checked)}
          data-testid="scheduled-catch-up"
        />
        {t('scheduled.form.catchUp')}
      </label>
      <fieldset className="scheduled-cap">
        <legend className="field-label">{t('scheduled.form.capTitle')}</legend>
        <div className="scheduled-form-row">
          <label className="form-field">
            <span className="field-help">{t('scheduled.form.capAmount')}</span>
            <input
              inputMode="decimal"
              className="field-input scheduled-number"
              value={d.capAmount}
              onChange={(e) => set('capAmount', e.target.value)}
              data-testid="scheduled-cap-amount"
            />
          </label>
          <label className="form-field">
            <span className="field-help">{t('scheduled.form.capTokens')}</span>
            <input
              inputMode="numeric"
              className="field-input scheduled-number"
              value={d.capTokens}
              onChange={(e) => set('capTokens', e.target.value)}
              data-testid="scheduled-cap-tokens"
            />
          </label>
        </div>
        {/* Tâche fréquente sans plafond : c'est là que part l'argent. */}
        {perDay && !positive(d.capAmount) && !positive(d.capTokens) && (
          <p
            className="settings-note warn scheduled-warning"
            data-testid="scheduled-no-cap-warning"
          >
            <TriangleAlert size={14} />
            <span>{t('scheduled.form.noCapWarning', { count: Math.ceil(perDay) })}</span>
          </p>
        )}
        <p className="field-help">{t('scheduled.form.capHint')}</p>
      </fieldset>
      <p className="field-help">{t('scheduled.form.permissions')}</p>
      <div className="scheduled-form-actions">
        <button
          type="button"
          className="btn small ghost"
          onClick={onCancel}
          data-testid="scheduled-cancel"
        >
          {t('scheduled.form.cancel')}
        </button>
        <button
          type="submit"
          className="btn small primary"
          disabled={!valid}
          data-testid="scheduled-save"
        >
          {t('scheduled.form.save')}
        </button>
      </div>
    </form>
  )
}
