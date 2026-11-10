/**
 * Outils de l'app fournis à l'agent pour une session (fiches 028, 029) : `ask_user` et les modules
 * (navigateur, simulateur, terminal…). Relie chaque appel MCP à la carte d'outil annoncée par
 * l'agent (images du résultat, onglet du panneau), et transforme les questions en cartes.
 */
import type { CreateElicitationResponse, SessionUpdate } from '../../shared/acp-sdk.mts'
import type { AgentEvent, ElicitationPrompt, ToolOutcome } from '@shared/agent'
import { appToolFallback, appToolLabel } from '@shared/app-tools'
import { askUserResult, askUserSchema, type AskUserArgs } from '@shared/ask-user'
import {
  childProposalSchema,
  parseChildDecision,
  type ChildDecision,
  type ChildProposal
} from '@shared/children'
import { askUserModule } from '../mcp/ask-user-tool'
import { log } from '../log'
import {
  matchAppTool,
  moduleTools,
  resemblesAppTool,
  type AppTool,
  type AppToolModule,
  type ToolContext,
  type ToolResult
} from '../mcp/tools'
import type { PendingRequests } from './pending-requests'

/**
 * Bob abandonne un appel d'outil MCP au bout d'environ 60 s (relevé sur Bob 2.0.6) : au-delà de
 * cette attente, l'agent est prié de finir son tour et la réponse arrivera en message.
 */
const ASK_USER_WAIT_MS = 45_000
const LATE_ANSWER_TEXT =
  'The question is now displayed to the user, who has not answered yet. Do not guess: end your ' +
  'turn now with a short sentence saying you are waiting for their answer. The answer will arrive ' +
  'as their next message.'

/** Appels d'outils jamais autorisés d'office, même s'ils portent le nom d'un outil de l'app. */
const SYSTEM_TOOL_KINDS = new Set(['edit', 'delete', 'move', 'execute'])

export interface AppToolsBridgeOptions {
  workspace: string
  conversationId?: string
  toolModules?: readonly AppToolModule[]
  /** Demander l'autorisation même pour les outils qui n'agissent que dans l'app. */
  confirmAppTools?: boolean
  askUserWaitMs?: number
  emit: (event: AgentEvent) => void
  requests: PendingRequests
  /** Une session est ouverte (sinon `ask_user` n'a personne à qui répondre). */
  connected: () => boolean
  /** Message à envoyer à l'agent dès que possible (réponse tardive à une question…). */
  tellAgent: (text: string) => void
  /** Règles de l'agent : partie d'une commande refusée partout (fiche 215), ou `undefined`. */
  deniedCommand?: (command: string) => string | undefined
}

export class AppToolsBridge {
  private readonly options: AppToolsBridgeOptions
  private tools: AppTool[] = []
  /** Appels annoncés par l'agent, en attente de l'appel MCP (par nom d'outil). */
  private readonly calls = new Map<string, string[]>()
  /**
   * Cartes en cours que leur titre ne relie à aucun outil de l'app, avec leur entrée en texte :
   * du code qui appelle les outils (`execute` d'OpenCode 2, fiche 079) peut s'y cacher.
   */
  private readonly running = new Map<string, string>()
  /**
   * Appels faits pendant que plusieurs cartes tournaient sans encore citer l'outil : l'agent peut
   * envoyer le code après avoir lancé l'appel (relevé sur OpenCode 2.0.32). Rattachés dès qu'une de
   * ces cartes le cite ; oubliés à la fin du tour.
   */
  private orphans: {
    name: string
    appTool: ReturnType<typeof appToolLabel>
    images: ToolImageData[]
    outcome?: ToolOutcome
    candidates: Set<string>
  }[] = []
  /** Dernier appel d'outil de l'agent qui ressemble à `ask_user` (pour lier la carte à l'outil). */
  private lastQuestion: { toolCallId: string; question: string } | undefined
  /** Dernier appel qui ressemble à `start_child` (titre) : la carte de propositions s'y relie (fiche 112). */
  private lastProposal: { toolCallId: string; title: string } | undefined
  /** Titres au format inconnu déjà signalés (une ligne de journal par titre). */
  private readonly unknownTitles = new Set<string>()

  constructor(options: AppToolsBridgeOptions) {
    this.options = options
  }

  /** Outils d'une nouvelle session : `ask_user` puis ceux des modules utiles dans ce dossier. */
  sessionTools(): AppTool[] {
    const modules = [
      askUserModule((args) => this.askUser(args)),
      ...(this.options.toolModules ?? [])
    ]
    const tools = moduleTools(modules, this.toolContext())
    this.calls.clear()
    this.running.clear()
    this.tools = tools.map((tool) => ({ ...tool, call: (args) => this.call(tool, args) }))
    return this.tools
  }

