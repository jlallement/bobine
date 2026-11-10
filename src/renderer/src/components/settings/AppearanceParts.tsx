import { useEffect, useState, useSyncExternalStore } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import type { InstalledFonts } from '@shared/ipc'
import type { AccentColor, Preferences } from '@shared/preferences'
import { ACCENTS, TINTS, type Palette } from '@shared/themes'
import { terminalFontCss } from '../../appearance'
import { currentPalette, subscribeTheme, themeKey } from '../../theme'

/** Polices installées (fiche 136) : demandées une fois au main, gardées pour la session. */
let fontsRequest: Promise<InstalledFonts> | undefined

export function useInstalledFonts(): InstalledFonts | null {
  const [fonts, setFonts] = useState<InstalledFonts | null>(null)
  useEffect(() => {
    let alive = true
    fontsRequest ??= window.api.app
      .fonts()
      .catch((): InstalledFonts => ({ families: [], monospace: [] }))
    void fontsRequest.then((list) => alive && setFonts(list))
    return () => {
      alive = false
    }
  }, [])
  return fonts
}

/**
 * Liste d'une police : les choix fixes (« Système… »), puis les polices installées. Une police
 * enregistrée mais absente du Mac reste affichée, marquée « non installée ».
 */
export function FontSelect({
  value,
  fixed,
  installed,
  installedLabel,
  onChange,
  testId
}: {
  value: string
  fixed: readonly { id: string; label: string }[]
  installed: readonly string[] | undefined
  installedLabel: string
  onChange: (font: string) => void
  testId: string
}) {
  const { t } = useTranslation()
  const missing =
    installed !== undefined && !fixed.some((f) => f.id === value) && !installed.includes(value)
  return (
    <select
      className="settings-input settings-input-font"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      data-testid={testId}
    >
      {fixed.map((f) => (
        <option key={f.id} value={f.id}>
          {f.label}
        </option>
      ))}
      {missing && (
        <option value={value}>{t('settings.appearance.fonts.current', { font: value })}</option>
      )}
      {installed && installed.length > 0 && (
        <optgroup label={installedLabel}>
          {installed.map((font) => (
            <option key={font} value={font}>
              {font}
            </option>
          ))}
        </optgroup>
      )}
    </select>
  )
}

/** Petite fenêtre aux couleurs d'une palette : fond, barre latérale, deux lignes. */
function Miniature({ palette }: { palette: Palette }) {
  const { neutrals } = TINTS[palette]
  return (
    <>
      <i style={{ background: neutrals.sidebar }} />
      <b style={{ background: neutrals.border }} />
      <b style={{ background: neutrals.border }} />
    </>
  )
}

/** Vignette d'un thème ; « Système » : moitié Clair, moitié Sombre. */
export function ThemeChoice({
  palette,
  label,
  checked,
  onChoose,
  testId
}: {
  palette: Palette | 'system'
  label: string
  checked: boolean
  onChoose: () => void
  testId: string
}) {
  return (
    <button
      role="radio"
      aria-checked={checked}
      className={`theme-choice${checked ? ' active' : ''}`}
      onClick={onChoose}
      data-testid={testId}
    >
      {palette === 'system' ? (
        <span className="theme-thumb split" aria-hidden>
          <span className="theme-half" style={{ background: TINTS.light.neutrals.bg }}>
            <Miniature palette="light" />
          </span>
          <span className="theme-half" style={{ background: TINTS.dark.neutrals.bg }}>
            <Miniature palette="dark" />
          </span>
        </span>
      ) : (
        <span
          className="theme-thumb"
          style={{ background: TINTS[palette].neutrals.bg }}
          aria-hidden
        >
          <Miniature palette={palette} />
        </span>
      )}
      {label}
    </button>
  )
}

/** Couleurs d'accent : six teintes dans la palette affichée. */
export function AccentChoice({
  value,
  onChange
}: {
  value: AccentColor
  onChange: (accent: AccentColor) => void
}) {
  const { t } = useTranslation()
  // Pastilles dans les teintes de la palette affichée (fiche 134).
  useSyncExternalStore(subscribeTheme, themeKey)
  const palette = currentPalette()
  return (
    <div
      className="accent-swatches"
      role="radiogroup"
      aria-label={t('settings.appearance.accent.label')}
    >
      {ACCENTS.map((id) => (
        <button
          key={id}
          role="radio"
          aria-checked={value === id}
          aria-label={t(`settings.appearance.accent.${id}`)}
          title={t(`settings.appearance.accent.${id}`)}
          className="accent-swatch"
          style={{ background: TINTS[palette].accents[id].accent }}
          onClick={() => onChange(id)}
          data-testid={`accent-${id}`}
        />
      ))}
    </div>
  )
}

/**
 * Aperçu en tête de la page Apparence : une réponse, un bloc de code et une ligne de terminal, qui
 * suivent les réglages (polices, tailles, thème, accent) au fil des choix.
 */
export function AppearancePreview({ preferences }: { preferences: Preferences }) {
  const { t } = useTranslation()
  return (
    <div
      className="appearance-preview"
      aria-label={t('settings.appearance.preview.label')}
      data-testid="appearance-preview"
    >
      <p className="appearance-preview-answer">
        <Trans t={t} i18nKey="settings.appearance.preview.answer" components={{ code: <code /> }} />
      </p>
      <pre className="appearance-preview-code">
        <span className="syn-keyword">{'export function'}</span>{' '}
        <span className="syn-function">{'hello'}</span>
        {'(name) {\n  '}
        <span className="syn-keyword">{'return'}</span>{' '}
        <span className="syn-string">{`\`${t('settings.appearance.preview.greeting')} \${name}\``}</span>{' '}
        <span className="syn-comment">{`// ${t('settings.appearance.preview.comment')}`}</span>
        {'\n}'}
      </pre>
      <div
        className="appearance-preview-terminal"
        style={{
          fontFamily: terminalFontCss(preferences.terminalFontFamily),
          fontSize: preferences.terminalFontSize
        }}
      >
        <span className="ansi-fg-4">{'❯'}</span> {'pnpm test'}{' '}
        <span className="ansi-fg-2">{`✓ ${t('settings.appearance.preview.result')}`}</span>
      </div>
    </div>
  )
}
