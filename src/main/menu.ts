/**
 * Menu macOS de l'app (fiche 027) : les entrées habituelles (rôles d'Electron pour Édition,
 * Fenêtre…) et les commandes de l'app avec leurs raccourcis (`shared/shortcuts.ts`). Un raccourci du
 * menu marche même quand le clavier est dans le terminal ou dans une page du navigateur intégré.
 */
import type { MenuItemConstructorOptions, WebContents } from 'electron'
import { SHORTCUTS, type MenuCommand, type Shortcut } from '@shared/shortcuts'
import { t } from 'i18next'

export interface MenuOptions {
  appName: string
  /** Développement : rechargement et outils de développement. */
  dev: boolean
  send: (command: MenuCommand) => void
  /** Aide → Afficher le journal (fiche 041). */
  showLog?: () => void
  /**
   * Fichier › Fenêtre rapide (fiche 062). Son raccourci est global (enregistré à part) : le menu
   * l'affiche sans l'enregistrer une seconde fois.
   */
  quickEntry?: { open: () => void; accelerator: string }
  /** Aide › Aide de Bobine (⌘?, fiche 186) : la fenêtre d'aide, recherche prête. */
  help?: () => void
  /** Bobine › À propos de Bobine : la fenêtre de l'app (fiche 116) ; sinon le panneau de macOS. */
  about?: () => void
  /** Fenêtre principale en plein écran, et sa bascule (fiche 126). */
  fullScreen?: boolean
  toggleFullScreen?: () => void
  /**
   * Zoom avant, arrière, taille réelle (fiche 129) : la page du navigateur si elle a le focus,
   * sinon l'interface. Sans lui, les rôles d'Electron (le webContents qui a le focus).
   */
  zoom?: (action: 'in' | 'out' | 'reset') => void
  /** Affichage › Mode présentation (fiche 159) : case cochée quand il est actif. */
  presentation?: { active: boolean; toggle: () => void }
}

/** Zoom de l'interface, comme les rôles `zoomIn`, `zoomOut` et `resetZoom` d'Electron. */
export function zoomInterface(contents: WebContents, action: 'in' | 'out' | 'reset'): void {
  contents.setZoomLevel(
    action === 'reset' ? 0 : contents.getZoomLevel() + (action === 'in' ? 0.5 : -0.5)
  )
}

