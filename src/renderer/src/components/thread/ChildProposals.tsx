import {
  Check,
  ChevronDown,
  ChevronRight,
  CornerDownLeft,
  SlidersHorizontal,
  X
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { ConversationSummary, ProfileSummary, SessionControl } from '@shared/agent'
import {
  childDecisionContent,
  parseChildDecision,
  type ChildDecisionAction,
  type ChildProposalItem
} from '@shared/children'
import { ipcErrorText } from '../../ipc-errors'
import { ChildOptions, childChoiceRequest, type ChildChoice } from '../sidebar/child-options'
import type { RespondElicitation } from './ElicitationCard'
import { RoleAvatar } from '../roles/RoleAvatar'
import { ProposalRoleMeta } from '../roles/RoleWork'
import { LaunchDetails, LaunchLine, useLaunchFolder } from './LaunchLine'

/**
 * Lignes proposées d'une carte de groupe (fiches 112, 264) : les propositions de travaux d'un tour
 * (`start_child`). Lancer (agent et modèle au choix, présélectionnés d'après la proposition de
 * l'agent et sa raison, fiche 160), Faire ici, Refuser ; une ligne répondue garde son issue ; une
 * ligne annulée par un redémarrage de l'agent garde « Lancer », qui passe alors par « Lancer en
 * parallèle… » (sa clé suit : le travail reste sur sa ligne). La carte elle-même est `WorkGroup`.
 */

/** Ce que la carte sait de la conversation affichée : la mère des travaux proposés. */
export interface ProposalsInfo {
  mother: ConversationSummary
  profiles: ProfileSummary[]
}

/** Issue d'une ligne : la décision, ou l'annulation. */
export type Outcome = ChildDecisionAction | 'expired'

export function outcomeOf(item: ChildProposalItem): Outcome | undefined {
  if (item.state === 'pending') return undefined
  if (item.state === 'accept') return parseChildDecision(item.content)?.action ?? 'refuse'
  return item.state === 'cancel' ? 'expired' : 'refuse'
}

/** Ligne encore à lancer (en attente, ou expirée) d'un travail qui écrit. */
const writes = (item: ChildProposalItem) => {
  const outcome = outcomeOf(item)
  return (!outcome || outcome === 'expired') && !item.prompt.child.role?.readOnly
}

/**
 * Où partiront les travaux qui écrivent (fiches 240, 262) : une ligne à lancer qui écrit (pas un
 * rôle en lecture seule) fait lire le dossier de la mère. Avec du non commité, une ligne discrète
 * le dit et « Lancer » part sans elles (choix porté par la décision) ; « Changer… » propose de
 * committer d'abord. Sans commit (ou hors dépôt), les travaux se feront dans ce dossier : rien à
 * choisir. Rend aussi ce que « Lancer » attend (lecture du dossier, commit en cours).
 */
export function useProposalsLaunch(items: readonly ChildProposalItem[], info?: ProposalsInfo) {
  const { t } = useTranslation()
  const toWorktree = items.some(writes)
  const folder = useLaunchFolder(info?.mother.id, !!info && toWorktree)
  const state = folder.state
  const [committing, setCommitting] = useState(false)
  const [showFiles, setShowFiles] = useState(false)
  // Dossier pas encore lu : « Lancer » attend un instant (un clic rapide partirait sans le choix
  // affiché) ; de même pendant « Committer d'abord ».
  const reading = state === undefined && !!info && toWorktree
  const anyway = state?.place === 'worktree' && !!state.dirty
  // Accord de la ligne : les travaux qui écrivent encore à lancer (revue UX).
  const writers = items.filter(writes).length
  const shown =
    !!state &&
    !!info &&
    toWorktree &&
    (state.place === 'here' || !!state.dirty) &&
    items.some((item) => {
      const outcome = outcomeOf(item)
      return !outcome || outcome === 'expired'
    })
  const place =
    shown && state && info ? (
      <div className="launch-place" data-testid="proposals-launch-place">
        <LaunchLine
          state={state}
          choice="without"
          onChoose={() => {}}
          who={writers > 1 ? 'works' : 'work'}
          opinion={false}
          standalone
          committing={committing}
          onCommitting={setCommitting}
          showFiles={showFiles}
          onShowFiles={setShowFiles}
        />
        <LaunchDetails
          state={state}
          committing={committing}
          onCommitting={setCommitting}
          showFiles={showFiles}
          onShowFiles={setShowFiles}
          commit={{
            conversationId: info.mother.id,
            confirmLabel: t('launchLine.commitOnly'),
            run: async (message, files) => {
              await window.api.conversations.commitForChildren(info.mother.id, {
                message,
                files
              })
              await folder.read()
            },
            // Fiche 244 : des fichiers décochés restent ; « Lancer » part sans eux (dit).
            onCommitted: () => {}
          }}
        />
      </div>
    ) : null
  return {
    held: reading || committing,
    heldWhy: (reading ? 'heldReading' : 'heldCommitting') as 'heldReading' | 'heldCommitting',
    anyway,
    inFolder: state?.place === 'here',
    place
  }
}

/** Ce que « Tout lancer » demande à chaque ligne encore proposée : la lancer, avec son choix. */
export type StartRegistry = Map<string, () => void>

export function ProposalRow({
  item,
  info,
  model,
  focused,
  onFocus,
  onRespond,
  held,
  heldWhy,
  uncommitted,
  inFolder,
  starts,
  children
}: {
  /** « Tout lancer » (fiche 264) : la ligne y inscrit son lancement tant qu'elle attend. */
  starts?: StartRegistry
  /** Travail lancé depuis cette ligne (fiche 264) : remplace l'issue « Lancée ». */
  children?: ReactNode
  /** Dossier de la mère pas encore lu, ou commit en cours (fiche 262) : « Lancer » attend. */
  held: boolean
  /** Pourquoi « Lancer » attend, dit en infobulle. */
  heldWhy: 'heldReading' | 'heldCommitting'
  /** Non commité laissé derrière, affiché par la ligne du dossier : passé au lancement. */
  uncommitted?: 'anyway'
  /** Dépôt sans commit (fiche 262) : la fille travaillera dans ce dossier, pas dans un worktree. */
  inFolder: boolean
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
      content: childDecisionContent({
        action,
        ...extra,
        ...(action === 'start' && uncommitted ? { uncommitted } : {})
      })
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
        ...childChoiceRequest(info.mother, model, choice),
        ...(uncommitted ? { uncommitted } : {}),
        ...cardOf(item)
      })
    } catch (e) {
      setError(ipcErrorText(e))
      setBusy(false)
    }
  }
  const canStart = outcome === undefined || (outcome === 'expired' && !!info && !busy)
  const loading = outcome === undefined && suggestion.loading
  // « Tout lancer » : la même chose que « Lancer » sur cette ligne, avec le choix affiché.
  const start = () => (outcome === undefined ? decide('start') : void startLater())
  useStartAll(starts, canStart && !held && !loading ? item.requestId : undefined, start)
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
          {role && <RoleAvatar role={role} size={22} />}
          {/* Le titre seul en gras ; son rôle est dans la méta (revue UX, fiche 264). */}
          <span className="proposal-title-text">{title}</span>
        </button>
        <RowOutcome outcome={outcome}>{children}</RowOutcome>
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
              onClick={start}
              disabled={busy || loading || held}
              title={
                held
                  ? t(`launchLine.${heldWhy}`)
                  : loading
                    ? t('children.proposals.loadingChoice')
                    : undefined
              }
              data-testid="proposal-start"
            >
              {t('children.proposals.start')}
            </button>
          </span>
        )}
      </div>
      {outcome === undefined && (
        <ProposalRoleMeta
          role={role}
          profile={chosenProfile}
          // Agent proposé par la mère : déjà dit par la ligne de suggestion.
          agentLabel={suggestion.shown ? undefined : chosenProfile?.label}
          inFolder={inFolder}
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
        <div className="proposal-note">{t('workGroup.expiredHint')}</div>
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
 * « Tout lancer » (fiche 264) : la ligne y inscrit son lancement tant qu'elle peut partir (`key`) ;
 * réinscrit à chaque rendu, il part avec le choix affiché (agent, modèle).
 */
function useStartAll(
  starts: StartRegistry | undefined,
  key: string | undefined,
  start: () => void
) {
  useEffect(() => {
    if (!starts || !key) return
    starts.set(key, start)
    return () => {
      starts.delete(key)
    }
  })
}

/** Sa clé suit une proposition expirée relancée : le travail reste sur sa ligne (fiche 264). */
const cardOf = (item: ChildProposalItem): { card?: string } =>
  item.prompt.child.key ? { card: item.prompt.child.key } : {}

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

/** L'issue d'une ligne ; ce que la carte met à sa place (un travail qui démarre) l'emporte. */
function RowOutcome({ outcome, children }: { outcome: Outcome | undefined; children?: ReactNode }) {
  if (children) return <>{children}</>
  return outcome ? <OutcomeBadge outcome={outcome} /> : null
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
      {t(`workGroup.outcome.${outcome}`)}
    </span>
  )
}