  /** Noms des outils de la session, s'ils ont été donnés à l'agent (sinon il n'en a aucun). */
  names(registered: boolean): string[] {
    return registered ? this.tools.map((tool) => tool.definition.name) : []
  }

  /** Session terminée : plus d'appel en attente. */
  clear(): void {
    this.calls.clear()
    this.running.clear()
    this.orphans = []
  }

  /** Appels d'outils annoncés depuis le début du tour (tour refusé après coup, recette 0.9 D10). */
  toolCallsInTurn = 0

  /** Début d'un tour : rien n'est encore lancé (le rejeu d'une session rouverte ne compte pas). */
  turnStarted(): void {
    this.toolCallsInTurn = 0
  }

  /** Tour fini : ses cartes ne tournent plus, même celles arrêtées sans mise à jour finale. */
  turnEnded(): void {
    this.running.clear()
    this.orphans = []
  }

  /** Mise à jour de la session de la conversation : seuls les appels d'outil comptent. */
  noteUpdate(update: SessionUpdate): void {
    if (update.sessionUpdate === 'tool_call') {
      this.toolCallsInTurn++
      this.noteToolCall(update)
    }
    if (update.sessionUpdate === 'tool_call_update') this.noteToolCallUpdate(update)
  }

  /** Appel d'outil annoncé par l'agent (`tool_call`) : à relier à l'appel MCP qui va suivre. */
  noteToolCall(update: { toolCallId: string; title?: string | null; rawInput?: unknown }): void {
    const question = questionOf(update.rawInput)
    if (question) this.lastQuestion = { toolCallId: update.toolCallId, question }
    const proposal = proposalTitleOf(update.rawInput)
    if (proposal) this.lastProposal = { toolCallId: update.toolCallId, title: proposal }
    const tool = matchAppTool(update.title, this.tools)
    if (!tool) {
      this.running.set(update.toolCallId, inputText(update.rawInput))
      return
    }
    const name = tool.definition.name
    this.calls.set(name, [...(this.calls.get(name) ?? []), update.toolCallId])
  }

  /** Suite d'une carte (`tool_call_update`) : son entrée complétée, ou sa fin. */
  noteToolCallUpdate(update: {
    toolCallId: string
    status?: string | null
    rawInput?: unknown
  }): void {
    if (!this.running.has(update.toolCallId)) return
    if (update.rawInput !== undefined) {
      this.running.set(update.toolCallId, inputText(update.rawInput))
      this.adoptOrphans(update.toolCallId)
    }
    if (update.status === 'completed' || update.status === 'failed') {
      this.running.delete(update.toolCallId)
    }
  }

  /** Appels restés sans carte que le code de cette carte, arrivé après eux, cite. */
  private adoptOrphans(toolCallId: string): void {
    const input = this.running.get(toolCallId) ?? ''
    const adopted = this.orphans.filter((o) => o.candidates.has(toolCallId) && cites(input, o.name))
    if (adopted.length === 0) return
    this.orphans = this.orphans.filter((o) => !adopted.includes(o))
    for (const orphan of adopted) {
      if (orphan.appTool)
        this.options.emit({ type: 'tool-app', toolCallId, appTool: orphan.appTool })
      if (orphan.images.length > 0) {
        this.options.emit({ type: 'tool-media', toolCallId, images: orphan.images })
      }
      if (orphan.outcome)
        this.options.emit({ type: 'tool-outcome', toolCallId, outcome: orphan.outcome })
    }
  }

  /**
   * Carte d'où vient un appel qu'aucune carte n'annonce par son titre (fiche 079) : la plus récente
   * des cartes en cours dont l'entrée cite l'outil, sinon la seule carte en cours ; aucune quand
   * plusieurs tournent sans le citer (pas de rattachement au hasard).
   */
  private hostOf(name: string): string | undefined {
    const running = [...this.running].reverse()
    const citing = running.find(([, input]) => cites(input, name))
    if (citing) return citing[0]
    return running.length === 1 ? running[0]?.[0] : undefined
  }

  /** Demande d'autorisation pour un outil de l'app qui n'agit que dans l'app : accordée d'office. */
  autoAllowed(toolCall: { title?: string | null; kind?: string | null }): boolean {
    if (this.options.confirmAppTools) return false
    if (toolCall.kind && SYSTEM_TOOL_KINDS.has(toolCall.kind)) return false
    const tool = matchAppTool(toolCall.title, this.tools)
    if (!tool && toolCall.title && resemblesAppTool(toolCall.title, this.tools)) {
      this.warnUnknownTitle(toolCall.title)
    }
    return tool?.autoAllow === true
  }

