/**
 * Une page prête à recevoir les entrées de l'agent (fiche 250, 2026-11-24).
 *
 * Chromium jette sans le dire (acquitté « non consommé », le CDP répond comme si de rien n'était)
 * tout clic, touche ou molette qu'une page reçoit tant que son rendu est suspendu : juste après une
 * navigation, jusqu'à sa première peinture (`WidgetInputHandlerManager::DispatchEvent` : « We don't
 * want users interacting with stuff they can't see »). Une vue cachée jamais peinte le reste.
 * L'agent clique d'après l'arbre de la page, pas d'après ce qui est peint : son clic aussitôt après
 * `browser_navigate` était perdu (runner macOS de GitHub : saisie « Bonjour, ! », téléchargement
 * jamais lancé).
 *
 * Avant la première entrée de l'agent dans un document, on attend sa première peinture (entrée
 * `paint` de la page). Un onglet que le panneau ne montre pas est peint le temps de l'attente
 * (`reveal`, voir `BrowserManager`). Au-delà de la borne, l'outil de l'agent reçoit une erreur
 * claire ; l'attente n'est pas refaite pour ce document (une page sans rien à peindre reçoit les
 * entrées une fois la retenue de Chromium expirée, relevé ≈ 3 s). L'option globale de Chromium
 * (`allow-pre-commit-input`) est écartée par l'utilisateur : elle ôterait aussi sa protection à
 * l'utilisateur.
 */

/** Borne de l'attente de la première peinture ; d'ordinaire quelques dizaines de ms. */
export const PAINT_TIMEOUT_MS = 5_000

export function notPaintedMessage(ms: number): string {
  return `The page has not been rendered yet after ${Math.round(ms / 1000)} s, so it would ignore this input. Nothing was sent; try the action again.`
}

/** Script de la page : vrai dès sa première peinture, faux au bout de `ms`. */
export function firstPaintScript(ms: number): string {
  return `new Promise((resolve) => {
  const painted = () => performance.getEntriesByType('paint').length > 0
  if (painted()) return resolve(true)
  const observer = new PerformanceObserver(() => {
    if (painted()) { observer.disconnect(); resolve(true) }
  })
  observer.observe({ type: 'paint', buffered: true })
  setTimeout(() => { observer.disconnect(); resolve(painted()) }, ${Math.max(0, Math.round(ms))})
})`
}

export interface PaintGateDeps {
  /** Attend la première peinture du document, au plus `ms` ; vrai si elle a eu lieu. */
  probe: (ms: number) => Promise<boolean>
  /** Fait peindre une page cachée le temps de l'attente ; rend de quoi la remettre comme avant. */
  reveal?: () => (() => void) | undefined
  timeoutMs?: number
}

export class PaintGate {
  private generation = 0
  /** Document (génération) déjà vérifié : plus d'attente pour lui. */
  private checked = -1
  private pending: { generation: number; done: Promise<void> } | undefined

  private readonly deps: PaintGateDeps

  constructor(deps: PaintGateDeps) {
    this.deps = deps
  }

  /** Nouveau document (navigation hors de la page) : la vérification est à refaire. */
  navigated(): void {
    this.generation++
  }

  /** Avant une entrée de l'agent : le document courant a été peint, ou une erreur claire. */
  async beforeInput(): Promise<void> {
    while (this.checked !== this.generation) {
      const generation = this.generation
      if (this.pending?.generation !== generation) {
        this.pending = { generation, done: this.check(generation) }
      }
      await this.pending.done
    }
  }

  private async check(generation: number): Promise<void> {
    const ms = this.deps.timeoutMs ?? PAINT_TIMEOUT_MS
    const restore = this.deps.reveal?.()
    let painted: boolean
    try {
      painted = await this.deps.probe(ms)
    } finally {
      restore?.()
      if (this.pending?.generation === generation) this.pending = undefined
    }
    // Navigation pendant l'attente : la page a changé, `beforeInput` vérifie la nouvelle.
    if (generation !== this.generation) return
    this.checked = generation
    if (!painted) throw new Error(notPaintedMessage(ms))
  }
}
