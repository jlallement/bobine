import {
  COST_CAP_AMOUNT_LIMITS,
  COST_CAP_TOKEN_LIMITS,
  MAX_CHILDREN_LIMITS,
  MAX_LIVE_LIMITS,
  STALLED_COMMAND_LIMITS,
  type Preferences
} from '@shared/preferences'
import { useState } from 'react'
import type { AgentSettingsView, NewConversationDefaults } from '@shared/agent'
import { CHILD_PROPOSALS } from '@shared/children'
import { useTranslation } from 'react-i18next'
import { Advanced, Row, SettingsCard, SettingsTitle, SizeStepper } from './rows'

/** Valeur spéciale de la liste des dossiers : ouvre le choix d'un dossier. */
const CHOOSE_FOLDER = '\u0000choisir'

/** Mode de départ d'une nouvelle conversation ; '' : comme la dernière fois (clé `last`). */
const NEW_MODES = [
  { id: '', key: 'last' },
  { id: 'execute', key: 'execute' },
  { id: 'plan', key: 'plan' }
] as const

/**
 * Réglages › Conversations (fiche 136) : comment part une nouvelle conversation, les sous-tâches
 * (conversations filles), pendant la réponse (fiche 157), et dans « Avancé » le nombre de
 * conversations gardées actives.
 */
export function ConversationSettings({
  settings,
  onPreferences,
  onNewConversation
}: {
  settings: AgentSettingsView
  onPreferences: (change: Partial<Preferences>) => void
  onNewConversation: (defaults: NewConversationDefaults) => void
}) {
  const { t } = useTranslation()
  const { preferences } = settings
  return (
    <section>
      <NewConversationCard settings={settings} onNewConversation={onNewConversation} />
      <SettingsTitle>{t('settings.conversation.children')}</SettingsTitle>
      <SettingsCard>
        <Row
          label={t('settings.conversation.childProposals.label')}
          hint={t('settings.conversation.childProposals.hint')}
        >
          <div
            className="segmented"
            role="radiogroup"
            aria-label={t('settings.conversation.childProposals.label')}
          >
            {CHILD_PROPOSALS.map((choice) => (
              <button
                key={choice}
                role="radio"
                aria-checked={preferences.childProposals === choice}
                className={preferences.childProposals === choice ? 'active' : ''}
                onClick={() => onPreferences({ childProposals: choice })}
                data-testid={`child-proposals-${choice}`}
              >
                {t(`settings.conversation.childProposals.${choice}`)}
              </button>
            ))}
          </div>
        </Row>
        <Row
          label={t('settings.conversation.maxChildren.label')}
          hint={t('settings.conversation.maxChildren.hint')}
        >
          <SizeStepper
            value={preferences.maxChildren}
            limits={MAX_CHILDREN_LIMITS}
            step={1}
            labels={{
              less: t('settings.conversation.maxChildren.less'),
              more: t('settings.conversation.maxChildren.more')
            }}
            onChange={(count) => onPreferences({ maxChildren: count })}
            testId="settings-max-children"
          />
        </Row>
      </SettingsCard>
      <TurnGuardsCard preferences={preferences} onPreferences={onPreferences} />
      <Advanced testId="settings-conversation-advanced">
        <SettingsCard>
          <Row
            label={t('settings.conversation.maxLive.label')}
            hint={t('settings.conversation.maxLive.hint')}
          >
            <SizeStepper
              value={preferences.maxLive}
              limits={MAX_LIVE_LIMITS}
              step={1}
              labels={{
                less: t('settings.conversation.maxLive.less'),
                more: t('settings.conversation.maxLive.more')
              }}
              onChange={(count) => onPreferences({ maxLive: count })}
              testId="settings-max-live"
            />
          </Row>
        </SettingsCard>
      </Advanced>
    </section>
  )
}

