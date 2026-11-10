/**
 * Fenêtre « À propos de Bobine » (fiche 116) : ouverte par le menu de l'app, une seule à la fois,
 * créée à la demande et détruite à la fermeture (Échap, ⌘W, feu rouge).
 */
import type { BrowserWindow } from 'electron'
import { app } from 'electron'
import type { ProfileSummary } from '@shared/agent'
import { buildInfo } from './build-info'
import { currentLanguage } from './i18n'
import type { TechnicalFacts } from './technical-info'
import { revealWindow } from './window-state'

export const ABOUT_SIZE = { width: 400, height: 420 } as const

type Bounds = { x: number; y: number; width: number; height: number }

/** Position d'une fenêtre centrée sur une autre, un peu au-dessus du milieu. */
export function centerOn(parent: Bounds, size: { width: number; height: number }) {
  return {
    x: Math.round(parent.x + (parent.width - size.width) / 2),
    y: Math.round(parent.y + Math.max(0, (parent.height - size.height) / 3))
  }
}

/** Ce dont la fenêtre a besoin d'une `BrowserWindow` (remplaçable en test). */
export type AboutBrowserWindow = Pick<
  BrowserWindow,
  'isDestroyed' | 'isVisible' | 'isMinimized' | 'restore' | 'show' | 'showInactive' | 'focus'
> & {
  close(): void
  once(event: 'ready-to-show', listener: () => void): unknown
  on(event: 'closed', listener: () => void): unknown
}

export interface AboutWindowOptions<W extends AboutBrowserWindow> {
  /** Crée la fenêtre (durcie, page `#about`), enfant de `parent` s'il est là. */
  create: (parent: W | undefined) => W
  /** Fenêtre principale, si elle est ouverte. */
  parent: () => W | undefined
  /** Montrée sans prendre le focus de la machine (essais de bout en bout, fiche 106). */
  inactive?: boolean
}

export class AboutWindow<W extends AboutBrowserWindow = BrowserWindow> {
  private win: W | undefined
  private readonly options: AboutWindowOptions<W>

  constructor(options: AboutWindowOptions<W>) {
    this.options = options
  }

  /** Ouvre la fenêtre, ou ramène celle qui est déjà ouverte. */
  show(): void {
    const open = this.win
    if (open && !open.isDestroyed()) {
      revealWindow(open, this.options.inactive)
      return
    }
    const parent = this.options.parent()
    const win = this.options.create(
      parent && !parent.isDestroyed() && parent.isVisible() ? parent : undefined
    )
    this.win = win
    // La page d'abord : pas de fenêtre vide qui clignote.
    win.once('ready-to-show', () => revealWindow(win, this.options.inactive))
    win.on('closed', () => {
      if (this.win === win) this.win = undefined
    })
  }

  close(): void {
    const win = this.win
    if (win && !win.isDestroyed()) win.close()
  }
}

/** Faits du système pour le bloc d'infos techniques (Electron, processus, langue). */
export function technicalFacts(agents: ProfileSummary[]): TechnicalFacts {
  return {
    name: app.getName(),
    version: app.getVersion(),
    build: buildInfo(),
    versions: {
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node
    },
    os: process.getSystemVersion(),
    arch: process.arch,
    language: currentLanguage(),
    agents
  }
}
