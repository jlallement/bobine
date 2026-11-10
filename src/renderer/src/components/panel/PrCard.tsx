import {
  CircleCheck,
  CircleDashed,
  CircleMinus,
  CircleX,
  Clock,
  GitMerge,
  GitPullRequest,
  RefreshCw,
  Wrench
} from 'lucide-react'
import type { TFunction } from 'i18next'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  mergeNowBlocker,
  mergeWait,
  type CheckState,
  type CiState,
  type MergeWait,
  type PrCheck,
  type PrEvent,
  type PrOptions,
  type PrTrack,
  type PrView
} from '@shared/pr-tracking'
import { ipcErrorText } from '../../ipc-errors'
import '../../pr-card.css'

const CHECK_ICON: Record<CheckState, typeof CircleCheck> = {
  passed: CircleCheck,
  failed: CircleX,
  pending: CircleDashed,
  skipped: CircleMinus
}

/** Sans contrôle (0.9.1, D16) : ce que la ligne des contrôles dit, et sa couleur. */
const NO_CHECKS: Record<
  CiState,
  { key: 'checksAwaited' | 'checksSilent' | 'checksNoCi'; tone: string }
> = {
  awaited: { key: 'checksAwaited', tone: 'awaited' },
  silent: { key: 'checksSilent', tone: 'none' },
  none: { key: 'checksNoCi', tone: 'none' }
}

/** Raisons d'attente dites sans alarme : la fusion viendra d'elle-même, ou au clic. */
const CALM_WAITS: readonly MergeWait[] = ['pending', 'awaited', 'no-ci', 'mergeability']

/** Compte des contrôles par état, pour « 2 en échec · 1 en cours · 3 réussis ». */
export function checksLine(checks: readonly PrCheck[], t: TFunction, ci?: CiState): string {
  if (checks.length === 0) return ci ? t(`prTrack.${NO_CHECKS[ci].key}`) : t('prTrack.checks.none')
  const parts: string[] = []
  for (const state of ['failed', 'pending', 'passed', 'skipped'] as const) {
    const count = checks.filter((c) => c.state === state).length
    if (count > 0) parts.push(t(`prTrack.checks.${state}`, { count }))
  }
  return parts.join(' · ')
}

/**
 * Carte « Pull request » de la barre du worktree (fiche 176) : état de la PR de la branche, ses
 * contrôles de CI, commentaires et conflits ; « Corriger les contrôles en échec » ; les deux choix
 * d'office, décochés par défaut. Rien sans PR ou sans `gh` (la barre dit déjà ce qui manque).
 */