/** Nouvelle conversation : agent, dossier et mode de départ ; vide, comme maintenant. */
function NewConversationCard({
  settings,
  onNewConversation
}: {
  settings: AgentSettingsView
  onNewConversation: (defaults: NewConversationDefaults) => void
}) {
  const { t } = useTranslation()
  const defaults = settings.newConversation
  const update = (change: Partial<Record<keyof NewConversationDefaults, string | undefined>>) => {
    const next = { ...defaults, ...change } as Record<string, string | undefined>
    onNewConversation(
      Object.fromEntries(Object.entries(next).filter(([, v]) => v)) as NewConversationDefaults
    )
  }
  const folders = [
    ...new Set([...(defaults.workspace ? [defaults.workspace] : []), ...settings.recentWorkspaces])
  ]
  return (
    <>
      <SettingsTitle>{t('settings.conversation.newConversation.label')}</SettingsTitle>
      <SettingsCard>
        <Row label={t('settings.conversation.agent.label')}>
          <select
            className="settings-input settings-input-wide"
            value={defaults.profileId ?? ''}
            onChange={(e) => update({ profileId: e.target.value || undefined })}
            data-testid="new-conversation-agent"
          >
            <option value="">{t('settings.conversation.sameAsCurrent')}</option>
            {settings.profiles
              .filter((p) => p.available || p.id === defaults.profileId)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
          </select>
        </Row>
        <Row label={t('settings.conversation.folder.label')}>
          <select
            className="settings-input settings-input-wide"
            value={defaults.workspace ?? ''}
            onChange={(e) => {
              if (e.target.value === CHOOSE_FOLDER) {
                void window.api.workspace.choose().then((folder) => {
                  if (folder) update({ workspace: folder })
                })
                return
              }
              update({ workspace: e.target.value || undefined })
            }}
            data-testid="new-conversation-folder"
          >
            <option value="">{t('settings.conversation.sameAsCurrent')}</option>
            {folders.map((w) => (
              <option key={w} value={w}>
                {w.replace(/^\/Users\/[^/]+/, '~')}
              </option>
            ))}
            <option value={CHOOSE_FOLDER}>{t('settings.conversation.chooseFolder')}</option>
          </select>
        </Row>
        <Row
          label={t('settings.conversation.mode.label')}
          hint={t('settings.conversation.mode.hint')}
        >
          <div
            className="segmented"
            role="radiogroup"
            aria-label={t('settings.conversation.mode.aria')}
          >
            {NEW_MODES.map((m) => (
              <button
                key={m.id}
                role="radio"
                aria-checked={(defaults.mode ?? '') === m.id}
                className={(defaults.mode ?? '') === m.id ? 'active' : ''}
                onClick={() => update({ mode: m.id || undefined })}
                data-testid={`new-conversation-mode-${m.id || 'last'}`}
              >
                {t(`settings.conversation.mode.${m.key}`)}
              </button>
            ))}
          </div>
        </Row>
      </SettingsCard>
    </>
  )
}

/**
 * Pendant la réponse (fiche 157) : seuil d'une commande sans sortie, plafond de coût par
 * conversation (montant dans l'unité de l'agent, jetons sans coût connu).
 */
function TurnGuardsCard({
  preferences,
  onPreferences
}: {
  preferences: Preferences
  onPreferences: (change: Partial<Preferences>) => void
}) {
  const { t } = useTranslation()
  return (
    <>
      <SettingsTitle>{t('turnGuards.settings.title')}</SettingsTitle>
      <SettingsCard>
        <Row
          label={t('turnGuards.settings.stalled.label')}
          hint={t('turnGuards.settings.stalled.hint')}
        >
          <SizeStepper
            value={preferences.stalledCommandMinutes}
            limits={STALLED_COMMAND_LIMITS}
            step={1}
            labels={{
              less: t('turnGuards.settings.stalled.less'),
              more: t('turnGuards.settings.stalled.more')
            }}
            onChange={(minutes) => onPreferences({ stalledCommandMinutes: minutes })}
            testId="settings-stalled-minutes"
          />
        </Row>
        <Row label={t('turnGuards.settings.cap.label')} hint={t('turnGuards.settings.cap.hint')}>
          <label className="switch">
            <input
              type="checkbox"
              checked={preferences.costCapEnabled}
              onChange={(e) => onPreferences({ costCapEnabled: e.target.checked })}
              data-testid="settings-cost-cap"
            />
            <span />
          </label>
        </Row>
        <Row
          sub
          label={t('turnGuards.settings.capAmount.label')}
          hint={t('turnGuards.settings.capAmount.hint')}
        >
          <NumberField
            value={preferences.costCapAmount}
            limits={COST_CAP_AMOUNT_LIMITS}
            step={0.5}
            disabled={!preferences.costCapEnabled}
            label={t('turnGuards.settings.capAmount.label')}
            onChange={(amount) => onPreferences({ costCapAmount: amount })}
            testId="settings-cost-cap-amount"
          />
        </Row>
        <Row
          sub
          label={t('turnGuards.settings.capTokens.label')}
          hint={t('turnGuards.settings.capTokens.hint')}
        >
          <NumberField
            value={preferences.costCapTokens}
            limits={COST_CAP_TOKEN_LIMITS}
            step={100_000}
            disabled={!preferences.costCapEnabled}
            label={t('turnGuards.settings.capTokens.label')}
            onChange={(tokens) => onPreferences({ costCapTokens: Math.round(tokens) })}
            testId="settings-cost-cap-tokens"
          />
        </Row>
      </SettingsCard>
    </>
  )
}

/** Nombre saisi, enregistré en quittant le champ (ou Entrée) s'il est dans ses bornes. */
function NumberField({
  value,
  limits,
  step,
  disabled,
  label,
  onChange,
  testId
}: {
  value: number
  limits: { min: number; max: number }
  step: number
  disabled: boolean
  label: string
  onChange: (value: number) => void
  testId: string
}) {
  const [draft, setDraft] = useState<string | undefined>(undefined)
  const commit = () => {
    const next = Number(draft?.replace(',', '.'))
    if (draft !== undefined && Number.isFinite(next) && next >= limits.min && next <= limits.max) {
      onChange(next)
    }
    setDraft(undefined)
  }
  return (
    <input
      type="number"
      className="settings-input settings-number"
      min={limits.min}
      max={limits.max}
      step={step}
      disabled={disabled}
      aria-label={label}
      value={draft ?? String(value)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit()
      }}
      data-testid={testId}
    />
  )
}
