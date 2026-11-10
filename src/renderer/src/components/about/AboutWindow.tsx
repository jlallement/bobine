import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'
import type { AppInfo } from '@shared/ipc'
import { issueUrl, REPOSITORY_URL } from '@shared/issue-url'
import { AppIcon } from '../common/SpoolMark'
import { applyAppearance } from '../../appearance'

export const LICENSE_URL = `${REPOSITORY_URL}/blob/main/LICENSE`

/** Durée de « Copié » après « Copier les infos techniques ». */
const COPIED_MS = 2000

/** Jour du build (`AAAA-MM-JJ`) en toutes lettres, dans la langue de l'interface. */
export function formatBuildDate(date: string, language: string): string {
  const day = new Date(`${date}T00:00:00Z`)
  if (Number.isNaN(day.getTime())) return date
  return new Intl.DateTimeFormat(language, { dateStyle: 'long', timeZone: 'UTC' }).format(day)
}

/**
 * Fenêtre « À propos de Bobine » (fiche 116) : sobre, sans information technique affichée ;
 * elles se copient d'un geste pour un signalement. Échap la ferme.
 */
export function AboutWindow() {
  const { t, i18n } = useTranslation()
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    void window.api.app.getInfo().then(setInfo)
  }, [])

  // Apparence de l'app (accent, Sépia, Nuit noire…), suivie quand elle change.
  useEffect(() => {
    void window.api.settings.get().then((s) => applyAppearance(s))
    return window.api.settings.onChanged((s) => applyAppearance(s))
  }, [])

  // Titre de la fenêtre (menu Fenêtre de macOS).
  useEffect(() => {
    if (info) document.title = t('menu.about', { app: info.name })
  }, [info, t])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') void window.api.about.close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), COPIED_MS)
    return () => clearTimeout(timer)
  }, [copied])

  const copy = async () => {
    await navigator.clipboard.writeText(await window.api.about.technicalInfo())
    setCopied(true)
  }

  // Même issue que Réglages › Diagnostic (fiche 105), avec les infos techniques pour rapport.
  const reportIssue = async () => {
    if (!info) return
    const report = await window.api.about.technicalInfo()
    const { url } = issueUrl({
      version: info.version,
      report,
      truncatedNote: t('diagnostics.reportIssueTruncated')
    })
    // Le main ouvre les adresses https:// dans le navigateur système.
    window.open(url, '_blank', 'noreferrer')
  }

  if (!info) return null
  return (
    <main className="about" data-testid="about">
      <AppIcon size={96} />
      <h1 className="about-name">{info.name}</h1>
      <div className="about-version" data-testid="about-version">
        {t('aboutWindow.version', {
          version: info.version,
          date: formatBuildDate(info.buildDate, i18n.language)
        })}
      </div>
      <p className="about-description">{t('settings.about.description')}</p>
      <div className="about-actions">
        <button
          type="button"
          className="btn"
          onClick={() => void window.api.about.showChangelog()}
          data-testid="about-whats-new"
        >
          {t('aboutWindow.whatsNew')}
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => void reportIssue()}
          title={t('aboutWindow.reportIssueHint')}
          data-testid="about-report-issue"
        >
          {t('diagnostics.reportIssue')}
        </button>
      </div>
      <footer className="about-links">
        <a href={REPOSITORY_URL} target="_blank" rel="noreferrer" data-testid="about-github">
          {t('aboutWindow.github')}
        </a>
        <span aria-hidden>·</span>
        <a href={LICENSE_URL} target="_blank" rel="noreferrer" data-testid="about-license">
          {t('aboutWindow.license')}
        </a>
        <span aria-hidden>·</span>
        <button
          type="button"
          className="about-copy"
          onClick={() => void copy()}
          title={t('aboutWindow.copyInfoHint')}
          aria-live="polite"
          data-testid="about-copy"
          data-copied={copied}
        >
          {copied ? (
            <>
              <Check size={12} /> {t('aboutWindow.copied')}
            </>
          ) : (
            t('aboutWindow.copyInfo')
          )}
        </button>
      </footer>
      <p className="about-notice" data-testid="about-notice">
        {t('aboutWindow.notAffiliated')}
      </p>
    </main>
  )
}