  private warnUnknownTitle(title: string): void {
    if (this.unknownTitles.has(title)) return
    this.unknownTitles.add(title)
    log.warn(
      `Titre d’outil qui ressemble à un outil de Bobine sans suivre un format connu : autorisation demandée à l’utilisateur (fiche 071). Titre : ${title.slice(0, 200)}`
    )
  }

  /**
   * Appel d'un outil de l'app par l'agent : ouvre l'onglet du panneau, dit en clair ce que fait
   * l'appel (fiche 047) et montre les images du résultat dans sa carte (Bob ne les renvoie pas au
   * client).
   */
  private async call(tool: AppTool, args: unknown): Promise<ToolResult> {
    const name = tool.definition.name
    const toolCallId = this.calls.get(name)?.shift() ?? this.hostOf(name)
    // Cartes en cours au moment de l'appel : l'une d'elles peut le citer un peu plus tard.
    const candidates = toolCallId ? undefined : new Set(this.running.keys())
    // Outil sans libellé propre : son nom (recette 0.11, C1), jamais le titre de l'agent.
    const appTool = appToolLabel(name, args) ?? appToolFallback(name)
    if (toolCallId && appTool) this.options.emit({ type: 'tool-app', toolCallId, appTool })
    if (tool.panel) this.options.emit({ type: 'panel-open', tab: tool.panel })
    // Refusé ou en erreur : la carte le dit, même si l'agent la dit finie (fiche 122).
    const settled = (outcome: ToolOutcome | undefined) => {
      if (toolCallId && outcome) this.options.emit({ type: 'tool-outcome', toolCallId, outcome })
    }
    const result = await tool.call(args).catch((error: unknown) => {
      settled('failed')
      if (candidates?.size)
        this.orphans.push({ name, appTool, images: [], outcome: 'failed', candidates })
      throw error
    })
    const outcome = result.refused ? 'refused' : result.isError ? 'failed' : undefined
    settled(outcome)
    const images = result.content.flatMap((c) =>
      c.type === 'image' ? [{ mimeType: c.mimeType, data: c.data }] : []
    )
    if (toolCallId && images.length > 0) {
      this.options.emit({ type: 'tool-media', toolCallId, images })
    }
    if (candidates?.size) {
      this.orphans.push({ name, appTool, images, ...(outcome ? { outcome } : {}), candidates })
      // Le code a pu arriver pendant que l'outil tournait.
      const host = [...candidates].reverse().find((id) => cites(this.running.get(id) ?? '', name))
      if (host) this.adoptOrphans(host)
    }
    return result
  }

  /**
   * Question posée par l'agent via `ask_user` : affichée avec la carte de questions. Si l'utilisateur
   * ne répond pas avant que l'agent abandonne l'appel, la réponse arrivera plus tard en message.
   */
  private async askUser(args: AskUserArgs): Promise<{ text: string; isError?: boolean }> {
    if (!this.options.connected()) return { text: 'No active session.', isError: true }
    const outcome = await this.elicit(this.questionPrompt(args), (response) =>
      this.lateAnswer(args, response)
    )
    if (outcome === 'late') return { text: LATE_ANSWER_TEXT }
    const action =
      outcome.action === 'accept' || outcome.action === 'decline' ? outcome.action : 'cancel'
    const content = 'content' in outcome ? (outcome.content as Record<string, unknown>) : undefined
    return askUserResult(action, content)
  }

  /**
   * Carte de questions pour un outil de l'app : la réponse, ou `'late'` si l'utilisateur n'a pas
   * répondu avant que l'agent abandonne l'appel (≈ 60 s chez Bob) — elle arrive alors à `onLate`.
   */
  private elicit(
    prompt: ElicitationPrompt,
    onLate: (response: CreateElicitationResponse) => void
  ): Promise<CreateElicitationResponse | 'late'> {
    let late = false
    const answered = this.options.requests.elicitation(prompt).then((response) => {
      if (late) onLate(response)
      return response
    })
    const waited = new Promise<'late'>((resolve) => {
      setTimeout(() => resolve('late'), this.options.askUserWaitMs ?? ASK_USER_WAIT_MS).unref()
    })
    return Promise.race([answered, waited]).then((outcome) => {
      if (outcome === 'late') late = true
      return outcome
    })
  }

  /** Carte de questions d'`ask_user` ou d'un outil de l'app, reliée à l'appel qui la pose. */
  private questionPrompt(args: AskUserArgs): ElicitationPrompt {
    const linked = this.lastQuestion?.question === args.question ? this.lastQuestion : undefined
    return {
      mode: 'form',
      message: args.question,
      schema: askUserSchema(args),
      outlivesTurn: true,
      ...(linked ? { toolCallId: linked.toolCallId } : {})
    }
  }

