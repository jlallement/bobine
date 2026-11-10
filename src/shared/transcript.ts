/**
 * Fil de conversation : réducteur pur qui transforme les `AgentEvent` en éléments affichables.
 * Toute la logique d'assemblage (streaming, fusion des appels d'outil…) vit ici, pas dans l'UI.
 */
import { haltMessage } from './halt-notice'
import type { AppToolLabel } from './app-tools'
import { planOf, toolInputOf, type ToolInput } from './tool-label'
import { withCommand, type ToolCommand } from './command-view'
import { withTodos, type TodoItem } from './todos'
import type { ToolArg } from './tool-args'
import { pendingWith, type ToolPermission } from './permissions'
import { t, type ParseKeys } from 'i18next'
import { isMessage, translate, type Message } from './i18n/message'
import type {
  PlanEntry,
  SessionUpdate,
  StopReason,
  ToolCallContent,
  ToolCallLocation,
  ToolCallStatus,
  ToolKind
} from './acp-sdk.mts'
import type {
  AgentEvent,
  ElicitationAction,
  ElicitationPrompt,
  NoticeLevel,
  ToolImage,
  ToolOutcome
} from './agent'
import { endTurn, nextSession, startTurn, withAsideCost, withContext, withCost } from './usage'
import type { ConversationUsage } from './usage'
import { attachmentOf, type AttachmentView } from './attachments'
import { applyTerminalPatch, terminalPatchOf, type TerminalState } from './terminal-output'
import { withSubagent, type Subagent, type SubagentRun } from './subagent'
import { markResent, replayTail } from './replay-tail'
import { renewalPending } from './session-renewal'
import type * as Children from './children'
import { reduceMemoryProposal } from './memory'
import { reduceCostCap, type ConversationCap, type CostCapCard } from './cost-cap'
import {
  reduceTurnLimitAnswer,
  supersedeTurnLimits,
  turnLimitCard,
  type TurnLimitCard
} from './turn-limit'
import { reduceChildrenMerge, type ChildrenMerge } from './children-merge'
import { reduceReview } from './review'
import type { Handover } from './handover'
import type { WorktreeStart } from './worktree-cycle'
import { reduceWorktreeSetup, type WorktreeSetup } from './worktree-setup'
import { contentOrKept } from './tool-call-kept'
import { compactionReply } from './compaction-reply'
export { withSubagentWork } from './subagent'

