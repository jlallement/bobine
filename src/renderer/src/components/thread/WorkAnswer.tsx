import { Check, ChevronDown, ChevronRight, ChevronUp, Send } from 'lucide-react'
import { useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ConversationSummary } from '@shared/agent'
import type { WorkCardData } from '@shared/role-request'
import type { RoleBadge } from '@shared/roles'
import { RoleAvatar, useRoleStyle } from '../roles/RoleAvatar'
import type { TranscriptItem } from '@shared/transcript'
import { usePresentation } from '../../presentation'
import { messageTime, turnDuration } from '../../time'
import { Markdown } from './Markdown'
import { Branch, FileStats, useUsageText } from './Subtasks'
import {
  answerText,
  currentReport,
  exchangeUsage,
  previousReport,
  relayOf,
  stepStart,
  workUsage,
  type WorkState
} from './work-card'

/**
 * Réponses d'une carte-réponse (fiche 263) : chacune entière, en Markdown, repliée après une
 * dizaine de lignes, avec son pied (heure · durée de cet échange · coût de cet échange) ; les
 * bulles de suite (« Répondre à … ») entre elles.
 */

type Report = Extract<TranscriptItem, { kind: 'child-report' }>
type Ask = Extract<TranscriptItem, { kind: 'role-request' }>
type Note = Extract<TranscriptItem, { kind: 'child-instruction' }>

/** Réponses et suites du travail, dans l'ordre du fil. */
export function WorkSteps({
  card,
  child,
  items,
  state,
  agent
}: {
  card: WorkCardData
  child: ConversationSummary | undefined
  items: readonly TranscriptItem[]
  state: WorkState
  /** Nom de l'agent de la conversation : l'auteur des messages au travail (`message_child`). */
  agent: string
}) {
  const current = currentReport(card)
  return (
    <>
      {/* Sans bulle (proposition, « Lancer en parallèle… ») : sa consigne, repliée (fiche 150). */}
      {!card.request && <WorkBrief card={card} />}
      {card.steps.map((step) =>
        step.kind === 'ask' ? (
          <FollowUp key={step.item.id} item={step.item} />
        ) : step.kind === 'note' ? (
          <AgentNote key={step.item.id} item={step.item} agent={agent} />
        ) : (
          <WorkAnswer
            key={step.item.id}
            card={card}
            child={child}
            report={step.item}
            relay={relayOf(step.item, items)}
            current={step.item.id === current?.id}
            state={state}
          />
        )
      )}
    </>
  )
}

/** Une suite (« Répondre à … ») dans la carte : un filet, puis la bulle avec la puce du rôle. */
function FollowUp({ item }: { item: Ask }) {
  return (
    <div className="work-follow-up" data-testid="work-ask" data-item-id={item.id}>
      <div className="msg-user role-request-bubble">
        {item.works.map((work) => (
          <RoleMention key={work.childId} role={work.role} />
        ))}
        <span className="role-request-text">{item.text}</span>
      </div>
    </div>
  )
}

/** Consigne d'un travail lancé sans bulle : son texte exact, replié (fiches 150, 264). */
function WorkBrief({ card }: { card: WorkCardData }) {
  const { t } = useTranslation()
  return (
    <details className="work-agent-note" data-testid="work-brief">
      <summary>
        <span>{t('workCard.brief')}</span>
        <ChevronRight size={13} className="chevron" aria-hidden />
      </summary>
      <div className="work-agent-note-text" data-testid="work-brief-text">
        {card.asked}
      </div>
    </details>
  )
}

/**
 * Message de l'agent de la conversation à ce travail (`message_child`, fiche 264) : sa seule
 * mention dans le fil, replié, son texte exact une fois déplié.
 */
function AgentNote({ item, agent }: { item: Note; agent: string }) {
  const { t } = useTranslation()
  return (
    <details className="work-agent-note" data-testid="work-note" data-item-id={item.id}>
      <summary>
        <Send size={12} aria-hidden />
        <span>{t('workCard.agentNote', { agent, time: messageTime(item.at) })}</span>
        <ChevronRight size={13} className="chevron" aria-hidden />
      </summary>
      <div className="work-agent-note-text" data-testid="work-note-text">
        {item.prompt}
      </div>
    </details>
  )
}

/** Puce d'un rôle dans une bulle : son avatar (18) et son nom, à sa couleur. */
export function RoleMention({ role }: { role: RoleBadge }) {
  const style = useRoleStyle(role.color)
  return (
    <span className="role-mention" style={style} data-testid="role-mention" data-role={role.name}>
      <RoleAvatar role={role} size={18} />
      {role.label}
    </span>
  )
}

