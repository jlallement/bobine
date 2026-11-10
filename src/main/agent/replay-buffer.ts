/**
 * Rejeu d'une session dont le fil de l'app est gardé (fiche 103, ADR-0021) : les mises à jour
 * rejouées par l'agent (`session/load`) ne vont pas au fil, elles sont réduites à part. Quand le
 * rejeu se calme (`REPLAY_QUIET_MS` sans mise à jour, le rejeu tardif de Bob 2.0.6 compris), ou
 * au plus tard au message suivant, le fil rejoué est remis en une fois à qui sait le réconcilier
 * avec le fil de l'app (`reduceTranscript`, évènement `replayed`).
 *
 * Un message envoyé dès la relance (après une panne, fiche 121) attend ce calme (`settled`) : sinon
 * le rejeu tardif arriverait pendant son tour et s'y fondrait (D21).
 */
import type { SessionUpdate } from '../../shared/acp-sdk.mts'
import { emptyTranscript, reduceTranscript, type TranscriptItem } from '@shared/transcript'
import type { TranscriptState } from '@shared/transcript'
import { log } from '../log'
import { formatDuration } from './acp-log'

/** Silence après lequel un rejeu est tenu pour fini. */
export const REPLAY_QUIET_MS = 300

export class ReplayBuffer {
  private replayed: TranscriptState = emptyTranscript
  private timer: ReturnType<typeof setTimeout> | undefined
  private readonly onSettled: (items: TranscriptItem[]) => void
  private readonly quietMs: number
  /** Un rejeu est attendu (`expect`) : il n'est calme qu'une fois entendu puis apaisé. */
  private awaited = false
  /** Une mise à jour rejouée est arrivée depuis `expect`. */
  private heard = false
  /** `settled` en attente. */
  private waiters: (() => void)[] = []

  constructor(onSettled: (items: TranscriptItem[]) => void, quietMs = REPLAY_QUIET_MS) {
    this.onSettled = onSettled
    this.quietMs = quietMs
  }

  /**
   * Un rejeu va venir (`session/load` envoyé, fil gardé) : `settled` l'attendra. Le calme sans rien
   * entendu ne compte pas, le rejeu tardif de Bob pouvant commencer après `REPLAY_QUIET_MS`.
   */
  expect(): void {
    this.awaited = true
    this.heard = false
  }

  /** Une mise à jour rejouée : réduite à part, et le compte à rebours du calme repart. */
  note(update: SessionUpdate): void {
    this.replayed = reduceTranscript(this.replayed, { type: 'update', update })
    this.heard = true
    this.schedule()
  }

  /**
   * Réponse à `session/load` reçue. Rejeu déjà entendu : il était complet avant la réponse, comme
   * le prévoit ACP, et aucun message n'a à l'attendre. Sinon il peut venir après (Bob 2.0.6).
   */
  loaded(): void {
    if (this.heard) this.release()
    this.schedule()
  }

  /** Le compte à rebours du calme (re)part : s'il ne vient rien, le rejeu est fini. */
  private schedule(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => this.settle(), this.quietMs)
  }

  /**
   * Attend que le rejeu attendu soit entendu et calme (et remis), au plus `maxMs` ; `false` si le
   * délai est passé. Tout de suite `true` quand aucun rejeu n'est attendu (⌘Q : déjà calme).
   */
  settled(maxMs: number): Promise<boolean> {
    if (!this.awaited) return Promise.resolve(true)
    return new Promise((resolve) => {
      const done = (): void => {
        clearTimeout(limit)
        resolve(true)
      }
      const limit = setTimeout(() => {
        this.waiters = this.waiters.filter((w) => w !== done)
        resolve(false)
      }, maxMs)
      this.waiters.push(done)
    })
  }

  /**
   * Avant un message : attend `settled` si un rejeu est attendu, et dit au journal combien de temps
   * (délai réel du rejeu tardif de Bob), ou que le message part sans que le rejeu soit calme.
   */
  async waitCalm(maxMs: number, scope: string): Promise<void> {
    if (!this.awaited) return
    const started = Date.now()
    const calm = await this.settled(maxMs)
    const waited = formatDuration(Date.now() - started)
    if (calm) log.info(`Rejeu de la session calme ${scope} : message envoyé après ${waited}`)
    else
      log.warn(`Rejeu de la session pas calme ${scope} après ${waited} : message envoyé quand même`)
  }

  /** Calme : remet le fil rejoué (s'il y a quelque chose), une seule fois, et repart à vide. */
  settle(): void {
    this.deliver()
    if (this.heard) this.release()
  }

  /** Un message part : ce qui a été rejoué est remis, et plus aucun rejeu n'est attendu. */
  finish(): void {
    this.deliver()
    this.release()
  }

  /** Oublie tout sans rien remettre (arrêt, redémarrage de l'agent, session perdue). */
  clear(): void {
    this.reset()
    this.release()
  }

  private deliver(): void {
    const { items } = this.replayed
    this.reset()
    if (items.length > 0) this.onSettled(items)
  }

  private reset(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = undefined
    this.replayed = emptyTranscript
  }

  /** Plus de rejeu attendu : les messages en attente partent. */
  private release(): void {
    this.awaited = false
    this.heard = false
    const waiters = this.waiters
    this.waiters = []
    for (const resolve of waiters) resolve()
  }
}
