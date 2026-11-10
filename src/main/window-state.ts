/**
 * Fenêtre principale retrouvée au lancement (fiche 093) : position, taille, agrandie (« Zoom » de
 * macOS) ou en plein écran, gardées dans les réglages (`window`). Une fenêtre laissée sur un écran
 * débranché revient au centre de l'écran principal.
 *
 * N'importe pas `electron` : la fenêtre et les écrans sont passés en paramètres (testable sous
 * Vitest).
 */

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** Ce que les réglages gardent de la fenêtre : sa taille « normale », et si elle était agrandie. */
export interface WindowState extends Rect {
  maximized?: boolean
  fullScreen?: boolean
}

/** Écrans : zone utile de chacun (sans la barre des menus ni le Dock), et celle de l'écran principal. */
export interface Screens {
  workAreas: readonly Rect[]
  primary: Rect
}

/** Hauteur de la barre du haut de la fenêtre : elle doit rester sur un écran pour la saisir. */
const TOP_BAR = 52
/** Ce qu'il faut au moins en voir (largeur, hauteur) pour dire la fenêtre visible. */
const MIN_VISIBLE = { width: 100, height: 20 }

/** État lu dans `settings.json` (valeurs mal formées : rien). */
export function parseWindowState(raw: unknown): WindowState | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const r = raw as Record<string, unknown>
  const int = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : NaN)
  const [x, y, width, height] = [int(r['x']), int(r['y']), int(r['width']), int(r['height'])]
  if ([x, y, width, height].some(Number.isNaN) || width <= 0 || height <= 0) return undefined
  return {
    x,
    y,
    width,
    height,
    ...(r['maximized'] === true ? { maximized: true } : {}),
    ...(r['fullScreen'] === true ? { fullScreen: true } : {})
  }
}

function intersection(a: Rect, b: Rect): { width: number; height: number } {
  return {
    width: Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x),
    height: Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
  }
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max))

/**
 * Où rouvrir la fenêtre : là où elle était si sa barre du haut est sur l'un des écrans (taille
 * ramenée à cet écran s'il a rétréci, fenêtre alors rentrée dedans) ; sinon (écran débranché),
 * centrée sur l'écran principal, à une taille qui y tient.
 */
export function visibleBounds(saved: Rect, screens: Screens): Rect {
  const topBar = { ...saved, height: Math.min(TOP_BAR, saved.height) }
  const host = screens.workAreas.find((area) => {
    const seen = intersection(topBar, area)
    return seen.width >= MIN_VISIBLE.width && seen.height >= MIN_VISIBLE.height
  })
  const area = host ?? screens.primary
  const width = Math.min(saved.width, area.width)
  const height = Math.min(saved.height, area.height)
  if (!host) {
    return {
      x: area.x + Math.round((area.width - width) / 2),
      y: area.y + Math.round((area.height - height) / 2),
      width,
      height
    }
  }
  if (width === saved.width && height === saved.height) return { ...saved }
  return {
    x: clamp(saved.x, area.x, area.x + area.width - width),
    y: clamp(saved.y, area.y, area.y + area.height - height),
    width,
    height
  }
}

/** Ce que le suivi demande à la fenêtre (`BrowserWindow` d'Electron). */
export interface TrackedWindow {
  on(event: WindowEvent, listener: () => void): unknown
  getNormalBounds(): Rect
  isMaximized(): boolean
  isFullScreen(): boolean
}

type WindowEvent =
  | 'resize'
  | 'move'
  | 'maximize'
  | 'unmaximize'
  | 'enter-full-screen'
  | 'leave-full-screen'
  | 'close'

/** Délai de calme après un déplacement ou un redimensionnement, avant d'enregistrer. */
const SAVE_DELAY_MS = 500

/**
 * Suit la fenêtre et enregistre son état : après un déplacement ou un redimensionnement (une fois
 * le geste fini), tout de suite quand elle est agrandie, mise en plein écran ou fermée. La taille
 * gardée est toujours la taille « normale » (`getNormalBounds`), même agrandie ou en plein écran.
 */
export function trackWindowState(
  win: TrackedWindow,
  save: (state: WindowState) => void,
  delayMs = SAVE_DELAY_MS
): void {
  let timer: ReturnType<typeof setTimeout> | undefined
  const now = () => {
    clearTimeout(timer)
    timer = undefined
    save({
      ...win.getNormalBounds(),
      ...(win.isMaximized() ? { maximized: true } : {}),
      ...(win.isFullScreen() ? { fullScreen: true } : {})
    })
  }
  const later = () => {
    clearTimeout(timer)
    timer = setTimeout(now, delayMs)
  }
  for (const event of ['resize', 'move'] as const) win.on(event, later)
  for (const event of [
    'maximize',
    'unmaximize',
    'enter-full-screen',
    'leave-full-screen',
    'close'
  ] as const) {
    win.on(event, now)
  }
}

/**
 * Ramène une fenêtre devant l'utilisateur (notification cliquée, commande du menu, fenêtre rapide,
 * relance de l'app). `inactive` : montrée sans prendre le focus de la machine (`BOBINE_SHOW_INACTIVE=1`,
 * essais de bout en bout, fiche 106) — sinon chaque app d'essai passerait au premier plan.
 */
export function revealWindow(
  win: {
    isMinimized(): boolean
    restore(): void
    show(): void
    showInactive(): void
    focus(): void
  },
  inactive = false
): void {
  if (win.isMinimized()) win.restore()
  if (inactive) {
    win.showInactive()
    return
  }
  win.show()
  win.focus()
}

/**
 * Affiche la fenêtre comme elle était : agrandie avant de se montrer, plein écran ensuite.
 * `inactive` : montrée sans prendre le focus de la machine (`BOBINE_SHOW_INACTIVE=1`, essais de
 * bout en bout, fiche 106) — sinon l'app d'essai devient l'application active et les frappes de
 * l'utilisateur tombent dans sa zone de saisie.
 */
export function showRestored(
  win: {
    maximize(): void
    show(): void
    showInactive(): void
    setFullScreen(flag: boolean): void
  },
  saved: WindowState | undefined,
  inactive = false
): void {
  if (saved?.maximized) win.maximize()
  if (inactive) win.showInactive()
  else win.show()
  // Le plein écran de macOS est une animation vers un autre espace : la fenêtre doit être visible.
  if (saved?.fullScreen) win.setFullScreen(true)
}
