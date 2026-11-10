import {
  Cpu,
  FileText,
  FolderLock,
  FolderOpen,
  KeyRound,
  LoaderCircle,
  RotateCw,
  SquareTerminal
} from 'lucide-react'
import { useState } from 'react'
import type { AgentBlocker, ControlValue, SessionControl } from '@shared/agent'
import { basename } from '../common/Menus'
import { ModelPickButton } from '../common/ModelMenu'
import { KeychainWait, useKeySave } from '../settings/KeySave'
import { Trans, useTranslation } from 'react-i18next'

interface Props {
  blocker: AgentBlocker
  agentLabel: string
  workspace: string
  onAuthenticate: (methodId: string) => void
  /** Rend la promesse de l'appel : « Réessayer » reste désactivé jusqu'à sa fin. */
  onRetry: () => unknown
  onUseApiKey: (env: string, value: string) => Promise<void>
  onRunStep: (stepId: string) => void
  onTrustForSession: () => void
  onOpenTerminal: () => void
  /** Dialogue natif de choix du dossier (carte « Choisissez le dossier… », fiche 093). */
  onChooseWorkspace: () => void
  /**
   * Réglage du modèle de la session et son changement : sur la carte d'un modèle refusé faute de
   * connexion (fiche 210), choisir un autre modèle renvoie le message refusé.
   */
  modelControl?: SessionControl
  onSetControl?: (id: string, value: ControlValue) => void
}

/** Ce que l'utilisateur doit faire avant que l'agent puisse ouvrir la session (Bob : SSO, dossier). */
export function BlockerPanel(props: Props) {
  const { t } = useTranslation()
  const { blocker } = props
  if (blocker.kind === 'auth') return <AuthPanel {...props} blocker={blocker} />
  if (blocker.kind === 'license') return <LicensePanel {...props} blocker={blocker} />
  if (blocker.kind === 'workspace') return <WorkspacePanel {...props} />

  const command = blocker.approveCommand
  return (
    <div className="blocker-card" data-testid="blocker-trust">
      <div className="pc-head">
        <FolderLock size={18} className="pc-icon" />
        <div>
          <div className="pc-title">{t('blocker.trust.title')}</div>
          <div className="pc-sub">
            {t('blocker.trust.notApproved', {
              agent: props.agentLabel,
              folder: basename(props.workspace)
            })}
          </div>
        </div>
      </div>
      <div className="blocker-body">
        <p>
          {command ? (
            <Trans
              t={t}
              i18nKey="blocker.trust.approveWithCommand"
              values={{ command }}
              components={{ code: <code /> }}
            />
          ) : (
            <>{t('blocker.trust.approveInAgent')}</>
          )}
        </p>
        <details className="blocker-details">
          <summary>{t('blocker.trust.agentMessage')}</summary>
          <p>{blocker.message}</p>
        </details>
      </div>
      {/* La confiance, quand le profil la permet, est l'action principale : à droite (fiche 093). */}
      <div className="pc-actions">
        <span className="grow" />
        <button className="btn" onClick={props.onOpenTerminal} data-testid="open-terminal">
          <SquareTerminal size={15} /> {t('blocker.openTerminal')}
        </button>
        <button
          className={`btn ${blocker.canTrustForSession ? '' : 'primary'}`}
          onClick={props.onRetry}
          data-testid="retry"
        >
          <RotateCw size={14} /> {t('blocker.retry')}
        </button>
        {blocker.canTrustForSession && (
          <button
            className="btn primary"
            onClick={props.onTrustForSession}
            title={
              blocker.trustRemembered
                ? t('blocker.trust.rememberedHint', { agent: props.agentLabel })
                : t('blocker.trust.sessionHint')
            }
            data-testid="trust-once"
          >
            {blocker.trustRemembered ? t('blocker.trust.remembered') : t('blocker.trust.session')}
          </button>
        )}
      </div>
    </div>
  )
}

type Blocker<K extends AgentBlocker['kind']> = Extract<AgentBlocker, { kind: K }>

/**
 * Aucun dossier choisi (premier lancement, fiche 093) : l'agent ne démarre qu'une fois le dossier
 * choisi. Icône d'un dossier ouvert, pas le cadenas de « Dossier non approuvé » : rien n'est refusé
 * ici, il reste à choisir.
 */
function WorkspacePanel(props: Props) {
  const { t } = useTranslation()
  return (
    <div className="blocker-card blocker-workspace" data-testid="blocker-workspace">
      <div className="pc-head">
        <FolderOpen size={18} className="pc-icon" />
        <div>
          <div className="pc-title">{t('blocker.workspace.title')}</div>
          <div className="pc-sub">{t('blocker.workspace.subtitle')}</div>
        </div>
      </div>
      <div className="pc-actions">
        <span className="grow" />
        <button
          className="btn primary"
          onClick={props.onChooseWorkspace}
          data-testid="choose-workspace"
        >
          {t('blocker.workspace.choose')}
        </button>
      </div>
    </div>
  )
}

