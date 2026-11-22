import { CircleArrowUp, CircleCheck, ExternalLink, RefreshCw, TriangleAlert } from 'lucide-react'
import { Trans, useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import type { UpdateView } from '@shared/update-check'
import { messageTime } from '../../time'
import { useUpdate } from '../common/useUpdate'
import { Row, SettingsCard } from './rows'
import '../../update-notice.css'

/**
 * Réglages › Nouveautés (fiche 274, ADR-0066) : « Vérifier les nouvelles versions », la dernière
 * vérification réussie et « Vérifier maintenant » (toujours possible, même réglage coupé), puis
 * le résultat : version disponible, à jour, ou échec d'une vérification lancée à la main.
 */
export function UpdateCheckCard({
  enabled,
  onEnabled
}: {
  /** Réglage enregistré ; `undefined` tant que les réglages ne sont pas reçus. */
  enabled: boolean | undefined
  onEnabled: (enabled: boolean) => void
}) {
  const { t } = useTranslation()
  const view = useUpdate()
  return (
    <SettingsCard testId="settings-update">
      <Row label={t('updates.settings.label')} hint={t('updates.settings.hint')}>
        <label className="switch">
          <input
            type="checkbox"
            checked={enabled ?? true}
            disabled={enabled === undefined}
            onChange={(e) => onEnabled(e.target.checked)}
            aria-label={t('updates.settings.label')}
            data-testid="settings-update-check"
          />
          <span />
        </label>
      </Row>
      <Row label={t('updates.settings.last')} hint={lastChecked(view, t)}>
        <button
          className="btn small"
          disabled={!view || view.checking}
          onClick={() => void window.api.app.checkUpdate().catch(() => {})}
          data-testid="settings-update-now"
        >
          <RefreshCw size={13} className={view?.checking ? 'spin' : undefined} aria-hidden />
          {view?.checking ? t('updates.settings.checking') : t('updates.settings.checkNow')}
        </button>
      </Row>
      {view && <UpdateNote view={view} />}
    </SettingsCard>
  )
}

function lastChecked(view: UpdateView | null, t: TFunction): string {
  if (!view?.lastCheckedAt) return t('updates.settings.never')
  const at = Date.parse(view.lastCheckedAt)
  const today = new Date(at).toDateString() === new Date().toDateString()
  return today ? t('updates.settings.todayAt', { time: messageTime(at) }) : messageTime(at)
}

/** L'encart sous la carte : version disponible d'abord, sinon le résultat de « Vérifier maintenant ». */
function UpdateNote({ view }: { view: UpdateView }) {
  const { t } = useTranslation()
  const available = view.available
  if (available) {
    return (
      <div className="settings-note update-note new" data-testid="settings-update-available">
        <CircleArrowUp size={14} aria-hidden />
        <span className="update-note-text">
          <Trans
            t={t}
            i18nKey="updates.settings.available"
            values={{ version: available.version, current: view.current }}
            components={{ b: <b /> }}
          />
        </span>
        <button
          className="btn small primary"
          onClick={() => void window.api.app.openUpdate(available.version)}
          data-testid="settings-update-open"
        >
          <ExternalLink size={13} aria-hidden />
          {t('updates.settings.view')}
        </button>
      </div>
    )
  }
  if (view.checking || !view.manual) return null
  if (view.manual.result === 'up-to-date') {
    return (
      <div className="settings-note update-note ok" data-testid="settings-update-current">
        <CircleCheck size={14} aria-hidden />
        <span className="update-note-text">
          <Trans
            t={t}
            i18nKey="updates.settings.upToDate"
            values={{ version: view.current }}
            components={{ b: <b /> }}
          />
        </span>
      </div>
    )
  }
  return (
    <div className="settings-note warn update-note" data-testid="settings-update-failed">
      <TriangleAlert size={14} aria-hidden />
      <span className="update-note-text">
        {t(`updates.settings.failed.${view.manual.failure}`)}
      </span>
    </div>
  )
}
