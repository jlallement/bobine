import { useContext, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  activityLabel,
  backgroundActivity,
  currentActivity,
  currentStepId,
  elapsedLabel
} from '@shared/activity'
import type { TranscriptItem } from '@shared/transcript'
import { SpoolMark } from '../common/SpoolMark'
import { DiscussionContext } from '../discussion/DocumentCards'

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
 * (fiche 128). Après la fin du tour, quand l'agent travaille encore (`background`, fiche 255) : le
 * sous-agent en cours ou « travaille après le tour », et le temps depuis l'envoi du message.
 */
export function WorkingIndicator({
  conversationId,
  items,
  workspace,
  background = false
}: {
  conversationId: string
  items: readonly TranscriptItem[]
  /** Dossier de la conversation : chemins relatifs dans le libellé de l'outil (fiche 107). */
  workspace?: string
  /** Tour fini, l'agent travaille encore (sous-agent en arrière-plan, réponse hors tour). */
  background?: boolean
}) {
  // Recalculé quand le message de l'utilisateur change : le statut « occupé » arrive parfois avant
  // le message du nouveau tour, qui donnerait sinon le début du tour précédent (fiche 095).
  const user = items.findLast((i) => i.kind === 'user')
  const userId = user?.id ?? -1
  const stepId = currentStepId(items)
  // Après le tour, l'indicateur peut apparaître bien après l'envoi : l'heure du message fait foi.
  const sentAt = background ? user?.at : undefined
  const start = useMemo(
    () => sentAt ?? turnStart(conversationId, userId),
    [conversationId, userId, sentAt]
  )
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
  // Discussion (fiche 224) : son dossier se dit « Documents ».
  const documents = useContext(DiscussionContext) ? t('discussion.documents.tab') : undefined
  const activity = background
    ? backgroundActivity(items)
    : currentActivity(items, workspace, documents)
  const waiting = activity.kind === 'permission' || activity.kind === 'question'
  // Après le tour, le temps depuis l'envoi : celui de l'étape ne dirait rien (fiche 255).
  const shownFrom = background ? start : stepAt
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
        {elapsedLabel(now - shownFrom)}
      </span>
    </div>
  )
}
