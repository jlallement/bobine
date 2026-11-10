import { Check, ChevronRight, Dot, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AgentSettingsView, ProfileSummary } from '@shared/agent'
import { currentLocale } from '@shared/i18n/format'
import { CodeText } from '../common/CodeText'
import { AgentAvatar, AgentStatus } from './AgentsSettings'
import { ApiKeyRow } from './ApiKeys'
import { ConfirmRow } from './ConfirmRow'
import { ProvidersSection } from './ProvidersSettings'
import { SettingsCard, SettingsTitle } from './rows'

/**
 * Page d'un agent (fiche 136), depuis Réglages › Agents : en-tête (état, version, commande,
 * « Relancer »), connexion par clé d'API, fournisseurs de modèles, ce qu'il annonce et ce qui lui
 * est propre. Chaque section vient de son profil : rien ici ne dépend d'un agent en particulier
 * (ADR-0011) ; une section sans contenu n'est pas affichée. Agent déclaré dans Bobine (fiche 141) :
 * « Modifier… » dans l'en-tête, « Supprimer cet agent » en bas.
 */
export function AgentPage({
  profile,
  settings,
  onSetApiKey,
  onRemoveApiKey,
  onRestart,
  onEdit,
  onRemove,
  onOpenApprovals
}: {
  profile: ProfileSummary
  settings: AgentSettingsView
  /** Ouvre la sous-page des approbations pour tous les projets (fiche 215). */
  onOpenApprovals?: () => void
  onSetApiKey: (profileId: string, env: string, value: string) => Promise<void>
  onRemoveApiKey: (profileId: string, env: string) => void
  /** Relance l'agent de la conversation active ; absent si elle utilise un autre agent. */
  onRestart?: () => void
  /** Agent déclaré : ouvre le formulaire de sa déclaration. */
  onEdit?: () => void
  /** Agent déclaré : le retire. */
  onRemove?: () => void
}) {
  const { t } = useTranslation()
  const keys = settings.apiKeys.find((k) => k.profileId === profile.id)?.keys ?? []
  return (
    <section data-testid="settings-agent-page" data-agent={profile.id}>
      <SettingsCard>
        <div className="agent-head">
          <AgentAvatar label={profile.label} />
          <div className="agent-head-text">
            <div className="agent-head-name">{profile.label}</div>
            <div className="agent-head-sub">
              <AgentStatus profile={profile} />
              <span aria-hidden>·</span>
              <code className="agent-head-command" title={profile.command}>
                {profile.command}
              </code>
            </div>
          </div>
          <div className="agent-head-actions">
            {onEdit && (
              <button className="btn small" onClick={onEdit} data-testid="agent-page-edit">
                {t('customAgents.edit')}
              </button>
            )}
            {onRestart && (
              <button
                className="btn small"
                onClick={onRestart}
                title={t('settings.agents.page.restartTip')}
                data-testid="agent-page-restart"
              >
                {t('settings.agents.page.restart')}
              </button>
            )}
          </div>
        </div>
      </SettingsCard>
      {keys.length > 0 && (
        <>
          <SettingsTitle>{t('settings.agents.page.connection')}</SettingsTitle>
          <ul className="settings-list" data-testid="settings-api-keys">
            {keys.map((key) => (
              <ApiKeyRow
                key={key.env}
                info={key}
                onSave={(value) => onSetApiKey(profile.id, key.env, value)}
                onRemove={() => onRemoveApiKey(profile.id, key.env)}
              />
            ))}
          </ul>
          <p className="settings-row-hint settings-after-card">
            {t('settings.agents.page.keysHint')}
          </p>
        </>
      )}
      {profile.providers && <ProvidersSection installed={[profile.id]} />}
      <Announced profile={profile} />
      <SettingsTitle>
        {t('settings.agents.capabilities.specific', { agent: profile.label })}
      </SettingsTitle>
      {profile.approvalRules && onOpenApprovals && (
        <ul className="settings-list agent-list" data-testid="agent-approvals-entry">
          <li className="agent-list-row">
            <button
              className="agent-list-open"
              onClick={onOpenApprovals}
              data-testid="agent-open-approvals"
            >
              <span className="agent-list-text">
                <span className="agent-list-name">{t('approvalRules.page.entry')}</span>
                <small>{t('approvalRules.page.entryHint')}</small>
              </span>
              <ChevronRight size={15} className="agent-list-chevron" aria-hidden />
            </button>
          </li>
        </ul>
      )}
      <ul className="settings-list agent-specific" data-testid="agent-specific">
        {profile.capabilities.specific.length === 0 && (
          <li className="settings-list-empty">{t('settings.agents.capabilities.noSpecific')}</li>
        )}
        {profile.capabilities.specific.map((item, i) => (
          <li key={`${item.id}-${i}`} data-setting={`${profile.id}:${item.id}:${i}`}>
            <Dot size={14} aria-hidden className="agent-specific-dot" />
            <span className="agent-item-text">
              {item.label}
              {item.detail && (
                <small>
                  <CodeText text={item.detail} />
                </small>
              )}
            </span>
          </li>
        ))}
      </ul>
      {onRemove && <Declared agent={profile.label} onRemove={onRemove} />}
    </section>
  )
}

/** « Déclaré dans Bobine » (fiche 141) : retirer l'agent, avec confirmation dans la ligne. */
function Declared({ agent, onRemove }: { agent: string; onRemove: () => void }) {
  const { t } = useTranslation()
  const [asking, setAsking] = useState(false)
  return (
    <>
      <SettingsTitle>{t('customAgents.declared')}</SettingsTitle>
      <SettingsCard testId="custom-agent-declared">
        <div className="settings-row">
          <div className="settings-row-text">
            <div className="settings-row-label">{t('customAgents.remove')}</div>
            <div className="settings-row-hint">{t('customAgents.removeHint')}</div>
          </div>
          <div className="settings-row-control">
            <button
              className="btn small"
              onClick={() => setAsking((v) => !v)}
              data-testid="custom-agent-remove"
            >
              {t('customAgents.removeButton')}
            </button>
          </div>
        </div>
        {asking && (
          <ConfirmRow
            message={t('customAgents.removeConfirm', { agent })}
            action={t('customAgents.removeAction')}
            onConfirm={onRemove}
            onCancel={() => setAsking(false)}
          />
        )}
      </SettingsCard>
    </>
  )
}

/** « Ce qu'il annonce » : ce que l'agent a dit savoir faire à son dernier démarrage (fiche 054). */
function Announced({ profile }: { profile: ProfileSummary }) {
  const { t } = useTranslation()
  const { announced } = profile.capabilities
  return (
    <>
      <SettingsTitle>{t('settings.agents.capabilities.title')}</SettingsTitle>
      <SettingsCard testId="agent-capabilities">
        {announced ? (
          <ul
            className="agent-announced"
            title={t('settings.agents.capabilities.seenAt', {
              date: new Date(announced.seenAt).toLocaleString(currentLocale())
            })}
          >
            {announced.items.map((item) => (
              <li key={item.id} className={item.supported ? 'yes' : 'no'}>
                {item.supported ? (
                  <Check size={14} aria-label={t('settings.agents.capabilities.yes')} />
                ) : (
                  <X size={14} aria-label={t('settings.agents.capabilities.no')} />
                )}
                <span className="agent-item-text">
                  {item.label}
                  {item.detail && (
                    <small>
                      <CodeText text={item.detail} />
                    </small>
                  )}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="settings-card-hint">{t('settings.agents.capabilities.notStarted')}</p>
        )}
      </SettingsCard>
    </>
  )
}
