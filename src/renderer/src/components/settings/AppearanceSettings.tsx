import { useTranslation } from 'react-i18next'
import {
  CODE_FONT_SIZES,
  DENSITIES,
  CONVERSATION_FONT_SIZES,
  TERMINAL_FONT_SIZES,
  THEME_CHOICES,
  themeChoiceOf,
  themeChoicePreferences,
  THREAD_WIDTHS,
  type Preferences
} from '@shared/preferences'
import {
  AccentChoice,
  AppearancePreview,
  FontSelect,
  ThemeChoice,
  useInstalledFonts
} from './AppearanceParts'
import { requestPresentation, usePresentation } from '../../presentation'
import { Row, SettingsCard, SettingsTitle, SizeStepper } from './rows'

type OnPreferences = (change: Partial<Preferences>) => void

/**
 * Réglages › Apparence (fiche 136) : tout ce qui change l'aspect de l'app au même endroit, avec un
 * aperçu en tête. Thème et accent ; police, taille et largeur du fil ; police
 * et taille du code, puis du terminal (séparées, choix de Jérôme du 23/10).
 */
export function AppearanceSettings({
  preferences,
  onPreferences
}: {
  preferences: Preferences
  onPreferences: OnPreferences
}) {
  return (
    <section>
      <SettingsCard>
        <AppearancePreview preferences={preferences} />
      </SettingsCard>
      <InterfaceCard preferences={preferences} onPreferences={onPreferences} />
      <ThreadCard preferences={preferences} onPreferences={onPreferences} />
      <CodeCard preferences={preferences} onPreferences={onPreferences} />
      <PresentationCard />
    </section>
  )
}

/** Thème (cinq vignettes, « Système » suit le Mac en Clair et Sombre) et accent. */
function InterfaceCard({
  preferences,
  onPreferences
}: {
  preferences: Preferences
  onPreferences: OnPreferences
}) {
  const { t } = useTranslation()
  return (
    <>
      <SettingsTitle>{t('settings.appearance.interface')}</SettingsTitle>
      <SettingsCard>
        <Row
          label={t('settings.appearance.theme.label')}
          hint={t('settings.appearance.theme.hint')}
        >
          <div
            className="theme-choices"
            role="radiogroup"
            aria-label={t('settings.appearance.theme.label')}
          >
            {THEME_CHOICES.map((choice) => (
              <ThemeChoice
                key={choice}
                palette={choice}
                label={t(`settings.appearance.theme.${choice}`)}
                checked={themeChoiceOf(preferences) === choice}
                onChoose={() => onPreferences(themeChoicePreferences(choice))}
                testId={`theme-${choice}`}
              />
            ))}
          </div>
        </Row>
        <Row label={t('settings.appearance.accent.label')}>
          <AccentChoice
            value={preferences.accent}
            onChange={(accent) => onPreferences({ accent })}
          />
        </Row>
        <Row
          label={t('settings.appearance.density.label')}
          hint={t('settings.appearance.density.hint')}
        >
          <div
            className="segmented"
            role="radiogroup"
            aria-label={t('settings.appearance.density.label')}
          >
            {DENSITIES.map((density) => (
              <button
                key={density}
                role="radio"
                aria-checked={preferences.density === density}
                className={preferences.density === density ? 'active' : ''}
                onClick={() => onPreferences({ density })}
                data-testid={`density-${density}`}
              >
                {t(`settings.appearance.density.${density}`)}
              </button>
            ))}
          </div>
        </Row>
      </SettingsCard>
    </>
  )
}

