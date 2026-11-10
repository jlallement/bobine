import { ChevronRight } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { HelpTopic } from '@shared/help-topics'
import { HelpLink } from '../help/HelpLink'

/**
 * Gabarit des réglages (fiche 136) : un titre de section, puis une carte arrondie dont les lignes
 * sont séparées par des filets.
 */
export function SettingsTitle({ children, help }: { children: ReactNode; help?: HelpTopic }) {
  return (
    <h3 className="settings-h3">
      {children}
      {/* « ? » après le titre de section, pas sur chaque ligne (fiche 186). */}
      {help && <HelpLink topic={help} section={typeof children === 'string' ? children : ''} />}
    </h3>
  )
}

export function SettingsCard({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <div className="settings-card" {...(testId ? { 'data-testid': testId } : {})}>
      {children}
    </div>
  )
}

/**
 * « Avancé », replié en bas de page (fiche 136), avec un résumé de son état quand il est fermé.
 * La recherche le déplie pour montrer un réglage qu'il contient (`revealSetting`).
 */
export function Advanced({
  summary,
  children,
  testId
}: {
  summary?: string
  children: ReactNode
  testId?: string
}) {
  const { t } = useTranslation()
  return (
    <details className="settings-advanced" {...(testId ? { 'data-testid': testId } : {})}>
      <summary>
        <ChevronRight size={13} className="settings-advanced-chevron" aria-hidden />
        {t('settings.advanced')}
        {summary && <small> · {summary}</small>}
      </summary>
      {children}
    </details>
  )
}

/**
 * Une ligne de réglage. `sub` : il dépend de la ligne du dessus, et se met en retrait de 16 px
 * sous elle (le seul retrait des réglages, jamais deux niveaux).
 */
export function Row({
  label,
  hint,
  sub,
  children
}: {
  label: string
  hint?: string
  sub?: boolean
  children: ReactNode
}) {
  return (
    <div className={`settings-row${sub ? ' sub' : ''}`}>
      <div className="settings-row-text">
        <div className="settings-row-label">{label}</div>
        {hint && <div className="settings-row-hint">{hint}</div>}
      </div>
      <div className="settings-row-control">{children}</div>
    </div>
  )
}

/**
 * Valeur réglable par pas (0,5 pour une taille de texte), affichée tout de suite pour que les clics
 * se cumulent. `labels` : noms des deux boutons (« Plus petit », « Plus grand » par défaut).
 */
export function SizeStepper({
  value,
  limits,
  onChange,
  testId,
  step = 0.5,
  labels
}: {
  value: number
  limits: { min: number; max: number }
  onChange: (size: number) => void
  testId: string
  step?: number
  labels?: { less: string; more: string }
}) {
  const { t } = useTranslation()
  const [size, setSize] = useState(value)
  const [seen, setSeen] = useState(value)
  if (seen !== value) {
    setSeen(value)
    setSize(value)
  }
  const change = (next: number) => {
    const clamped = Math.min(limits.max, Math.max(limits.min, next))
    setSize(clamped)
    onChange(clamped)
  }
  return (
    <div className="stepper">
      <button
        aria-label={labels?.less ?? t('settings.fontSize.smaller')}
        disabled={size <= limits.min}
        onClick={() => change(size - step)}
        data-testid={`${testId}-less`}
      >
        −
      </button>
      <span data-testid={testId}>{size}</span>
      <button
        aria-label={labels?.more ?? t('settings.fontSize.larger')}
        disabled={size >= limits.max}
        onClick={() => change(size + step)}
        data-testid={`${testId}-more`}
      >
        +
      </button>
    </div>
  )
}