/**
 * Connexion requise : les méthodes de l'agent (SSO de Bob : il ouvre le navigateur ; OpenCode : une
 * commande à lancer dans le terminal), ou une clé d'API (fiche 022).
 */
function AuthPanel(props: Props & { blocker: Blocker<'auth'> }) {
  const { t } = useTranslation()
  const { blocker } = props
  const [stepLaunched, setStepLaunched] = useState(false)
  const [keyOpen, setKeyOpen] = useState(false)
  const [key, setKey] = useState('')
  const apiKey = blocker.apiKey
  // Jamais silencieux (fiche 207) : comme dans Réglages › Agents.
  const keySave = useKeySave((value) =>
    apiKey ? props.onUseApiKey(apiKey.env, value) : Promise.resolve()
  )
  const { saving } = keySave
  // Refusée à un message (connexion expirée, D10) : « Réessayer » toujours là ; un seul bouton
  // principal, la connexion d'abord, puis « Réessayer » une fois l'étape lancée.
  const atTurn = blocker.atTurn === true
  // Confirmation des outils ouverte : son bouton est le seul principal de la carte.
  const [confirming, setConfirming] = useState(false)
  const retryFirst = atTurn && (stepLaunched || confirming)
  // Modèle refusé (fiche 210) : la carte le nomme ; un autre modèle, s'il y en a, en premier.
  const model = atTurn ? blocker.model : undefined
  const { onSetControl } = props
  const otherModel = model && onSetControl ? withOtherModel(props.modelControl) : undefined
  const submitKey = () => {
    if (!apiKey || !key.trim() || saving) return
    void keySave.run(key).then((saved) => saved && setKey(''))
  }
  const waiting = blocker.authenticating
  return (
    <div className="blocker-card" data-testid="blocker-auth">
      <AuthHead atTurn={atTurn} model={model} agentLabel={props.agentLabel} />
      {waiting ? (
        <div className="blocker-wait" data-testid="authenticating">
          <LoaderCircle size={15} className="spin" />
          {t('blocker.auth.waitBrowser')}
        </div>
      ) : (
        <div className="blocker-methods">
          {otherModel && onSetControl && (
            <ChooseModel
              control={otherModel}
              primary={!retryFirst}
              toolsRan={blocker.toolsRan === true}
              onPick={(value) => onSetControl(otherModel.id, value)}
            />
          )}
          {blocker.methods.map((method, i) => (
            <button
              key={method.id}
              className={`btn ${i === 0 && !retryFirst && !otherModel ? 'primary' : ''}`}
              onClick={() => {
                if (method.step) {
                  props.onRunStep(method.step.id)
                  setStepLaunched(true)
                } else {
                  props.onAuthenticate(method.id)
                }
              }}
              title={
                method.step
                  ? t('blocker.runInTerminal', { command: method.step.command })
                  : method.description
              }
              data-testid={`auth-${method.id}`}
            >
              {method.step && <SquareTerminal size={15} />}
              {method.step ? method.step.label : method.name}
            </button>
          ))}
          {apiKey && !keyOpen && (
            <button
              className={`btn ${blocker.methods.length ? 'ghost' : 'primary'}`}
              onClick={() => setKeyOpen(true)}
              data-testid="auth-api-key"
            >
              {t('blocker.auth.useApiKey')}
            </button>
          )}
        </div>
      )}
      {/* Modèle refusé : « Réessayer » une fois la connexion lancée (ou des outils déjà passés). */}
      {atTurn && (!model || stepLaunched || waiting || blocker.toolsRan) && (
        <ExpiredAuthBody
          blocker={blocker}
          retryFirst={retryFirst || !blocker.methods.length}
          confirming={confirming}
          onConfirming={setConfirming}
          onRetry={props.onRetry}
          waiting={waiting}
        />
      )}
      {waiting && !atTurn && <StuckSignIn onRetry={props.onRetry} />}
      {stepLaunched && !atTurn && !waiting && (
        <>
          <div className="blocker-body">
            <p>{t('blocker.auth.finishInTerminal')}</p>
          </div>
          <div className="pc-actions">
            <span className="grow" />
            <button className="btn primary" onClick={props.onRetry} data-testid="retry">
              <RotateCw size={14} /> {t('blocker.retry')}
            </button>
          </div>
        </>
      )}
      {apiKey && keyOpen && !blocker.authenticating && (
        <form
          className="blocker-key"
          onSubmit={(event) => {
            event.preventDefault()
            submitKey()
          }}
        >
          <label htmlFor="blocker-api-key">{apiKey.label}</label>
          <div className="blocker-key-row">
            <input
              id="blocker-api-key"
              type="password"
              autoComplete="off"
              spellCheck={false}
              autoFocus
              disabled={saving}
              value={key}
              placeholder={t('blocker.auth.keyPlaceholder')}
              onChange={(event) => setKey(event.target.value)}
              data-testid="api-key-input"
            />
            <button
              type="submit"
              className="btn primary"
              disabled={!key.trim() || saving}
              data-testid="api-key-save"
            >
              {saving ? (
                <>
                  <LoaderCircle size={14} className="spin" /> {t('settings.apiKeys.saving')}
                </>
              ) : keySave.timedOut ? (
                <>
                  <RotateCw size={14} /> {t('settings.apiKeys.retry')}
                </>
              ) : (
                t('blocker.auth.signIn')
              )}
            </button>
          </div>
          {keySave.slow ? (
            <KeychainWait className="blocker-key-hint" />
          ) : (
            !keySave.timedOut && (
              <div className="blocker-key-hint">
                {apiKey.help ? `${apiKey.help} ` : ''}
                {t('blocker.auth.keyHint')}
              </div>
            )
          )}
          {keySave.error && (
            <div className="blocker-error" data-testid="api-key-error">
              {keySave.error}
            </div>
          )}
        </form>
      )}
      {blocker.error && (
        <div className="blocker-error">{t('blocker.auth.failed', { error: blocker.error })}</div>
      )}
    </div>
  )
}

