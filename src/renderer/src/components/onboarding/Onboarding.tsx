import { ArrowRight, Folder, FolderOpen, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AgentConfigureRequest, ProfileSummary } from '@shared/agent'
import { PROBE_PROMPT, REPLY_TIMEOUT_SECONDS, type AgentReadiness } from '@shared/onboarding'
import { numberFormat } from '@shared/i18n/format'
import { formatCost } from '@shared/usage'
import { ipcErrorText } from '../../ipc-errors'
import { CodeText } from '../common/CodeText'
import { SpoolMark } from '../common/SpoolMark'
import { BlockerPanel } from '../composer/BlockerPanel'
import { ActionLine, Alert, ReadinessError, Stepper, Waiting } from './OnboardingParts'
import type { OnboardingController, OnboardingStep } from './useOnboarding'

interface Props {
  onboarding: OnboardingController
  /** Reconfigure la conversation de l'accueil (agent, dossier) ; erreurs déjà signalées. */
  configure: (request: AgentConfigureRequest) => Promise<unknown> | undefined
  /** Dossier de la conversation de l'accueil (vide tant qu'aucun n'est choisi). */
  workspace: string
  /** Panneau de droite sur le terminal de la conversation. */
  onShowTerminal: () => void
}

/**
 * Accueil du premier lancement (fiche 188, verdict UX du 2026-11-07) : Agent → Connexion →
 * Dossier → Essai, dans la zone principale. Rien de propre à un agent : agents, connexions et
 * conseils viennent des profils, la carte de connexion est celle des conversations (fiche 022).
 */
