/**
 * Demandes de l'agent en attente de l'utilisateur : autorisations (`session/request_permission`)
 * et formulaires ou pages (élicitations, y compris les questions des outils de l'app). Chaque
 * demande est émise vers l'interface, puis résolue une seule fois par la réponse de l'utilisateur
 * ou par une annulation (Stop, arrêt de l'agent).
 */
import type {
  CreateElicitationResponse,
  PermissionOption,
  RequestPermissionRequest,
  RequestPermissionResponse
} from '../../shared/acp-sdk.mts'
import type { AgentEvent, ElicitationAnswer, ElicitationPrompt } from '@shared/agent'
import { validateElicitationContent } from '@shared/elicitation'
import type { PermissionRisk } from '@shared/permissions'
import { safeUrl } from './process-utils'
import { t } from 'i18next'

const MAX_WITHDRAWN = 50

/** Code JSON-RPC « requête annulée » (ACP, `$/cancel_request`) : la raison de l'abandon du signal. */
const REQUEST_CANCELLED = -32800
const requestCancelled = (reason: unknown): boolean =>
  typeof reason === 'object' &&
  reason !== null &&
  (reason as { code?: unknown }).code === REQUEST_CANCELLED

interface PendingPermission {
  toolCall: RequestPermissionRequest['toolCall']
  options: PermissionOption[]
  risks: PermissionRisk[]
  resolve: (response: RequestPermissionResponse) => void
}

interface PendingElicitation {
  prompt: ElicitationPrompt
  resolve: (response: CreateElicitationResponse) => void
}

export class PendingRequests {
  private readonly permissions = new Map<string, PendingPermission>()
  private readonly elicitations = new Map<string, PendingElicitation>()
  /** Demandes retirées par l'agent : une réponse de l'utilisateur qui les croise n'est pas une erreur. */
  private readonly withdrawn = new Set<string>()
  private nextPermission = 1
  private nextElicitation = 1
  private readonly emit: (event: AgentEvent) => void
  private readonly openExternal: ((url: string) => void) | undefined

  constructor(emit: (event: AgentEvent) => void, openExternal?: (url: string) => void) {
    this.emit = emit
    this.openExternal = openExternal
  }

  /**
   * Autorisation demandée par l'agent : affichée dans la carte de l'outil, avec ce qu'elle a de
   * risqué (fiche 211). `signal` : la requête ACP, abandonnée quand l'agent l'annule
   * (`$/cancel_request`, fiche 214) ; la demande est alors retirée sans attendre l'utilisateur.
   */
  permission(
    params: RequestPermissionRequest,
    risks: PermissionRisk[] = [],
    signal?: AbortSignal
  ): Promise<RequestPermissionResponse> {
    const requestId = `permission-${this.nextPermission++}`
    return new Promise((resolve) => {
      this.permissions.set(requestId, {
        toolCall: params.toolCall,
        options: params.options,
        risks,
        resolve
      })
      this.emit({
        type: 'permission-request',
        requestId,
        toolCall: params.toolCall,
        options: params.options,
        ...(risks.length > 0 ? { risks } : {})
      })
      if (!signal) return
      // Seule l'annulation de CETTE requête compte (code -32800, `$/cancel_request`) : la
      // connexion qui se ferme (agent mort) abandonne aussi le signal, et c'est `cancelAll` qui
      // ferme alors la demande, comme avant.
      const withdraw = () => {
        if (requestCancelled(signal.reason)) this.withdrawPermission(requestId)
      }
      if (signal.aborted) withdraw()
      else signal.addEventListener('abort', withdraw, { once: true })
    })
  }

  /**
   * L'agent retire sa demande (`$/cancel_request`) : plus en attente, carte fermée « par l'agent »,
   * réponse `cancelled` (permise par ACP). Sans effet si la demande est déjà traitée.
   */
  private withdrawPermission(requestId: string): void {
    const pending = this.permissions.get(requestId)
    if (!pending) return
    this.permissions.delete(requestId)
    this.withdrawn.add(requestId)
    // Borné : on ne garde que les plus récentes (une réponse tardive vient en quelques secondes).
    if (this.withdrawn.size > MAX_WITHDRAWN) {
      this.withdrawn.delete(this.withdrawn.values().next().value as string)
    }
    this.emit({ type: 'permission-resolved', requestId, optionId: null, cancelledBy: 'agent' })
    pending.resolve({ outcome: { outcome: 'cancelled' } })
  }

