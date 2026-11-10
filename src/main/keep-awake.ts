/**
 * Empêche la mise en veille du Mac tant qu'un agent travaille (réglage « Empêcher la mise en
 * veille »). `prevent-app-suspension` : le Mac reste éveillé, l'écran peut s'éteindre. Le bloqueur
 * d'Electron est injecté (testable sans Electron).
 */
export interface PowerBlocker {
  start: (type: 'prevent-app-suspension') => number
  stop: (id: number) => void
}

export class KeepAwake {
  private id: number | undefined
  private readonly blocker: PowerBlocker

  constructor(blocker: PowerBlocker) {
    this.blocker = blocker
  }

  /** À appeler à chaque changement : un agent travaille-t-il, le réglage est-il actif ? */
  update(working: boolean, enabled: boolean): void {
    const wanted = working && enabled
    if (wanted && this.id === undefined) {
      this.id = this.blocker.start('prevent-app-suspension')
    } else if (!wanted && this.id !== undefined) {
      this.blocker.stop(this.id)
      this.id = undefined
    }
  }

  get active(): boolean {
    return this.id !== undefined
  }
}
