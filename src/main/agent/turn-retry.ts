/**
 * Reconnexion progressive d'un tour (fiche 142) : après une panne réseau ou une limite de débit,
 * le message du tour est renvoyé tel quel (mêmes blocs, sans nouvelle bulle) après 2, 4, 8, 16
 * puis 32 s ; tout de suite si le réseau revient ou si le Mac sort de veille, ou si l'utilisateur
 * clique « Réessayer maintenant ». Après la cinquième tentative, il ne reste que « Réessayer ».
 *
 * Sans Electron ni ACP : l'hôte d'agent renvoie le message (`resend`) et émet l'instantané
 * (`changed`), qui porte le bandeau (`view`).
 */
import type { ContentBlock } from '../../shared/acp-sdk.mts'
import type { TurnRetryView } from '@shared/agent'
import { log } from '../log'
import type { NetworkWatch } from '../network-watch'
import { classifyTurnFailure, type TurnFailure } from './turn-failure'

/** Attente avant chaque tentative : la n-ième après `RETRY_DELAYS_MS[n - 1]`. */
export const RETRY_DELAYS_MS: readonly number[] = [2_000, 4_000, 8_000, 16_000, 32_000]

type Cause = TurnRetryView['cause']

export interface TurnRetryOptions {
  /** Renvoie le message du tour à l'agent (mêmes blocs, sans nouvelle bulle dans le fil). */
  resend: (blocks: ContentBlock[]) => void
  /** Le bandeau a changé : l'instantané de l'agent est à émettre. */
  changed: () => void
  /** Retour du réseau et sortie de veille, écoutés seulement pendant l'attente. */
  network?: NetworkWatch | undefined
  /** Attentes (remplaçables en test). */
  delaysMs?: readonly number[] | undefined
  /** Processus de l'agent, pour relire sa sortie d'erreur pendant le tour. */
  agentProcess?: () => { stderrMark(): number; stderrSince(mark: number): string } | undefined
  /** Format d'erreur propre à l'agent (profil, `transientError`) ; `undefined` : rien de reconnu. */
  transientError?: ((error: unknown) => Exclude<TurnFailure, 'other'> | undefined) | undefined
  /** D'où vient le tour, pour le journal. */
  scope?: () => string
}

type State =
  | { phase: 'idle' }
  /** Tour en cours : `attempt` 0 au premier envoi (ou à « Réessayer » après l'épuisement). */
  | { phase: 'running'; blocks: ContentBlock[]; attempt: number; mark: number }
  /** Renvoi demandé, en attendant que l'hôte relance le tour (`begin`). */
  | { phase: 'resending'; blocks: ContentBlock[]; attempt: number }
  | {
      phase: 'waiting'
      blocks: ContentBlock[]
      cause: Cause
      attempt: number
      at: number
      timer: ReturnType<typeof setTimeout>
    }
  | { phase: 'exhausted'; blocks: ContentBlock[]; cause: Cause }

export class TurnRetry {
  private state: State = { phase: 'idle' }
  private unwatch: (() => void) | undefined
  private readonly options: TurnRetryOptions
  private readonly delays: readonly number[]

  constructor(options: TurnRetryOptions) {
    this.options = options
    this.delays = options.delaysMs ?? RETRY_DELAYS_MS
  }

  /**
   * Un tour part avec ces blocs : la tentative demandée (`now`) s'ils sont les siens, sinon un
   * nouveau message, qui remplace tout ce qui attendait.
   */
  begin(blocks: ContentBlock[]): void {
    const { state } = this
    const attempt = state.phase === 'resending' && state.blocks === blocks ? state.attempt : 0
    if (attempt === 0) this.clear()
    const mark = this.options.agentProcess?.()?.stderrMark() ?? 0
    this.state = { phase: 'running', blocks, attempt, mark }
  }

  /**
   * Le tour a échoué : `waiting` si une tentative est prévue (le tour reste en cours), `exhausted`
   * si les tentatives sont épuisées, `undefined` pour une erreur qui n'est pas une panne passagère.
   */
  failed(error: unknown): 'waiting' | 'exhausted' | undefined {
    const { state } = this
    if (state.phase !== 'running') return undefined
    const stderr = this.options.agentProcess?.()?.stderrSince(state.mark) ?? ''
    const cause = this.options.transientError?.(error) ?? classifyTurnFailure(error, stderr)
    if (cause === 'other') {
      this.clear()
      return undefined
    }
    const attempt = state.attempt + 1
    const max = this.delays.length
    const scope = this.options.scope?.() ?? ''
    if (attempt > max) {
      this.state = { phase: 'exhausted', blocks: state.blocks, cause }
      log.warn(`Tour en échec ${scope} : ${cause}, ${max} tentatives sans succès`)
    } else {
      const delay = this.delays[attempt - 1] ?? 0
      const timer = setTimeout(() => this.now(), delay)
      timer.unref?.()
      this.state = {
        phase: 'waiting',
        blocks: state.blocks,
        cause,
        attempt,
        at: Date.now() + delay,
        timer
      }
      log.info(
        `Tour en échec ${scope} : ${cause}, tentative ${attempt} sur ${max} dans ${delay} ms`
      )
    }
    this.watch()
    this.options.changed()
    return this.state.phase === 'exhausted' ? 'exhausted' : 'waiting'
  }

  /** Renvoie le message tout de suite (bouton, réseau revenu) ; `false` s'il n'y a rien à renvoyer. */
  now(): boolean {
    const { state } = this
    if (state.phase !== 'waiting' && state.phase !== 'exhausted') return false
    if (state.phase === 'waiting') clearTimeout(state.timer)
    // Après l'épuisement, « Réessayer » repart pour un cycle complet de tentatives.
    const attempt = state.phase === 'waiting' ? state.attempt : 0
    this.state = { phase: 'resending', blocks: state.blocks, attempt }
    this.stopWatching()
    this.options.changed()
    this.options.resend(state.blocks)
    return true
  }

  /** Échap ou Stop pendant l'attente : plus de tentative. `true` si une tentative attendait. */
  cancel(): boolean {
    if (this.state.phase !== 'waiting') return false
    this.clear()
    return true
  }

  /** Oublie tout (tour réussi, autre erreur, agent arrêté, nouveau message). */
  clear(): void {
    const { state } = this
    if (state.phase === 'waiting') clearTimeout(state.timer)
    this.state = { phase: 'idle' }
    this.stopWatching()
    if (state.phase === 'waiting' || state.phase === 'exhausted') this.options.changed()
  }

  /** Une tentative attend : le tour est toujours en cours, sans requête chez l'agent. */
  get waiting(): boolean {
    return this.state.phase === 'waiting'
  }

  view(): TurnRetryView | undefined {
    const { state } = this
    const max = this.delays.length
    if (state.phase === 'waiting') {
      return { cause: state.cause, attempt: state.attempt, max, at: state.at }
    }
    return state.phase === 'exhausted' ? { cause: state.cause, attempt: max, max } : undefined
  }

  private watch(): void {
    if (this.unwatch || !this.options.network) return
    this.unwatch = this.options.network.onRestored(() => {
      log.info(`Réseau revenu ${this.options.scope?.() ?? ''} : nouvelle tentative`)
      this.now()
    })
  }

  private stopWatching(): void {
    this.unwatch?.()
    this.unwatch = undefined
  }
}
