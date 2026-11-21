import { useTranslation } from 'react-i18next'
import { countText } from '@shared/i18n/format'

/**
 * Totaux « +12 −4 » d'un ensemble de fichiers (en-tête, Modifications, pied du tour, Session). Un
 * fichier écrit sans diff connu (fiche 272) n'a pas de totaux : jamais « +0 −0 » inventé, mais
 * « sans totaux » (tous) ou « · 1 sans totaux » (certains).
 */
export function LineTotals({
  files,
  added,
  removed,
  unknown = 0,
  spaced = false
}: {
  files: number
  added: number
  removed: number
  /** Fichiers aux totaux inconnus, parmi `files`. */
  unknown?: number
  /** Une espace entre les deux totaux (texte courant) ; sans : l'écart vient du CSS (puces). */
  spaced?: boolean
}) {
  const { t } = useTranslation()
  if (files > 0 && unknown >= files) {
    return (
      <span className="muted" data-testid="line-totals-unknown">
        {t('changes.noTotals')}
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
    </>
  )
}
