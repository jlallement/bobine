import { TriangleExclamationPoint, Volume2 } from 'lucide-react'
import { ATTENTION_SOUNDS, type AttentionSound, type Preferences } from '@shared/preferences'
import { useTranslation } from 'react-i18next'
import { Row, SettingsCard, SettingsTitle } from './rows'

/**
 * Réglages › Notifications (fiche 136) : le bandeau quand macOS bloque les bannières, puis ce qui
 * prévient quand un agent a fini ou attend (le rebond et le compteur du Dock en dépendent, d'où
 * leur retrait), puis le son, qui marche même sans notifications.
 */
export function NotificationsSettings({
  preferences,
  notifications,
  blocked,
  onPreferences,
  onNotifications,
  onOpenNotificationSettings
}: {
  preferences: Preferences
  notifications: boolean
  /** Raison du refus de macOS, quand il bloque les bannières de l'app (fiche 024). */
  blocked?: string
  onPreferences: (change: Partial<Preferences>) => void
  onNotifications: (enabled: boolean) => void
  onOpenNotificationSettings: () => void
}) {
  const { t } = useTranslation()
  return (
    <section>
      {notifications && blocked && (
        <div className="settings-banner" role="status" data-testid="settings-notifications-blocked">
          <TriangleExclamationPoint size={16} aria-hidden />
          <span>{t('settings.notifications.notifications.blocked')}</span>
          <button className="btn small" onClick={onOpenNotificationSettings}>
            {t('settings.notifications.notifications.openSettings')}
          </button>
        </div>
      )}
      <SettingsTitle>{t('settings.notifications.whenDone')}</SettingsTitle>
      <SettingsCard>
        <Row
          label={t('settings.notifications.notifications.label')}
          hint={t('settings.notifications.notifications.hint')}
        >
          <label className="switch">
            <input
              type="checkbox"
              checked={notifications}
              onChange={(e) => onNotifications(e.target.checked)}
              data-testid="settings-notifications-enabled"
            />
            <span />
          </label>
        </Row>
        {/* Rebond du Dock (fiche 101) : coupé avec les notifications, d'où l'interrupteur grisé. */}
        <Row
          sub
          label={t('settings.notifications.dockBounce.label')}
          hint={t('settings.notifications.dockBounce.hint')}
        >
          <label className="switch">
            <input
              type="checkbox"
              checked={preferences.dockBounce}
              disabled={!notifications}
              onChange={(e) => onPreferences({ dockBounce: e.target.checked })}
              data-testid="settings-dock-bounce"
            />
            <span />
          </label>
        </Row>
        {/* Compteur « À traiter » du Dock (fiche 119) : coupé avec les notifications. */}
        <Row
          sub
          label={t('settings.notifications.dockBadge.label')}
          hint={t('settings.notifications.dockBadge.hint')}
        >
          <label className="switch">
            <input
              type="checkbox"
              checked={preferences.dockBadge}
              disabled={!notifications}
              onChange={(e) => onPreferences({ dockBadge: e.target.checked })}
              data-testid="settings-dock-badge"
            />
            <span />
          </label>
        </Row>
      </SettingsCard>
      <SettingsTitle>{t('settings.notifications.sound')}</SettingsTitle>
      <SettingsCard>
        <Row
          label={t('settings.notifications.attentionSound.label')}
          hint={t('settings.notifications.attentionSound.hint')}
        >
          <div className="settings-inline">
            <select
              className="settings-input"
              value={preferences.attentionSound}
              onChange={(e) => onPreferences({ attentionSound: e.target.value as AttentionSound })}
              data-testid="settings-attention-sound"
            >
              <option value="off">{t('settings.notifications.attentionSound.none')}</option>
              {ATTENTION_SOUNDS.map((sound) => (
                <option key={sound} value={sound}>
                  {sound}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="icon-button small"
              disabled={preferences.attentionSound === 'off'}
              onClick={() => void window.api.sound.preview(preferences.attentionSound)}
              title={t('settings.notifications.attentionSound.play')}
              aria-label={t('settings.notifications.attentionSound.playLabel')}
              data-testid="settings-attention-sound-play"
            >
              <Volume2 size={15} />
            </button>
          </div>
        </Row>
      </SettingsCard>
    </section>
  )
}
