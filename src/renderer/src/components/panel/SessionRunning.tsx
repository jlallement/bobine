import {
  Bot,
  ChevronDown,
  ChevronRight,
  GitFork,
  Server,
  Square,
  SquareTerminal
} from 'lucide-react'
import { useEffect, useState, type ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import type { RunningEntry, RunningKind, RunningState } from '../../session-running'
import { turnDuration } from '../../time'
import { Tip } from '../common/Menus'

const ICONS: Record<RunningKind, ComponentType<{ size?: number }>> = {
  terminal: SquareTerminal,
  server: Server,
  subagent: Bot,
  child: GitFork
}

/** Heure courante, rafraîchie chaque seconde tant qu'il y a quelque chose en cours. */
function useNow(ticking: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!ticking) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [ticking])
  return now
}

function EntryRow({
  entry,
  now,
  onStop,
  onOpenChild
}: {
  entry: RunningEntry
  now: number
  onStop?: ((entry: RunningEntry) => void) | undefined
  onOpenChild: (id: string) => void
}) {
  const { t } = useTranslation()
  const Icon = ICONS[entry.kind]
  const kind = t(`sessionTab.kind.${entry.kind}`)
  const duration = turnDuration((entry.endedAt ?? Math.max(now, entry.startedAt)) - entry.startedAt)
  const childId = entry.childId
  return (
    <li className="session-entry" data-kind={entry.kind} data-testid="session-entry">
      {/* Sous-agent : pas d'arrêt, l'infobulle dit pourquoi. */}
      <Tip
        label={
          entry.kind === 'subagent' && !entry.endedAt ? `${kind} — ${t('sessionTab.noStop')}` : kind
        }
      >
        <span className="session-entry-icon">
          <Icon size={14} />
        </span>
      </Tip>
      {childId ? (
        <Tip label={t('sessionTab.openChild', { label: entry.label })}>
          <button
            type="button"
            className="session-entry-label session-link"
            onClick={() => onOpenChild(childId)}
          >
            {entry.label}
          </button>
        </Tip>
      ) : (
        <span className="session-entry-label" title={entry.label}>
          {entry.label}
        </span>
      )}
      <span className="session-entry-duration" data-testid="session-entry-duration">
        {duration}
      </span>
      {onStop && entry.stop && (
        <Tip label={t('sessionTab.stop', { label: entry.label })}>
          <button
            type="button"
            className="icon-button small"
            aria-label={t('sessionTab.stop', { label: entry.label })}
            onClick={() => onStop(entry)}
            data-testid="session-stop"
          >
            <Square size={11} fill="currentColor" />
          </button>
        </Tip>
      )}
    </li>
  )
}

/**
 * Ce qui tourne pour la conversation (fiche 166) : durée, « Arrêter » quand Bobine sait le faire ;
 * en dessous, « Terminées : N » replié.
 */
export function SessionRunning({
  running,
  onStop,
  onOpenChild
}: {
  running: RunningState
  onStop: (entry: RunningEntry) => void
  onOpenChild: (id: string) => void
}) {
  const { t } = useTranslation()
  const [showFinished, setShowFinished] = useState(false)
  const now = useNow(running.running.length > 0)
  const finished = [...running.finished].sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0))
  return (
    <section className="session-section" data-testid="session-running">
      <h3 className="session-title">{t('sessionTab.running')}</h3>
      {running.running.length === 0 ? (
        <p className="session-empty" data-testid="session-nothing-running">
          {t('sessionTab.nothingRunning')}
        </p>
      ) : (
        <ul className="session-entries">
          {running.running.map((entry) => (
            <EntryRow
              key={entry.key}
              entry={entry}
              now={now}
              onStop={onStop}
              onOpenChild={onOpenChild}
            />
          ))}
        </ul>
      )}
      {finished.length > 0 && (
        <>
          <button
            type="button"
            className="session-finished-toggle"
            aria-expanded={showFinished}
            onClick={() => setShowFinished(!showFinished)}
            data-testid="session-finished-toggle"
          >
            {showFinished ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            {t('sessionTab.finished', { count: finished.length })}
          </button>
          {showFinished && (
            <ul className="session-entries finished" data-testid="session-finished">
              {finished.map((entry) => (
                <EntryRow key={entry.key} entry={entry} now={now} onOpenChild={onOpenChild} />
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}