/**
 * « Choisir un autre modèle » (fiche 210) : le choix renvoie le message refusé. Des outils avaient
 * déjà tourné pour lui : la même confirmation que « Réessayer » avant de les relancer.
 */
function ChooseModel({
  control,
  primary,
  toolsRan,
  onPick
}: {
  control: SessionControl
  primary: boolean
  toolsRan: boolean
  onPick: (value: string) => void
}) {
  const { t } = useTranslation()
  const [pending, setPending] = useState<string | undefined>(undefined)
  if (pending !== undefined) {
    return (
      <span className="blocker-model-confirm" data-testid="model-confirm">
        <span className="grow">{t('blocker.auth.confirmToolsRan')}</span>
        <button className="btn" onClick={() => setPending(undefined)} data-testid="model-cancel">
          {t('common.cancel')}
        </button>
        <button
          className="btn primary"
          autoFocus
          onClick={() => {
            setPending(undefined)
            onPick(pending)
          }}
          data-testid="model-rerun"
        >
          <RotateCw size={14} /> {t('blocker.auth.rerun')}
        </button>
      </span>
    )
  }
  return (
    <ModelPickButton
      control={control}
      className={`btn ${primary ? 'primary' : ''}`}
      testId="auth-choose-model"
      onPick={(value) => (toolsRan ? setPending(value) : onPick(value))}
    >
      <Cpu size={15} /> {t('blocker.auth.chooseModel')}
    </ModelPickButton>
  )
}

/** Le réglage du modèle, s'il propose un autre modèle que celui en cours (fiche 210). */
function withOtherModel(control: SessionControl | undefined): SessionControl | undefined {
  return control?.options.some((o) => o.value !== control.currentValue) ? control : undefined
}

/**
 * Titre de la carte de connexion : à l'ouverture de la session, refusée à un message, ou refusée
 * pour un modèle nommé (fiche 210 : souvent un fournisseur non connecté, pas toute la connexion).
 */
function AuthHead({
  atTurn,
  model,
  agentLabel
}: {
  atTurn: boolean
  model: { name: string } | undefined
  agentLabel: string
}) {
  const { t } = useTranslation()
  const [title, subtitle] = model
    ? [t('blocker.auth.modelTitle', { model: model.name }), t('blocker.auth.modelSubtitle')]
    : atTurn
      ? [t('blocker.auth.expiredTitle'), t('blocker.auth.expiredSubtitle', { agent: agentLabel })]
      : [t('blocker.auth.title'), t('blocker.auth.subtitle', { agent: agentLabel })]
  return (
    <div className="pc-head">
      <KeyRound size={18} className="pc-icon" />
      <div>
        <div className="pc-title">{title}</div>
        <div className="pc-sub">{subtitle}</div>
      </div>
    </div>
  )
}

