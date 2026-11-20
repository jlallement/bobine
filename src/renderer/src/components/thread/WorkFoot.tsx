import { BookmarkPlus, Check, Reply, ScanSearch, Send } from 'lucide-react'
import i18next from 'i18next'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ConversationSummary } from '@shared/agent'
import type { WorkCardData } from '@shared/role-request'
import type { TranscriptItem } from '@shared/transcript'
import { ipcErrorText } from '../../ipc-errors'
import { invokeRole } from '../../roles/roles-store'
import { saveAsRoleAction } from '../../roles/save-as-role'
import { useProfileStatus } from '../common/Profile'
import { messageTime } from '../../time'
import type { SubtasksInfo } from './Subtasks'
import { answerText, answerTitle, relayOf, type WorkState } from './work-card'
import { WorkMergeButton, type WorkMergeControl } from './WorkMerge'

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
  items,
  merge
}: {
  card: WorkCardData
  child: ConversationSummary | undefined
  info: SubtasksInfo | undefined
  state: WorkState
  report: Report | undefined
  items: readonly TranscriptItem[]
  /** Fusion du travail dans sa carte (fiche 264) : « Fusionner dans main ». */
  merge?: WorkMergeControl
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
              {...(merge ? { merge } : {})}
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
            : card.byAgent
              ? // Lancé par l'agent : sa réponse lui part à son réveil (fiche 097).
                t('workCard.relayPendingWake', { agent })
              : t(several ? 'workCard.relayPendingLast' : 'workCard.relayPending', { agent })}
        </div>
      )}
    </>
  )
}

/** États où « Relancer » renvoie la même demande. */
const RETRY: readonly WorkState[] = ['stopped', 'error', 'silent']

/** États où le travail attend un geste : l'appliquer, le relancer, lui répondre. */
const SETTLED: readonly WorkState[] = ['replied', 'stopped', 'error', 'silent', 'pending']

/**
 * Message préparé pour l'agent de la conversation, lisible dans la bulle (décision du tech lead) :
 * « Applique la proposition d'Expert UX/UI : « Le carnet de courses calme ». », le titre de la
 * réponse sans préfixe ni guillemets ; sans titre, le rôle seul. Le travail visé part à part
 * (`about`, marqué dans le contexte joint), jamais dans le texte.
 */
export function applyMessage(role: string, text: string): string {
  const title = answerTitle(text)
  return title
    ? i18next.t('workCard.applyMessageTitled', { role, title })
    : i18next.t('workCard.applyMessage', { role })
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
  warn,
  merge
}: {
  card: WorkCardData
  child: ConversationSummary | undefined
  info: SubtasksInfo | undefined
  state: WorkState
  report: Report | undefined
  pending: boolean
  agent: string
  warn: (error: unknown) => void
  merge?: WorkMergeControl
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
  // Lancé par l'agent : il la recevra à son réveil (fiche 097).
  const role = card.role
  const applies =
    state === 'replied' &&
    report?.outcome === 'done' &&
    !!role?.readOnly &&
    !card.byAgent &&
    pending &&
    !!answer &&
    !info?.motherQueued
  const lastAsk = card.steps.findLast((s) => s.kind === 'ask')
  const askText = lastAsk?.kind === 'ask' ? lastAsk.item.text : card.asked
  const motherId = info?.motherId
  const openGit = info?.merge?.openGit
  const writes = !role?.readOnly && !!child?.branch
  // « Faire relire » (fiche 177) : un seul point d'entrée, la relecture actuelle (fiche 265 : le
  // rôle Code reviewer) ; pas pour un relecteur, ni pendant une fusion.
  const review = info?.onReview
  const reviewable = writes && state === 'replied' && !child?.reviewOf && !merge?.active
  return (
    <>
      {applies && onAsk && role && (
        <button
          type="button"
          className="btn primary small"
          disabled={acting}
          onClick={() => act(() => onAsk(applyMessage(role.label, answer), card.childId))}
          data-testid="work-apply"
        >
          <Send size={13} aria-hidden />
          {t('workCard.apply', { agent })}
        </button>
      )}
      {merge && <WorkMergeButton control={merge} />}
      {writes && openGit && (
        <button
          type="button"
          className="btn small"
          onClick={() => openGit(card.childId)}
          data-testid="work-changes-open"
        >
          {t('workCard.changes')}
        </button>
      )}
      {reviewable && review && (
        <button
          type="button"
          className="btn small"
          title={t('workCard.reviewLabel')}
          onClick={() => review(card.childId)}
          data-testid="work-review"
        >
          <ScanSearch size={13} aria-hidden />
          {t('workCard.review')}
        </button>
      )}
      {motherId && role && RETRY.includes(state) && (
        <button
          type="button"
          className="btn small"
          title={t('workCard.retryLabel', { role: role.label })}
          disabled={acting}
          onClick={() =>
            act(() => window.api.roles.reply(motherId, { childId: card.childId, text: askText }))
          }
          data-testid="work-retry"
        >
          {t('workCard.retry')}
        </button>
      )}
      {!role && report && <SaveAsRole card={card} report={report} info={info} />}
      {/* Sans rôle, pas de jeton pour lui répondre : sa conversation s'ouvre. */}
      {role && (
        <button
          type="button"
          className="btn small"
          onClick={() => invokeRole(role.name, { replyTo: card.childId, role })}
          data-testid="work-reply"
        >
          <Reply size={13} aria-hidden />
          {t('workCard.reply', { role: role.label })}
        </button>
      )}
    </>
  )
}

/**
 * « Enregistrer comme rôle » (fiche 223, maquette 01-C2) : un travail sans rôle qui a répondu
 * ouvre l'assistant prérempli de sa consigne ; pas en lecture seule du profil (fiche 196).
 */
function SaveAsRole({
  card,
  report,
  info
}: {
  card: WorkCardData
  report: Report
  info: SubtasksInfo | undefined
}) {
  const { t } = useTranslation()
  const { readOnly } = useProfileStatus()
  const save = saveAsRoleAction(report, { prompt: card.asked }, info?.children)
  if (!save || readOnly) return null
  return (
    <button type="button" className="btn small" onClick={save} data-testid="work-save-role">
      <BookmarkPlus size={13} aria-hidden />
      {t('roleWork.report.saveAsRole')}
    </button>
  )
}
