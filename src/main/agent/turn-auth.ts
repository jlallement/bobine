/**
 * Connexion refusée pendant un tour (recette 0.9, D10) : l'agent répond `authRequired` (code ACP
 * standard) à `session/prompt`, quand sa connexion a expiré (OpenCode 2.2.5 : « provider
 * authentication required »). Même carte de connexion qu'à l'ouverture de la session (méthodes et
 * commandes du profil, ADR-0011), marquée `atTurn`. Une fois reconnecté (« Réessayer » après une
 * étape dans le terminal, ou `authenticate`), la même session est rouverte et le message refusé
 * renvoyé une fois, sans que l'agent passe par « prêt » entre-temps. Rien de propre à un agent ici :
 * le profil dit s'il reconnaît le refus (`authAtTurn.pattern`, ou un autre code avec son motif :
 * Bob 2.0.9, fiche 200) et si sa clé d'API y répond.
 */
import type { AgentBlocker, AgentEvent, SessionControl } from '@shared/agent'
import { RequestError, type ContentBlock } from '../../shared/acp-sdk.mts'
import { modelControl } from './models-seen'
import { errorMessage } from './process-utils'
import type { AgentProfile } from './profiles'
import { currentModel } from './session-controls'

/** Message refusé, à renvoyer dans la même session une fois reconnecté. */
export interface BlockedTurn {
  sessionId: string
  blocks: ContentBlock[]
  /** Des outils avaient déjà tourné (dans ce tour ou un renvoi précédent du même message). */
  toolsRan?: boolean
}

export type AuthBlocker = Extract<AgentBlocker, { kind: 'auth' }>

/**
 * La carte d'un tour refusé, ou `undefined`. `blockerOf` : les refus de session reconnus comme à
 * l'ouverture (`sessionBlocker`). Ce n'est une connexion à refaire que si le message porte
 * l'indice du profil : avec `authRequired` (`authAtTurn.pattern`), ou avec l'un des autres codes
 * qu'il déclare (`authAtTurn.otherCodes`, code et motif ensemble) ; sinon, une erreur de tour
 * ordinaire (un `-32000` n'est pas toujours une connexion, un `-32603` encore moins). La clé
 * d'API n'est proposée que si le profil dit qu'elle y répond, ou si c'est le seul moyen.
 * `controls` : réglages de la session ; avec un réglage de catégorie `model`, la carte nomme le
 * modèle refusé (fiche 210 : souvent un fournisseur non connecté, pas toute la connexion).
 */
export function turnAuthBlocker(
  error: unknown,
  blockerOf: (error: unknown) => AgentBlocker | undefined,
  profile: Pick<AgentProfile, 'authAtTurn'>,
  controls: readonly SessionControl[] = []
): AuthBlocker | undefined {
  const rule = profile.authAtTurn
  if (!rule) return undefined
  const message = errorMessage(error)
  const code = typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : 0
  const other = rule.otherCodes?.some((o) => o.code === code && o.pattern.test(message)) === true
  // Autre code déclaré : lu comme un `authRequired` (mêmes méthodes, même clé d'API).
  const blocker = other
    ? blockerOf(RequestError.authRequired(undefined, message))
    : rule.pattern?.test(message) === true
      ? blockerOf(error)
      : undefined
  if (blocker?.kind !== 'auth') return undefined
  const { apiKey, ...rest } = blocker
  const keepKey = apiKey && (rule.apiKey === true || rest.methods.length === 0)
  const model = currentModel(controls)
  return { ...rest, ...(keepKey ? { apiKey } : {}), atTurn: true, ...(model ? { model } : {}) }
}

/** Avis du fil à la place de l'erreur brute (traduit à l'affichage, ADR-0014). */
export function authExpiredNotice(agent: string, model?: { name: string }): AgentEvent {
  return {
    type: 'notice',
    level: 'warning',
    message: model
      ? { key: 'agentHost.modelAuthRefused', params: { agent, model: model.name } }
      : { key: 'agentHost.authExpired', params: { agent } }
  }
}

/**
 * Le message refusé d'un hôte d'agent, de la carte jusqu'à son renvoi. Oublié dès que la carte
 * disparaît autrement (arrêt, autre message, session ouverte sans renvoi) : jamais un vieux message
 * rejoué dans une vieille session.
 */
export class TurnAuth {
  /**
   * Le réglage changé pendant la carte d'un tour refusé est-il le modèle (fiche 210) ? Alors le
   * message refusé repart aussitôt avec le nouveau modèle, dans la même session.
   */
  static retriesWithModel(
    blocker: AgentBlocker | undefined,
    controls: readonly SessionControl[],
    id: string
  ): boolean {
    return blocker?.kind === 'auth' && blocker.atTurn === true && modelControl(controls)?.id === id
  }

  /** Message refusé, tant que sa carte est là. */
  private blocked: BlockedTurn | undefined
  /** À renvoyer à la prochaine ouverture de session. */
  private pending: BlockedTurn | undefined
  /** Renvoi en cours : refusé de nouveau, ses outils comptent toujours. */
  private resent: BlockedTurn | undefined

  /** Tour refusé : la carte, avec `toolsRan` s'il y a eu des outils (renvois compris). */
  block(blocker: AuthBlocker, turn: BlockedTurn, toolCalls: number): AuthBlocker {
    const toolsRan = toolCalls > 0 || this.resent?.toolsRan === true
    this.blocked = { ...turn, toolsRan }
    this.resent = undefined
    return { ...blocker, ...(toolsRan ? { toolsRan: true as const } : {}) }
  }

  /**
   * Reconnecté : le message à renvoyer à la réouverture. Carte d'un tour : son message. Carte de
   * session pendant un renvoi (la réouverture elle-même refusée, N2) : le message en attente, gardé.
   */
  take(blocker: AgentBlocker | undefined): BlockedTurn | undefined {
    const turn = blocker?.kind === 'auth' && blocker.atTurn ? this.blocked : this.pending
    this.clear()
    return turn
  }

  /**
   * Autre modèle choisi sur la carte (fiche 210) : le message refusé, renvoyé tout de suite dans la
   * même session ; refusé de nouveau, ses outils comptent toujours.
   */
  resendNow(blocker: AgentBlocker | undefined): BlockedTurn | undefined {
    const turn = this.take(blocker)
    this.resent = turn
    return turn
  }

  expect(turn: BlockedTurn | undefined): void {
    this.pending = turn
  }

  /** Session à rouvrir pour ce renvoi seulement (sinon celle des options de l'hôte). */
  reopen(): { sessionId: string; keepTranscript: true } | undefined {
    return this.pending && { sessionId: this.pending.sessionId, keepTranscript: true }
  }

  /** Session ouverte : le message à renvoyer, s'il y en a un ; le reste est oublié. */
  opened(): BlockedTurn | undefined {
    const turn = this.pending
    this.blocked = undefined
    this.pending = undefined
    this.resent = turn
    return turn
  }

  /** Arrêt, ou nouveau message de l'utilisateur. */
  clear(): void {
    this.blocked = undefined
    this.pending = undefined
    this.resent = undefined
  }
}
