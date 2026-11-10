import { useEffect, useState } from 'react'
import type { CommandLineStatus } from '@shared/command-line'
import { ipcErrorText } from '../../ipc-errors'
import { useTranslation } from 'react-i18next'
import { Row } from './rows'

/**
 * Commande `bobine` du terminal (fiche 158) : installer, réinstaller (app déplacée), désinstaller.
 * Absente quand l'app ne peut pas l'offrir (lancée depuis les sources).
 */
export function CommandLineRow() {
  const { t } = useTranslation()
  const [status, setStatus] = useState<CommandLineStatus | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    // Appel enveloppé : absent des API simulées des essais de composants, la ligne reste masquée.
    Promise.resolve()
      .then(() => window.api.app.commandStatus())
      .then(setStatus)
      .catch(() => setStatus(null))
  }, [])
  if (!status) return null
  const run = (action: () => Promise<CommandLineStatus>) => {
    setError('')
    action().then(setStatus, (e: unknown) => setError(ipcErrorText(e)))
  }
  const dir = status.path ? status.path.replace(/\/bobine$/, '') : status.target
  return (
    <>
      <Row label={t('settings.general.command.label')} hint={t('settings.general.command.hint')}>
        {status.path ? (
          <>
            {!status.current && (
              <button
                className="btn small"
                onClick={() => run(() => window.api.app.installCommand())}
                data-testid="settings-command-install"
              >
                {t('settings.general.command.reinstall')}
              </button>
            )}
            <button
              className="btn small"
              onClick={() => run(() => window.api.app.uninstallCommand())}
              data-testid="settings-command-uninstall"
            >
              {t('settings.general.command.uninstall')}
            </button>
          </>
        ) : (
          <button
            className="btn small"
            onClick={() => run(() => window.api.app.installCommand())}
            data-testid="settings-command-install"
          >
            {t('settings.general.command.install')}
          </button>
        )}
      </Row>
      <div
        className={`settings-note${status.path && (!status.current || !status.inPath) ? ' warn' : ''}`}
        data-testid="settings-command-note"
      >
        {status.path
          ? t(
              status.current
                ? 'settings.general.command.installed'
                : 'settings.general.command.outdated',
              { path: status.path }
            )
          : t('settings.general.command.target', { dir: status.target })}
        {status.path && !status.inPath && <> {t('settings.general.command.notInPath', { dir })}</>}
      </div>
      {error && (
        <div className="settings-note error" role="alert">
          {error}
        </div>
      )}
    </>
  )
}
