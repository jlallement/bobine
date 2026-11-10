import { FileText, FolderOpen } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { currentLocale } from '@shared/i18n/format'
import { VERBOSITIES, type LogStatus, type Verbosity } from '@shared/log-level'

/** Taille d'un fichier en Ko ou Mo, dans la langue de l'interface. */
function sizeText(bytes: number): string {
  const megabytes = bytes >= 1024 * 1024
  return new Intl.NumberFormat(currentLocale(), {
    style: 'unit',
    unit: megabytes ? 'megabyte' : 'kilobyte',
    maximumFractionDigits: megabytes ? 1 : 0
  }).format(megabytes ? bytes / (1024 * 1024) : Math.max(1, Math.round(bytes / 1024)))
}

const FILES = ['main', 'agents'] as const

/**
 * Réglages › Diagnostic › Journal (fiches 080, 133), en tête de la page : chaque fichier avec sa
 * taille et ce qu'il contient, « Ouvrir » (Console) et « Afficher dans le Finder », puis le niveau
 * du journal, réglable à chaud (Normal, Détaillé, Trace).
 */
export function LogSettings() {
  const { t } = useTranslation()
  const [status, setStatus] = useState<LogStatus | null>(null)
  useEffect(() => {
    void window.api.log.status().then(setStatus, () => setStatus(null))
  }, [])
  if (!status) return null
  const choose = (level: Verbosity) => {
    void window.api.log.setLevel(level).then(setStatus, () => {})
  }
  return (
    <div className="diag-group" data-testid="log-settings">
      <h3 className="diag-group-title">{t('diagnostics.log.label')}</h3>
      <ul className="settings-list log-card">
        {FILES.map((file) => {
          const name = `${file}.log`
          const empty = status.sizes[file] === 0
          return (
            <li key={file} data-testid={`log-file-${file}`}>
              <FileText size={16} className="log-file-icon" aria-hidden="true" />
              <div className="log-file-text">
                <span className="log-file-name">{name}</span>
                <span className="log-file-size" data-testid={`log-size-${file}`}>
                  · {empty ? t('diagnostics.log.empty') : sizeText(status.sizes[file])}
                </span>
                <div className="log-file-hint">{t(`diagnostics.log.fileHint.${file}`)}</div>
              </div>
              <button
                type="button"
                className="btn small"
                disabled={empty}
                aria-label={t('diagnostics.log.openLabel', { file: name })}
                onClick={() => void window.api.log.open(file)}
                data-testid={`log-open-${file}`}
              >
                {t('diagnostics.log.open')}
              </button>
              <button
                type="button"
                className="icon-button small"
                disabled={empty}
                title={t('diagnostics.log.reveal')}
                aria-label={t('diagnostics.log.revealLabel', { file: name })}
                onClick={() => void window.api.log.reveal(file)}
                data-testid={`log-reveal-${file}`}
              >
                <FolderOpen size={15} />
              </button>
            </li>
          )
        })}
        <li>
          <div className="log-file-text">
            <div className="settings-row-label">{t('diagnostics.log.level')}</div>
            <div className="log-file-hint" data-testid="log-level-hint">
              {t(`diagnostics.log.hint.${status.level}`)}
              {status.imposed && ` ${t('diagnostics.log.imposed')}`}
            </div>
          </div>
          <select
            className="settings-input"
            value={status.level}
            disabled={status.imposed}
            onChange={(e) => choose(e.target.value as Verbosity)}
            data-testid="log-level"
          >
            {VERBOSITIES.map((level) => (
              <option key={level} value={level}>
                {t(`diagnostics.log.levels.${level}`)}
              </option>
            ))}
          </select>
        </li>
      </ul>
    </div>
  )
}
