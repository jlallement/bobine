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
 * Modèle indisponible (`modelRefusedAtTurn`, fiche 259) : la même carte, `model.unavailable`.
 */
export function turnAuthBlocker(
  error: unknown,
  blockerOf: (error: unknown) => AgentBlocker | undefined,
  profile: Pick<AgentProfile, 'authAtTurn' | 'modelRefusedAtTurn'>,
  controls: readonly SessionControl[] = []
): AuthBlocker | undefined {
  const rule = profile.authAtTurn
  const message = errorMessage(error)
  const code = typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : 0
  const unavailable = unavailableModel(profile, code, rawMessage(error), controls)
  const other = rule?.otherCodes?.some((o) => o.code === code && o.pattern.test(message)) === true
  // Autre code déclaré, ou modèle indisponible : lu comme un `authRequired` (mêmes méthodes, même
  // clé d'API), pour la carte de tour et ses gestes (autre modèle, connexion, « Réessayer »).
  const found =
    unavailable || other
      ? blockerOf(RequestError.authRequired(undefined, message))
      : rule?.pattern?.test(message) === true
        ? blockerOf(error)
        : undefined
  // Modèle indisponible chez un agent sans moyen de connexion annoncé : la carte quand même, pour
  // choisir un autre modèle ou réessayer ; ce n'est pas une connexion qui manque.
  const blocker = found ?? (unavailable ? NO_SIGN_IN : undefined)
  if (blocker?.kind !== 'auth') return undefined
  const { apiKey, ...rest } = blocker
  const keepKey = apiKey && (rule?.apiKey === true || rest.methods.length === 0)
  const model = unavailable
    ? { ...unavailable, unavailable: true as const }
    : currentModel(controls)
  return { ...rest, ...(keepKey ? { apiKey } : {}), atTurn: true, ...(model ? { model } : {}) }
}

const NO_SIGN_IN: AuthBlocker = { kind: 'auth', methods: [], authenticating: false }

/** Le message de l'erreur, sans le détail de `data` qu'`errorMessage` y ajoute. */
function rawMessage(error: unknown): string {
  const message =
    typeof error === 'object' && error !== null
      ? (error as { message?: unknown }).message
      : undefined
  return typeof message === 'string' ? message : errorMessage(error)
}

/**
 * Le modèle de la session, si l'agent vient de le dire indisponible (`modelRefusedAtTurn` du
 * profil) : code et motif ensemble, et l'identifiant du message égal, entier, à celui du modèle
 * de la session. Sans réglage de modèle, ou pour un autre modèle (celui d'un sous-agent…) : rien,
 * l'erreur reste une erreur de tour ordinaire.
 */
function unavailableModel(
  profile: Pick<AgentProfile, 'modelRefusedAtTurn'>,
  code: unknown,
  message: string,
  controls: readonly SessionControl[]
): { id: string; name: string; quota?: true } | undefined {
  const rule = profile.modelRefusedAtTurn
  if (!rule || rule.code !== code) return undefined
  const model = currentModel(controls)
  // Quota gratuit épuisé (fiche 267) : le modèle de la session, que le message ne nomme pas.
  if (rule.quota?.test(message.trim())) return model ? { ...model, quota: true } : undefined
  const named = rule.pattern.exec(message)?.[1]
  if (named) return model?.id === named ? model : undefined
  // Nommé sans fournisseur (E6) : le nom entier, après le dernier « / » du modèle de la session.
  const bare = rule.unqualified?.exec(message.trim())?.[1]
  const tail = model?.id.slice(model.id.lastIndexOf('/') + 1)
  return bare && tail === bare ? model : undefined
}

/** Avis du fil à la place de l'erreur brute (traduit à l'affichage, ADR-0014). */
export function authExpiredNotice(
  agent: string,
  model?: { name: string; unavailable?: true; quota?: true }
): AgentEvent {
  return {
    type: 'notice',
    level: 'warning',
    message: model
      ? {
          key: model.quota
            ? 'agentHost.modelQuota'
            : model.unavailable
              ? 'agentHost.modelUnavailable'
              : 'agentHost.modelAuthRefused',
          params: { agent, model: model.name }
        }
      : { key: 'agentHost.authExpired', params: { agent } },
    // Vrai jusqu'à la réponse suivante de l'agent : retiré par elle (fiche 259, D6).
    refusal: true
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
