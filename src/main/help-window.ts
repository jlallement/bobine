/**
 * Fenêtre d'aide (fiche 186) : une seule, non modale, posée à droite de la fenêtre principale
 * s'il y a la place sur son écran, sinon par-dessus son bord droit. Un nouvel appel la ramène et
 * la mène à la page demandée ; elle demande sa première cible (`help:target`) une fois chargée.
 */
import type { BrowserWindow } from 'electron'
import { HELP_TOPICS, type HelpTarget, type HelpTopic } from '@shared/help-topics'
import { revealWindow } from './window-state'

export const HELP_SIZE = { width: 860, height: 680 } as const
export const HELP_MIN_SIZE = { width: 640, height: 420 } as const
/** Espace laissé entre la fenêtre principale et l'aide. */
const GAP = 8

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Place de l'aide : collée à droite de la fenêtre principale si elle tient dans la zone utile de
 * l'écran, sinon contre le bord droit de l'écran (par-dessus la fenêtre principale). Même haut que
 * la fenêtre principale, hauteur bornée par l'écran.
 */
export function helpBounds(main: Rect | undefined, workArea: Rect): Rect {
  const height = Math.min(
    Math.max(main?.height ?? HELP_SIZE.height, HELP_MIN_SIZE.height),
    workArea.height
  )
  const width = Math.min(HELP_SIZE.width, workArea.width)
  const right = workArea.x + workArea.width
  const bottom = workArea.y + workArea.height
  if (!main) {
    return {
      x: Math.round(workArea.x + (workArea.width - width) / 2),
      y: Math.round(workArea.y + (workArea.height - height) / 3),
      width,
      height
    }
  }
  const beside = main.x + main.width + GAP
  const x = beside + width <= right ? beside : right - width
  const y = Math.min(Math.max(main.y, workArea.y), bottom - height)
  return { x, y, width, height }
}

/** Ce dont l'aide a besoin d'une `BrowserWindow` (remplaçable en test). */
export type HelpBrowserWindow = Pick<
  BrowserWindow,
  'isDestroyed' | 'isMinimized' | 'restore' | 'show' | 'showInactive' | 'focus'
> & {
  close(): void
  once(event: 'ready-to-show', listener: () => void): unknown
  on(event: 'closed', listener: () => void): unknown
}

export interface HelpWindowOptions<W extends HelpBrowserWindow> {
  /** Crée la fenêtre (durcie, page `#help`). */
  create: () => W
  /** Envoie la page à ouvrir à cette fenêtre d'aide, qui a déjà lu sa première cible. */
  navigate: (win: W, target: HelpTarget) => void
  /** Met le curseur dans la recherche de cette fenêtre d'aide. */
  focusSearch: (win: W) => void
  /** Montrée sans prendre le focus de la machine (essais de bout en bout, fiche 106). */
  inactive?: boolean
}

/** Cible d'un sujet de l'interface, ou l'accueil du guide. */
export const helpTarget = (topic: HelpTopic | null): HelpTarget =>
  topic ? HELP_TOPICS[topic] : { page: 'README' }

export class HelpWindow<W extends HelpBrowserWindow = BrowserWindow> {
  private win: W | undefined
  /** Cible de la fenêtre en cours de chargement, lue par elle (`help:target`). */
  private pending: HelpTarget = { page: 'README' }
  /** La recherche aura le curseur une fois la page chargée (⌘?). */
  private pendingSearch = false
  /**
   * La page a lu sa première cible (`help:target`) : les demandes suivantes lui sont envoyées.
   * Avant, elles remplacent la cible en attente (sinon elles se perdraient : la page ne s'est pas
   * encore abonnée).
   */
  private targetRead = false
  private readonly options: HelpWindowOptions<W>

  constructor(options: HelpWindowOptions<W>) {
    this.options = options
  }

  /**
   * Ouvre l'aide à un sujet (`null` : là où elle en était, l'accueil la première fois), ou la
   * ramène. `search` : le curseur dans la recherche (⌘?).
   */
  show(topic: HelpTopic | null, options: { search?: boolean } = {}): void {
    const open = this.win
    if (open && !open.isDestroyed()) {
      revealWindow(open, this.options.inactive)
      if (!this.targetRead) {
        if (topic) this.pending = helpTarget(topic)
        if (options.search) this.pendingSearch = true
        return
      }
      if (topic) this.options.navigate(open, helpTarget(topic))
      if (options.search) this.options.focusSearch(open)
      return
    }
    this.pending = helpTarget(topic)
    this.pendingSearch = options.search === true
    this.targetRead = false
    const win = this.options.create()
    this.win = win
    // La page d'abord : pas de fenêtre vide qui clignote.
    win.once('ready-to-show', () => revealWindow(win, this.options.inactive))
    win.on('closed', () => {
      if (this.win === win) this.win = undefined
    })
  }

  /** Première cible de la fenêtre qui vient de se charger. */
  initialTarget(): { target: HelpTarget; search: boolean } {
    this.targetRead = true
    return { target: this.pending, search: this.pendingSearch }
  }

  close(): void {
    const win = this.win
    if (win && !win.isDestroyed()) win.close()
  }
}