/** Une réponse du travail, son pied, et sa transmission si elle a déjà eu lieu. */
function WorkAnswer({
  card,
  child,
  report,
  relay,
  current,
  state
}: {
  card: WorkCardData
  child: ConversationSummary | undefined
  report: Report
  relay: ReturnType<typeof relayOf>
  current: boolean
  state: WorkState
}) {
  const { t } = useTranslation()
  const text = answerText(report)
  const relayed = relay?.sent === true
  return (
    <div className="work-answer" data-testid="work-answer" data-outcome={report.outcome}>
      {report.outcome === 'error' ? (
        <div className="work-error" data-testid="work-error">
          {text}
        </div>
      ) : text ? (
        <FoldedAnswer text={text} relayed={relayed} />
      ) : (
        <div className="work-note">{t('workCard.noReply')}</div>
      )}
      {report.replyCut && (
        <div className="work-note" data-testid="work-cut">
          {t('workCard.cut', {
            shown: (report.reply?.length ?? 0).toLocaleString(),
            total: (report.replyChars ?? 0).toLocaleString()
          })}
        </div>
      )}
      {report.outcome === 'stopped' && <div className="work-note">{t('workCard.stoppedLine')}</div>}
      {!card.role?.readOnly &&
        !(current && state === 'running') &&
        (report.branch || report.fileCount > 0) && (
          <div className="work-changes" data-testid="work-changes">
            {report.branch && <Branch name={report.branch} />}
            <FileStats report={report} />
          </div>
        )}
      <AnswerFacts card={card} child={child} report={report} current={current} />
      {/* Transmise : dit sous chaque réponse d'avant ; la dernière, en bas de la carte. */}
      {relay?.sent && !current && (
        <div className="work-relayed" data-testid="work-relayed">
          <Check size={12} aria-hidden />
          {relay.at
            ? t('workCard.relayedAt', { time: messageTime(relay.at) })
            : t('workCard.relayed')}
        </div>
      )}
    </div>
  )
}

/**
 * « 21:15 · 1 min 38 s · gratuit » : heure de la réponse, durée de cet échange, coût de cet
 * échange (le cumul de la conversation à cette réponse, moins celui de la réponse d'avant ; pour
 * la dernière, celui de la conversation au repos, son coût pouvant arriver après, fiche 117).
 */
function AnswerFacts({
  card,
  child,
  report,
  current
}: {
  card: WorkCardData
  child: ConversationSummary | undefined
  report: Report
  current: boolean
}) {
  const { t } = useTranslation()
  const usageText = useUsageText()
  // Mode présentation (fiche 159) : aucun montant, pas même « gratuit ».
  const presenting = usePresentation()
  const usage = exchangeUsage(
    current ? workUsage(report, child) : report.usage,
    previousReport(card, report)?.usage
  )
  const facts = [
    messageTime(report.at),
    turnDuration(Math.max(0, report.at - stepStart(card, report))),
    usage?.cost?.amount === 0 && !presenting ? t('workCard.free') : usageText(usage)
  ].filter(Boolean)
  return (
    <div className="work-facts" data-testid="work-facts">
      {facts.join(' · ')}
    </div>
  )
}

/**
 * Réponse repliée : hauteur bornée à dix lignes (cinq sixièmes de moins une fois transmise),
 * fondu en bas, « Lire la suite » dans le fondu ; le bouton n'est là que si la hauteur coupe
 * vraiment quelque chose.
 */
function FoldedAnswer({ text, relayed }: { text: string; relayed: boolean }) {
  const { t } = useTranslation()
  const ref = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [overflows, setOverflows] = useState(false)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || open) return
    const measure = () => setOverflows(el.scrollHeight > el.clientHeight + 1)
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [text, relayed, open])
  const Chevron = open ? ChevronUp : ChevronDown
  return (
    <>
      <div
        ref={ref}
        className={`work-body${open ? '' : ' folded'}${relayed ? ' relayed' : ''}`}
        data-testid="work-body"
        data-folded={(!open && overflows) || undefined}
      >
        <Markdown text={text} />
      </div>
      {(overflows || open) && (
        <button
          type="button"
          className={`work-more${open ? '' : ' in-fade'}`}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          data-testid="work-more"
        >
          <Chevron size={13} aria-hidden />
          {t(open ? 'workCard.collapse' : 'workCard.readMore')}
        </button>
      )}
    </>
  )
}