export type TranscriptItem =
  | {
      kind: 'user'
      id: number
      text: string
      attachments?: AttachmentView[]
      /** Mode actif à l'envoi (fiche 040). */
      mode?: { id: string; name: string }
      /** Modèle de la session à l'envoi, s'il est connu (fiche 130). */
      model?: { id: string; name: string }
      /** Heure d'envoi (ms), affichée au survol ; absente pour un fil rejoué par l'agent. */
      at?: number
      /** Message d'une autre conversation, ou réveil de la mère (fiche 097). */
      from?: Children.MessageOrigin
      /** Commande de compaction de la session (fiches 126, 140). */
      compaction?: true
      /** Renvoyé après un refus de connexion (D10) : l'agent a pu le recevoir `1 + resent` fois. */
      resent?: number
    }
  | {
      kind: 'agent'
      id: number
      text: string
      /** Heure de fin de la réponse (ms), affichée au survol. */
      at?: number
    }
  | { kind: 'thought'; id: number; text: string }
  | {
      kind: 'tool'
      id: number
      toolCallId: string
      title: string
      toolKind?: ToolKind
      /**
       * `cancelled` : l'outil n'a pas abouti parce que le tour s'est arrêté avant ; `refused` :
       * l'utilisateur l'a refusé (fiche 122).
       */
      status: ToolCallStatus | 'cancelled' | 'refused'
      /**
       * Issue vue par l'app (outil de l'app refusé ou en erreur, autorisation refusée, fiche 122) :
       * elle l'emporte sur la fin annoncée par l'agent, et sur « interrompu » en fin de tour.
       */
      outcome?: ToolOutcome
      content: ToolCallContent[]
      locations: ToolCallLocation[]
      /** Cible lue dans `rawInput` (chemin, motif, adresse, commande) : libellé lisible, fiche 107. */
      input?: ToolInput
      /** Commande entière de `rawInput` (`command`, `cmd`) et son dossier : à lire avant d'autoriser. */
      command?: ToolCommand
      /** Plan à valider porté par `rawInput.plan` (sortie du mode plan de Codex, Claude Code). */
      plan?: string
      /**
       * Tâches de `rawInput.todos` (liste de tâches : texte à cases de Bob, ou tableau ; fiche 214) ;
       * absent si l'appel n'en porte pas. Lu pour toute carte, sans regarder le titre ni le genre.
       */
      todos?: TodoItem[]
      /** Arguments d'un outil `other` (MCP, skill…) lus dans `rawInput`, pour la carte d'autorisation (fiche 214). */
      args?: ToolArg[]
      /** L'outil lance un sous-agent (Bob, OpenCode : voir `subagent.ts`). */
      subagent?: Subagent
      /** Ce que l'app a vu du sous-agent en direct : début, fin, coût (fiche 053). */
      subagentRun?: SubagentRun
      /**
       * Travail du sous-agent reçu en direct (OpenCode 2, fiche 078) : ses outils et ses messages,
       * sans sa réflexion. Absent si l'agent ne le transmet pas.
       */
      work?: TranscriptItem[]
      /** Terminal dont la sortie est affichée avec l'outil (voir `terminals`). */
      terminalId?: string
      /** Images renvoyées par un outil de l'app (captures), que l'agent ne retransmet pas. */
      images?: ToolImage[]
      /** Outil de l'app : ce qu'il fait, en clair (fiche 047), à la place du titre de l'agent. */
      appTool?: AppToolLabel
      /**
       * Tous les outils de l'app appelés par cette carte, dans l'ordre, quand il y en a plusieurs
       * (du code qui les appelle, `execute` d'OpenCode 2, fiche 079) ; `appTool` reste le premier.
       */
      appTools?: AppToolLabel[]
      permission?: ToolPermission
    }
  | { kind: 'plan'; id: number; entries: PlanEntry[] }
  | {
      kind: 'notice'
      id: number
      level: NoticeLevel
      /** Ce que dit l'app, en code (ADR-0014) : traduit à l'affichage, voir `noticeText`. */
      message?: Message
      /** Texte tel quel : avis d'avant la fiche 074, ou texte venu de l'agent. */
      text?: string
      /** Titre de l'encadré (sortie de `/context`, `/cost`, fiche 126). */
      title?: string
      /** Lien à la suite du texte (fiche 198). */
      link?: Extract<AgentEvent, { type: 'notice' }>['link']
    }
  | {
      kind: 'elicitation'
      id: number
      requestId: string
      prompt: ElicitationPrompt
      state: 'pending' | ElicitationAction
      /** Contenu envoyé à l'agent (formulaire accepté), pour le résumé dans le fil. */
      content?: Record<string, unknown>
    }
  | {
      /** Début d'une branche (fiche 023) : ce qui précède est repris de la conversation d'origine. */
      kind: 'branch'
      id: number
      fromId: string
      fromTitle: string
      /** Fichiers remis dans leur état d'alors, et ceux laissés tels quels (modifiés depuis). */
      restored: number
      skipped: number
    }
  /** Conversation fille lancée depuis celle-ci (fiche 097) : ancre de la carte « Sous-tâches ». */
  | ({ kind: 'child-started'; id: number } & Children.ChildStart)
  /** Consigne adressée à une fille existante (fiche 150). */
  | ({ kind: 'child-instruction'; id: number } & Children.ChildInstruction)
  /** Compte rendu d'une conversation fille à la fin d'un de ses tours (fiche 097). */
  | ({ kind: 'child-report'; id: number } & Children.ChildReport)
  /** Recommandation de fusion d'une fille par l'agent de la mère (fiche 160). */
  | ({ kind: 'child-recommendation'; id: number } & Children.ChildRecommendation)
  /** La conversation continue avec un autre agent, dans une nouvelle session (fiche 108). */
  /**
   * `resent` : le message d'avant la bascule, refusé faute de connexion, renvoyé à la session neuve
   * (D10) ; elle l'a reçu sans qu'il soit répété dans le fil.
   */
  | ({ kind: 'handover'; id: number; resent?: number } & Handover)
  /**
   * Départ du worktree de la conversation (fiche 117). Les fils d'avant gardent leurs deux avis
   * (`notice` de clés `worktrees.notice.*`, fiche 110).
   */
  | ({ kind: 'worktree-start'; id: number } & WorktreeStart)
  /** Préparation du worktree (fiche 175) : un seul élément, remplacé à chaque étape. */
  | ({ kind: 'worktree-setup'; id: number } & WorktreeSetup)
  /**
   * Fusion enchaînée des filles (fiche 120) : un seul élément par fusion, remplacé à chaque étape ;
   * pas affiché à sa place, la carte « Sous-tâches » le lit.
   */
  | ({ kind: 'children-merge'; id: number } & ChildrenMerge)
  /** Relecture de ce travail par une autre conversation (fiche 177) : une carte, remplacée. */
  | ({ kind: 'review'; id: number } & import('./review').Review)
  /** Plafond de coût franchi (fiche 157) : « Continuer » ou « Arrêter », puis la réponse. */
  | ({ kind: 'cost-cap'; id: number } & CostCapCard)
  /** Tour arrêté par la limite d'étapes de l'agent (fiche 209) : la carte, puis la réponse. */
  | ({ kind: 'turn-limit'; id: number } & TurnLimitCard)
  /** Proposition de l'agent de retenir ou d'oublier un souvenir (fiche 182) : une carte, remplacée. */
  | ({ kind: 'memory-proposal'; id: number } & import('./memory').MemoryProposal)
  | {
      /** L'agent a résumé l'échange pour libérer du contexte (`compaction_update`). */
      kind: 'compaction'
      id: number
      compactionId: string
      status: string
      summary: string
      error?: string
    }

export type { ToolPermission }