export function Onboarding(props: Props) {
  const { t } = useTranslation()
  const { onboarding } = props
  const available = onboarding.agents.filter((a) => a.available)
  const [step, setStep] = useState<OnboardingStep>('agent')
  const [profileId, setProfileId] = useState(available[0]?.id ?? '')
  // Modèle annoncé à la vérification, montré avant l'essai.
  const [model, setModel] = useState<string | undefined>()
  const agent = onboarding.agents.find((a) => a.id === profileId)
  const label = agent?.label ?? ''
  const { check } = onboarding

  // Échap annule une vérification ou un essai en cours ; ne passe jamais une étape.
  useEffect(() => {
    if (check.status !== 'running') return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onboarding.cancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [check.status, onboarding])

  const announced =
    check.status === 'done' && check.result.state === 'ready' ? check.result.model : undefined
  if (announced && announced !== model) setModel(announced)

  const go = (next: OnboardingStep) => {
    onboarding.reset()
    setStep(next)
  }
  const reconfigure = async (request: AgentConfigureRequest): Promise<boolean> => {
    onboarding.rebind()
    try {
      await props.configure(request)
      return true
    } catch (failure) {
      onboarding.setError(ipcErrorText(failure))
      return false
    }
  }
  const chooseAgent = async () => {
    if (!profileId || !(await reconfigure({ profileId }))) return
    setModel(undefined)
    go('connect')
    onboarding.start(profileId, 'connect')
  }
  const useFolder = async (folder: string | null) => {
    if (!folder || !(await reconfigure({ workspace: folder }))) return
    go('trial')
  }

  const body = (() => {
    switch (step) {
      case 'agent':
        return (
          <AgentStep
            agents={onboarding.agents}
            selected={profileId}
            onSelect={setProfileId}
            onContinue={() => void chooseAgent()}
            onboarding={onboarding}
          />
        )
      case 'connect':
        return (
          <ConnectStep
            {...props}
            label={label}
            profileId={profileId}
            onContinue={() => go('folder')}
            onOtherAgent={() => go('agent')}
          />
        )
      case 'folder':
        return (
          <FolderStep
            trialFolder={onboarding.trialFolder}
            onChoose={() => void window.api.workspace.choose().then(useFolder, () => {})}
            onTrial={() =>
              void window.api.onboarding
                .trialFolder()
                .then(useFolder, (failure: unknown) => onboarding.setError(ipcErrorText(failure)))
            }
          />
        )
      case 'trial':
        return (
          <TrialStep
            {...props}
            label={label}
            profileId={profileId}
            model={model}
            onOtherAgent={() => go('agent')}
          />
        )
    }
  })()

  return (
    <div className="onboarding" data-testid="onboarding">
      <div className="onboarding-top">
        <Stepper step={step} onBack={go} />
        <span className="grow" />
        <button
          className="link-button onboarding-skip-all"
          onClick={() => onboarding.finish('skipped')}
          data-testid="onboarding-skip-all"
        >
          {t('onboarding.skipAll')}
        </button>
      </div>
      <div className="onboarding-center" key={step}>
        {body}
        {onboarding.error && (
          <p className="onboarding-text error" role="alert">
            {onboarding.error}
          </p>
        )}
      </div>
    </div>
  )
}

function Title(props: { title: string; subtitle?: string }) {
  return (
    <>
      <h1 className="greeting onboarding-title">
        <SpoolMark size={30} motion="intro" />
        {props.title}
      </h1>
      {props.subtitle && <p className="onboarding-subtitle">{props.subtitle}</p>}
    </>
  )
}

function AgentStep(props: {
  agents: ProfileSummary[]
  selected: string
  onSelect: (id: string) => void
  onContinue: () => void
  onboarding: OnboardingController
}) {
  const { t } = useTranslation()
  const [searched, setSearched] = useState<'idle' | 'searching' | 'none'>('idle')
  const available = props.agents.filter((a) => a.available)
  if (available.length === 0) {
    const search = async () => {
      setSearched('searching')
      const agents = await props.onboarding.refreshAgents().catch(() => [])
      const first = agents.find((a) => a.available)
      if (first) {
        props.onSelect(first.id)
        setSearched('idle')
      } else setSearched('none')
    }
    return (
      <>
        <Title title={t('onboarding.agent.title')} subtitle={t('onboarding.agent.noneSubtitle')} />
        <div className="onboarding-card" data-testid="onboarding-no-agent">
          {props.agents.map((a) => (
            <ActionLine
              key={a.id}
              icon={<Sparkles size={15} />}
              title={a.label}
              help={a.reason ? <CodeText text={a.reason} /> : undefined}
            />
          ))}
        </div>
        <div className="onboarding-actions">
          <span className="grow" />
          <button
            className="btn ghost"
            onClick={() => props.onboarding.finish('skipped')}
            data-testid="onboarding-explore"
          >
            {t('onboarding.agent.explore')}
          </button>
          <button
            className="btn primary"
            onClick={() => void search()}
            disabled={searched === 'searching'}
            autoFocus
            data-testid="onboarding-search"
          >
            {t('onboarding.agent.search')}
          </button>
        </div>
        <p
          className="onboarding-text muted small"
          aria-live="polite"
          data-testid="onboarding-still-none"
        >
          {searched === 'none' ? t('onboarding.agent.stillNone') : ''}
        </p>
      </>
    )
  }
  return (
    <>
      <Title title={t('onboarding.agent.title')} subtitle={t('onboarding.agent.subtitle')} />
      <div className="onboarding-card" role="radiogroup" aria-label={t('onboarding.agent.group')}>
        {props.agents.map((a) => (
          <label
            key={a.id}
            className={`onboarding-choice ${a.id === props.selected ? 'selected' : ''} ${a.available ? '' : 'off'}`}
            data-testid={`onboarding-agent-${a.id}`}
          >
            <input
              type="radio"
              name="onboarding-agent"
              value={a.id}
              checked={a.id === props.selected}
              disabled={!a.available}
              onChange={() => props.onSelect(a.id)}
            />
            <div className="grow" style={{ minWidth: 0 }}>
              <div>
                <b>{a.label}</b>{' '}
                <span className={`onboarding-badge ${a.available ? 'ok' : ''}`}>
                  {a.available ? t('onboarding.agent.found') : t('onboarding.agent.missing')}
                </span>
              </div>
              {(a.available ? a.destination : a.reason) && (
                <div className="muted small">
                  <CodeText text={(a.available ? a.destination : a.reason) ?? ''} />
                </div>
              )}
            </div>
          </label>
        ))}
      </div>
      <p className="onboarding-text muted small">{t('onboarding.agent.note')}</p>
      <div className="onboarding-actions">
        <span className="grow" />
        <button
          className="btn primary"
          onClick={props.onContinue}
          data-testid="onboarding-continue"
        >
          {t('onboarding.continue')}
          <ArrowRight size={14} />
        </button>
      </div>
    </>
  )
}

type StepProps = Props & { label: string; profileId: string; onOtherAgent: () => void }

/** Carte de connexion (fiche 022), ses actions passant par l'essai plutôt que par une conversation. */
function Blocker(props: StepProps & { result: AgentReadiness; level: 'connect' | 'reply' }) {
  const { onboarding, profileId, level } = props
  if (
    props.result.state !== 'auth' &&
    props.result.state !== 'license' &&
    props.result.state !== 'trust'
  ) {
    return null
  }
  return (
    <BlockerPanel
      blocker={props.result.blocker}
      agentLabel={props.label}
      workspace={props.workspace}
      onAuthenticate={(methodId) => onboarding.start(profileId, level, methodId)}
      onRetry={() => onboarding.start(profileId, level)}
      onUseApiKey={async (env, value) => {
        await window.api.settings.setApiKey(profileId, env, value)
        onboarding.start(profileId, level)
      }}
      onRunStep={(stepId) => {
        const id = onboarding.homeId()
        if (!id) return
        // L'onglet du terminal d'abord : sans dossier choisi, le panneau n'en crée pas lui-même.
        window.api.onboarding
          .runStep(id, profileId, stepId)
          .then(props.onShowTerminal, (failure: unknown) =>
            onboarding.setError(ipcErrorText(failure))
          )
      }}
      onTrustForSession={() => {}}
      onOpenTerminal={props.onShowTerminal}
      onChooseWorkspace={() => {}}
    />
  )
}

const BLOCKERS = new Set(['auth', 'license', 'trust'])

function ConnectStep(props: StepProps & { onContinue: () => void }) {
  const { t } = useTranslation()
  const { onboarding, profileId, label } = props
  const { check } = onboarding
  const retry = () => onboarding.start(profileId, 'connect')
  const content = (() => {
    if (check.status === 'running') {
      // SSO dans le navigateur (fiche 207) : dit ce qu'on attend, et une sortie si rien ne revient.
      return check.authenticating ? (
        <Waiting
          text={t('blocker.auth.waitBrowser')}
          started={check.started}
          onCancel={onboarding.cancel}
          onStuck={retry}
        />
      ) : (
        <Waiting
          text={t('onboarding.connect.checking')}
          started={check.started}
          onCancel={onboarding.cancel}
        />
      )
    }
    if (check.status !== 'done') return null
    const { result } = check
    if (result.state === 'ready') {
      return (
        <>
          <Alert
            tone="ok"
            title={t('onboarding.connect.readyTitle', { agent: label })}
            testId="onboarding-ready"
          >
            <p className="onboarding-text">
              {t('onboarding.connect.readyText', { seconds: seconds(result.ms) })}
            </p>
          </Alert>
          <div className="onboarding-actions">
            <span className="grow" />
            <button
              className="btn primary"
              onClick={props.onContinue}
              autoFocus
              data-testid="onboarding-continue"
            >
              {t('onboarding.continue')}
              <ArrowRight size={14} />
            </button>
          </div>
        </>
      )
    }
    const blocker = BLOCKERS.has(result.state)
    return (
      <>
        {blocker ? (
          <Blocker {...props} result={result} level="connect" />
        ) : result.state === 'cancelled' ? (
          <Alert
            tone="neutral"
            title={t('onboarding.connect.cancelled')}
            testId="onboarding-cancelled"
          />
        ) : (
          <ReadinessError result={result} agent={label} />
        )}
        <Actions
          onOtherAgent={props.onOtherAgent}
          onSkip={props.onContinue}
          {...(blocker ? {} : { onRetry: retry })}
        />
      </>
    )
  })()
  return (
    <>
      <Title title={t('onboarding.connect.title', { agent: label })} />
      <div aria-live="polite">{content}</div>
    </>
  )
}

/** Actions d'une étape en erreur : autre agent à gauche, passer, réessayer (principal). */
function Actions(props: { onOtherAgent: () => void; onSkip: () => void; onRetry?: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="onboarding-actions">
      <button
        className="link-button"
        onClick={props.onOtherAgent}
        data-testid="onboarding-other-agent"
      >
        {t('onboarding.otherAgent')}
      </button>
      <span className="grow" />
      <button className="btn ghost" onClick={props.onSkip} data-testid="onboarding-skip-step">
        {t('onboarding.skipStep')}
      </button>
      {props.onRetry && (
        <button
          className="btn primary"
          onClick={props.onRetry}
          autoFocus
          data-testid="onboarding-retry"
        >
          {t('onboarding.retry')}
        </button>
      )}
    </div>
  )
}

function FolderStep(props: { trialFolder: string; onChoose: () => void; onTrial: () => void }) {
  const { t } = useTranslation()
  return (
    <>
      <Title title={t('onboarding.folder.title')} subtitle={t('onboarding.folder.subtitle')} />
      <div className="onboarding-card">
        <ActionLine
          icon={<FolderOpen size={16} />}
          title={t('onboarding.folder.projectTitle')}
          help={t('onboarding.folder.projectHelp')}
        >
          <button
            className="btn primary"
            onClick={props.onChoose}
            autoFocus
            data-testid="onboarding-choose-folder"
          >
            {t('onboarding.folder.choose')}
          </button>
        </ActionLine>
        <ActionLine
          icon={<Folder size={16} />}
          title={t('onboarding.folder.trialTitle')}
          help={t('onboarding.folder.trialHelp', {
            path: `${props.trialFolder}/${t('onboarding.trialFolderName')}`
          })}
        >
          <button className="btn" onClick={props.onTrial} data-testid="onboarding-trial-folder">
            {t('onboarding.folder.create')}
          </button>
        </ActionLine>
      </div>
    </>
  )
}

function TrialStep(props: StepProps & { model: string | undefined }) {
  const { t } = useTranslation()
  const { onboarding, profileId, label } = props
  const { check } = onboarding
  const send = () => onboarding.start(profileId, 'reply')
  // « Passer » pendant l'envoi annule d'abord, puis termine l'accueil.
  const skip = () => onboarding.finish('skipped')
  const content = (() => {
    if (check.status === 'running') {
      return (
        <Waiting
          text={t('onboarding.trial.waiting')}
          started={check.started}
          max={REPLY_TIMEOUT_SECONDS}
          onCancel={onboarding.cancel}
          onSkip={skip}
        />
      )
    }
    if (check.status === 'idle') {
      return (
        <>
          <div className="onboarding-card">
            <ActionLine
              icon={<Sparkles size={16} />}
              title={t('onboarding.trial.toSend')}
              help={
                <>
                  <span className="onboarding-prompt">« {PROBE_PROMPT} »</span>
                  <br />
                  {t('onboarding.trial.cost')}
                  {props.model && (
                    <>
                      <br />
                      {t('onboarding.trial.model', { model: props.model })}
                    </>
                  )}
                </>
              }
            />
          </div>
          <div className="onboarding-actions">
            <span className="grow" />
            <button className="btn ghost" onClick={skip} data-testid="onboarding-skip-step">
              {t('onboarding.skipStep')}
            </button>
            <button className="btn primary" onClick={send} autoFocus data-testid="onboarding-send">
              {t('onboarding.trial.send')}
            </button>
          </div>
        </>
      )
    }
    const { result } = check
    if (result.state === 'ready') {
      const facts = [
        result.cost ? t('onboarding.trial.cost2', { amount: formatCost(result.cost) }) : null,
        result.tokens
          ? t('onboarding.trial.tokens', {
              input: numberFormat().format(result.tokens.input),
              output: numberFormat().format(result.tokens.output)
            })
          : null,
        result.model ? t('onboarding.trial.model', { model: result.model }) : null
      ].filter(Boolean)
      return (
        <>
          <Alert
            tone="ok"
            title={t('onboarding.trial.repliedTitle', {
              agent: label,
              seconds: seconds(result.ms)
            })}
            testId="onboarding-replied"
          >
            <div className="onboarding-reply">{result.reply}</div>
            {facts.length > 0 && <div className="onboarding-facts">{facts.join(' · ')}</div>}
            {result.toolRefused && (
              <p className="onboarding-text muted small">{t('onboarding.trial.toolRefused')}</p>
            )}
          </Alert>
          <div className="onboarding-actions">
            <span className="grow" />
            <button
              className="btn primary"
              onClick={() => onboarding.finish('finished')}
              autoFocus
              data-testid="onboarding-start"
            >
              {t('onboarding.start')}
            </button>
          </div>
        </>
      )
    }
    const blocker = BLOCKERS.has(result.state)
    return (
      <>
        {blocker ? (
          <Blocker {...props} result={result} level="reply" />
        ) : result.state === 'cancelled' ? (
          <Alert
            tone="neutral"
            title={t('onboarding.trial.cancelled')}
            testId="onboarding-cancelled"
          />
        ) : (
          <ReadinessError result={result} agent={label} />
        )}
        <Actions
          onOtherAgent={props.onOtherAgent}
          onSkip={skip}
          {...(blocker ? {} : { onRetry: send })}
        />
      </>
    )
  })()
  return (
    <>
      <Title
        title={t('onboarding.trial.title', { agent: label })}
        subtitle={check.status === 'idle' ? t('onboarding.trial.subtitle') : undefined}
      />
      <div aria-live="polite">{content}</div>
    </>
  )
}

const seconds = (ms: number) => numberFormat({ maximumFractionDigits: 1 }).format(ms / 1000)
