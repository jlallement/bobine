/**
 * Ordre des envois d'une conversation (revue de la fiche 272) : la préparation d'un message (garde
 * du dossier, asynchrone ; relance de l'agent) attend celle du message précédent. Deux envois
 * rapprochés arrivent donc à l'agent dans l'ordre où ils ont été faits, même si la garde du
 * premier est plus lente. Seule la préparation est enchaînée : l'envoi lui-même (tout le tour)
 * n'est pas attendu, le second message part dans la file comme avant.
 *
 * « Arrêter » pendant une préparation (fiche 278) : l'agent n'a pas encore de tour à annuler (il
 * démarre, par exemple une fille qui vient d'être lancée). L'arrêt est retenu pour le message en
 * route, qui le prend en partant ; sans envoi en route, il n'y a rien à retenir.
 *
 * Fille qui démarre (`startingHeld`) : sa consigne n'est pas encore dans cette file pendant que son
 * agent démarre, que son modèle est posé ou que son worktree se prépare (`children.ts`,
 * `worktree-setup-wiring.ts`). L'arrêt est alors retenu jusqu'au départ de la consigne, ou oublié
 * si elle ne part pas (`forget`).
 */
export class SendOrder {
  private readonly tails = new Map<string, Promise<void>>()
  private readonly preparing = new Map<string, number>()
  private readonly stops = new Set<string>()

  run<T>(id: string, prepare: () => Promise<T>): Promise<T> {
    this.preparing.set(id, (this.preparing.get(id) ?? 0) + 1)
    const previous = this.tails.get(id) ?? Promise.resolve()
    const result = previous.then(prepare)
    // Préparation finie (avant que l'appelant reprenne la main) : plus rien en route, plus d'arrêt
    // retenu sans objet.
    const prepared = () => {
      const left = (this.preparing.get(id) ?? 1) - 1
      if (left > 0) return void this.preparing.set(id, left)
      this.preparing.delete(id)
      this.stops.delete(id)
    }
    const tail = result.then(prepared, prepared)
    this.tails.set(id, tail)
    void tail.then(() => {
      if (this.tails.get(id) === tail) this.tails.delete(id)
    })
    return result
  }

  /** « Arrêter » : retenu si un envoi est en préparation, ou pour une fille qui démarre. */
  stopPending(id: string, starting = false): void {
    if (starting || this.preparing.has(id)) this.stops.add(id)
  }

  /** Consigne qui ne partira pas (lancement de la fille en échec) : l'arrêt retenu est oublié. */
  forget(id: string): void {
    this.stops.delete(id)
  }

  /** Envoi parti (`done` : son tour) : un arrêt retenu le suit aussitôt, une seule fois. */
  follow(id: string, done: Promise<void>, host: { cancel(): Promise<void> }): Promise<void> {
    if (this.stops.delete(id)) void host.cancel().catch(() => {})
    return done
  }
}