  /** Formulaire ou page demandés à l'utilisateur ; la réponse résout la promesse. */
  elicitation(prompt: ElicitationPrompt): Promise<CreateElicitationResponse> {
    const requestId = `elicitation-${this.nextElicitation++}`
    return new Promise((resolve) => {
      this.elicitations.set(requestId, { prompt, resolve })
      this.emit({ type: 'elicitation-request', requestId, prompt })
    })
  }

  /** Demande en attente : l'appel d'outil concerné et l'option choisie (avant d'y répondre). */
  permissionChoice(
    requestId: string,
    optionId: string | null
  ):
    | {
        toolCall: RequestPermissionRequest['toolCall']
        option?: PermissionOption
        risks: PermissionRisk[]
      }
    | undefined {
    const pending = this.permissions.get(requestId)
    if (!pending) return undefined
    const option = pending.options.find((o) => o.optionId === optionId)
    return { toolCall: pending.toolCall, risks: pending.risks, ...(option ? { option } : {}) }
  }

  /** Réponse de l'utilisateur à une demande de permission (`null` = annuler). */
  respondPermission(requestId: string, optionId: string | null): void {
    const pending = this.permissions.get(requestId)
    // Retirée par l'agent entre-temps : rien à envoyer, rien à dire (la carte est déjà fermée).
    if (!pending && this.withdrawn.has(requestId)) return
    if (!pending) throw new Error(t('requests.unknownPermission'))
    if (optionId !== null && !pending.options.some((o) => o.optionId === optionId)) {
      throw new Error(t('requests.unknownOption', { option: optionId }))
    }
    this.permissions.delete(requestId)
    this.emit({ type: 'permission-resolved', requestId, optionId })
    pending.resolve(
      optionId === null
        ? { outcome: { outcome: 'cancelled' } }
        : { outcome: { outcome: 'selected', optionId } }
    )
  }

  /** Réponse de l'utilisateur à un formulaire ou une page demandés par l'agent. */
  respondElicitation(requestId: string, answer: ElicitationAnswer): void {
    const pending = this.elicitations.get(requestId)
    if (!pending) throw new Error(t('requests.unknownElicitation'))
    let response: CreateElicitationResponse
    let accepted: Record<string, unknown> | undefined
    if (answer.action === 'accept') {
      if (pending.prompt.mode === 'form') {
        // Le main fait autorité : rien de non conforme au schéma ne part vers l'agent.
        const result = validateElicitationContent(pending.prompt.schema, answer.content ?? {})
        if (!result.ok) {
          const details = Object.entries(result.errors).map(([k, v]) => `${k} : ${v}`)
          throw new Error(`Formulaire invalide — ${details.join(' ; ')}`)
        }
        response = { action: 'accept', content: result.content }
        accepted = result.content
      } else {
        const url = safeUrl(pending.prompt.url)
        if (!url) throw new Error(t('requests.badLink'))
        this.openExternal?.(url)
        response = { action: 'accept' }
      }
    } else if (answer.action === 'decline' || answer.action === 'cancel') {
      response = { action: answer.action }
    } else {
      throw new Error('Réponse invalide')
    }
    this.elicitations.delete(requestId)
    this.emit({
      type: 'elicitation-resolved',
      requestId,
      action: answer.action,
      ...(accepted ? { content: accepted } : {})
    })
    pending.resolve(response)
  }

  /** Tout ce qui attend encore est annulé (Stop, arrêt de l'agent). */
  /** Une autorisation ou une question attend la réponse de l'utilisateur. */
  waiting(): boolean {
    return this.permissions.size > 0 || this.elicitations.size > 0
  }

  cancelAll(): void {
    for (const requestId of [...this.permissions.keys()]) this.respondPermission(requestId, null)
    for (const requestId of [...this.elicitations.keys()]) {
      this.respondElicitation(requestId, { action: 'cancel' })
    }
  }
}
