/**
 * Attend `ms` millisecondes. `unref` : l'attente ne retient pas le processus — pour une borne
 * (budget d'un appel d'outil, chargement d'une page) qui n'a pas à le faire durer à elle seule.
 */
export function delay(ms: number, options: { unref?: boolean } = {}): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms)
    if (options.unref) timer.unref()
  })
}
