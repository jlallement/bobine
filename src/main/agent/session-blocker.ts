/**
 * Refus de session qui appelle une action de l'utilisateur (fiches 022, 041) : connexion, licence
 * à accepter, dossier à approuver. Reconnus d'après le code JSON-RPC ou les motifs du profil
 * (ADR-0011) ; pur, sorti d'`AgentHost`.
 */
import { RequestError } from '../../shared/acp-sdk.mts'
import type { AgentBlocker, ApiKeyInfo, TerminalStep } from '@shared/agent'
import { errorMessage } from './process-utils'
import type { AgentProfile } from './profiles'

/** Connexion requise : code ACP standard (`RequestError.authRequired`). */
const AUTH_REQUIRED = RequestError.authRequired().code

export interface BlockerContext {
  profile: Pick<AgentProfile, 'license' | 'trust' | 'authMethodLabels'>
  /** Méthodes de connexion annoncées par l'agent à `initialize`. */
  authMethods: { id: string; name: string; description?: string }[]
  apiKey: ApiKeyInfo | undefined
  /** Commande du profil proposée dans le terminal de l'app. */
  step: (id: string) => TerminalStep | undefined
  /** L'agent a été lancé avec des options en plus (approbation pour la session déjà donnée). */
  extraArgs: boolean
}

/** Le refus de session que montre l'app, ou `undefined` pour une erreur ordinaire. */
export function sessionBlocker(error: unknown, ctx: BlockerContext): AgentBlocker | undefined {
  const code = (error as { code?: unknown }).code
  const { profile, apiKey } = ctx
  if (code === AUTH_REQUIRED && (ctx.authMethods.length > 0 || apiKey)) {
    return {
      kind: 'auth',
      methods: ctx.authMethods.map((announced) => {
        // Libellé traduit déclaré par le profil (fiche 205), sinon le nom donné par l'agent.
        const label = profile.authMethodLabels?.[announced.id]?.label
        const method = label ? { ...announced, name: label } : announced
        const step = ctx.step(method.id)
        return step ? { ...method, step } : method
      }),
      ...(apiKey ? { apiKey } : {}),
      authenticating: false
    }
  }
  const message = errorMessage(error)
  // Licence non acceptée (Bob : `-32600` « A license agreement is required… »).
  if (profile.license?.pattern.test(message)) {
    return {
      kind: 'license',
      message,
      steps: profile.license.steps.flatMap((id) => ctx.step(id) ?? [])
    }
  }
  // Dossier non approuvé (Bob : pas de code dédié, on reconnaît son message).
  const trust = profile.trust
  if (trust?.pattern.test(message)) {
    return {
      kind: 'trust',
      message,
      canTrustForSession: !!trust.flag && !ctx.extraArgs,
      trustRemembered: trust.remembered === true,
      ...(trust.approveCommand ? { approveCommand: trust.approveCommand } : {})
    }
  }
  return undefined
}
