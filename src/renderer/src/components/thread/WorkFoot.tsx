import { BookmarkPlus, Check, FileDiff, Reply, ScanSearch, Send } from 'lucide-react'
import i18next from 'i18next'
import { useState, type ReactNode } from 'react'
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
import { answerText, answerTitle, askedAbout, relayOf, type WorkState } from './work-card'
import { WorkMergeButton, type WorkMergeControl } from './WorkMerge'
import { ReviewFixButton, settleFindings, useWorkReview } from './WorkReviewActions'
import { workName } from './work-name'

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
  onShowDiff,
  nested = false,
  hostFix = false,
  facts
}: {
  card: WorkCardData
  child: ConversationSummary | undefined
  info: SubtasksInfo | undefined
  state: WorkState
  report: Report | undefined
  items: readonly TranscriptItem[]
  /** Rangée dans la carte du travail qu'elle relit (fiche 265) : sa transmission n'y est pas redite. */
  nested?: boolean
  /** La carte du travail relu porte « Faire corriger » (fiche 265, revue UX). */
  hostFix?: boolean
  /** Code reviewer (fiche 265, revue UX) : « heure · durée · coût », sur la ligne des boutons. */
  facts?: ReactNode
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
  // Code reviewer (fiche 265, revue UX) : la méta et ses gestes sur une ligne, « Répondre »
  // (fantôme) et « Ouvrir sa conversation » sur la suivante.
  const reviewer = !!card.reviewOf || !!card.review
  const asked = reviewer ? askedAbout(card, items) : undefined
  const role = card.role
  const open = (
    <button
      type="button"
      className="link-button work-open"
      onClick={() => info?.onOpen(card.childId)}
      data-testid="work-open"
    >
      {t('workCard.open')}
    </button>
  )
  return (
    <>
      {canOpen && (
        <div className={`work-actions${reviewer ? ' review' : ''}`} data-testid="work-actions">
          {reviewer && facts}
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
              items={items}
              reviewer={reviewer}
              hostFix={hostFix}
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
          {!reviewer && open}
        </div>
      )}
      {canOpen && reviewer && (
        <div className="work-actions work-actions-second" data-testid="work-actions-second">
          {live && role && SETTLED.includes(state) && !mergeBusy && (
            <button
              type="button"
              className="btn ghost small"
              onClick={() => invokeRole(role.name, { replyTo: card.childId, role })}
              data-testid="work-reply"
            >
              <Reply size={13} aria-hidden />
              {t('workCard.reply', { role: role.label })}
            </button>
          )}
          {open}
        </div>
      )}
      {!nested && (
        <RelayLine
          relay={relay}
          asked={asked}
          agent={agent}
          byAgent={!!card.byAgent}
          several={several}
        />
      )}
    </>
  )
}

/**
 * Dernière ligne de la carte : la transmission de la dernière réponse (fiche 263) ; pour un Code
 * reviewer dont la correction a été demandée, « Correction demandée · heure » (fiche 265).
 */
function RelayLine({
  relay,
  asked,
  agent,
  byAgent,
  several
}: {
  relay: ReturnType<typeof relayOf>
  asked: { at: number | undefined } | undefined
  agent: string
  byAgent: boolean
  several: boolean
}) {
  const { t } = useTranslation()
  if (asked) {
    return (
      <div className="work-relay sent" data-testid="work-relay" data-sent="true" data-fix>
        <Check size={13} aria-hidden />
        {asked.at
          ? t('workCard.fixRequestedAt', { time: messageTime(asked.at) })
          : t('workCard.fixRequested')}
      </div>
    )
  }
  if (!relay) return null
  return (
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
        : byAgent
          ? // Lancé par l'agent : sa réponse lui part à son réveil (fiche 097).
            t('workCard.relayPendingWake', { agent })
          : t(several ? 'workCard.relayPendingLast' : 'workCard.relayPending', { agent })}
    </div>
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
  const of = card.reviewOf ?? card.review?.authorId
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
  onShowDiff,
  items,
  reviewer,
  hostFix
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
  items: readonly TranscriptItem[]
  /** Code reviewer : « Répondre » est sur la ligne suivante (`WorkFoot`). */
  reviewer: boolean
  /** « Faire corriger » est porté par la carte du travail relu. */
  hostFix: boolean
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
  const applies = transmittable && !reviewer && !!answer
  const fixes = transmittable && !!review && review.findings.length > 0 && !hostFix
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
          onClick={() =>
            act(async () => {
              await onAsk(fixMessage(card, role.label, info), card.childId)
              settleFindings(card)
            })
          }
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
      {!reviewer && (
        <WriterActions
          card={card}
          child={child}
          info={info}
          state={state}
          merge={merge}
          items={items}
        />
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
      {role && !reviewer && (
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
  merge,
  items
}: {
  card: WorkCardData
  child: ConversationSummary | undefined
  info: SubtasksInfo | undefined
  state: WorkState
  merge: WorkMergeControl | undefined
  items: readonly TranscriptItem[]
}) {
  const { t } = useTranslation()
  const openGit = info?.merge?.openGit
  const writes = (!card.role?.readOnly && !!child?.branch) || merge?.row?.state === 'merged'
  const review = info?.onReview
  // Sa relecture (fiche 265) : pas une deuxième pendant qu'elle tourne, ni de fusion ; une remarque
  // importante à faire corriger d'abord : l'action principale de la carte.
  const { reviewing, toFix } = useWorkReview(card, items, info)
  const reviewable =
    writes && state === 'replied' && !child?.reviewOf && !merge?.active && !reviewing
  return (
    <>
      {toFix && toFix.card.role && (
        <ReviewFixButton
          entry={toFix}
          name={workName(card)}
          message={fixMessage(toFix.card, toFix.card.role.label, info)}
          info={info}
        />
      )}
      {merge && <WorkMergeButton control={merge} secondary={!!toFix} reviewing={reviewing} />}
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
