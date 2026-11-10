import { useEffect, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { AppInfo } from '@shared/ipc'
import { type Language } from '@shared/i18n/language'
import { AppIcon } from '../common/SpoolMark'
import { Markdown } from '../thread/Markdown'
import { SettingsCard } from './rows'
import changelogFr from '../../../../../CHANGELOG.md?raw'
import changelogEn from '../../../../../CHANGELOG.en.md?raw'

/**
 * Réglages › Nouveautés (fiches 074, 136) : l'app (icône, nom, version, une phrase), puis le
 * journal des versions, une ligne par version, la plus récente ouverte (essai à la souris du 24/10 :
 * la page dépliée faisait plus de 500 lignes). Electron et le système sont dans Diagnostic.
 */
export function AboutSettings() {
  const { t, i18n } = useTranslation()
  const [info, setInfo] = useState<AppInfo | null>(null)
  useEffect(() => {
    void window.api.app.getInfo().then(setInfo)
  }, [])
  const versions = changelogVersions(i18n.language)
  return (
    <section>
      <SettingsCard>
        <div className="settings-about-head" data-testid="settings-about-head">
          <AppIcon size={56} />
          <div>
            <div className="settings-about-name">{info?.name}</div>
            {info && (
              <div className="settings-about-version">
                {t('settings.about.version', { version: info.version })}
              </div>
            )}
            <div className="settings-about-description">{t('settings.about.description')}</div>
          </div>
        </div>
      </SettingsCard>
      <SettingsCard testId="settings-changelog">
        {versions.map((version, index) => (
          <details key={version.title} className="settings-version" open={index === 0}>
            <summary data-testid="settings-version" data-title={version.title}>
              <span className="settings-version-name">{version.name}</span>
              {version.date && <span className="settings-version-date">{version.date}</span>}
              <ChevronRight size={15} className="settings-version-chevron" aria-hidden />
            </summary>
            <div className="settings-changelog">
              <Markdown text={version.body} />
            </div>
          </details>
        ))}
      </SettingsCard>
    </section>
  )
}

/** Nouveautés par langue de l'interface, intégrées au build (fiche 074). */
const CHANGELOGS: Record<Language, string> = { fr: changelogFr, en: changelogEn }

interface ChangelogVersion {
  /** Titre complet (`0.5.0 — 23 octobre 2026`, « Prochaine version »). */
  title: string
  name: string
  date: string | undefined
  body: string
}

/** Les versions du journal dans la langue de l'interface, sans son titre ni son introduction. */
export function changelogVersions(language: string): ChangelogVersion[] {
  return parseChangelog(CHANGELOGS[language as Language] ?? changelogFr)
}

/**
 * Une version par titre `## ` : « Prochaine version », puis `X.Y.Z — date`, préversion comprise
 * (`1.0.0-beta.1 — 10 novembre 2026`, fiche 218) ; le nom est ce qui précède « — ».
 */
export function parseChangelog(changelog: string): ChangelogVersion[] {
  return changelog
    .split(/^## /m)
    .slice(1)
    .map((chunk) => {
      const newline = chunk.indexOf('\n')
      const title = (newline < 0 ? chunk : chunk.slice(0, newline)).trim()
      const [name = title, date] = title.split(' — ')
      return { title, name, date, body: newline < 0 ? '' : chunk.slice(newline + 1).trim() }
    })
}