export interface TranscriptState {
  items: TranscriptItem[]
  nextId: number
  /** Consommation rapportée par l'agent (contexte, coût, jetons cumulés). */
  usage?: ConversationUsage
  /** Sortie des commandes de l'agent, par terminal. */
  terminals?: Record<string, TerminalState>
  /** L'utilisateur a arrêté le tour en cours (`cancel-requested`), jusqu'à sa fin. */
  cancelling?: true
  /** Plafond de coût de la conversation (fiche 157, ADR-0035) ; absent : aucun. */
  costCap?: ConversationCap
  /**
   * Dernier arrêt annoncé (`exited` ou `error`, avec son détail) : le même statut répété (instantané
   * réémis après l'arrêt, fiche 194) n'ajoute pas un second avis. Effacé par tout autre statut.
   */
  halted?: { status: string; detail: string | undefined } | undefined
  /** Jetons estimés de l'index de la mémoire joint à la session en cours (fiche 182). */
  memoryTokens?: number
}

/** Images gardées par carte d'outil. */
const MAX_TOOL_IMAGES = 4

export const emptyTranscript: TranscriptState = { items: [], nextId: 1 }

type NewItem = TranscriptItem extends infer T
  ? T extends TranscriptItem
    ? Omit<T, 'id'>
    : never
  : never

function push(state: TranscriptState, item: NewItem): TranscriptState {
  return {
    ...state,
    items: [...state.items, { ...item, id: state.nextId } as TranscriptItem],
    nextId: state.nextId + 1
  }
}

function replaceAt(
  state: TranscriptState,
  index: number,
  update: (current: TranscriptItem) => TranscriptItem
): TranscriptState {
  const current = state.items[index]
  if (!current) return state
  const items = state.items.slice()
  items[index] = update(current)
  return { ...state, items }
}

/** Index du dernier message utilisateur (début du tour courant), -1 s'il n'y en a pas. */
function turnStart(items: TranscriptItem[]): number {
  for (let i = items.length - 1; i >= 0; i--) if (items[i]?.kind === 'user') return i
  return -1
}

const STOP_MESSAGES: Partial<Record<StopReason, ParseKeys>> = {
  cancelled: 'transcript.notice.cancelled',
  refusal: 'transcript.notice.refusal',
  max_tokens: 'transcript.notice.maxTokens'
  // `max_turn_requests` : une carte (fiche 209) ; l'avis `transcript.notice.maxTurnRequests` reste
  // dans les fils d'avant.
}

const withoutCancelling = ({ cancelling: _done, ...state }: TranscriptState): TranscriptState =>
  state

/**
 * Statut d'une carte mise à jour. L'issue vue par l'app (refusé, échec, fiche 122) l'emporte ;
 * sinon, un outil en cours qui échoue après que l'utilisateur a arrêté le tour (OpenCode : « Tool
 * execution interrupted ») est interrompu, pas en échec (fiche 126).
 */
function toolStatus(
  state: TranscriptState,
  tool: ToolItem,
  next: ToolCallStatus | null | undefined
): ToolItem['status'] {
  if (tool.outcome) return finalStatus(next ?? tool.status, tool.outcome)
  if (!next) return tool.status
  const running = tool.status === 'pending' || tool.status === 'in_progress'
  return state.cancelling && running && next === 'failed' ? 'cancelled' : next
}

/** Tour en échec : compté s'il avait commencé (un message envoyé), sans jetons. */
const withEndedTurn = (state: TranscriptState): TranscriptState =>
  state.usage?.pending ? { ...state, usage: endTurn(state.usage) } : state

/** Texte d'un avis du fil, dans la langue courante. */
export const noticeText = (notice: { message?: Message; text?: string }): string =>
  notice.message ? translate(notice.message) : (notice.text ?? '')

function findCompaction(items: TranscriptItem[], compactionId: string): number {
  return items.findLastIndex(
    (item) => item.kind === 'compaction' && item.compactionId === compactionId
  )
}

/** Texte de blocs de contenu (les autres types sont signalés entre crochets). */
function blocksText(blocks: { type: string; text?: string }[]): string {
  return blocks.map((b) => (b.type === 'text' ? (b.text ?? '') : `[${b.type}]`)).join('')
}

