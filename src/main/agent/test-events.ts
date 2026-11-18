/**
 * Essais contre l'agent factice réel : attendre un évènement de l'hôte plutôt que sonder pendant un
 * délai fixe (fiche 239, CI Windows du 2026-11-18). `expect.poll` et `vi.waitFor` abandonnent au
 * bout d'une seconde par défaut ; sous un coureur chargé, la question de l'agent (outil `ask_user`
 * par le serveur MCP de l'app) arrivait plus tard. Ici, la condition est relue à chaque évènement
 * émis par l'hôte, sans délai : seule la limite de l'essai (`testTimeout`) borne l'attente.
 *
 * Toute condition doit dépendre de ce que l'hôte émet (fil, instantané `status`) : un changement
 * sans évènement ne réveillerait pas l'attente.
 */
export function eventLog<E>(): {
  events: E[]
  emit: (event: E) => void
  until: (condition: () => boolean) => Promise<void>
} {
  const events: E[] = []
  const waiters = new Set<() => void>()
  const emit = (event: E) => {
    events.push(event)
    for (const wake of [...waiters]) wake()
  }
  const until = (condition: () => boolean) =>
    new Promise<void>((resolve) => {
      if (condition()) return resolve()
      const wake = () => {
        if (!condition()) return
        waiters.delete(wake)
        resolve()
      }
      waiters.add(wake)
    })
  return { events, emit, until }
}
