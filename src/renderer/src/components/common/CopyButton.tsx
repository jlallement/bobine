import { Check, Copy, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

/** Durée du retour « Copié » (fiche 185, P3). */
const COPIED_MS = 1200

/**
 * Bouton « Copier » : le texte (ou celui que rend `text()`) va dans le presse-papiers. Le même
 * retour partout (fiche 185, P3) : l'icône devient ✓ et une bulle « Copié » s'affiche (en CSS : ni
 * couche qui prendrait Échap au dialogue, ni infobulle Radix par bouton dans un long fil). Le nom
 * passe par `title`, que l'app affiche en infobulle (`installTitleTooltips`, fiche 126).
 */
export function CopyButton({
  text,
  label,
  className = '',
  testId
}: {
  text: () => string
  label?: string
  className?: string
  testId?: string
}) {
  const { t } = useTranslation()
  // Chaque clic réarme le délai (horodatage), même si la bulle est encore là.
  const [feedback, setFeedback] = useState<{ ok: boolean; at: number } | null>(null)
  useEffect(() => {
    if (!feedback) return
    const timer = setTimeout(() => setFeedback(null), COPIED_MS)
    return () => clearTimeout(timer)
  }, [feedback])
  const name = label ?? t('copy.action')
  const said = feedback ? (feedback.ok ? t('copy.done') : t('copy.failed')) : undefined
  return (
    <button
      type="button"
      className={`icon-button small copy-button${feedback ? (feedback.ok ? ' copied' : ' copy-failed') : ''} ${className}`}
      title={said ? undefined : name}
      aria-label={said ?? name}
      data-copied={said}
      onClick={() => {
        navigator.clipboard.writeText(text()).then(
          () => setFeedback({ ok: true, at: Date.now() }),
          () => setFeedback({ ok: false, at: Date.now() })
        )
      }}
      data-testid={testId}
    >
      {feedback ? feedback.ok ? <Check size={13} /> : <X size={13} /> : <Copy size={13} />}
    </button>
  )
}
