import { useState } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * Confirmation d'une suppression ou d'une révocation, dans la ligne même (fiche 126) : une phrase,
 * le bouton rouge et « Garder », sous l'élément sur lequel on a cliqué. Une seule règle pour les
 * Réglages : rien ne part au premier clic, et rien n'est caché sous le pointeur (un double-clic
 * ne confirme pas : le bouton rouge n'est pas là où l'on a cliqué). « Garder » a le focus, Échap
 * referme.
 */
export function ConfirmRow({
  message,
  action,
  onConfirm,
  onCancel
}: {
  message: string
  /** Libellé du bouton rouge (« Supprimer », « Révoquer », « Nettoyer »). */
  action: string
  onConfirm: () => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  return (
    <div
      className="confirm-row"
      role="group"
      aria-label={message}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return
        // Échap referme la confirmation, pas la fenêtre des réglages.
        event.stopPropagation()
        onCancel()
      }}
      data-testid="confirm-row"
    >
      <span>{message}</span>
      <button className="btn small danger" onClick={onConfirm} data-testid="confirm-row-confirm">
        {action}
      </button>
      <button
        className="btn small ghost"
        autoFocus
        onClick={onCancel}
        data-testid="confirm-row-keep"
      >
        {t('common.keep')}
      </button>
    </div>
  )
}

/** Ligne qui demande confirmation (une à la fois par liste) : `ask` ouvre ou referme. */
export function useConfirm() {
  const [asking, setAsking] = useState<string | null>(null)
  return {
    asking,
    ask: (key: string) => setAsking((current) => (current === key ? null : key)),
    done: () => setAsking(null)
  }
}
