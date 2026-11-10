import { INTERFACE_SHORTCUTS, SHORTCUTS } from '@shared/shortcuts'
import { useTranslation } from 'react-i18next'
import { SettingsCard } from './rows'

export function ShortcutsSettings() {
  const { t } = useTranslation()
  return (
    <section>
      <SettingsCard>
        <table className="shortcuts" data-testid="settings-shortcuts-table">
          <tbody>
            {[...SHORTCUTS, ...INTERFACE_SHORTCUTS].map((s) => (
              <tr key={s.label}>
                <td>{s.label}</td>
                <td>
                  <kbd>{s.keys}</kbd>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </SettingsCard>
      <p className="settings-row-hint settings-after-card">{t('settings.shortcuts.hint')}</p>
    </section>
  )
}