  /** Carte de propositions de `start_child` (fiche 112), reliée à l'appel par son titre. */
  private proposalPrompt(proposal: ChildProposal): ElicitationPrompt {
    const linked = this.lastProposal?.title === proposal.title ? this.lastProposal : undefined
    return {
      mode: 'form',
      message: proposal.title,
      schema: childProposalSchema(),
      outlivesTurn: true,
      child: proposal,
      ...(linked ? { toolCallId: linked.toolCallId } : {})
    }
  }

  /** Contexte donné aux modules d'outils : conversation, questions à l'utilisateur. */
  private toolContext(): ToolContext {
    return {
      workspace: this.options.workspace,
      conversationId: this.options.conversationId ?? 'default',
      ask: async (args, onLate) => {
        const outcome = await this.elicit(this.questionPrompt(args), (response) =>
          onLate?.(choicesOf(response))
        )
        return outcome === 'late' ? 'late' : choicesOf(outcome)
      },
      proposeChild: async (proposal, onLate) => {
        const outcome = await this.elicit(this.proposalPrompt(proposal), (response) =>
          onLate?.(decisionOf(response))
        )
        return outcome === 'late' ? 'late' : decisionOf(outcome)
      },
      tellAgent: (text) => this.options.tellAgent(text),
      deniedCommand: (command) => {
        const denied = this.options.deniedCommand?.(command)
        // Dit dans le fil : la carte de l'outil seule (« refusé ») ne dirait pas pourquoi.
        if (denied !== undefined) {
          this.options.emit({
            type: 'notice',
            level: 'warning',
            message: { key: 'approvalRules.terminal.denied', params: { command: denied } }
          })
        }
        return denied
      }
    }
  }

  /** Réponse tardive à `ask_user` : envoyée comme message de l'utilisateur dès que possible. */
  private lateAnswer(args: AskUserArgs, response: CreateElicitationResponse): void {
    if (response.action === 'cancel') return
    const choices = choicesOf(response)
    const answer = choices
      ? choices.join(', ') || '(aucun choix)'
      : 'je préfère ne pas répondre, décide toi-même.'
    this.options.tellAgent(`Réponse à ta question « ${args.question} » : ${answer}`)
  }
}

/** Décision prise sur la carte de propositions ; passée ou annulée : un refus. */
function decisionOf(response: CreateElicitationResponse): ChildDecision {
  const content = 'content' in response && response.action === 'accept' ? response.content : {}
  return parseChildDecision(content) ?? { action: 'refuse' }
}

/** Choix et texte libre d'une réponse à la carte de questions ; `null` si l'utilisateur a passé. */
function choicesOf(response: CreateElicitationResponse): string[] | null {
  if (response.action !== 'accept') return null
  const content = 'content' in response ? (response.content as Record<string, unknown>) : undefined
  const picked = content?.['answer']
  const picks = Array.isArray(picked) ? picked.map(String) : picked ? [String(picked)] : []
  const custom =
    typeof content?.['answer_custom'] === 'string' ? content['answer_custom'].trim() : ''
  return [...picks, ...(custom ? [custom] : [])]
}

/** Question d'un appel d'outil qui ressemble à `ask_user` (`rawInput.question`), sinon `undefined`. */
/** Image renvoyée par un outil, telle que l'évènement `tool-media` la porte. */
type ToolImageData = { mimeType: string; data: string }

/** L'entrée d'une carte cite-t-elle cet outil (nom entier, pas un morceau d'un autre) ? */
function cites(input: string, name: string): boolean {
  return new RegExp(`(^|[^A-Za-z0-9_])${name}([^A-Za-z0-9_]|$)`).test(input)
}

/** Entrée d'une carte en texte, pour y chercher le nom d'un outil. */
function inputText(rawInput: unknown): string {
  if (rawInput === undefined || rawInput === null) return ''
  if (typeof rawInput === 'string') return rawInput
  try {
    return JSON.stringify(rawInput)
  } catch {
    return ''
  }
}

/** Titre d'un appel qui ressemble à `start_child` (`rawInput.title` et `prompt`), sinon `undefined`. */
function proposalTitleOf(rawInput: unknown): string | undefined {
  if (typeof rawInput !== 'object' || rawInput === null) return undefined
  const { title, prompt } = rawInput as Record<string, unknown>
  return typeof title === 'string' && typeof prompt === 'string' ? title.trim() : undefined
}

function questionOf(rawInput: unknown): string | undefined {
  if (typeof rawInput !== 'object' || rawInput === null) return undefined
  const { question, options } = rawInput as Record<string, unknown>
  return typeof question === 'string' && Array.isArray(options) ? question : undefined
}
