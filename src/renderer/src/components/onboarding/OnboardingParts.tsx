import {
  Check,
  CircleCheck,
  CircleX,
  Hourglass,
  Info,
  LoaderCircle,
  RotateCw,
  WifiOff
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { AgentReadiness } from '@shared/onboarding'
import { ONBOARDING_STEPS, type OnboardingStep } from './useOnboarding'

/** Bandeau des étapes : les étapes faites sont des boutons qui y ramènent. */
export function Stepper(props: { step: OnboardingStep; onBack: (step: OnboardingStep) => void }) {
  const { t } = useTranslation()
  const current = ONBOARDING_STEPS.indexOf(props.step)
  return (
    <ol className="onboarding-stepper" aria-label={t('onboarding.steps.label')}>
      {ONBOARDING_STEPS.map((step, i) => {
        const label = t(`onboarding.steps.${step}`)
        const done = i < current
        const content = (
          <>
            <span className="dot" aria-hidden="true">
              {done ? <Check size={12} /> : i + 1}
            </span>
            <span className="label">{label}</span>
          </>
        )
        return (
          <li
            key={step}
            className={done ? 'done' : i === current ? 'on' : ''}
            {...(i === current ? { 'aria-current': 'step' as const } : {})}
          >
            {i > 0 && <span className="sep" aria-hidden="true" />}
            {done ? (
              <button
                className="step-back"
                onClick={() => props.onBack(step)}
                aria-label={t('onboarding.steps.back', { step: label })}
                data-testid={`onboarding-back-${step}`}
              >
                {content}
              </button>
            ) : (
              content
            )}
          </li>
        )
      })}
    </ol>
  )
}

/** Attente bornée : durée écoulée et « Annuler » (Échap fait de même). */
export function Waiting(props: {
  text: string
  started: number
  max?: number
  onCancel: () => void
  /** « Passer cette étape » : annule, puis passe. */
  onSkip?: () => void
  /**
   * Connexion dans le navigateur qui ne revient pas (fiche 207) : « Réessayer » relance la
   * vérification sans la connexion (l'agent en cours est arrêté).
   */
  onStuck?: () => void
}) {
  const { t } = useTranslation()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  const seconds = Math.max(0, Math.round((now - props.started) / 1000))
  return (
    <div className="onboarding-card">
      <div className="onboarding-line" data-testid="onboarding-waiting">
        <LoaderCircle size={15} className="spin onboarding-accent" />
        <span className="grow">{props.text}</span>
        <span className="muted small">
          {props.max
            ? t('onboarding.trial.waitingFor', { seconds, max: props.max })
            : `${seconds} s`}
        </span>
        <button className="btn" onClick={props.onCancel} autoFocus data-testid="onboarding-cancel">
          {t('onboarding.cancel')}
        </button>
      </div>
      {props.onStuck && (
        <div className="onboarding-actions inside onboarding-stuck">
          <span className="grow muted small" data-testid="onboarding-stuck">
            {t('blocker.auth.stuck')}
          </span>
          <button
            className="btn primary"
            onClick={props.onStuck}
            data-testid="onboarding-stuck-retry"
          >
            <RotateCw size={14} /> {t('onboarding.retry')}
          </button>
        </div>
      )}
      {props.onSkip && (
        <div className="onboarding-actions inside">
          <span className="grow" />
          <button className="btn ghost" onClick={props.onSkip} data-testid="onboarding-skip-step">
            {t('onboarding.skipStep')}
          </button>
        </div>
      )}
    </div>
  )
}

/** Alerte de succès, d'erreur ou neutre. */
export function Alert(props: {
  tone: 'ok' | 'warn' | 'err' | 'neutral'
  icon?: ReactNode
  title: string
  children?: ReactNode
  testId?: string
}) {
  const icon =
    props.icon ??
    (props.tone === 'ok' ? (
      <CircleCheck size={16} />
    ) : props.tone === 'neutral' ? (
      <Info size={16} />
    ) : (
      <CircleX size={16} />
    ))
  return (
    <div className={`onboarding-alert ${props.tone}`} data-testid={props.testId}>
      <span className="onboarding-alert-icon">{icon}</span>
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="onboarding-alert-title">{props.title}</div>
        {props.children}
      </div>
    </div>
  )
}

/** Erreur d'un essai : ce qui s'est passé en clair, le détail technique replié. */
export function ReadinessError(props: { result: AgentReadiness; agent: string }) {
  const { t } = useTranslation()
  const { result, agent } = props
  const details = (text: string | undefined, log = false) =>
    text || log ? (
      <details className="onboarding-details">
        <summary>{t('onboarding.error.details')}</summary>
        {text && <pre>{text}</pre>}
        {log && (
          <button
            className="link-button"
            onClick={() => void window.api.log.open('agents').catch(() => {})}
          >
            {t('onboarding.error.openLog')}
          </button>
        )}
      </details>
    ) : null
  switch (result.state) {
    case 'network':
      return (
        <Alert
          tone="err"
          icon={<WifiOff size={16} />}
          title={t(
            result.cause === 'rate-limit'
              ? 'onboarding.error.rateLimit'
              : 'onboarding.error.network'
          )}
          testId="onboarding-error-network"
        >
          <p className="onboarding-text">
            {t(
              result.cause === 'rate-limit'
                ? 'onboarding.error.rateLimitText'
                : 'onboarding.error.networkText',
              { agent }
            )}
          </p>
          {details(result.message)}
        </Alert>
      )
    case 'timeout':
      return (
        <Alert
          tone="warn"
          icon={<Hourglass size={16} />}
          title={t('onboarding.error.timeout')}
          testId="onboarding-error-timeout"
        >
          <p className="onboarding-text">{t('onboarding.error.timeoutText', { agent })}</p>
          {details(result.message)}
        </Alert>
      )
    case 'crashed':
      return (
        <Alert
          tone="err"
          title={t('onboarding.error.crashed', { agent })}
          testId="onboarding-error-crashed"
        >
          <p className="onboarding-text">{t('onboarding.error.crashedText')}</p>
          {details([result.message, result.stderr].filter(Boolean).join('\n\n'), true)}
        </Alert>
      )
    case 'missing':
      return (
        <Alert
          tone="err"
          title={t('onboarding.error.missing', { agent })}
          testId="onboarding-error-missing"
        >
          <p className="onboarding-text">{result.reason}</p>
        </Alert>
      )
    case 'failed':
      return (
        <Alert
          tone="err"
          title={t('onboarding.error.failed', { agent })}
          testId="onboarding-error-failed"
        >
          <p className="onboarding-text">{result.message}</p>
        </Alert>
      )
    default:
      return null
  }
}

/** Ligne d'action de la carte : icône alignée sur le titre, aide, bouton à droite. */
export function ActionLine(props: {
  icon: ReactNode
  title: string
  help?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="onboarding-line top">
      <span className="onboarding-line-icon">{props.icon}</span>
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="onboarding-line-title">{props.title}</div>
        {props.help && <div className="muted small">{props.help}</div>}
      </div>
      {props.children}
    </div>
  )
}