export function buildMenuTemplate(options: MenuOptions): MenuItemConstructorOptions[] {
  const item = (shortcut: Shortcut): MenuItemConstructorOptions => ({
    id: shortcut.command,
    label: shortcut.label,
    accelerator: shortcut.accelerator,
    click: () =>
      shortcut.command === 'help' && options.help ? options.help() : options.send(shortcut.command)
  })
  const of = (menu: Shortcut['menu']) => SHORTCUTS.filter((s) => s.menu === menu).map(item)
  const command = (id: MenuCommand) => {
    const shortcut = SHORTCUTS.find((s) => s.command === id)
    if (!shortcut) throw new Error(`Commande inconnue : ${id}`)
    return item(shortcut)
  }

  return [
    {
      label: options.appName,
      submenu: [
        options.about
          ? { id: 'about', label: t('menu.about', { app: options.appName }), click: options.about }
          : { role: 'about', label: t('menu.about', { app: options.appName }) },
        { type: 'separator' },
        { ...command('settings'), label: t('menu.settings') },
        { type: 'separator' },
        { role: 'services', label: t('menu.services') },
        { type: 'separator' },
        { role: 'hide', label: t('menu.hide', { app: options.appName }) },
        { role: 'hideOthers', label: t('menu.hideOthers') },
        { role: 'unhide', label: t('menu.unhide') },
        { type: 'separator' },
        { role: 'quit', label: t('menu.quit', { app: options.appName }) }
      ]
    },
    {
      label: t('menu.file'),
      submenu: [
        ...of('file'),
        ...(options.quickEntry
          ? ([
              {
                id: 'quick-entry',
                label: t('menu.quickEntry'),
                ...(options.quickEntry.accelerator
                  ? { accelerator: options.quickEntry.accelerator, registerAccelerator: false }
                  : {}),
                click: options.quickEntry.open
              }
            ] satisfies MenuItemConstructorOptions[])
          : []),
        { type: 'separator' },
        { role: 'close', label: t('menu.close') }
      ]
    },
    {
      label: t('menu.edit'),
      submenu: [
        { role: 'undo', label: t('menu.undo') },
        { role: 'redo', label: t('menu.redo') },
        { type: 'separator' },
        { role: 'cut', label: t('menu.cut') },
        { role: 'copy', label: t('menu.copy') },
        { role: 'paste', label: t('menu.paste') },
        { role: 'pasteAndMatchStyle', label: t('menu.pasteAndMatchStyle') },
        { role: 'delete', label: t('menu.delete') },
        { role: 'selectAll', label: t('menu.selectAll') },
        { type: 'separator' },
        ...of('edit')
      ]
    },
    {
      label: t('menu.view'),
      submenu: [
        ...of('view'),
        { type: 'separator' },
        ...zoomItems(options.zoom),
        { type: 'separator' },
        ...(options.presentation
          ? ([
              {
                id: 'presentation',
                label: t('menu.presentation'),
                type: 'checkbox',
                checked: options.presentation.active,
                click: options.presentation.toggle
              },
              { type: 'separator' }
            ] satisfies MenuItemConstructorOptions[])
          : []),
        // Sans le rôle `togglefullscreen`, qui fait ajouter à macOS un second « Plein écran »
        // (fiche 126, `full-screen-menu.ts`).
        {
          id: 'fullscreen',
          label: options.fullScreen ? t('menu.exitFullscreen') : t('menu.fullscreen'),
          accelerator: 'Ctrl+Cmd+F',
          click: () => options.toggleFullScreen?.()
        },
        ...(options.dev
          ? ([
              { type: 'separator' },
              { role: 'reload', label: t('menu.reload') },
              { role: 'toggleDevTools', label: t('menu.devTools') }
            ] satisfies MenuItemConstructorOptions[])
          : [])
      ]
    },
    { label: t('menu.conversation'), submenu: of('conversation') },
    {
      // Sous-menu explicite (fiche 093) : celui d'Electron par défaut est en anglais. macOS y
      // ajoute toujours ses entrées (Remplir, Centrer…) et la liste des fenêtres.
      role: 'windowMenu',
      label: t('menu.window'),
      submenu: [
        // « Mon activité » (fiche 144), puis les entrées de macOS.
        ...of('window'),
        { type: 'separator' },
        { role: 'minimize', label: t('menu.minimize') },
        { role: 'zoom', label: t('menu.zoom') },
        { type: 'separator' },
        { role: 'front', label: t('menu.front') }
      ]
    },
    {
      role: 'help',
      label: t('menu.help'),
      submenu: [
        ...of('help'),
        // Fiche 061 : sans raccourci.
        {
          id: 'diagnostics',
          label: t('menu.diagnostics'),
          click: () => options.send('diagnostics')
        },
        ...(options.showLog
          ? ([
              { type: 'separator' },
              { id: 'show-log', label: t('menu.showLog'), click: options.showLog }
            ] satisfies MenuItemConstructorOptions[])
          : [])
      ]
    }
  ]
}

/**
 * Entrées de zoom du menu Présentation. Avec `zoom`, elles choisissent leur cible (fiche 129) ;
 * ⌘= (clavier américain, sans Maj) zoome aussi, caché, comme dans Chrome.
 */
function zoomItems(zoom: MenuOptions['zoom']): MenuItemConstructorOptions[] {
  if (!zoom) {
    return [
      { role: 'resetZoom', label: t('menu.resetZoom') },
      { role: 'zoomIn', label: t('menu.zoomIn') },
      { role: 'zoomOut', label: t('menu.zoomOut') }
    ]
  }
  return [
    {
      id: 'reset-zoom',
      label: t('menu.resetZoom'),
      accelerator: 'CommandOrControl+0',
      click: () => zoom('reset')
    },
    {
      id: 'zoom-in',
      label: t('menu.zoomIn'),
      accelerator: 'CommandOrControl+Plus',
      click: () => zoom('in')
    },
    {
      id: 'zoom-in-equal',
      label: t('menu.zoomIn'),
      accelerator: 'CommandOrControl+=',
      visible: false,
      click: () => zoom('in')
    },
    {
      id: 'zoom-out',
      label: t('menu.zoomOut'),
      accelerator: 'CommandOrControl+-',
      click: () => zoom('out')
    }
  ]
}