// eslint-disable-next-line complexity -- un cas par type d'évènement : un switch long mais lisible (fiche 089)
export function reduceTranscript(state: TranscriptState, event: AgentEvent): TranscriptState {
  switch (event.type) {
    case 'reset':
      // Rejeu d'une session rechargée : le fil est reconstruit, la consommation cumulée et le
      // plafond restent.
      return {
        ...emptyTranscript,
        ...(state.usage ? { usage: state.usage } : {}),
        ...(state.costCap ? { costCap: state.costCap } : {})
      }
    case 'cancel-requested':
      return { ...state, cancelling: true }
    case 'user-message':
      return push(
        {
          ...supersedeTurnLimits(withoutCancelling(state)),
          usage: startTurn(state.usage ?? {}, event.model)
        },
        {
          kind: 'user',
          text: event.text,
          ...(event.attachments?.length ? { attachments: event.attachments } : {}),
          ...(event.mode ? { mode: event.mode } : {}),
          ...(event.model ? { model: event.model } : {}),
          ...(event.at ? { at: event.at } : {}),
          ...(event.from ? { from: event.from } : {}),
          ...(event.compaction ? { compaction: true as const } : {})
        }
      )
    case 'update':
      return applyUpdate(state, event.update)
    case 'resent':
      return markResent(state, event.fresh === true)
    case 'replayed': {
      // Fil gardé (fiche 103) : seuls les tours que le fil n'a pas sont ajoutés, avec un avis.
      const tail = replayTail(state.items, event.items)
      if (tail.length === 0) return state
      const noticed = push(state, {
        kind: 'notice',
        level: 'info',
        message: {
          key: 'transcript.notice.continuedElsewhere',
          params: { count: tail.filter((item) => item.kind === 'user').length }
        }
      })
      return tail.reduce((acc, { id: _id, ...item }) => push(acc, item as NewItem), noticed)
    }
    case 'turn-end': {
      // Chaque tour est compté (fiche 109), même sans jetons : son coût peut venir d'ailleurs.
      const counted = {
        ...withoutCancelling(state),
        usage: endTurn(state.usage ?? {}, event.usage, event.at)
      }
      const ended = compactionReply(
        stampReplies(closeUnfinishedTools(counted, true), event.at),
        event.stopReason
      )
      if (event.stopReason === 'max_turn_requests') {
        return push(supersedeTurnLimits(ended), {
          kind: 'turn-limit',
          ...turnLimitCard(event.limit)
        })
      }
      const key = STOP_MESSAGES[event.stopReason]
      return key ? push(ended, { kind: 'notice', level: 'info', message: { key } }) : ended
    }
    case 'attempt-failed':
      // La nouvelle tentative repart de zéro : ce que l'agent avait commencé ne finira pas.
      return closeUnfinishedTools(state, true)
    case 'turn-error':
      return push(closeUnfinishedTools(withEndedTurn(withoutCancelling(state)), true), {
        kind: 'notice',
        level: 'error',
        message: { key: 'transcript.notice.error', params: { message: event.message } }
      })
    case 'notice':
      return push(state, {
        kind: 'notice',
        level: event.level,
        ...(isMessage(event.message) ? { message: event.message } : { text: event.message }),
        ...(event.title ? { title: event.title } : {}),
        ...(event.link ? { link: event.link } : {})
      })
    case 'usage-report':
      return { ...state, usage: withCost(state.usage ?? {}, event.cost) }
    case 'aside-cost':
      return { ...state, usage: withAsideCost(state.usage, event.cost) }
    case 'memory-context':
      return { ...state, memoryTokens: event.tokens }
    case 'cost-cap-set':
    case 'cost-cap-reached':
    case 'cost-cap-answer':
      return reduceCostCap(state, event)
    case 'turn-limit-answer':
      return reduceTurnLimitAnswer(state, event)
    case 'child-started':
      return push(state, { kind: 'child-started', ...event.child })
    case 'child-instruction':
      return push(state, { kind: 'child-instruction', ...event.instruction })
    case 'child-report':
      return push(state, { kind: 'child-report', ...event.report })
    case 'child-recommendation':
      return push(state, { kind: 'child-recommendation', ...event.recommendation })
    case 'worktree-start':
      return push(state, { kind: 'worktree-start', ...event.start })
    case 'worktree-setup':
      return reduceWorktreeSetup(state, event.setup)
    case 'children-merge':
      return reduceChildrenMerge(state, event.merge)
    case 'review':
      return reduceReview(state, event.review)
    case 'memory-proposal':
      return reduceMemoryProposal(state, event.proposal)
    case 'handover': {
      // Session neuve du même agent déjà annoncée, sans message depuis (deux redémarrages sans
      // écrire) : pas de second repère (ADR-0030).
      if (renewalPending(state.items, event.handover)) return state
      // Nouvelle session : contexte et coût à zéro, sessions précédentes gardées (fiches 108, 164).
      const { usage, ...rest } = supersedeTurnLimits(state)
      const next = nextSession(usage)
      return push(next ? { ...rest, usage: next } : rest, { kind: 'handover', ...event.handover })
    }
    case 'tool-outcome': {
      const index = findTool(state.items, event.toolCallId)
      if (index === -1) return state
      return replaceAt(state, index, (current) => withOutcome(current as ToolItem, event.outcome))
    }
    case 'tool-app': {
      const index = findTool(state.items, event.toolCallId)
      if (index === -1) return state
      return replaceAt(state, index, (current) => {
        const tool = current as Extract<TranscriptItem, { kind: 'tool' }>
        // Une carte qui appelle plusieurs outils de l'app (fiche 079) : tous leurs libellés.
        const appTools = [...(tool.appTools ?? (tool.appTool ? [tool.appTool] : [])), event.appTool]
        return {
          ...tool,
          appTool: tool.appTool ?? event.appTool,
          ...(appTools.length > 1 ? { appTools } : {})
        }
      })
    }
    case 'subagent-run': {
      const index = findSubagent(state.items, event.toolCallId)
      if (index === -1) return state
      return replaceAt(state, index, (current) => {
        const tool = current as Extract<TranscriptItem, { kind: 'tool' }>
        const subagentRun = { ...tool.subagentRun, ...event.run }
        return { ...tool, subagentRun, status: backgroundStatus(tool.status, subagentRun) }
      })
    }
    case 'subagent-update': {
      // Seuls ses outils et ses messages : sa réflexion alourdirait l'historique sans servir.
      const kind = event.update.sessionUpdate
      if (kind !== 'tool_call' && kind !== 'tool_call_update' && kind !== 'agent_message_chunk') {
        return state
      }
      // Outil du sous-agent sorti dans le fil (autorisation demandée) : sa suite y va aussi.
      if (
        (kind === 'tool_call' || kind === 'tool_call_update') &&
        findTool(state.items, (event.update as { toolCallId: string }).toolCallId) !== -1
      ) {
        return applyUpdate(state, event.update)
      }
      const index = findSubagent(state.items, event.toolCallId)
      if (index === -1) return state
      const tool = state.items[index] as Extract<TranscriptItem, { kind: 'tool' }>
      const nested = applyUpdateItems(
        { items: tool.work ?? [], nextId: state.nextId },
        event.update
      )
      return {
        ...replaceAt(state, index, () => ({ ...tool, work: nested.items })),
        nextId: nested.nextId
      }
    }
    case 'tool-media': {
      const index = findTool(state.items, event.toolCallId)
      if (index === -1) return state
      return replaceAt(state, index, (current) => {
        const tool = current as Extract<TranscriptItem, { kind: 'tool' }>
        // Les dernières seulement : un fil n'a pas à garder chaque capture d'une longue session.
        return {
          ...tool,
          images: [...(tool.images ?? []), ...event.images].slice(-MAX_TOOL_IMAGES)
        }
      })
    }
    case 'panel-open':
    case 'waiting-user':
      return state
    case 'permission-request': {
      const { toolCall, requestId, options, risks } = event
      const permission: ToolPermission = { requestId, options, ...pendingWith(risks) }
      const index = findTool(state.items, toolCall.toolCallId)
      const nested = index === -1 ? takeFromWork(state, toolCall.toolCallId) : undefined
      if (nested) {
        // Outil d'un sous-agent qui demande une autorisation : sorti de sous sa carte, dans le fil,
        // pour qu'on voie la question (la suite de cet outil y arrivera aussi).
        return push(nested.state, { ...nested.tool, permission })
      }
      if (index === -1) {
        return push(state, {
          kind: 'tool',
          toolCallId: toolCall.toolCallId,
          title: toolCall.title ?? t('toolCall.untitled'),
          toolKind: toolCall.kind ?? undefined,
          status: toolCall.status ?? 'pending',
          content: toolCall.content ?? [],
          locations: toolCall.locations ?? [],
          ...(toolInputOf(toolCall.rawInput) ? { input: toolInputOf(toolCall.rawInput) } : {}),
          ...(planOf(toolCall.rawInput) ? { plan: planOf(toolCall.rawInput) } : {}),
          ...withCommand(toolCall.rawInput),
          ...withTodos(toolCall.rawInput, undefined, toolCall.kind),
          ...withSubagent(toolCall),
          permission
        })
      }
      return replaceAt(state, index, (current) => {
        const tool = current as Extract<TranscriptItem, { kind: 'tool' }>
        // On garde le titre de la carte : celui de la demande est souvent générique (Codex envoie
        // « Run command » alors que la carte affiche la commande exacte).
        return {
          ...tool,
          toolKind: tool.toolKind ?? toolCall.kind ?? undefined,
          content: toolCall.content ?? tool.content,
          locations: toolCall.locations ?? tool.locations,
          plan: planOf(toolCall.rawInput) ?? tool.plan,
          ...withCommand(toolCall.rawInput, tool.command),
          ...withTodos(toolCall.rawInput, tool, toolCall.kind),
          ...withSubagent(toolCall, tool.subagent),
          permission
        }
      })
    }
    case 'elicitation-request':
      return push(state, {
        kind: 'elicitation',
        requestId: event.requestId,
        prompt: event.prompt,
        state: 'pending'
      })
    case 'elicitation-resolved': {
      const index = state.items.findLastIndex(
        (item) => item.kind === 'elicitation' && item.requestId === event.requestId
      )
      return replaceAt(
        state,
        index,
        (current) =>
          ({
            ...current,
            state: event.action,
            ...(event.content ? { content: event.content } : {})
          }) as TranscriptItem
      )
    }
    case 'permission-resolved': {
      const index = state.items.findLastIndex(
        (item) => item.kind === 'tool' && item.permission?.requestId === event.requestId
      )
      return replaceAt(state, index, (current) => {
        const tool = current as Extract<TranscriptItem, { kind: 'tool' }>
        if (!tool.permission) return tool
        // Demande retirée par l'agent (fiche 214) : la carte disparaît sans bruit (ni « annulée »,
        // ni échec) ; l'outil garde l'état que l'agent lui donne ensuite.
        if (event.optionId === null && event.cancelledBy) return withoutPermission(tool)
        const option = tool.permission.options.find((o) => o.optionId === event.optionId)
        const resolved: ToolPermission['state'] =
          event.optionId === null
            ? 'cancelled'
            : {
                optionId: event.optionId,
                name: option?.name ?? event.optionId,
                kind: option?.kind ?? 'allow_once'
              }
        const permission = { ...tool.permission, state: resolved }
        // Refuser une autorisation : la carte dit « refusé », quoi que l'agent en dise (fiche 122).
        const refused = typeof resolved === 'object' && resolved.kind.startsWith('reject')
        return refused ? withOutcome({ ...tool, permission }, 'refused') : { ...tool, permission }
      })
    }
    case 'status': {
      const { status, detail } = event.snapshot
      if (status === 'exited' || status === 'error') {
        // Un avis au passage vers l'arrêt seulement : le même arrêt réannoncé n'en ajoute pas.
        if (state.halted?.status === status && state.halted.detail === detail) return state
        // Les outils du tour interrompu n'aboutiront plus, ni les sous-agents en arrière-plan ; le
        // tour est compté, comme un tour en échec (fiche 139, comme le journal de la fiche 130).
        const closed = closeUnfinishedTools(closeBackground(withEndedTurn(state)))
        const message = haltMessage(status, detail)
        return push(
          { ...closed, halted: { status, detail } },
          { kind: 'notice', level: 'error', message }
        )
      }
      return state.halted ? { ...state, halted: undefined } : state
    }
  }
}

