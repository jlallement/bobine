/**
 * Menu de l'application (fiches 027, 145). Sur macOS, le menu d'Electron dans la barre du système,
 * comme avant. Ailleurs (capacité `appMenu` absente, variante D) : le même menu reste installé
 * pour ses raccourcis (Ctrl+N…), mais sa barre n'est jamais montrée, pas même par Alt ; Bobine le
 * dessine derrière son bouton ☰ (`AppMenuButton`), d'après le modèle sérialisé d'ici. Un clic y
 * revient par `app:menuInvoke` : seuls les identifiants de ce modèle sont acceptés.
 */
import {
  app,
  BrowserWindow,
  Menu,
  webContents,
  type MenuItemConstructorOptions,
  type WebContents
} from 'electron'
import { appMenuIds, type AppMenuItem } from '@shared/app-menu'
import type { PlatformFeatures } from '@shared/platform'
import { appMenuModel } from './menu'

/** Rôles d'Electron que le menu de Bobine déclenche lui-même, sur la page qui a le clavier. */
const ROLES: Record<string, (contents: WebContents | null) => void> = {
  undo: (c) => c?.undo(),
  redo: (c) => c?.redo(),
  cut: (c) => c?.cut(),
  copy: (c) => c?.copy(),
  paste: (c) => c?.paste(),
  delete: (c) => c?.delete(),
  selectAll: (c) => c?.selectAll(),
  reload: (c) => c?.reload(),
  toggleDevTools: (c) => c?.toggleDevTools(),
  close: (c) => (c ? BrowserWindow.fromWebContents(c)?.close() : undefined),
  quit: () => app.quit(),
  about: () => app.showAboutPanel()
}

export interface AppMenu {
  /** Reconstruit le menu (langue, plein écran, raccourci de la fenêtre rapide…). */
  refresh: () => void
  /** Modèle du menu ☰ ; `null` sur macOS (pas de menu dessiné par Bobine). */
  model: () => AppMenuItem[] | null
  /** Entrée choisie dans le menu ☰ ; refusée si elle n'est pas dans le modèle courant. */
  invoke: (id: unknown) => void
}

export function appMenu(
  features: Pick<PlatformFeatures, 'appMenu'>,
  build: () => MenuItemConstructorOptions[]
): AppMenu {
  let menu: Menu | undefined
  let model: AppMenuItem[] | null = null
  // Hors macOS, la barre du menu d'Electron n'apparaît dans aucune fenêtre, même plus tard.
  const hide = (win: BrowserWindow) => win.setMenuBarVisibility(false)
  if (!features.appMenu) app.on('browser-window-created', (_event, win) => hide(win))
  return {
    refresh() {
      const template = build()
      menu = Menu.buildFromTemplate(template)
      Menu.setApplicationMenu(menu)
      if (features.appMenu) return
      for (const win of BrowserWindow.getAllWindows()) hide(win)
      model = appMenuModel(template)
    },
    model: () => model,
    invoke(id) {
      if (typeof id !== 'string' || !model || !appMenuIds(model).has(id)) {
        throw new Error(`Entrée de menu inconnue : ${String(id)}`)
      }
      if (id.startsWith('role:')) {
        ROLES[id.slice('role:'.length)]?.(webContents.getFocusedWebContents())
        return
      }
      const item = menu?.getMenuItemById(id)
      item?.click(undefined, BrowserWindow.getFocusedWindow() ?? undefined, undefined)
    }
  }
}
