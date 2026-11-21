/**
 * Ordre des envois d'une conversation (revue de la fiche 272) : la préparation d'un message (garde
 * du dossier, asynchrone ; relance de l'agent) attend celle du message précédent. Deux envois
 * rapprochés arrivent donc à l'agent dans l'ordre où ils ont été faits, même si la garde du
 * premier est plus lente. Seule la préparation est enchaînée : l'envoi lui-même (tout le tour)
 * n'est pas attendu, le second message part dans la file comme avant.
 */
export class SendOrder {
  private readonly tails = new Map<string, Promise<void>>()

  run<T>(id: string, prepare: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(id) ?? Promise.resolve()
    const result = previous.then(prepare)
    const tail = result.then(
      () => {},
      () => {}
    )
    this.tails.set(id, tail)
    void tail.then(() => {
      if (this.tails.get(id) === tail) this.tails.delete(id)
    })
    return result
  }
}
