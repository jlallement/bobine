/**
 * Fenêtres qui affichent le renderer (sorti d'`index.ts`, fiche 116) : préférences durcies
 * communes (AGENTS.md), chargement de la page (un `#hash` par vue secondaire, fiche 062), et les
 * fenêtres : la principale, la fenêtre rapide (fiche 062) et la fenêtre À propos (fiche 116), sur
 * le fond du thème enregistré (fiche 134).
 */
import { homedir } from 'node:os'
import { join } from 'node:path'
import { app, BrowserWindow, nativeTheme, shell } from 'electron'
import type { Preferences } from '@shared/preferences'
import { windowBackground } from '@shared/themes'
import { featuresArgument, type PlatformFeatures } from '@shared/platform'
import { homeArgument } from '@shared/path-display'
import { viewArgument } from '@shared/window-view'
import { registerAppWindow } from './app-windows'
import { attachContextMenu } from './context-menu'
import { rendererArguments } from './i18n'
import { QUICK_WIDTH } from './quick-entry'
import { ABOUT_SIZE, centerOn } from './about-window'
import { HELP_MIN_SIZE } from './help-window'
import type { Rect } from './window-state'

/** Fenêtres de l'app : `webPreferences` durcies (AGENTS.md), identiques partout. */
export const SAFE_WEB_PREFERENCES = {
  preload: join(__dirname, '../preload/index.js'),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
  webSecurity: true
} as const

/** Page du renderer dans l'app construite. */
export const RENDERER_FILE = join(__dirname, '../renderer/index.html')

/**
 * Préférences d'une fenêtre du renderer, langue de l'interface (fiche 074) et capacités de la
 * plateforme (fiche 145, données par `index.ts`) comprises.
 */
export const rendererWebPreferences = (features: PlatformFeatures) => ({
  ...SAFE_WEB_PREFERENCES,
  additionalArguments: [
    ...rendererArguments(),
    featuresArgument(features),
    // Dossier personnel, pour dire `~` dans les cartes (fiche 214).
    homeArgument(homedir())
  ]
})

/** Page du renderer (`hash` : autre vue, ex. `quick`), liens externes vers le navigateur système. */
export function loadRenderer(win: BrowserWindow, hash?: string): void {
  registerAppWindow(win)
  // Menu contextuel réduit à l'essentiel : orthographe, copier / coller, lien, image (fiche 154).
  attachContextMenu(win)
  // Les liens externes s'ouvrent dans le navigateur système, jamais dans l'app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    // Jamais de navigation de la fenêtre : http(s) part dans le navigateur du Mac (fiche 154).
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event, url) => {
    if (url !== win.webContents.getURL()) event.preventDefault()
  })

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (!app.isPackaged && devUrl) {
    void win.loadURL(hash ? `${devUrl}#${hash}` : devUrl)
  } else {
    void win.loadFile(RENDERER_FILE, hash ? { hash } : {})
  }
}

/**
 * Fond d'une fenêtre avant que sa page ne s'affiche : le `--bg` du thème enregistré (fiche 134),
 * sans éclair de clair ou de sombre en Sépia ou Nuit noire. `nativeTheme` est déjà réglé.
 */
const themeBackground = (prefs: ModePreferences) =>
  windowBackground(prefs, nativeTheme.shouldUseDarkColors)

/** Mode et thème de chaque mode : ce qui décide du fond d'une fenêtre (fiche 136). */
export type ModePreferences = Pick<Preferences, 'theme' | 'lightTheme' | 'darkTheme'>

/** Fenêtre principale : là où elle était (`bounds`, fiche 093), sur le fond du thème enregistré. */
export function createMainBrowserWindow(
  bounds: Rect | undefined,
  theme: ModePreferences,
  features: PlatformFeatures
): BrowserWindow {
  return new BrowserWindow({
    width: 1280,
    height: 820,
    ...bounds,
    minWidth: 800,
    minHeight: 500,
    show: false,
    titleBarStyle: 'hiddenInset',
    // Feux de la fenêtre centrés sur la hauteur des barres (52 px), comme leurs boutons (fiche 050).
    trafficLightPosition: { x: 18, y: 19 },
    backgroundColor: themeBackground(theme),
    webPreferences: rendererWebPreferences(features)
  })
}

/** Fenêtre rapide (fiche 062) : panneau flottant sans cadre, page `#quick` du renderer. */
export function createQuickWindow(features: PlatformFeatures): BrowserWindow {
  const win = new BrowserWindow({
    width: QUICK_WIDTH,
    height: 140,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    // Panneau macOS : passe au-dessus des apps en plein écran.
    type: 'panel',
    webPreferences: rendererWebPreferences(features)
  })
  loadRenderer(win, 'quick')
  return win
}

/**
 * Fenêtre À propos (fiche 116), page `#about` : enfant de la fenêtre principale et centrée sur
 * elle (pas `modal`, qui en ferait une feuille sans feux sur macOS), sinon centrée sur l'écran.
 */
export function createAboutWindow(
  parent: BrowserWindow | undefined,
  theme: ModePreferences,
  features: PlatformFeatures
): BrowserWindow {
  const win = new BrowserWindow({
    ...ABOUT_SIZE,
    ...(parent ? { parent, ...centerOn(parent.getBounds(), ABOUT_SIZE) } : { center: true }),
    show: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 14, y: 14 },
    backgroundColor: themeBackground(theme),
    webPreferences: rendererWebPreferences(features)
  })
  loadRenderer(win, 'about')
  return win
}

/**
 * Fenêtre d'aide (fiche 186), page `#help` : à part et non modale (elle se lit pendant qu'on
 * travaille), posée à côté de la fenêtre principale (`helpBounds`).
 */
export function createHelpWindow(
  bounds: Rect,
  theme: ModePreferences,
  features: PlatformFeatures
): BrowserWindow {
  const win = new BrowserWindow({
    ...bounds,
    minWidth: HELP_MIN_SIZE.width,
    minHeight: HELP_MIN_SIZE.height,
    show: false,
    fullscreenable: false,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 14, y: 14 },
    backgroundColor: themeBackground(theme),
    // API réduite à la vue d'aide : le preload lit cette marque (fiche 186).
    webPreferences: {
      ...rendererWebPreferences(features),
      additionalArguments: [
        ...rendererWebPreferences(features).additionalArguments,
        viewArgument('help')
      ]
    }
  })
  loadRenderer(win, 'help')
  return win
}
