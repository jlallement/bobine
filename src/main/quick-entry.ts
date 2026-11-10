/**
 * Fenêtre rapide (fiche 062) : petite fenêtre flottante, ouverte par un raccourci global depuis
 * n'importe quelle app (apps en plein écran comprises) ; le message part dans une nouvelle
 * conversation. Créée à la première ouverture, puis masquée et réaffichée.
 */
import type { BrowserWindow } from 'electron'
import { revealWindow } from './window-state'
import { QUICK_SHORTCUTS, type QuickEntryStatus, type QuickShortcut } from '@shared/quick-entry'

/** Ce dont l'enregistrement a besoin de `globalShortcut` d'Electron (remplaçable en test). */
export interface GlobalShortcuts {
  register(accelerator: string, callback: () => void): boolean
  unregister(accelerator: string): void
}

/** Raccourci global de la fenêtre rapide : un seul à la fois, réenregistré quand le réglage change. */
export class QuickShortcutRegistrar {
  private current: { shortcut: QuickShortcut; accelerator: string } | undefined
  private status: QuickEntryStatus = { shortcut: 'off', refused: false }
  private readonly shortcuts: GlobalShortcuts
  private readonly onPress: () => void

  constructor(shortcuts: GlobalShortcuts, onPress: () => void) {
    this.shortcuts = shortcuts
    this.onPress = onPress
  }

  /** Applique le réglage ; sans effet s'il n'a pas changé. */
  apply(shortcut: QuickShortcut): QuickEntryStatus {
    if (this.status.shortcut === shortcut && (this.current || shortcut === 'off'))
      return this.status
    if (this.current) this.shortcuts.unregister(this.current.accelerator)
    this.current = undefined
    const { accelerator } = QUICK_SHORTCUTS[shortcut]
    if (!accelerator) {
      this.status = { shortcut, refused: false }
      return this.status
    }
    // macOS refuse un raccourci déjà pris par une autre app.
    const ok = this.shortcuts.register(accelerator, this.onPress)
    if (ok) this.current = { shortcut, accelerator }
    this.status = { shortcut, refused: !ok }
    return this.status
  }

  get state(): QuickEntryStatus {
    return this.status
  }

  dispose(): void {
    if (this.current) this.shortcuts.unregister(this.current.accelerator)
    this.current = undefined
  }
}

export const QUICK_WIDTH = 680
/** Perte de focus ignorée juste après l'ouverture. */
const BLUR_GRACE_MS = 500
const MIN_HEIGHT = 96
// Assez haute pour annoter une image (fiche 067).
const MAX_HEIGHT = 680

export interface QuickEntryOptions {
  /** Crée la fenêtre (durcie, page `#quick` du renderer). */
  create: () => BrowserWindow
  /** Où la poser : zone utile de l'écran de la souris. */
  workArea: () => { x: number; y: number; width: number; height: number }
  /** Montrée sans prendre le focus de la machine (essais de bout en bout, fiche 106). */
  inactive?: boolean
}

export class QuickEntry {
  private win: BrowserWindow | undefined
  /** Capture en cours : la fenêtre est masquée exprès, la perte du focus ne la ferme pas. */
  private capturing = false
  /** Dernière ouverture : une perte de focus juste après (macOS qui réordonne) ne compte pas. */
  private shownAt = 0
  private readonly options: QuickEntryOptions

  constructor(options: QuickEntryOptions) {
    this.options = options
  }

  /** Raccourci : ouvre, ou referme si elle est déjà au premier plan. */
  toggle(): void {
    if (this.win?.isVisible() && (this.win.isFocused() || this.options.inactive)) this.hide()
    else this.show()
  }

  show(): void {
    const win = this.window()
    const area = this.options.workArea()
    const [width = QUICK_WIDTH] = win.getSize()
    win.setPosition(
      Math.round(area.x + (area.width - width) / 2),
      Math.round(area.y + area.height * 0.22)
    )
    const reveal = () => {
      this.shownAt = Date.now()
      revealWindow(win, this.options.inactive)
      win.webContents.send('quick:shown')
    }
    // Première ouverture : la page d'abord (affichée trop tôt, la fenêtre perdait le focus).
    if (win.webContents.isLoading()) win.once('ready-to-show', reveal)
    else reveal()
  }

  hide(): void {
    if (this.win?.isVisible()) this.win.hide()
  }

  /** Hauteur demandée par la page (le contenu grandit avec le texte et les images). */
  resize(height: number): void {
    const win = this.win
    if (!win || !Number.isFinite(height)) return
    const [width = QUICK_WIDTH] = win.getSize()
    win.setSize(width, Math.round(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, height))))
  }

  /** Pendant une capture, la fenêtre se masque sans que la perte du focus compte. */
  setCapturing(capturing: boolean): void {
    this.capturing = capturing
  }

  destroy(): void {
    this.win?.destroy()
    this.win = undefined
  }

  private window(): BrowserWindow {
    if (this.win && !this.win.isDestroyed()) return this.win
    const win = this.options.create()
    // Au-dessus de tout, sur chaque bureau, apps en plein écran comprises.
    win.setAlwaysOnTop(true, 'floating')
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
    // Un clic ailleurs la referme (sauf pendant une capture, où elle est masquée exprès).
    win.on('blur', () => {
      if (!this.capturing && Date.now() - this.shownAt > BLUR_GRACE_MS) this.hide()
    })
    this.win = win
    return win
  }
}