function applyUpdate(state: TranscriptState, update: SessionUpdate): TranscriptState {
  const next = applyUpdateItems(state, update)
  if (update.sessionUpdate === 'tool_call' || update.sessionUpdate === 'tool_call_update') {
    return withTerminal(next, update.toolCallId, update._meta, update.content ?? undefined)
  }
  return next
}

/** Sortie de terminal portée par un appel d'outil (`_meta` ou contenu `terminal`). */
function withTerminal(
  state: TranscriptState,
  toolCallId: string,
  meta: unknown,
  content: ToolCallContent[] | undefined
): TranscriptState {
  const patch = terminalPatchOf(meta)
  const fromContent = content?.find((c) => c.type === 'terminal')
  const terminalId =
    patch?.terminalId ?? (fromContent?.type === 'terminal' ? fromContent.terminalId : undefined)
  if (!terminalId) return state
  const terminals = { ...state.terminals }
  terminals[terminalId] = patch
    ? applyTerminalPatch(terminals[terminalId], patch)
    : (terminals[terminalId] ?? { output: '' })
  const index = findTool(state.items, toolCallId)
  const items =
    index === -1
      ? state.items
      : state.items.map((item, i) =>
          i === index && item.kind === 'tool' && item.terminalId !== terminalId
            ? { ...item, terminalId }
            : item
        )
  return { ...state, items, terminals }
}

