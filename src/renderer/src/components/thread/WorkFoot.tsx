import { BookmarkPlus, Check, FileDiff, Reply, ScanSearch, Send } from 'lucide-react'
import i18next from 'i18next'
import { useContext, useState } from 'react'
import { childState } from '@shared/children'
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
import { WorkLayoutContext } from './work-layout-context'

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
  merge,
  mergeBusy = false,
  onShowDiff
}: {
  card: WorkCardData
  child: ConversationSummary | undefined
  info: SubtasksInfo | undefined
  state: WorkState
  report: Report | undefined
  items: readonly TranscriptItem[]
  /** Fusion du travail dans sa carte (fiche 264) : « Fusionner dans main ». */
  merge?: WorkMergeControl
  /**
   * Sa fusion avance (revue QA) : ni « Répondre » ni « Relancer » (sa branche bougerait sous la
   * fusion), ni l'« Arrêter » du tour (celui de la fusion est dans sa boîte).
   */
  mergeBusy?: boolean
  /** Code reviewer (fiche 265) : « Voir sur le diff », la vue Git de la conversation relue. */
  onShowDiff?: (() => void) | undefined
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
  const merged = merge?.row?.state === 'merged'
  const openGit = info?.merge?.openGit
  return (
    <>
      {canOpen && (
        <div className="work-actions" data-testid="work-actions">
          {live && state === 'running' && !mergeBusy && (
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
          {live && SETTLED.includes(state) && !mergeBusy && (
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
              {...(onShowDiff ? { onShowDiff } : {})}
            />
          )}
          {!live && merged && openGit && (
            // Fusionné puis nettoyé (conversation archivée) : ses modifications restent visibles.
            <button
              type="button"
              className="btn small"
              onClick={() => openGit(card.childId)}
              data-testid="work-changes-open"
            >
              {t('workCard.changes')}
            </button>
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
 * Message préparé « Demander à <agent> de corriger » (fiche 265) : il nomme le relecteur ; ses
 * remarques partent dans le contexte joint, avec sa réponse (`about`). La conversation affichée
 * relue : elle corrige ; un travail relu : elle le fait corriger (sa branche n'est pas la sienne).
 */
export function fixMessage(
  card: WorkCardData,
  role: string,
  info: Pick<SubtasksInfo, 'children' | 'motherId'> | undefined
): string {
  const of = card.request?.review?.of
  const work = of && of !== info?.motherId ? info?.children.find((c) => c.id === of) : undefined
  return work
    ? i18next.t('workCard.fixMessageWork', { role, work: work.title })
    : i18next.t('workCard.fixMessage', { role })
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
  merge,
  onShowDiff
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
  onShowDiff?: (() => void) | undefined
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
  // Une réponse à transmettre, d'un rôle de conseil lancé par l'utilisateur.
  const transmittable =
    state === 'replied' &&
    report?.outcome === 'done' &&
    !!role?.readOnly &&
    !card.byAgent &&
    pending &&
    !info?.motherQueued
  // Code reviewer (fiche 265) : pas « appliquer » sa réponse, mais corriger ses remarques.
  const review = card.review?.status === 'reported' ? card.review : undefined
  const reviewing = !!card.request?.review
  const applies = transmittable && !reviewing && !!answer
  const fixes = transmittable && !!review && review.findings.length > 0
  const lastAsk = card.steps.findLast((s) => s.kind === 'ask')
  const askText = lastAsk?.kind === 'ask' ? lastAsk.item.text : card.asked
  const motherId = info?.motherId
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
      {fixes && onAsk && role && (
        <button
          type="button"
          className="btn primary small"
          disabled={acting}
          onClick={() => act(() => onAsk(fixMessage(card, role.label, info), card.childId))}
          data-testid="work-fix"
        >
          <Send size={13} aria-hidden />
          {t('workCard.fix', { agent })}
        </button>
      )}
      {review && review.findings.length > 0 && onShowDiff && (
        <button
          type="button"
          className="btn small"
          onClick={() => onShowDiff()}
          data-testid="work-show-diff"
        >
          <FileDiff size={13} aria-hidden />
          {t('workCard.showDiff')}
        </button>
      )}
      <WriterActions card={card} child={child} info={info} state={state} merge={merge} />
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

/**
 * Travail qui écrit (fiche 264, écran C) : « Fusionner dans main », « Voir les modifications »,
 * « Faire relire » (fiche 177 : un seul point d'entrée, la relecture actuelle ; fiche 265 : le rôle
 * Code reviewer) ; pas pour un relecteur, ni pendant une fusion.
 */
function WriterActions({
  card,
  child,
  info,
  state,
  merge
}: {
  card: WorkCardData
  child: ConversationSummary | undefined
  info: SubtasksInfo | undefined
  state: WorkState
  merge: WorkMergeControl | undefined
}) {
  const { t } = useTranslation()
  const openGit = info?.merge?.openGit
  const writes = (!card.role?.readOnly && !!child?.branch) || merge?.row?.state === 'merged'
  const review = info?.onReview
  // Une relecture de ce travail tourne encore (fiche 265) : pas une deuxième en même temps.
  const layout = useContext(WorkLayoutContext)
  const reviewing = layout?.reviews.get(card.childId)?.some((entry) => {
    const reviewer = info?.children.find((c) => c.id === entry.card.childId)
    const now = reviewer && childState(reviewer, info?.attention[reviewer.id])
    return now === 'running' || now === 'waiting'
  })
  const reviewable =
    writes && state === 'replied' && !child?.reviewOf && !merge?.active && !reviewing
  return (
    <>
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
    </>
  )
}
