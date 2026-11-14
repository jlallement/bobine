import {
  Check,
  ChevronDown,
  ChevronRight,
  CornerDownLeft,
  SlidersHorizontal,
  Split,
  X
} from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { ConversationSummary, ProfileSummary, SessionControl } from '@shared/agent'
import {
  childDecisionContent,
  parseChildDecision,
  type ChildDecisionAction,
  type ChildProposalItem
} from '@shared/children'
import { ipcErrorText } from '../../ipc-errors'
import {
  ChildOptions,
  childChoiceRequest,
  childModelAllowed,
  useMotherModel,
  type ChildChoice
} from '../sidebar/child-options'
import type { RespondElicitation } from './ElicitationCard'
import { RoleAvatar } from '../roles/RoleAvatar'
import { ProposalRoleMeta } from '../roles/RoleWork'

/**
 * Carte « Tâches proposées » (fiche 112) : les propositions de conversations filles d'un même tour
 * (`start_child`), une ligne chacune. Lancer (agent et modèle au choix, présélectionnés d'après la
 * proposition de la mère et sa raison, fiche 160), Faire ici, Refuser ; une
 * ligne répondue garde son issue ; une ligne annulée par un redémarrage de l'agent garde
 * « Lancer », qui passe alors par « Lancer en parallèle… ».
 */

/** Ce que la carte sait de la conversation affichée : la mère des filles proposées. */
export interface ProposalsInfo {
  mother: ConversationSummary
  profiles: ProfileSummary[]
}

/** Issue d'une ligne : la décision, ou l'annulation. */
type Outcome = ChildDecisionAction | 'expired'

function outcomeOf(item: ChildProposalItem): Outcome | undefined {
  if (item.state === 'pending') return undefined
  if (item.state === 'accept') return parseChildDecision(item.content)?.action ?? 'refuse'
  return item.state === 'cancel' ? 'expired' : 'refuse'
}

export function ChildProposals({
  items,
  info,
  onRespond
}: {
  items: ChildProposalItem[]
  info?: ProposalsInfo
  onRespond: RespondElicitation
}) {
  const { t } = useTranslation()
  const model = useMotherModel(
    info?.mother.id ?? '',
    !!info && childModelAllowed(info.profiles, info.mother)
  )
  const card = useRef<HTMLDivElement>(null)
  const pending = items.filter((item) => item.state === 'pending')
  const [focus, setFocus] = useState(0)
  // La carte prend le focus à l'apparition si elle attend une réponse : on répond sans la souris.
  const askedAtMount = useRef(pending.length > 0)
  useEffect(() => {
    if (askedAtMount.current) card.current?.focus({ preventScroll: true })
  }, [])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement
    if (target.tagName === 'SELECT' || target.tagName === 'INPUT') return
    if (pending.length === 0) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setFocus((f) => (f + (event.key === 'ArrowDown' ? 1 : pending.length - 1)) % pending.length)
    } else if (event.key === 'Enter' && target.tagName !== 'BUTTON') {
      event.preventDefault()
      const row = pending[Math.min(focus, pending.length - 1)]
      if (row) {
        card.current
          ?.querySelector<HTMLButtonElement>(
            `[data-request="${CSS.escape(row.requestId)}"] [data-testid=proposal-start]`
          )
          ?.click()
      }
    }
  }

  const outcomes = items.map(outcomeOf)
  const count = (outcome: Outcome | undefined) => outcomes.filter((o) => o === outcome).length
  const summary = [
    count('start') && t('children.proposals.started', { count: count('start') }),
    count('here') && t('children.proposals.here', { count: count('here') }),
    count('refuse') && t('children.proposals.refused', { count: count('refuse') }),
    count('expired') && t('children.proposals.expired', { count: count('expired') }),
    count(undefined) && t('children.proposals.pending', { count: count(undefined) })
  ].filter(Boolean)

  return (
    <div
      className="permission-card proposals"
      ref={card}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      data-testid="proposals"
      data-pending={pending.length}
      // Lignes à lancer : le fil ne défile pas tout seul sous le pointeur (fiche 124) ; les
      // propositions qui arrivent s'ajoutent en dessous (ordre d'arrivée, clé stable).
      data-scroll-hold={pending.length > 0 ? '' : undefined}
    >
      <div className="pc-head">
        <Split size={18} className="pc-icon" />
        <div>
          <div className="pc-title">
            {t('children.proposals.title', { count: items.length })}
            {summary.length > 0 && (
              <span className="proposals-summary"> · {summary.join(', ')}</span>
            )}
          </div>
          {/* Un rôle en lecture seule travaille dans le dossier de la mère (fiche 223). */}
          <div className="pc-sub">
            {t(
              items.some((item) => item.prompt.child.role?.readOnly)
                ? 'roleWork.proposalsWhere'
                : 'children.proposals.worktree'
            )}
          </div>
        </div>
      </div>
      <div className="proposal-rows">
        {items.map((item) => (
          <ProposalRow
            key={item.requestId}
            item={item}
            {...(info ? { info } : {})}
            model={model}
            focused={pending.length > 0 && pending[Math.min(focus, pending.length - 1)] === item}
            onFocus={() => setFocus(Math.max(0, pending.indexOf(item)))}
            onRespond={onRespond}
          />
        ))}
      </div>
      {pending.length > 0 && (
        <div className="pc-actions proposals-foot">
          <span className="question-hint">{t('children.proposals.hint')}</span>
        </div>
      )}
    </div>
  )
}

