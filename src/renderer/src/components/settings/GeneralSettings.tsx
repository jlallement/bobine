import { useEffect, useState } from 'react'
import type { AgentSettingsView } from '@shared/agent'
import type { LanguagePreference, Preferences } from '@shared/preferences'
import { QUICK_SHORTCUTS, type QuickShortcut } from '@shared/quick-entry'
import { LANGUAGE_NAMES, LANGUAGES, type Language } from '@shared/i18n/language'
import { useTranslation } from 'react-i18next'
import { TipsRow } from './TipsRow'
import { CommandLineRow } from './CommandLineRow'
import { Row, SettingsCard, SettingsTitle } from './rows'
import { EditorRow } from './EditorRow'

/**
 * Langue de l'interface (fiche 074) : change tout de suite. Les menus et fenêtres de macOS suivent
 * au prochain lancement, d'où « Relancer » quand ils ne sont pas encore dans la langue affichée.
 */
function LanguageRow({
  preference,
  onChange
}: {
  preference: LanguagePreference
  onChange: (language: LanguagePreference) => void
}) {
  const { t, i18n } = useTranslation()
  const [nativeLanguage, setNativeLanguage] = useState<Language | undefined>()
  useEffect(() => {
    void window.api.app.getInfo().then((info) => setNativeLanguage(info.nativeLanguage))
  }, [])
  return (
    <>
      <Row label={t('settings.general.language.label')} hint={t('settings.general.language.hint')}>
        <select
          className="settings-input"
          value={preference}
          onChange={(e) => onChange(e.target.value as LanguagePreference)}
          data-testid="settings-language"
        >
          <option value="system">{t('settings.general.language.system')}</option>
          {LANGUAGES.map((language) => (
            <option key={language} value={language} lang={language}>
              {LANGUAGE_NAMES[language]}
            </option>
          ))}
        </select>
      </Row>
      {nativeLanguage && nativeLanguage !== i18n.language && (
        <div className="settings-note" data-testid="settings-language-native">
          {t('settings.general.language.native')}{' '}
          <button
            className="link-button"
            onClick={() => void window.api.app.relaunch()}
            data-testid="settings-language-relaunch"
          >
            {t('settings.general.language.relaunch')}
          </button>
        </div>
      )}
    </>
  )
}

/** Réglages › Général (fiche 136) : vous (prénom, langue), puis le Mac (veille, fenêtre rapide). */
export function GeneralSettings({
  settings,
  onPreferences
}: {
  settings: AgentSettingsView
  onPreferences: (change: Partial<Preferences>) => void
}) {
  const { t } = useTranslation()
  const { preferences } = settings
  return (
    <section>
      <SettingsTitle>{t('settings.general.you')}</SettingsTitle>
      <SettingsCard>
        <Row
          label={t('settings.general.firstName.label')}
          hint={t('settings.general.firstName.hint')}
        >
          <input
            key={preferences.userName}
            className="settings-input"
            defaultValue={preferences.userName}
            placeholder={t('settings.general.firstName.placeholder')}
            maxLength={40}
            onBlur={(e) => {
              if (e.target.value.trim() !== preferences.userName) {
                onPreferences({ userName: e.target.value })
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
            }}
            data-testid="settings-user-name"
          />
        </Row>
        <LanguageRow
          preference={preferences.language}
          onChange={(language) => onPreferences({ language })}
        />
        <TipsRow
          enabled={preferences.tipsEnabled}
          onChange={(tipsEnabled) => onPreferences({ tipsEnabled })}
        />
      </SettingsCard>
      <SettingsTitle>{t('settings.general.mac')}</SettingsTitle>
      <SettingsCard>
        <Row
          label={t('settings.general.keepAwake.label')}
          hint={t('settings.general.keepAwake.hint')}
        >
          <label className="switch">
            <input
              type="checkbox"
              checked={preferences.keepAwake}
              onChange={(e) => onPreferences({ keepAwake: e.target.checked })}
              data-testid="settings-keep-awake"
            />
            <span />
          </label>
        </Row>
        <Row
          label={t('settings.general.quickEntry.label')}
          hint={t('settings.general.quickEntry.hint')}
        >
          <select
            className="settings-input"
            value={preferences.quickEntryShortcut}
            onChange={(e) => onPreferences({ quickEntryShortcut: e.target.value as QuickShortcut })}
            data-testid="settings-quick-shortcut"
          >
            {Object.entries(QUICK_SHORTCUTS).map(([id, shortcut]) => (
              <option key={id} value={id}>
                {shortcut.label}
              </option>
            ))}
          </select>
        </Row>
        {settings.quickEntry?.refused && (
          <div className="settings-note warn" data-testid="settings-quick-refused">
            {t('settings.general.quickEntry.refused', {
              shortcut: QUICK_SHORTCUTS[settings.quickEntry.shortcut].label
            })}
          </div>
        )}
        <EditorRow
          preference={preferences.editor}
          onChange={(editor) => onPreferences({ editor })}
        />
        <CommandLineRow />
      </SettingsCard>
    </section>
  )
}
