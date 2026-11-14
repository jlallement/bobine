/**
 * Demandes d'autorisation auxquelles l'app répond seule (sorties de `agent-host.ts`) : les outils
 * de l'app qui n'agissent que dans l'app, et les outils « toujours autorisés » dans une
 * conversation précédente (fiche 042) quand la demande ne porte aucun risque (fiche 211). Le reste
 * est posé à l'utilisateur.
 *
 * Fille d'un rôle en lecture seule (fiche 223) : toute demande d'écrire (modifier, supprimer,
 * déplacer un fichier, changer de mode) est refusée d'abord, avant tout accord d'office ; les
 * commandes restent posées à l'utilisateur (une relecture lance `git diff`, les tests). Un agent
 * qui écrit sans demander n'est pas arrêté ici : voir `roles/read-only-watch.ts`.
 */
import type { RequestPermissionRequest, RequestPermissionResponse } from '../../shared/acp-sdk.mts'
import type { AgentEvent } from '@shared/agent'
import { rememberableTool } from '@shared/permissions'
import { permissionRisks, type RiskContext } from './permission-risk'

export interface PermissionRules {
  /** Outil de l'app accordé d'office (question, panneau). */
  autoAllowed: (toolCall: RequestPermissionRequest['toolCall']) => boolean
  /** Outils « toujours autorisés » retenus pour ce profil (fiche 042). */
  remembered?: { has: (title: string) => boolean } | undefined
  /** Dossier de la conversation et dossier personnel, pour repérer les risques. */
  place: RiskContext
  /** Rôle en lecture seule (fiche 223) : écritures refusées, `onRefused` prévenu. */
  readOnly?: boolean | undefined
  onRefused?: (toolCall: RequestPermissionRequest['toolCall']) => void
}

/** Genres ACP refusés à un rôle en lecture seule. */
export const READ_ONLY_REFUSED: ReadonlySet<string> = new Set([
  'edit',
  'delete',
  'move',
  'switch_mode'
])

/** Ligne du fil qui dit le refus d'une écriture à un rôle en lecture seule. */
export function readOnlyRefusal(toolCall: RequestPermissionRequest['toolCall']): AgentEvent {
  return {
    type: 'notice',
    level: 'warning',
    message: {
      key: 'roles.notice.writeRefused',
      params: { tool: toolCall.title ?? toolCall.kind ?? '' }
    }
  }
}

const selected = (optionId: string): RequestPermissionResponse => ({
  outcome: { outcome: 'selected', optionId }
})

/** Réponse de l'app sans l'utilisateur ; `undefined` : la demande lui est posée. */
export function automaticAnswer(
  params: RequestPermissionRequest,
  rules: PermissionRules
): RequestPermissionResponse | undefined {
  if (rules.readOnly && READ_ONLY_REFUSED.has(params.toolCall.kind ?? '')) {
    const reject =
      params.options.find((o) => o.kind === 'reject_once') ??
      params.options.find((o) => o.kind === 'reject_always')
    rules.onRefused?.(params.toolCall)
    return reject ? selected(reject.optionId) : { outcome: { outcome: 'cancelled' } }
  }
  const allow = params.options.find((o) => o.kind === 'allow_once')
  if (allow && rules.autoAllowed(params.toolCall)) return selected(allow.optionId)
  // Fille en lecture seule : aucun accord « toujours » ne vaut, tout est demandé.
  const remembered = rules.readOnly ? undefined : rememberableTool(params.toolCall)
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

/** Option « une fois » qui répond à la place d'une option « toujours » de même sens. */
const ONCE = { allow_always: 'allow_once', reject_always: 'reject_once' } as const

/**
 * Demande posée à l'utilisateur pour une fille en lecture seule (fiche 223) : aucun accord
 * « toujours » ne vaut pour elle, donc les options `allow_always` / `reject_always` de l'agent ne
 * sont pas proposées quand une option « une fois » de même sens existe ; une réponse « toujours »
 * qui arriverait quand même part en « une fois ». Autre conversation : la demande telle quelle.
 */
export function askReadOnly(
  params: RequestPermissionRequest,
  readOnly: boolean | undefined,
  ask: (asked: RequestPermissionRequest) => Promise<RequestPermissionResponse>
): Promise<RequestPermissionResponse> {
  if (!readOnly) return ask(params)
  const onceOf = (kind: string) =>
    kind in ONCE
      ? params.options.find((o) => o.kind === ONCE[kind as keyof typeof ONCE])
      : undefined
  const options = params.options.filter((o) => !onceOf(o.kind))
  return ask({ ...params, options }).then((answer) => {
    if (answer.outcome.outcome !== 'selected') return answer
    const { optionId } = answer.outcome
    const chosen = params.options.find((o) => o.optionId === optionId)
    const once = chosen ? onceOf(chosen.kind) : undefined
    return once ? selected(once.optionId) : answer
  })
}
