import * as Dropdown from '@radix-ui/react-dropdown-menu'
import { Plus, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { PanelTab } from '@shared/panel'
import { Tip } from '../common/Menus'
import { PANEL_ICONS } from './PanelIcons'

/**
 * Menu « + » du panneau (fiche 185, maquette 7) : en tête, les onglets ouverts que la rangée n'a
 * pas la place de montrer (icône, nom, compte, ✕) ; puis les outils à ouvrir. Le bouton porte le
 * nombre d'onglets rangés. ⌫ ou Suppr sur une ligne rangée ferme son onglet ; le focus passe à la
 * ligne suivante, ou le menu se ferme s'il n'y en a plus. Le ✕ d'une ligne est une cible de souris
 * seulement (pas un bouton dans un élément de menu : interactif imbriqué) : touché au début du clic,
 * la sélection de la ligne est annulée et l'onglet se ferme ; au clavier, ⌫ / Suppr.
 */
export function PanelMoreMenu({
  overflow,
  closed,
  counts,
  label,
  onTab,
  onCloseTab
}: {
  /** Onglets ouverts rangés là faute de place, dans l'ordre de la rangée. */
  overflow: PanelTab[]
  /** Outils pas encore ouverts. */
  closed: PanelTab[]
  counts?: Partial<Record<PanelTab, string | undefined>>
  label: (id: PanelTab) => string
  onTab: (id: PanelTab) => void
  onCloseTab: (id: PanelTab) => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  // Après une fermeture au clavier, au rendu suivant : la ligne suivante, sinon la précédente,
  // sinon le premier élément du menu ; s'il n'y a plus rien, le menu se ferme.
  const frame = useRef(0)
  useEffect(() => () => cancelAnimationFrame(frame.current), [])
  // ✕ d'une ligne touché au début du clic : la ligne ferme son onglet au lieu de l'ouvrir.
  const closeHit = useRef<PanelTab | null>(null)
  const refocus = (next?: PanelTab, previous?: PanelTab) => {
    cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(() => {
      const row = (id?: PanelTab) =>
        id
          ? document.querySelector<HTMLElement>(`[data-testid="panel-more-tab"][data-tab="${id}"]`)
          : null
      const target =
        row(next) ??
        row(previous) ??
        document.querySelector<HTMLElement>('[data-testid="panel-more-menu"] [role="menuitem"]')
      if (target) target.focus()
      else setOpen(false)
    })
  }
  if (overflow.length === 0 && closed.length === 0) return null
  const name =
    overflow.length > 0
      ? t('sidePanel.moreTabs', { count: overflow.length, more: t('sidePanel.moreTitle') })
      : t('sidePanel.more')
  return (
    <Dropdown.Root
      modal={false}
      open={open}
      onOpenChange={(next) => {
        closeHit.current = null
        setOpen(next)
      }}
    >
      <Tip label={name}>
        <Dropdown.Trigger
          className={`icon-button small no-drag${overflow.length > 0 ? ' panel-more-count' : ''}`}
          aria-label={name}
          data-testid="panel-more"
        >
          <Plus size={16} />
          {overflow.length > 0 && <span className="panel-more-badge">{overflow.length}</span>}
        </Dropdown.Trigger>
      </Tip>
      <Dropdown.Portal>
        <Dropdown.Content
          className="menu panel-more-menu"
          align="start"
          sideOffset={6}
          collisionPadding={12}
          data-testid="panel-more-menu"
        >
          {overflow.length > 0 && (
            <>
              <div className="menu-label">{t('sidePanel.openTabs')}</div>
              {overflow.map((id, index) => {
                const Icon = PANEL_ICONS[id]
                const closeLabel = t('sidePanel.closeTab', { tab: label(id) })
                return (
                  <Dropdown.Item
                    key={id}
                    className="menu-item panel-more-tab"
                    // Le clic du ✕ passe par la sélection de la ligne (Radix) : elle est annulée, le
                    // menu reste ouvert, et l'onglet se ferme.
                    onPointerDown={(event) => {
                      const target = event.target as Element
                      closeHit.current = target.closest('.panel-more-tab-close') ? id : null
                    }}
                    // Appui sur le ✕ puis glissé ailleurs : ce n'est plus un clic sur le ✕. (Pas au
                    // relâché : Radix sélectionne la ligne dans ce même évènement, après nous.)
                    onPointerLeave={() => (closeHit.current = null)}
                    onPointerCancel={() => (closeHit.current = null)}
                    onSelect={(event) => {
                      if (closeHit.current !== id) return onTab(id)
                      closeHit.current = null
                      event.preventDefault()
                      onCloseTab(id)
                      refocus(overflow[index + 1], overflow[index - 1])
                    }}
                    aria-keyshortcuts="Backspace Delete"
                    onKeyDown={(event) => {
                      // Au clavier, ↩ ouvre la ligne, quel qu'ait été le dernier appui de souris.
                      closeHit.current = null
                      if (event.key !== 'Backspace' && event.key !== 'Delete') return
                      event.preventDefault()
                      onCloseTab(id)
                      refocus(overflow[index + 1], overflow[index - 1])
                    }}
                    data-tab={id}
                    data-testid="panel-more-tab"
                  >
                    <Icon size={16} className="menu-icon" />
                    <span className="menu-text">{label(id)}</span>
                    {counts?.[id] && <span className="panel-more-tab-count">{counts[id]}</span>}
                    <span
                      className="panel-more-tab-close"
                      aria-hidden="true"
                      title={closeLabel}
                      data-testid="panel-more-tab-close"
                    >
                      <X size={12} />
                    </span>
                  </Dropdown.Item>
                )
              })}
              {closed.length > 0 && <Dropdown.Separator className="menu-separator" />}
            </>
          )}
          {closed.length > 0 && <div className="menu-label">{t('sidePanel.moreTitle')}</div>}
          {closed.map((id) => {
            const Icon = PANEL_ICONS[id]
            return (
              <Dropdown.Item
                key={id}
                className="menu-item"
                onSelect={() => onTab(id)}
                data-tab={id}
              >
                <Icon size={16} className="menu-icon" />
                <span className="menu-text">{label(id)}</span>
              </Dropdown.Item>
            )
          })}
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  )
}