/** Police, taille des réponses et largeur du fil. */
function ThreadCard({
  preferences,
  onPreferences
}: {
  preferences: Preferences
  onPreferences: OnPreferences
}) {
  const { t } = useTranslation()
  const fonts = useInstalledFonts()
  return (
    <>
      <SettingsTitle>{t('settings.appearance.thread')}</SettingsTitle>
      <SettingsCard>
        <Row
          label={t('settings.appearance.conversationFont.label')}
          hint={t('settings.appearance.conversationFont.hint')}
        >
          <FontSelect
            value={preferences.conversationFont}
            fixed={[
              { id: 'sans', label: t('settings.appearance.conversationFont.sans') },
              { id: 'serif', label: t('settings.appearance.conversationFont.serif') }
            ]}
            installed={fonts?.families}
            installedLabel={t('settings.appearance.conversationFont.installed')}
            onChange={(conversationFont) => onPreferences({ conversationFont })}
            testId="settings-conversation-font"
          />
        </Row>
        <Row
          label={t('settings.appearance.conversationSize.label')}
          hint={t('settings.appearance.conversationSize.hint')}
        >
          <SizeStepper
            value={preferences.conversationFontSize}
            limits={CONVERSATION_FONT_SIZES}
            onChange={(size) => onPreferences({ conversationFontSize: size })}
            testId="settings-conversation-size"
          />
        </Row>
        <Row label={t('settings.appearance.width.label')}>
          <div
            className="segmented"
            role="radiogroup"
            aria-label={t('settings.appearance.width.label')}
          >
            {THREAD_WIDTHS.map((width) => (
              <button
                key={width}
                role="radio"
                aria-checked={preferences.threadWidth === width}
                className={preferences.threadWidth === width ? 'active' : ''}
                onClick={() => onPreferences({ threadWidth: width })}
                data-testid={`thread-width-${width}`}
              >
                {t(`settings.appearance.width.${width}`)}
              </button>
            ))}
          </div>
        </Row>
      </SettingsCard>
    </>
  )
}

/** Police et taille du code (blocs, diffs, sorties), puis du terminal : séparées. */
function CodeCard({
  preferences,
  onPreferences
}: {
  preferences: Preferences
  onPreferences: OnPreferences
}) {
  const { t } = useTranslation()
  const fonts = useInstalledFonts()
  const installedLabel = t('settings.appearance.codeFont.installed')
  return (
    <>
      <SettingsTitle>{t('settings.appearance.code')}</SettingsTitle>
      <SettingsCard>
        <Row
          label={t('settings.appearance.codeFont.label')}
          hint={t('settings.appearance.codeFont.hint')}
        >
          <FontSelect
            value={preferences.codeFont}
            fixed={[{ id: 'system', label: t('settings.appearance.codeFont.system') }]}
            installed={fonts?.monospace}
            installedLabel={installedLabel}
            onChange={(codeFont) => onPreferences({ codeFont })}
            testId="settings-code-font"
          />
        </Row>
        <Row label={t('settings.appearance.codeSize.label')}>
          <SizeStepper
            value={preferences.codeFontSize}
            limits={CODE_FONT_SIZES}
            onChange={(size) => onPreferences({ codeFontSize: size })}
            testId="settings-code-size"
          />
        </Row>
        <Row
          label={t('settings.appearance.terminalFont.label')}
          hint={t('settings.appearance.terminalFont.hint')}
        >
          <FontSelect
            value={preferences.terminalFontFamily ?? ''}
            fixed={[{ id: '', label: t('settings.appearance.terminalFont.auto') }]}
            installed={fonts?.monospace}
            installedLabel={installedLabel}
            onChange={(family) => onPreferences({ terminalFontFamily: family })}
            testId="settings-terminal-font"
          />
        </Row>
        <Row label={t('settings.appearance.terminalSize.label')}>
          <SizeStepper
            value={preferences.terminalFontSize}
            limits={TERMINAL_FONT_SIZES}
            onChange={(size) => onPreferences({ terminalFontSize: size })}
            testId="settings-terminal-size"
          />
        </Row>
      </SettingsCard>
    </>
  )
}

/** Mode présentation (fiche 159) : le même interrupteur que le menu Affichage, jamais enregistré. */
function PresentationCard() {
  const { t } = useTranslation()
  const presenting = usePresentation()
  return (
    <>
      <SettingsTitle>{t('settings.appearance.presentation.title')}</SettingsTitle>
      <SettingsCard>
        <Row
          label={t('settings.appearance.presentation.label')}
          hint={t('settings.appearance.presentation.hint')}
        >
          <label className="switch">
            <input
              type="checkbox"
              checked={presenting}
              onChange={(e) => requestPresentation(e.target.checked)}
              data-testid="settings-presentation"
            />
            <span />
          </label>
        </Row>
      </SettingsCard>
    </>
  )
}
