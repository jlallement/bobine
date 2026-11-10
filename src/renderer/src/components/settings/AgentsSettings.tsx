import { ChevronRight, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { AgentSettingsView, ProfileSummary } from '@shared/agent'
import { NetworkSection } from './NetworkSettings'
import { SettingsTitle } from './rows'

/** Initiale d'un agent, dans un carré arrondi (liste et en-tête de sa page). */
export function AgentAvatar({ label }: { label: string }) {
  return (
    <span className="agent-avatar" aria-hidden>
      {label.trim().charAt(0).toUpperCase()}
    </span>
  )
}

/** État d'un agent installé : prêt, avec sa version s'il l'a déjà annoncée. */
export function agentState(profile: ProfileSummary, ready: string): string {
  const version = profile.capabilities.announced?.version
  return version ? `${ready} · ${version}` : ready
}

/**
 * Agents montrés dans la liste, qui ont une page : ceux qui sont installés, et ceux déclarés dans
 * Bobine même introuvables (fiche 141), pour qu'on puisse corriger leur commande.
 */
export const listedAgent = (profile: ProfileSummary) => profile.available || !!profile.custom

/** Point et texte d'état d'un agent de la liste ou de sa page ; `suffix` suit l'état « Prêt ». */
export function AgentStatus({
  profile,
  suffix = ''
}: {
  profile: ProfileSummary
  suffix?: string
}) {
  const { t } = useTranslation()
  return profile.available ? (
    <>
      <span className="status-dot ready" aria-hidden />
      <span>{agentState(profile, t('settings.agents.ready')) + suffix}</span>
    </>
  ) : (
    <>
      <span className="status-dot error" aria-hidden />
      <span>{t('customAgents.commandMissing')}</span>
    </>
  )
}

/**
 * Réglages › Agents (fiche 136) : une ligne par agent installé, qui mène à sa page, et « Ajouter un
 * agent ACP… » en dernière ligne (fiche 141) ; ceux qui ne sont pas installés, avec un lien vers le
 * Diagnostic ; le réseau d'entreprise dans « Avancé ».
 */
export function AgentsSettings({
  settings,
  onOpenAgent,
  onAddAgent,
  onDiagnostics
}: {
  settings: AgentSettingsView
  onOpenAgent: (profileId: string) => void
  /** Ouvre le formulaire d'un nouvel agent ACP (fiche 141). */
  onAddAgent: () => void
  /** Ouvre Réglages › Diagnostic, où se relit le PATH du shell (fiche 133). */
  onDiagnostics: () => void
}) {
  const { t } = useTranslation()
  // Seulement les agents installés (fiche 058) ; les autres sont nommés, avec quoi installer.
  const installed = settings.profiles.filter(listedAgent)
  const missing = settings.profiles.filter((p) => !listedAgent(p))
  return (
    <section>
      <SettingsTitle help="settingsAgents">{t('settings.agents.agents.label')}</SettingsTitle>
      <ul className="settings-list agent-list" data-testid="settings-agent-list">
        {installed.length === 0 && (
          <li className="settings-list-empty">{t('settings.agents.none')}</li>
        )}
        {installed.map((p) => (
          <li key={p.id} className="agent-list-row">
            <button
              className="agent-list-open"
              onClick={() => onOpenAgent(p.id)}
              aria-label={t('settings.agents.page.open', { agent: p.label })}
              data-testid="settings-agent"
              data-agent={p.id}
            >
              <AgentAvatar label={p.label} />
              <span className="agent-list-text">
                <span className="agent-list-name">{p.label}</span>
                <small>
                  <AgentStatus profile={p} suffix={p.destination ? ` · ${p.destination}` : ''} />
                </small>
              </span>
              <ChevronRight size={15} className="agent-list-chevron" aria-hidden />
            </button>
          </li>
        ))}
        <li className="agent-list-row">
          <button
            className="agent-list-open agent-list-add"
            onClick={onAddAgent}
            data-testid="settings-add-agent"
          >
            <Plus size={15} aria-hidden />
            <span className="agent-list-text">
              <span className="agent-list-name">{t('customAgents.add')}</span>
            </span>
          </button>
        </li>
      </ul>
      {missing.length > 0 && (
        <p className="settings-row-hint settings-after-card" data-testid="settings-agents-missing">
          {t('settings.agents.missing', {
            list: missing
              .map((p) => `${p.label} (${p.reason ?? t('settings.agents.notFound')})`)
              .join(' ; ')
          })}{' '}
          <button
            className="link-button"
            onClick={onDiagnostics}
            data-testid="settings-agents-diagnostics"
          >
            {t('settings.agents.missingDiagnostics')}
          </button>
        </p>
      )}
      <NetworkSection />
    </section>
  )
}
