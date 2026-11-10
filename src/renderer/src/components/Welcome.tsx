import { BookOpen, Bug, ClipboardList, FlaskConical, ShieldCheck } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import i18next from 'i18next'
import type { AgentConfigureRequest } from '@shared/agent'
import { CodeText } from './common/CodeText'
import { SpoolMark } from './common/SpoolMark'
import { openHelp } from './help/HelpLink'
import { Onboarding } from './onboarding/Onboarding'
import type { OnboardingController } from './onboarding/useOnboarding'

/** Salutation selon l'heure, avec le prénom choisi dans les réglages. */
export function greeting(name: string, hour = new Date().getHours()): string {
  const hello = i18next.t(
    hour >= 5 && hour < 12
      ? 'home.hello.morning'
      : hour >= 12 && hour < 18
        ? 'home.hello.afternoon'
        : 'home.hello.evening'
  )
  return name
    ? i18next.t('home.greetingWithName', { hello, name })
    : i18next.t('home.greeting', { hello })
}

/** Suggestions de départ de l'écran d'accueil : le texte va dans la zone de saisie, sans envoyer. */
/** Clés `home.suggestions.<id>.label` (bouton) et `.text` (ce qui va dans la zone de saisie). */
const SUGGESTIONS = [
  { id: 'explain', icon: <BookOpen size={15} /> },
  { id: 'bugs', icon: <Bug size={15} /> },
  { id: 'tests', icon: <FlaskConical size={15} /> },
  { id: 'plan', icon: <ClipboardList size={15} /> }
] as const

interface Props {
  userName: string
  /** Carte de l'aparté et zone de saisie, rendues par l'app. */
  asideCard: ReactNode
  composer: ReactNode
  welcomeHint?: string | undefined
  /** Remplit la zone de saisie, sans envoyer. */
  fill: (text: string) => void
  /** Accueil du premier lancement (fiche 188) : à la place de cette page tant qu'il est là. */
  onboarding: OnboardingController
  configure: (request: AgentConfigureRequest) => Promise<unknown> | undefined
  workspace: string
  onShowTerminal: () => void
}

/**
 * Page d'accueil d'une conversation vide ; l'accueil du premier lancement à sa place tant qu'il
 * n'est ni fini ni passé. Juste après lui, la première conversation propose aussi de lancer les
 * tests du dossier (gestionnaire d'après son fichier de verrouillage).
 */
export function Welcome(props: Props) {
  const { t } = useTranslation()
  const { onboarding } = props
  const { clearHints } = onboarding
  // Les suggestions tirées du dossier ne servent qu'à la première conversation.
  useEffect(() => () => clearHints(), [clearHints])
  if (onboarding.visible) {
    return (
      <Onboarding
        onboarding={onboarding}
        configure={props.configure}
        workspace={props.workspace}
        onShowTerminal={props.onShowTerminal}
      />
    )
  }
  const testCommand = onboarding.hints?.testCommand
  return (
    // Toute la largeur disponible, pas celle de son contenu : en fenêtre étroite, la barre de
    // saisie et les suggestions débordaient (fiche 092).
    <div className="welcome column" style={{ width: '100%' }} data-testid="welcome">
      <h1 className="greeting">
        <SpoolMark size={38} motion="intro" />
        {greeting(props.userName)}
      </h1>
      {props.asideCard}
      {props.composer}
      <div className="suggestions" data-testid="suggestions">
        {testCommand && (
          <button
            className="suggestion"
            onClick={() => props.fill(t('onboarding.home.runTestsText', { command: testCommand }))}
            data-testid="suggestion-run-tests"
          >
            <FlaskConical size={15} />
            {t('onboarding.home.runTests', { command: testCommand })}
          </button>
        )}
        {SUGGESTIONS.filter((s) => !(testCommand && s.id === 'tests')).map((s) => (
          <button
            key={s.id}
            className="suggestion"
            onClick={() => props.fill(t(`home.suggestions.${s.id}.text`))}
            data-testid="suggestion"
          >
            {s.icon}
            {t(`home.suggestions.${s.id}.label`)}
          </button>
        ))}
      </div>
      {onboarding.hints && (
        // Juste après l'accueil : deux pages du guide, puis l'aide entière (fiche 188).
        <p className="welcome-help" data-testid="welcome-help">
          <button className="link-button" onClick={() => openHelp('gettingStarted')}>
            <BookOpen size={13} /> {t('onboarding.home.gettingStarted')}
          </button>
          <button className="link-button" onClick={() => openHelp('permissions')}>
            <ShieldCheck size={13} /> {t('onboarding.home.permissions')}
          </button>
          <span>{t('onboarding.home.help')}</span>
        </p>
      )}
      {props.welcomeHint && (
        <p className="welcome-hint">
          <CodeText text={props.welcomeHint} />
        </p>
      )}
    </div>
  )
}
