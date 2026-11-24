import { FileDiff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { changesSummary } from '@shared/changes'
import { LineTotals } from '../common/LineTotals'
import { Tip } from '../common/Menus'

/**
 * Raccourci des modifications dans l'en-tête de la conversation (fiche 021) : « 2 +6 −1 », qui
 * ouvre ou ferme l'onglet Modifications ; rien tant que l'agent n'a rien modifié.
 */
export function ChangesToggle({
  changes,
  open,
  onToggle
}: {
  changes: ReturnType<typeof changesSummary>
  /** L'onglet Modifications est affiché. */
  open: boolean
  onToggle: () => void
}) {
  const { t } = useTranslation()
  if (changes.files === 0) return null
  return (
    <Tip label={open ? t('app.hideChanges') : t('app.showChanges')} command="show-changes">
      <button
        className={`icon-button panel-toggle no-drag${open ? ' active' : ''}`}
        onClick={onToggle}
        data-testid="changes-toggle"
      >
        <FileDiff size={15} />
        {changes.files}
        <LineTotals {...changes} />
      </button>
    </Tip>
  )
}
