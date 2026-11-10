import { useContext, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Hourglass } from 'lucide-react'
import type { TerminalState } from '@shared/terminal-output'
import { TurnControlsContext } from '../../turn-controls'
import '../../turn-guards.css'

/**
 * Dernière sortie vue de chaque commande en cours (par appel d'outil), gardée hors du composant : la
 * carte peut être refaite (fil remonté, conversation rouverte) sans remettre le compte à zéro.
 * L'heure n'est pas dans `TerminalState` : le réducteur du fil reste pur (rejeux comparés tels
 * quels, fiche 139), et une commande est signalée pendant le tour, donc vue par cette fenêtre.
 * Bornée : oubliée à la fin de la commande, et les plus anciennes au-delà de `MAX_WATCHED`.
 */
const lastOutputs = new Map<string, { length: number; at: number }>()
const MAX_WATCHED = 200

/** Heure de la dernière sortie vue d'une commande : maintenant si sa sortie a changé. */
export function lastOutputAt(toolCallId: string, length: number, now = Date.now()): number {
  const known = lastOutputs.get(toolCallId)
  if (known?.length === length) return known.at
  lastOutputs.delete(toolCallId)
  lastOutputs.set(toolCallId, { length, at: now })
  for (const oldest of lastOutputs.keys()) {
    if (lastOutputs.size <= MAX_WATCHED) break
    lastOutputs.delete(oldest)
  }
  return now
}

/** Commande finie : plus rien à suivre. */
export function forgetOutput(toolCallId: string): void {
  lastOutputs.delete(toolCallId)
}

/** Minutes sans sortie à signaler, au-delà du seuil ; sinon `undefined`. */
export function stalledMinutes(
  since: number,
  now: number,
  thresholdMs: number
): number | undefined {
  const idle = now - since
  return idle >= thresholdMs ? Math.max(1, Math.floor(idle / 60_000)) : undefined
}

/**
 * Commande en cours sans nouvelle sortie depuis le seuil (fiche 157) : « Aucune sortie depuis
 * N min » et « Interrompre » (comme ■). Seulement pour une commande dont l'agent envoie la sortie
 * (extension de terminal, fiche 018), pendant le tour, dans le fil principal (`TurnControls`).
 */
export function StalledNotice({
  toolCallId,
  terminal
}: {
  toolCallId: string
  terminal: TerminalState
}) {
  const { t } = useTranslation()
  const controls = useContext(TurnControlsContext)
  const length = terminal.output.length
  const since = useMemo(() => lastOutputAt(toolCallId, length), [toolCallId, length])
  const [now, setNow] = useState(() => Date.now())
  const watching = !!controls?.busy && !terminal.exited
  useEffect(() => {
    if (terminal.exited) forgetOutput(toolCallId)
  }, [terminal.exited, toolCallId])
  const threshold = controls?.stalledAfterMs ?? 0
  useEffect(() => {
    if (!watching) return
    // Assez souvent pour un seuil court (essais), au plus toutes les 15 s.
    const timer = setInterval(() => setNow(Date.now()), Math.min(15_000, threshold / 4))
    return () => clearInterval(timer)
  }, [watching, threshold])
  const minutes = watching ? stalledMinutes(since, now, threshold) : undefined
  if (!controls || minutes === undefined) return null
  return (
    <div className="stalled-notice" role="status" data-testid="stalled-notice">
      <Hourglass size={14} aria-hidden />
      <span className="stalled-text" title={t('turnGuards.stalled.hint')}>
        {t('turnGuards.stalled.notice', { count: minutes })}
      </span>
      <button
        type="button"
        className="stalled-interrupt"
        title={t('turnGuards.stalled.interruptTip')}
        onClick={controls.cancel}
        data-testid="stalled-interrupt"
      >
        {t('turnGuards.stalled.interrupt')}
      </button>
    </div>
  )
}
