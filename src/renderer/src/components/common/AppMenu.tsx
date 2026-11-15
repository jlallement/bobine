/**
 * Menu ☰ de Bobine hors macOS (fiche 145, variante D) : le menu de l'app, dessiné par Bobine aux
 * couleurs du thème, à la place de la barre de menu d'Electron (jamais montrée). Le modèle vient
 * du main (`app:menu`, tiré de `main/menu.ts`) ; un choix y retourne (`app:menuInvoke`). Ouvert
 * par le bouton, ou par Alt seul (appuyé puis relâché sans autre touche). Radix (ADR-0005) : rôles
 * `menu` et `menuitem`, flèches, Entrée, Échap, focus rendu au bouton.
 */
import * as Dropdown from '@radix-ui/react-dropdown-menu'
import { Check, ChevronRight, Menu as MenuIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { acceleratorKeys, type AppMenuItem } from '@shared/app-menu'
import { ItemText, Tip } from './Menus'

/**
 * Alt seul : appuyé puis relâché sans autre touche, comme la convention des apps Linux. Rien pour
 * AltGr (touche `AltGraph`), Alt+Tab (la fenêtre perd le focus), Alt+lettre, ni pendant la
 * composition d'un caractère.
 */
export function useAltAlone(onAlt: () => void): void {
  const latest = useRef(onAlt)
  useEffect(() => {
    latest.current = onAlt
  })
  useEffect(() => {
    let armed = false
    const down = (event: KeyboardEvent) => {
      armed =
        event.key === 'Alt' &&
        !event.repeat &&
        !event.isComposing &&
        !event.ctrlKey &&
        !event.shiftKey &&
        !event.metaKey
    }
    const up = (event: KeyboardEvent) => {
      if (event.key === 'Alt' && armed && !event.isComposing) latest.current()
      armed = false
    }
    const disarm = () => (armed = false)
    window.addEventListener('keydown', down, true)
    window.addEventListener('keyup', up, true)
    window.addEventListener('pointerdown', disarm, true)
    window.addEventListener('blur', disarm)
    return () => {
      window.removeEventListener('keydown', down, true)
      window.removeEventListener('keyup', up, true)
      window.removeEventListener('pointerdown', disarm, true)
      window.removeEventListener('blur', disarm)
    }
  }, [])
}

export function AppMenuButton() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<AppMenuItem[]>([])
  /** Élément qui avait le clavier avant le menu : Copier, Coller… s'y appliquent. */
  const previous = useRef<HTMLElement | null>(null)
  /** Entrée choisie, déclenchée une fois le menu refermé et le focus remis en place. */
  const chosen = useRef<string | null>(null)
  const names = {
    ctrl: t('keys.ctrl'),
    alt: t('keys.alt'),
    shift: t('keys.shift'),
    space: t('keys.space')
  }

  const show = (next: boolean) => {
    if (!next) return setOpen(false)
    previous.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    // Le modèle est relu à chaque ouverture : cases cochées (présentation), plein écran, langue.
    void window.api.app.menu().then((model) => {
      setItems(model ?? [])
      setOpen(true)
    })
  }
  useAltAlone(() => show(!open))

  const render = (list: AppMenuItem[]) =>
    list.map((item, i) => {
      if (item.kind === 'separator') {
        return <Dropdown.Separator key={`sep-${i}`} className="menu-separator" />
      }
      if (item.kind === 'submenu') {
        return (
          <Dropdown.Sub key={item.id}>
            <Dropdown.SubTrigger className="menu-item" data-testid={`app-menu-${item.id}`}>
              <ItemText title={item.label} />
              <ChevronRight size={15} className="menu-icon" />
            </Dropdown.SubTrigger>
            <Dropdown.Portal>
              <Dropdown.SubContent
                className="menu app-menu"
                sideOffset={6}
                collisionPadding={12}
                data-testid={`app-menu-${item.id}-content`}
              >
                {render(item.items)}
              </Dropdown.SubContent>
            </Dropdown.Portal>
          </Dropdown.Sub>
        )
      }
      const keys = item.accelerator && (
        <span className="menu-value app-menu-keys">{acceleratorKeys(item.accelerator, names)}</span>
      )
      const select = () => (chosen.current = item.id)
      // Case à cocher (mode présentation) : `menuitemcheckbox`, son état lu par les lecteurs d'écran.
      if (item.checked !== undefined) {
        return (
          <Dropdown.CheckboxItem
            key={item.id}
            className="menu-item"
            checked={item.checked}
            disabled={!item.enabled}
            onSelect={select}
            data-testid={`app-menu-${item.id}`}
          >
            <ItemText title={item.label} />
            <Dropdown.ItemIndicator>
              <Check size={15} className="menu-check" />
            </Dropdown.ItemIndicator>
            {keys}
          </Dropdown.CheckboxItem>
        )
      }
      return (
        <Dropdown.Item
          key={item.id}
          className="menu-item"
          disabled={!item.enabled}
          onSelect={select}
          data-testid={`app-menu-${item.id}`}
        >
          <ItemText title={item.label} />
          {keys}
        </Dropdown.Item>
      )
    })

  return (
    <Dropdown.Root modal={false} open={open} onOpenChange={show}>
      <Tip label={t('appMenu.label')} side="bottom">
        <Dropdown.Trigger
          className="icon-button no-drag"
          aria-label={t('appMenu.label')}
          data-testid="app-menu"
        >
          <MenuIcon size={18} />
        </Dropdown.Trigger>
      </Tip>
      <Dropdown.Portal>
        <Dropdown.Content
          className="menu app-menu"
          side="bottom"
          align="start"
          sideOffset={6}
          collisionPadding={12}
          data-testid="app-menu-content"
          onCloseAutoFocus={(event) => {
            const id = chosen.current
            chosen.current = null
            // Copier, Coller… : le clavier revient d'abord là où il était.
            if (id?.startsWith('role:') && previous.current?.isConnected) {
              event.preventDefault()
              previous.current.focus()
            }
            if (id) void window.api.app.menuInvoke(id)
          }}
        >
          {render(items)}
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  )
}