/** Licence à accepter (Bob) : l'utilisateur la lit et l'accepte lui-même, dans le terminal. */
function LicensePanel(props: Props & { blocker: Blocker<'license'> }) {
  const { t } = useTranslation()
  const { blocker } = props
  return (
    <div className="blocker-card" data-testid="blocker-license">
      <div className="pc-head">
        <FileText size={18} className="pc-icon" />
        <div>
          <div className="pc-title">{t('blocker.license.title')}</div>
          <div className="pc-sub">{t('blocker.license.subtitle', { agent: props.agentLabel })}</div>
        </div>
      </div>
      <div className="blocker-body">
        <p>{t('blocker.license.hint')}</p>
        <p className="blocker-message" data-testid="license-message">
          {blocker.message}
        </p>
      </div>
      <div className="pc-actions">
        <span className="grow" />
        {blocker.steps.map((step) => (
          <button
            key={step.id}
            className="btn"
            onClick={() => props.onRunStep(step.id)}
            title={t('blocker.runInTerminal', { command: step.command })}
            data-testid={`step-${step.id}`}
          >
            <SquareTerminal size={15} /> {step.label}
          </button>
        ))}
        <button className="btn primary" onClick={props.onRetry} data-testid="retry">
          <RotateCw size={14} /> {t('blocker.retry')}
        </button>
      </div>
    </div>
  )
}

/**
 * Connexion expirée à un message (recette 0.9, D10) : la commande du profil, et « Réessayer » (une
 * fois : désactivé pendant l'appel ; confirmé si des outils ont déjà tourné pour ce message).
 */
function ExpiredAuthBody({
  blocker,
  retryFirst,
  confirming,
  onConfirming: setConfirming,
  onRetry,
  waiting
}: {
  blocker: Blocker<'auth'>
  retryFirst: boolean
  confirming: boolean
  onConfirming: (confirming: boolean) => void
  onRetry: Props['onRetry']
  /** Connexion dans le navigateur en cours : « Réessayer » relance l'agent (fiche 207). */
  waiting: boolean
}) {
  const { t } = useTranslation()
  const [pending, setPending] = useState(false)
  const step = blocker.methods.find((m) => m.step)?.step
  const retry = () => {
    setConfirming(false)
    setPending(true)
    void Promise.resolve(onRetry())
      .catch(() => {})
      .finally(() => setPending(false))
  }
  return (
    <>
      <div className="blocker-body">
        {step && (
          <p>
            <Trans
              t={t}
              i18nKey="blocker.auth.expiredHow"
              values={{ command: step.command }}
              components={{ code: <code /> }}
            />
          </p>
        )}
        <p>{t('blocker.auth.expiredRetry')}</p>
        {blocker.toolsRan && <p data-testid="auth-tools-ran">{t('blocker.auth.toolsRan')}</p>}
      </div>
      <div className="pc-actions">
        {confirming ? (
          <>
            <span className="grow">{t('blocker.auth.confirmToolsRan')}</span>
            <button className="btn" onClick={() => setConfirming(false)} data-testid="retry-cancel">
              {t('common.cancel')}
            </button>
            <button className="btn primary" onClick={retry} autoFocus data-testid="retry-confirm">
              <RotateCw size={14} /> {t('blocker.auth.rerun')}
            </button>
          </>
        ) : (
          <>
            {waiting ? <StuckQuestion /> : <span className="grow" />}
            <button
              className={`btn ${retryFirst || waiting ? 'primary' : ''}`}
              disabled={pending}
              onClick={blocker.toolsRan ? () => setConfirming(true) : retry}
              data-testid="retry"
            >
              {pending ? <LoaderCircle size={14} className="spin" /> : <RotateCw size={14} />}{' '}
              {t('blocker.retry')}
            </button>
          </>
        )}
      </div>
    </>
  )
}

/** « Connecté dans le navigateur, mais rien ne se passe ici ? » (fiche 207). */
function StuckQuestion() {
  const { t } = useTranslation()
  return (
    <span className="grow muted small blocker-stuck" data-testid="auth-stuck">
      {t('blocker.auth.stuck')}
    </span>
  )
}

/**
 * Connexion dans le navigateur qui ne revient pas (fiche 207) : « Réessayer » relance l'agent, qui
 * relit sa connexion au démarrage. Cliqué avant d'avoir fini dans le navigateur, la connexion en
 * cours est coupée et la carte revient.
 */
function StuckSignIn({ onRetry }: { onRetry: Props['onRetry'] }) {
  const { t } = useTranslation()
  const [pending, setPending] = useState(false)
  const retry = () => {
    setPending(true)
    void Promise.resolve(onRetry())
      .catch(() => {})
      .finally(() => setPending(false))
  }
  return (
    <div className="pc-actions">
      <StuckQuestion />
      <button className="btn primary" disabled={pending} onClick={retry} data-testid="retry">
        {pending ? <LoaderCircle size={14} className="spin" /> : <RotateCw size={14} />}{' '}
        {t('blocker.retry')}
      </button>
    </div>
  )
}