function applyUpdateItems(state: TranscriptState, update: SessionUpdate): TranscriptState {
  switch (update.sessionUpdate) {
    case 'usage_update':
      return { ...state, usage: withContext(state.usage ?? {}, update, state.nextId) }
    case 'compaction_update': {
      const index = findCompaction(state.items, update.compactionId)
      const summary = update.summary ? blocksText(update.summary) : undefined
      if (index === -1) {
        return push(state, {
          kind: 'compaction',
          compactionId: update.compactionId,
          status: update.status,
          summary: summary ?? '',
          ...(update.error ? { error: update.error } : {})
        })
      }
      return replaceAt(state, index, (current) => {
        const c = current as Extract<TranscriptItem, { kind: 'compaction' }>
        return {
          ...c,
          status: update.status,
          summary: summary ?? c.summary,
          ...(update.error ? { error: update.error } : {})
        }
      })
    }
    case 'compaction_summary_chunk': {
      const index = findCompaction(state.items, update.compactionId)
      const text = blocksText([update.content])
      if (index === -1) {
        return push(state, {
          kind: 'compaction',
          compactionId: update.compactionId,
          status: 'in_progress',
          summary: text
        })
      }
      return replaceAt(state, index, (current) => {
        const c = current as Extract<TranscriptItem, { kind: 'compaction' }>
        return { ...c, summary: c.summary + text }
      })
    }
    case 'user_message_chunk':
    case 'agent_message_chunk':
    case 'agent_thought_chunk': {
      // Pièce jointe d'un message rejoué (`session/load`) : rattachée au message de l'utilisateur.
      const attachment =
        update.sessionUpdate === 'user_message_chunk' ? attachmentOf(update.content) : undefined
      if (attachment) {
        const last = state.items.at(-1)
        if (last?.kind === 'user') {
          return replaceAt(state, state.items.length - 1, () => ({
            ...last,
            attachments: [...(last.attachments ?? []), attachment]
          }))
        }
        return push(state, { kind: 'user', text: '', attachments: [attachment] })
      }
      // `user_message_chunk` n'arrive que lors du rejeu d'une session rechargée (`session/load`).
      const kind =
        update.sessionUpdate === 'agent_message_chunk'
          ? 'agent'
          : update.sessionUpdate === 'user_message_chunk'
            ? 'user'
            : 'thought'
      const text =
        update.content.type === 'text' ? update.content.text : `\n[${update.content.type}]\n`
      const last = state.items.at(-1)
      if (last && last.kind === kind) {
        return replaceAt(state, state.items.length - 1, () => ({ ...last, text: last.text + text }))
      }
      return push(state, { kind, text })
    }
    case 'tool_call': {
      const index = findTool(state.items, update.toolCallId)
      const item: NewItem = {
        kind: 'tool',
        toolCallId: update.toolCallId,
        title: update.title,
        toolKind: update.kind,
        status: update.status ?? 'pending',
        // Demande d'autorisation arrivée avant : son diff reste (Bob 2.0.9, fiche 203).
        ...contentOrKept(update, index === -1 ? undefined : state.items[index]),
        ...(toolInputOf(update.rawInput) ? { input: toolInputOf(update.rawInput) } : {}),
        ...(planOf(update.rawInput) ? { plan: planOf(update.rawInput) } : {}),
        ...withCommand(update.rawInput),
        ...withTodos(update.rawInput, undefined, update.kind),
        ...withSubagent(update)
      }
      if (index === -1) return push(state, item)
      // La demande de permission peut arriver avant ce `tool_call` : on la conserve.
      return replaceAt(state, index, (current) => {
        const { permission, outcome, command, todos, args } = current.kind === 'tool' ? current : {}
        const status = finalStatus(item.status, outcome)
        const kept = { command, todos, args, permission, outcome }
        return { ...kept, ...item, id: current.id, status } as TranscriptItem
      })
    }
    case 'tool_call_update': {
      const index = findTool(state.items, update.toolCallId)
      if (index === -1) {
        return push(state, {
          kind: 'tool',
          toolCallId: update.toolCallId,
          title: update.title ?? t('toolCall.untitled'),
          toolKind: update.kind ?? undefined,
          status: update.status ?? 'pending',
          content: update.content ?? [],
          locations: update.locations ?? [],
          ...(toolInputOf(update.rawInput) ? { input: toolInputOf(update.rawInput) } : {}),
          ...withCommand(update.rawInput),
          ...withTodos(update.rawInput, undefined, update.kind),
          ...withSubagent(update)
        })
      }
      return replaceAt(state, index, (current) => {
        const tool = current as Extract<TranscriptItem, { kind: 'tool' }>
        return {
          ...tool,
          ...withSubagent(update, tool.subagent),
          title: update.title ?? tool.title,
          toolKind: update.kind ?? tool.toolKind,
          status: toolStatus(state, tool, update.status),
          content: update.content ?? tool.content,
          locations: update.locations ?? tool.locations,
          input: toolInputOf(update.rawInput) ?? tool.input,
          ...withCommand(update.rawInput, tool.command),
          ...withTodos(update.rawInput, tool, update.kind ?? tool.toolKind),
          plan: planOf(update.rawInput) ?? tool.plan
        }
      })
    }
    case 'plan': {
      // Un plan remplace le précédent du même tour.
      const start = turnStart(state.items)
      const index = state.items.findLastIndex((item, i) => i > start && item.kind === 'plan')
      if (index === -1) return push(state, { kind: 'plan', entries: update.entries })
      return replaceAt(state, index, (current) => ({
        kind: 'plan',
        id: current.id,
        entries: update.entries
      }))
    }
    default:
      // Modes, commandes, sous-agents… : gérés par d'autres fiches.
      return state
  }
}