function ProposalRow({
  item,
  info,
  model,
  focused,
  onFocus,
  onRespond
}: {
  item: ChildProposalItem
  info?: ProposalsInfo
  model: SessionControl | null
  focused: boolean
  onFocus: () => void
  onRespond: RespondElicitation
}) {
  const { t } = useTranslation()
  const { title, prompt, role } = item.prompt.child
  const suggestion = suggestionOf(item.prompt.child, info, model)
  const [open, setOpen] = useState(false)
  // Agent ou modèle suggéré par la mère (fiche 160) : les sélecteurs sont ouverts d'emblée, le
  // choix se confirme (« Lancer ») ou se change sous les yeux de l'utilisateur.
  const [options, setOptions] = useState(suggestion.suggested)
  const [choice, setChoice] = useState<ChildChoice>(suggestion.initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const outcome = outcomeOf(item)
  // Agent qui fera tourner la fille (choisi sur la carte) : lecture seule garantie ou demandée.
  const chosenProfile = info?.profiles.find(
    (p) => p.id === (choice.profileId || info.mother.profileId)
  )

  const decide = (action: ChildDecisionAction) => {
    const extra = action === 'start' && info ? childChoiceRequest(info.mother, model, choice) : {}
    onRespond(item.requestId, {
      action: 'accept',
      content: childDecisionContent({ action, ...extra })
    })
  }
  /** Proposition expirée : la fille part comme avec « Lancer en parallèle… ». */
  const startLater = async () => {
    if (!info || busy) return
    setBusy(true)
    setError(null)
    try {
      await window.api.conversations.startChild(info.mother.id, {
        text: prompt,
        title,
        ...childChoiceRequest(info.mother, model, choice)
      })
    } catch (e) {
      setError(ipcErrorText(e))
      setBusy(false)
    }
  }
  const canStart = outcome === undefined || (outcome === 'expired' && !!info && !busy)
  const loading = outcome === undefined && suggestion.loading
  return (
    <div
      className={`proposal-row${focused ? ' focused' : ''}${outcome ? ` ${outcome}` : ''}`}
      data-testid="proposal-row"
      data-request={item.requestId}
      data-title={title}
      data-outcome={outcome ?? 'pending'}
      onMouseEnter={outcome === undefined ? onFocus : undefined}
    >
      <div className="proposal-main">
        <button
          type="button"
          className="proposal-title"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          data-testid="proposal-title"
        >
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          {role && <RoleAvatar role={role} size="sm" />}
          <span>
            {role ? (
              <>
                <strong className="proposal-role-label">{role.label}</strong> — {title}
              </>
            ) : (
              title
            )}
          </span>
        </button>
        {outcome && <OutcomeBadge outcome={outcome} />}
        <span className="grow" />
        {canStart && (
          <span className="proposal-actions">
            {outcome === undefined && (
              <>
                <button
                  type="button"
                  className={`btn small ghost icon${options ? ' active' : ''}`}
                  title={t('children.proposals.options')}
                  aria-label={t('children.proposals.options')}
                  aria-pressed={options}
                  onClick={() => setOptions((o) => !o)}
                  data-testid="proposal-options"
                >
                  <SlidersHorizontal size={14} />
                </button>
                <button
                  type="button"
                  className="btn small ghost"
                  onClick={() => decide('refuse')}
                  data-testid="proposal-refuse"
                >
                  {t('children.proposals.refuse')}
                </button>
                <button
                  type="button"
                  className="btn small"
                  onClick={() => decide('here')}
                  data-testid="proposal-here"
                >
                  {t('children.proposals.here')}
                </button>
              </>
            )}
            <button
              type="button"
              className="btn small primary"
              onClick={() => (outcome === undefined ? decide('start') : void startLater())}
              disabled={busy || loading}
              title={loading ? t('children.proposals.loadingChoice') : undefined}
              data-testid="proposal-start"
            >
              {t('children.proposals.start')}
            </button>
          </span>
        )}
      </div>
      {role && outcome === undefined && (
        <ProposalRoleMeta
          role={role}
          profile={chosenProfile}
          // Agent proposé par la mère : déjà dit par la ligne de suggestion.
          agentLabel={suggestion.shown ? undefined : chosenProfile?.label}
        />
      )}
      {suggestion.shown && outcome === undefined && (
        <ProposedChoice agent={suggestion.agent} model={suggestion.model} why={suggestion.why} />
      )}
      {open && (
        <pre className="proposal-prompt" data-testid="proposal-prompt">
          {prompt}
        </pre>
      )}
      {outcome === 'expired' && info && (
        <div className="proposal-note">{t('children.proposals.expiredHint')}</div>
      )}
      {options && outcome === undefined && info && (
        <div className="proposal-options" data-testid="proposal-options-panel">
          <ChildOptions
            mother={info.mother}
            profiles={info.profiles}
            model={model}
            choice={choice}
            onChange={setChoice}
            testId="proposal"
          />
        </div>
      )}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

/**
 * Suggestion de la mère sur une ligne (fiche 160) : choix initial, noms à afficher, et si elle
 * n'est pas encore lisible (profils, modèle de la mère) — « Lancer » attend alors, sinon elle
 * serait perdue en silence.
 */
function suggestionOf(
  proposed: ChildProposalItem['prompt']['child'],
  info: ProposalsInfo | undefined,
  model: SessionControl | null
) {
  const suggested = !!(proposed.profileId || proposed.model)
  const value = proposed.model?.value
  return {
    suggested,
    shown: suggested || !!proposed.why,
    initial: {
      profileId: proposed.profileId ?? info?.mother.profileId ?? '',
      modelValue: value ?? null
    },
    loading: (!!value && !model) || (suggested && !info),
    agent: info?.profiles.find((p) => p.id === proposed.profileId)?.label ?? proposed.profileId,
    model: value && (model?.options.find((o) => o.value === value)?.name ?? value),
    why: proposed.why
  }
}

/** Agent et modèle proposés par la mère, et pourquoi (fiche 160) ; l'utilisateur les change. */
function ProposedChoice({
  agent,
  model,
  why
}: {
  agent: string | undefined
  model: string | undefined
  why: string | undefined
}) {
  const { t } = useTranslation()
  const picked = [agent, model].filter(Boolean).join(' · ')
  return (
    <div className="proposal-note proposal-why" data-testid="proposal-why">
      {picked && t('children.proposals.proposed', { choice: picked })}
      {picked && why && ' — '}
      {why}
    </div>
  )
}

function OutcomeBadge({ outcome }: { outcome: Outcome }) {
  const { t } = useTranslation()
  const icon =
    outcome === 'start' ? (
      <Check size={13} />
    ) : outcome === 'here' ? (
      <CornerDownLeft size={13} />
    ) : (
      <X size={13} />
    )
  return (
    <span className={`proposal-state ${outcome}`} data-testid="proposal-state">
      {icon}
      {t(`children.proposals.state.${outcome}`)}
    </span>
  )
}
