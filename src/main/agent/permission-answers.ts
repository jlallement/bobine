/**
 * Demandes d'autorisation auxquelles l'app répond seule (sorties de `agent-host.ts`) : les outils
 * de l'app qui n'agissent que dans l'app, et les outils « toujours autorisés » dans une
 * conversation précédente (fiche 042) quand la demande ne porte aucun risque (fiche 211). Le reste
 * est posé à l'utilisateur.
 */
import type { RequestPermissionRequest, RequestPermissionResponse } from '../../shared/acp-sdk.mts'
import { rememberableTool } from '@shared/permissions'
import { permissionRisks, type RiskContext } from './permission-risk'

export interface PermissionRules {
  /** Outil de l'app accordé d'office (question, panneau). */
  autoAllowed: (toolCall: RequestPermissionRequest['toolCall']) => boolean
  /** Outils « toujours autorisés » retenus pour ce profil (fiche 042). */
  remembered?: { has: (title: string) => boolean } | undefined
  /** Dossier de la conversation et dossier personnel, pour repérer les risques. */
  place: RiskContext
}

const selected = (optionId: string): RequestPermissionResponse => ({
  outcome: { outcome: 'selected', optionId }
})

/** Réponse de l'app sans l'utilisateur ; `undefined` : la demande lui est posée. */
export function automaticAnswer(
  params: RequestPermissionRequest,
  rules: PermissionRules
): RequestPermissionResponse | undefined {
  const allow = params.options.find((o) => o.kind === 'allow_once')
  if (allow && rules.autoAllowed(params.toolCall)) return selected(allow.optionId)
  const remembered = rememberableTool(params.toolCall)
  if (
    remembered &&
    rules.remembered?.has(remembered) &&
    permissionRisks(params.toolCall, rules.place).length === 0
  ) {
    const always = params.options.find((o) => o.kind === 'allow_always') ?? allow
    if (always) return selected(always.optionId)
  }
  return undefined
}