/** Heure de fin de la réponse sur les messages de l'agent du tour qui n'en ont pas encore. */
function stampReplies(state: TranscriptState, at: number | undefined): TranscriptState {
  if (!at) return state
  const start = turnStart(state.items)
  let changed = false
  const items = state.items.map((item, i) => {
    if (i <= start || item.kind !== 'agent' || item.at) return item
    changed = true
    return { ...item, at }
  })
  return changed ? { ...state, items } : state
}

/**
 * Fil relu du disque : rien n'y est plus en cours (l'app a pu être quittée, ou plantée, en plein
 * tour). Outils en attente → interrompus, permissions et questions en attente → annulées.
 */
export function settleTranscript(state: TranscriptState): TranscriptState {
  let changed = false
  const items = state.items.map((item) => {
    if (item.kind === 'elicitation' && item.state === 'pending') {
      changed = true
      return { ...item, state: 'cancel' as const }
    }
    if (item.kind === 'compaction' && item.status === 'in_progress') {
      changed = true
      return { ...item, status: 'cancelled' }
    }
    if (item.kind !== 'tool') return item
    const permission =
      item.permission?.state === 'pending'
        ? { ...item.permission, state: 'cancelled' as const }
        : item.permission
    const unfinished = item.status === 'pending' || item.status === 'in_progress'
    const closed = closeWork(item)
    if (!unfinished && permission === item.permission && closed === item) return item
    changed = true
    return {
      ...closed,
      permission,
      status: unfinished ? (item.outcome ?? 'cancelled') : item.status
    }
  })
  return changed ? { ...state, items } : state
}

/**
 * En fin de tour, les outils du tour encore en attente ou en cours n'aboutiront plus, et aucune
 * permission ne reste en attente.
 */
function closeUnfinishedTools(state: TranscriptState, keepBackground = false): TranscriptState {
  const start = turnStart(state.items)
  let changed = false
  const items = state.items.map((item, i) => {
    if (item.kind === 'elicitation' && item.state === 'pending') {
      // Question de l'outil `ask_user` : on peut encore y répondre après le tour (fiche 028).
      if (item.prompt.mode === 'form' && item.prompt.outlivesTurn) return item
      changed = true
      return { ...item, state: 'cancel' as const }
    }
    if (item.kind !== 'tool') return item
    // Une permission ne survit jamais à la fin d'un tour.
    const permission =
      item.permission?.state === 'pending'
        ? { ...item.permission, state: 'cancelled' as const }
        : item.permission
    // Un sous-agent en arrière-plan survit au tour (fiche 122) ; son travail aussi.
    const kept = keepBackground && runsInBackground(item)
    const unfinished =
      i > start && !kept && (item.status === 'pending' || item.status === 'in_progress')
    const closed = i > start && !kept ? closeWork(item) : item
    if (!unfinished && permission === item.permission && closed === item) return item
    changed = true
    return {
      ...closed,
      permission,
      status: unfinished ? (item.outcome ?? 'cancelled') : item.status
    }
  })
  return changed ? { ...state, items } : state
}

