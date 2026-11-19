import { Check, Reply, Send } from 'lucide-react'
import i18next from 'i18next'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ConversationSummary } from '@shared/agent'
import type { WorkCardData } from '@shared/role-request'
import type { TranscriptItem } from '@shared/transcript'
import { ipcErrorText } from '../../ipc-errors'
import { invokeRole } from '../../roles/roles-store'
import { messageTime } from '../../time'
import type { SubtasksInfo } from './Subtasks'
import { answerText, answerTitle, relayOf, type WorkState } from './work-card'

/**
 * Pied d'une carte-réponse (fiche 263, revue UX) : une seule rangée d'actions alignée à gauche,
 * « Ouvrir sa conversation » au bout ; puis la ligne de transmission de la dernière réponse.
 */

type Report = Extract<TranscriptItem, { kind: 'child-report' }>

export function WorkFoot({
  card,
  child,
  info,
  state,
  report,
  items
}: {
  card: WorkCardData
  child: ConversationSummary | undefined
  info: SubtasksInfo | undefined
  state: WorkState
  report: Report | undefined
  items: readonly TranscriptItem[]
}) {
  const { t } = useTranslation()
  const relay = relayOf(report, items)
  const agent = info?.agentLabel ?? t('workCard.mainAgent')
  // Agir sur le travail : sa conversation existe encore, rattachée à celle-ci et pas archivée ;
  // l'ouvrir : même archivée.
  const live = !!info && !!child && !child.archived
  const canOpen = !!info && !!child
  const warn = (error: unknown) => info?.onWarn?.(ipcErrorText(error))
  const several = card.steps.filter((s) => s.kind === 'report').length > 1
  return (
    <>
      {canOpen && (
        <div className="work-actions" data-testid="work-actions">
          {live && state === 'running' && (
            <button
              type="button"
              className="btn ghost small"
              title={t('workCard.stopLabel')}
              onClick={() => window.api.agent.cancel(card.childId).catch(warn)}
              data-testid="work-stop"
            >
              {t('workCard.stop')}
            </button>
          )}
          {live && SETTLED.includes(state) && (
            <SettledActions
              card={card}
              child={child}
              info={info}
              state={state}
              report={report}
              pending={relay?.sent === false}
              agent={agent}
              warn={warn}
            />
          )}
          <button
            type="button"
            className="link-button work-open"
            onClick={() => info?.onOpen(card.childId)}
            data-testid="work-open"
          >
            {t('workCard.open')}
          </button>
        </div>
      )}
      {relay && (
        <div
          className={`work-relay${relay.sent ? ' sent' : ''}`}
          data-testid="work-relay"
          data-sent={relay.sent}
        >
          {relay.sent ? <Check size={13} aria-hidden /> : <span className="work-dot" aria-hidden />}
          {relay.sent
            ? relay.at
              ? t('workCard.relayDoneAt', { agent, time: messageTime(relay.at) })
              : t('workCard.relayDone', { agent })
            : t(several ? 'workCard.relayPendingLast' : 'workCard.relayPending', { agent })}
        </div>
      )}
    </>
  )
}

/** États où le travail attend un geste : l'appliquer, le relancer, lui répondre. */
const SETTLED: readonly WorkState[] = ['replied', 'stopped', 'error', 'silent', 'pending']

/**
 * Message préparé pour l'agent de la conversation (revue UX, 12) : la proposition, nommée par le
 * titre de la réponse s'il y en a un (entre guillemets, sauf s'il en porte déjà).
 */
export function applyMessage(role: string, workId: string, text: string): string {
  const title = answerTitle(text)
  const work = workId
  if (!title) return i18next.t('workCard.applyMessage', { role, work })
  const quoted = /[«»"“”]/.test(title)
  return i18next.t(quoted ? 'workCard.applyMessageNamed' : 'workCard.applyMessageTitled', {
    role,
    title,
    work
  })
}

/**
 * Actions d'un travail qui a répondu, s'est arrêté ou a échoué : l'appliquer (rôle de conseil,
 * réponse pas encore transmise), voir ses modifications (rôle qui écrit), relancer, répondre.
 */
function SettledActions({
  card,
  child,
  info,
  state,
  report,
  pending,
  agent,
  warn
}: {
  card: WorkCardData
  child: ConversationSummary | undefined
  info: SubtasksInfo | undefined
  state: WorkState
  report: Report | undefined
  pending: boolean
  agent: string
  warn: (error: unknown) => void
}) {
  const { t } = useTranslation()
  // Un geste à la fois : « Appliquer » et « Relancer » attendent l'acquittement (revue QA).
  const [acting, setActing] = useState(false)
  const act = (action: () => unknown) => {
    setActing(true)
    void Promise.resolve()
      .then(action)
      .catch(warn)
      .finally(() => setActing(false))
  }
  const onAsk = info?.onAsk
  const answer = report ? answerText(report).trim() : ''
  // Un message attend déjà dans la file de la mère : il emportera la réponse, rien à proposer.
  const applies =
    state === 'replied' &&
    report?.outcome === 'done' &&
    card.role.readOnly &&
    pending &&
    !!answer &&
    !info?.motherQueued
  const lastAsk = card.steps.findLast((s) => s.kind === 'ask')
  const askText = lastAsk?.kind === 'ask' ? lastAsk.item.text : card.request.text
  const motherId = info?.motherId
  const openGit = info?.merge?.openGit
  return (
    <>
      {applies && onAsk && (
        <button
          type="button"
          className="btn primary small"
          disabled={acting}
          onClick={() => act(() => onAsk(applyMessage(card.role.label, card.childId, answer)))}
          data-testid="work-apply"
        >
          <Send size={13} aria-hidden />
          {t('workCard.apply', { agent })}
        </button>
      )}
      {/* Rôle qui écrit : « Faire relire » et « Fusionner dans main » viendront ici (fiche 264). */}
      {!card.role.readOnly && child?.branch && openGit && (
        <button
          type="button"
          className="btn small"
          onClick={() => openGit(card.childId)}
          data-testid="work-changes-open"
        >
          {t('workCard.changes')}
        </button>
      )}
      {motherId && (state === 'stopped' || state === 'error' || state === 'silent') && (
        <button
          type="button"
          className="btn small"
          title={t('workCard.retryLabel', { role: card.role.label })}
          disabled={acting}
          onClick={() =>
            act(() => window.api.roles.reply(motherId, { childId: card.childId, text: askText }))
          }
          data-testid="work-retry"
        >
          {t('workCard.retry')}
        </button>
      )}
      <button
        type="button"
        className="btn small"
        onClick={() => invokeRole(card.role.name, { replyTo: card.childId, role: card.role })}
        data-testid="work-reply"
      >
        <Reply size={13} aria-hidden />
        {t('workCard.reply', { role: card.role.label })}
      </button>
    </>
  )
}
