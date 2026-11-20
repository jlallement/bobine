import { PanelLeft, SquarePen } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { platformFeatures } from '../../platform-features'
import { AppMenuButton } from '../common/AppMenu'
import { Tip } from '../common/Menus'

/**
 * En-tête de la conversation, barre latérale repliée : le menu ☰ hors macOS (fiche 145), puis
 * « Afficher la barre latérale » et « Nouvelle conversation ».
 */
export function CollapsedSidebarButtons({
  onShowSidebar,
  onNew
}: {
  onShowSidebar: () => void
  onNew: () => void
}) {
  const { t } = useTranslation()
  return (
    <>
      {!platformFeatures().appMenu && <AppMenuButton />}
      <Tip label={t('app.showSidebar')} command="toggle-sidebar">
        <button
          className="icon-button no-drag"
          onClick={onShowSidebar}
          aria-label={t('app.showSidebar')}
        >
          <PanelLeft size={18} />
        </button>
      </Tip>
      <Tip label={t('app.newConversation')} command="new-conversation">
        <button
          className="icon-button no-drag"
          onClick={onNew}
          aria-label={t('app.newConversation')}
        >
          <SquarePen size={17} />
        </button>
      </Tip>
    </>
  )
}
