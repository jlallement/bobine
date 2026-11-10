import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { activityLabel, currentActivity, currentStepId, elapsedLabel } from '@shared/activity'
import type { TranscriptItem } from '@shared/transcript'
import { SpoolMark } from '../common/SpoolMark'

/** Début du tour en cours, par conversation (garde le chrono en changeant de conversation). */
const turnStarts = new Map<string, { userId: number; start: number }>()

function turnStart(conversationId: string, userId: number): number {
  const known = turnStarts.get(conversationId)
  if (known?.userId === userId) return known.start
  const start = Date.now()
  turnStarts.set(conversationId, { userId, start })
  return start
}

/** Début de l'étape en cours, par conversation : le temps repart de zéro à chaque étape (fiche 128). */
const stepStarts = new Map<string, { userId: number; stepId: number; start: number }>()

function stepStart(conversationId: string, userId: number, stepId: number): number {
  const known = stepStarts.get(conversationId)
  if (known?.userId === userId && known.stepId === stepId) return known.start
  const start = Date.now()
  stepStarts.set(conversationId, { userId, stepId, start })
  return start
}

/**
 * Indicateur d'activité à la fin du fil pendant que l'agent travaille, comme Claude Desktop :
 * bobine dont le fil s'enroule (fiche 069), ce qu'il fait (réfléchit, écrit, outil, attend votre accord)
 * et depuis quand : le temps est celui de l'étape en cours, la durée du tour est en infobulle
 * (fiche 128).
 */
export function WorkingIndicator({
  conversationId,
  items,
  workspace
}: {
  conversationId: string
  items: readonly TranscriptItem[]
  /** Dossier de la conversation : chemins relatifs dans le libellé de l'outil (fiche 107). */
  workspace?: string
}) {
  // Recalculé quand le message de l'utilisateur change : le statut « occupé » arrive parfois avant
  // le message du nouveau tour, qui donnerait sinon le début du tour précédent (fiche 095).
  const userId = items.findLast((i) => i.kind === 'user')?.id ?? -1
  const stepId = currentStepId(items)
  const start = useMemo(() => turnStart(conversationId, userId), [conversationId, userId])
  const stepAt = useMemo(
    () => stepStart(conversationId, userId, stepId),
    [conversationId, userId, stepId]
  )
  const { t } = useTranslation()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  const activity = currentActivity(items, workspace)
  const waiting = activity.kind === 'permission' || activity.kind === 'question'
  return (
    <div
      className={`working${waiting ? ' waiting' : ''}`}
      role="status"
      aria-live="polite"
      data-testid="working"
      data-activity={activity.kind}
    >
      <SpoolMark size={16} motion={waiting ? 'none' : 'loop'} className="working-icon" />
      <span className="working-label">{activityLabel(activity)}</span>
      <span
        className="working-time"
        title={t('activity.turnStarted', { elapsed: elapsedLabel(now - start) })}
      >
        {elapsedLabel(now - stepAt)}
      </span>
    </div>
  )
}