type ToolItem = Extract<TranscriptItem, { kind: 'tool' }>

/** Sous-agent lancé en arrière-plan qui n'a pas encore fini (fiche 122). */
const runsInBackground = (item: ToolItem) =>
  !!item.subagentRun?.background && item.subagentRun.endedAt === undefined && !item.subagentRun.lost

/**
 * Statut d'une carte de sous-agent lancé en arrière-plan (fiche 122) : en cours tant que sa session
 * n'a pas fini, même si son outil a rendu la main ; fini avec elle ; interrompu si on le perd.
 */
function backgroundStatus(status: ToolItem['status'], run: SubagentRun): ToolItem['status'] {
  if (!run.background) return status
  if (run.endedAt !== undefined) return status === 'in_progress' ? 'completed' : status
  if (run.lost) return status === 'in_progress' ? 'cancelled' : status
  return status === 'completed' ? 'in_progress' : status
}

/** Agent arrêté : les sous-agents en arrière-plan, de n'importe quel tour, n'ont plus de suivi. */
function closeBackground(state: TranscriptState): TranscriptState {
  if (!state.items.some((item) => item.kind === 'tool' && runsInBackground(item))) return state
  const items = state.items.map((item) =>
    item.kind === 'tool' && runsInBackground(item)
      ? closeWork({ ...item, status: 'cancelled' as const })
      : item
  )
  return { ...state, items }
}

/** Fin annoncée par l'agent, corrigée par l'issue que l'app connaît (fiche 122). */
function finalStatus(status: ToolItem['status'], outcome: ToolOutcome | undefined) {
  return outcome && (status === 'completed' || status === 'failed') ? outcome : status
}

/** L'outil sans sa demande d'autorisation (retirée par l'agent, fiche 214). */
function withoutPermission(tool: ToolItem): ToolItem {
  const { permission: _retired, ...kept } = tool
  return kept
}

/** Issue vue par l'app : un refus n'est jamais changé en échec ; une carte finie la prend. */
function withOutcome(tool: ToolItem, outcome: ToolOutcome): ToolItem {
  const kept = tool.outcome === 'refused' ? tool.outcome : outcome
  return { ...tool, outcome: kept, status: finalStatus(tool.status, kept) }
}

/**
 * Outil d'un sous-agent rangé sous une carte du tour (`work`), retiré de là : l'état sans lui, et
 * l'outil (sans identifiant, prêt à être ajouté au fil).
 */
function takeFromWork(
  state: TranscriptState,
  toolCallId: string
): { state: TranscriptState; tool: Omit<ToolItem, 'id'> } | undefined {
  const start = turnStart(state.items)
  for (let i = state.items.length - 1; i > start; i--) {
    const card = state.items[i]
    if (card?.kind !== 'tool' || !card.work) continue
    const at = card.work.findIndex((w) => w.kind === 'tool' && w.toolCallId === toolCallId)
    if (at === -1) continue
    const { id: _id, ...tool } = card.work[at] as ToolItem
    const work = card.work.filter((_, j) => j !== at)
    return { state: replaceAt(state, i, () => ({ ...card, work })), tool }
  }
  return undefined
}

/** Outils du sous-agent rangés sous sa carte, encore en attente ou en cours : interrompus. */
function closeWork(item: ToolItem): ToolItem {
  if (!item.work?.some((w) => w.kind === 'tool' && isUnfinished(w.status))) return item
  return {
    ...item,
    work: item.work.map((w) =>
      w.kind === 'tool' && isUnfinished(w.status) ? { ...w, status: 'cancelled' as const } : w
    )
  }
}

const isUnfinished = (status: ToolItem['status']) =>
  status === 'pending' || status === 'in_progress'

/**
 * Outil du tour en cours portant cet identifiant. Limité au tour : si un agent réutilise un
 * identifiant d'un tour à l'autre, on crée une nouvelle carte au lieu de réécrire l'historique.
 */
function findTool(items: TranscriptItem[], toolCallId: string): number {
  const start = turnStart(items)
  const index = items.findLastIndex(
    (item) => item.kind === 'tool' && item.toolCallId === toolCallId
  )
  return index > start ? index : -1
}

/**
 * Carte d'un sous-agent : celle du tour en cours, sinon la plus récente d'un tour précédent qui
 * suit déjà un sous-agent. Un sous-agent en arrière-plan finit souvent après que l'utilisateur a
 * envoyé un autre message (D25, fiche 127) : sa fin, son coût et son travail vont à sa carte.
 */
function findSubagent(items: TranscriptItem[], toolCallId: string): number {
  const index = findTool(items, toolCallId)
  if (index !== -1) return index
  return items.findLastIndex(
    (item) => item.kind === 'tool' && item.toolCallId === toolCallId && !!item.subagentRun
  )
}
