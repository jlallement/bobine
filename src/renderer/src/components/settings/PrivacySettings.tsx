import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AgentSettingsView } from '@shared/agent'
import type { ForgottenApproval } from '@shared/approvals'
import type { Preferences } from '@shared/preferences'
import { ipcErrorText } from '../../ipc-errors'
import { RememberedApprovals } from './RememberedApprovals'
import { Row, SettingsCard, SettingsTitle } from './rows'

/**
 * Réglages › Confidentialité (fiche 136) : ce que les agents font sans demander, et ce que le
 * navigateur intégré garde (connexions, données des sites).
 */
export function PrivacySettings({
  settings,
  onPreferences,
  onForgetTool,
  onForgetApproval
}: {
  settings: AgentSettingsView
  onPreferences: (change: Partial<Preferences>) => void
  onForgetTool: (profileId: string, tool: string) => void
  onForgetApproval: (approval: ForgottenApproval) => void
}) {
  const { t } = useTranslation()
  return (
    <section>
      <RememberedApprovals
        settings={settings}
        onForgetTool={onForgetTool}
        onForgetApproval={onForgetApproval}
      />
      <SettingsTitle help="settingsBrowser">{t('settings.privacy.browser')}</SettingsTitle>
      <SettingsCard>
        <Row
          label={t('settings.privacy.keepCookies.label')}
          hint={t('settings.privacy.keepCookies.hint')}
        >
          <label className="switch">
            <input
              type="checkbox"
              checked={settings.preferences.browserKeepCookies}
              onChange={(e) => onPreferences({ browserKeepCookies: e.target.checked })}
              data-testid="settings-browser-keep-cookies"
            />
            <span />
          </label>
        </Row>
        <ClearBrowserDataRow />
      </SettingsCard>
    </section>
  )
}

/** « Effacer les données du navigateur » (fiche 072), comme dans Claude Code. */
function ClearBrowserDataRow() {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const clear = () => {
    setBusy(true)
    setNote(null)
    window.api.browser
      .clearData()
      .then(() => setNote(t('settings.privacy.browserData.cleared')))
      .catch((e: unknown) => setNote(ipcErrorText(e)))
      .finally(() => setBusy(false))
  }
  return (
    <>
      <Row
        label={t('settings.privacy.browserData.label')}
        hint={t('settings.privacy.browserData.hint')}
      >
        <button
          className="btn small"
          onClick={clear}
          disabled={busy}
          data-testid="settings-clear-browser-data"
        >
          {busy
            ? t('settings.privacy.browserData.clearing')
            : t('settings.privacy.browserData.clear')}
        </button>
      </Row>
      {note && (
        <div className="settings-note" data-testid="settings-clear-browser-data-note">
          {note}
        </div>
      )}
    </>
  )
}