export function PrCard({
  conversationId,
  track,
  onRefresh
}: {
  conversationId: string
  track: PrTrack | null
  /** « Actualiser » relit aussi l'état git de la barre (fiche 176, D15). */
  onRefresh?: () => void
}) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState<'refresh' | 'fix' | 'options' | 'merge' | null>(null)
  const [error, setError] = useState<string | null>(null)
  if (!track || track.status === 'unavailable' || track.status === 'none') return null
  const api = window.api.pr
  const act = async (what: NonNullable<typeof busy>, action: () => Promise<unknown>) => {
    setBusy(what)
    setError(null)
    try {
      await action()
    } catch (e: unknown) {
      setError(ipcErrorText(e))
    } finally {
      setBusy(null)
    }
  }
  const refresh = (
    <button
      className="btn small ghost pr-refresh"
      disabled={busy !== null}
      title={t('prTrack.refresh')}
      aria-label={t('prTrack.refresh')}
      onClick={() => {
        onRefresh?.()
        void act('refresh', () => api.refresh(conversationId))
      }}
      data-testid="pr-refresh"
    >
      <RefreshCw size={13} className={busy === 'refresh' ? 'spin' : undefined} />
    </button>
  )
  if (track.status === 'error') {
    return (
      <div className="pr-card" data-testid="pr-card">
        <div className="pr-head">
          <GitPullRequest size={13} />
          <span className="pr-error" data-testid="pr-error">
            {t('prTrack.error', { message: track.message })}
          </span>
          {refresh}
        </div>
      </div>
    )
  }
  const { pr, options, event, ci } = track
  const setOption = (change: Partial<PrOptions>) =>
    void act('options', () => api.setOptions(conversationId, change))
  // Fusion d'office cochée mais pas faite : pourquoi (0.9.1, D20).
  const wait = options.autoMerge && event?.kind !== 'merged' ? mergeWait(pr, ci) : undefined
  // Aucune CI détectée : la fusion se fait au clic, si GitHub ne s'y oppose pas.
  const nowBlocker = ci === 'none' ? mergeNowBlocker(pr, ci) : undefined
  return (
    <div className="pr-card" data-testid="pr-card" data-summary={pr.summary}>
      <div className="pr-head">
        <GitPullRequest size={13} />
        <a
          href={pr.url}
          target="_blank"
          rel="noreferrer"
          className="pr-title"
          data-testid="pr-link"
        >
          {t('prTrack.title', { number: pr.number, title: pr.title })}
        </a>
        <span
          className={`pr-state pr-state-${pr.draft ? 'draft' : pr.state}`}
          data-testid="pr-state"
        >
          {t(`prTrack.state.${pr.draft && pr.state === 'open' ? 'draft' : pr.state}`)}
        </span>
        {refresh}
      </div>
      <PrDetails pr={pr} {...(ci ? { ci } : {})} />
      {track.rulesUnreadable && (
        <div className="pr-meta muted" data-testid="pr-rules-unreadable">
          {t('prTrack.rulesUnreadable')}
        </div>
      )}
      {pr.state === 'open' && (
        <div className="pr-actions">
          {pr.summary === 'failed' && (
            <button
              className="btn small primary"
              disabled={busy !== null}
              onClick={() => void act('fix', () => api.fixChecks(conversationId))}
              data-testid="pr-fix"
            >
              <Wrench size={13} />
              {t('prTrack.fix')}
            </button>
          )}
          <label className="pr-option">
            <input
              type="checkbox"
              checked={options.autoFix}
              disabled={busy !== null}
              onChange={(e) => setOption({ autoFix: e.target.checked })}
              data-testid="pr-auto-fix"
            />
            {t('prTrack.autoFix')}
          </label>
          <label className="pr-option">
            <input
              type="checkbox"
              checked={options.autoMerge}
              disabled={busy !== null}
              onChange={(e) => setOption({ autoMerge: e.target.checked })}
              data-testid="pr-auto-merge"
            />
            {track.mergeMethod
              ? t('prTrack.autoMergeWith', { method: t(`prTrack.method.${track.mergeMethod}`) })
              : t('prTrack.autoMerge')}
          </label>
          {ci === 'none' && (
            <button
              className="btn small"
              disabled={busy !== null || !!nowBlocker}
              title={nowBlocker ? t(`prTrack.wait.${nowBlocker}`, { base: pr.base }) : undefined}
              onClick={() => void act('merge', () => api.mergeNow(conversationId))}
              data-testid="pr-merge-now"
            >
              <GitMerge size={13} />
              {busy === 'merge' ? t('prTrack.mergingNow') : t('prTrack.mergeNow')}
            </button>
          )}
        </div>
      )}
      {wait && (
        <div
          className={`pr-waiting${CALM_WAITS.includes(wait) ? '' : ' pr-warn'}`}
          data-testid="pr-waiting"
          data-wait={wait}
        >
          <Clock size={13} />
          <span>
            {wait === 'mergeability' && track.mergeabilityUnreported
              ? t('prTrack.mergeabilityUnreported')
              : t(`prTrack.wait.${wait}`, { base: pr.base })}
          </span>
        </div>
      )}
      {event && (
        <div
          className={
            event.kind === 'merge-failed' || event.kind === 'fix-failed'
              ? 'pr-event pr-error'
              : 'pr-event muted'
          }
          data-testid="pr-event"
          data-kind={event.kind}
        >
          {eventText(event, t)}
        </div>
      )}
      {error && (
        <div className="browser-error git-error" data-testid="pr-action-error">
          {error}
        </div>
      )}
    </div>
  )
}

/** Ce que l'app a fait, dit sous la carte. */
function eventText(event: PrEvent, t: TFunction): string {
  switch (event.kind) {
    case 'fix-sent':
      return t(event.auto ? 'prTrack.event.fixSentAuto' : 'prTrack.event.fixSent', {
        count: event.count
      })
    case 'fix-failed':
      return t('prTrack.event.fixFailed', { message: event.message })
    case 'merged':
      return t(event.noCi ? 'prTrack.event.mergedNoCi' : 'prTrack.event.merged', {
        method: t(`prTrack.method.${event.method}`)
      })
    case 'merge-failed':
      return t('prTrack.event.mergeFailed', { message: event.message })
  }
}

/** Contrôles (ceux en échec d'abord), commentaires, avis de relecture, conflits. */
function PrDetails({ pr, ci }: { pr: PrView; ci?: CiState }) {
  const { t } = useTranslation()
  const meta: string[] = []
  meta.push(t('prTrack.comments', { count: pr.comments }))
  if (pr.review) meta.push(t(`prTrack.review.${pr.review}`))
  if (pr.state === 'open' && pr.mergeable !== 'unknown') {
    meta.push(t(`prTrack.mergeable.${pr.mergeable}`))
  }
  return (
    <>
      <div
        className={`pr-checks-line pr-summary-${pr.checks.length === 0 && ci ? NO_CHECKS[ci].tone : pr.summary}`}
        data-testid="pr-checks-line"
        {...(pr.checks.length === 0 && ci ? { 'data-ci': ci } : {})}
      >
        {checksLine(pr.checks, t, ci)}
      </div>
      {pr.checks.length > 0 && (
        <ul className="pr-checks" data-testid="pr-checks">
          {pr.checks.map((check) => {
            const Icon = CHECK_ICON[check.state]
            return (
              <li
                key={check.name}
                className={`pr-check pr-check-${check.state}`}
                data-testid="pr-check"
                data-state={check.state}
              >
                <Icon size={13} aria-label={t(`prTrack.checkState.${check.state}`)} />
                {check.url ? (
                  <a href={check.url} target="_blank" rel="noreferrer">
                    {check.name}
                  </a>
                ) : (
                  <span>{check.name}</span>
                )}
              </li>
            )
          })}
        </ul>
      )}
      <div
        className={`pr-meta muted${pr.mergeable === 'conflicting' && pr.state === 'open' ? ' pr-conflicting' : ''}`}
        data-testid="pr-meta"
      >
        {meta.join(' · ')}
      </div>
    </>
  )
}
