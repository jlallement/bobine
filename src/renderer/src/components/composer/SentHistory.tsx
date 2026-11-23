import { History, Paperclip } from 'lucide-react'
import '../../sent-history.css'
import { useTranslation } from 'react-i18next'

/**
 * Historique de la saisie (fiche 227, maquettes `01-historique`, variante A) : la pastille
 * « 9/10 · ↑↓ · Échap vider » posée sur le bord haut de la saisie (elle ne prend ni place ni
 * hauteur : rien ne bouge à chaque ↑), l'annonce aux lecteurs d'écran, le rappel de la saisie vide
 * et la ligne des pièces jointes non reprises.
 */
export function SentHistoryPill({
  index,
  count
}: {
  /** Position affichée (0 : le plus ancien) ; `undefined` : hors de l'historique. */
  index: number | undefined
  count: number
}) {
  const { t } = useTranslation()
  const position = index === undefined ? undefined : { index: index + 1, count }
  return (
    <>
      {/* Annonce polie, seulement quand la position change (pas à chaque frappe). */}
      <span className="sr-only" role="status" aria-live="polite" data-testid="history-announce">
        {position ? t('composer.history.announce', position) : ''}
      </span>
      {position && (
        <div className="sent-history-pill" aria-hidden="true" data-testid="history-pill">
          <span className="sent-history-pos">
            <History size={12} />
            {t('composer.history.position', position)}
          </span>
          <span className="sent-history-sep">·</span>
          <span className="sent-history-keys">
            <kbd>↑</kbd>
            <kbd>↓</kbd>
          </span>
          <span className="sent-history-sep">·</span>
          <kbd>{t('composer.history.escape')}</kbd>
          <span>{t('composer.history.clear')}</span>
        </div>
      )}
    </>
  )
}

/**
 * « ↑ Messages précédents », à droite dans la première ligne de la saisie vide, qui lui réserve sa
 * place (maquette rc4, variante 1). Saisie étroite : la touche seule, son nom en infobulle et pour
 * les lecteurs d'écran (`sent-history.css`). Appuyer dessus ne retire pas le focus à la saisie :
 * le rappel, qui ne vit qu'avec lui, resterait affiché sans raison… puis disparaîtrait.
 */
export function SentHistoryHint() {
  const { t } = useTranslation()
  const label = t('composer.history.hint')
  return (
    <div
      className="sent-history-hint"
      title={label}
      data-testid="history-hint"
      onMouseDown={(event) => event.preventDefault()}
    >
      <kbd aria-hidden="true">↑</kbd>
      <span className="sent-history-hint-label">{label}</span>
    </div>
  )
}

/** Pièces jointes du message repris : elles ne reviennent pas, c'est dit (rien à cliquer). */
export function LostAttachments({ count }: { count: number }) {
  const { t } = useTranslation()
  if (count === 0) return null
  return (
    <div className="sent-history-lost" data-testid="history-lost">
      <Paperclip size={13} />
      {t('composer.history.lost', { count })}
    </div>
  )
}
