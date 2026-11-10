/**
 * Mode présentation (fiche 159) : un état du lancement en cours, volontairement jamais enregistré
 * (on ne reprend pas l'app, un jour, sans coûts ni bannières sans l'avoir voulu). Le menu, les
 * Réglages et les fenêtres le lisent ici ; le main s'en sert pour couper bannières et sons.
 */
export class Presentation {
  private on = false
  private readonly listeners = new Set<(active: boolean) => void>()

  get active(): boolean {
    return this.on
  }

  set(active: boolean): void {
    if (active === this.on) return
    this.on = active
    for (const listener of this.listeners) listener(active)
  }

  toggle(): void {
    this.set(!this.on)
  }

  /** Prévient à chaque changement ; rend le désabonnement. */
  onChange(listener: (active: boolean) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
}
