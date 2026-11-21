import { useTranslation } from 'react-i18next'
import { countText } from '@shared/i18n/format'

/**
 * Totaux « +12 −4 » d'un ensemble de fichiers (en-tête, Modifications, pied du tour, Session).
 * Jamais « +0 −0 » inventé (fiche 272) : un fichier écrit sans diff connu dit « sans totaux », un
 * fichier binaire « binaire » ; seuls, à la place des totaux ; à côté d'autres, en plus d'eux.
 */
export function LineTotals({
  files,
  added,
  removed,
  unknown = 0,
  binary = 0,
  spaced = false
}: {
  files: number
  added: number
  removed: number
  /** Fichiers aux totaux inconnus, parmi `files`. */
  unknown?: number
  /** Fichiers binaires (pas de lignes), parmi `files`. */
  binary?: number
  /** Une espace entre les deux totaux (texte courant) ; sans : l'écart vient du CSS (puces). */
  spaced?: boolean
}) {
  const { t } = useTranslation()
  if (files > 0 && unknown + binary >= files) {
    return (
      <span className="muted" data-testid="line-totals-unknown">
        {unknown > 0 ? t('changes.noTotals') : t('changes.binaryBadge')}
      </span>
    )
  }
  return (
    <>
      <span className="diff-added">+{countText(added)}</span>
      {spaced && ' '}
      <span className="diff-removed">−{countText(removed)}</span>
      {unknown > 0 && (
        <span className="muted" data-testid="line-totals-unknown">
          {' · '}
          {t('changes.someNoTotals', { count: unknown })}
        </span>
      )}
      {binary > 0 && (
        <span className="muted" data-testid="line-totals-binary">
          {' · '}
          {t('changes.someBinary', { count: binary })}
        </span>
      )}
    </>
  )
}
