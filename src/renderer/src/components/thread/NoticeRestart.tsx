import { useContext } from 'react'
import { useTranslation } from 'react-i18next'
import { RotateCcw } from 'lucide-react'
import { TurnControlsContext } from '../../turn-controls'

/**
 * « Redémarrer l'agent » d'un avis du fil (outils apparus avec un projet, fiche 241) : la même
 * action que le menu ⚙. Seulement dans le fil principal (contrôles du tour fournis par `App`).
 */
export function NoticeRestart() {
  const { t } = useTranslation()
  const controls = useContext(TurnControlsContext)
  if (!controls?.restartAgent) return null
  return (
    <button
      type="button"
      className="link-button notice-action notice-restart"
      data-testid="notice-restart-agent"
      onClick={controls.restartAgent}
    >
      <RotateCcw size={14} />
      {t('transcript.notice.appTools.restartAgent')}
    </button>
  )
}
