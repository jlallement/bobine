/**
 * Outils que l'app fournit à l'agent par son serveur MCP (fiche 029) : questions, et plus tard
 * navigateur, simulateurs, terminal. Chaque module déclare ses outils ; l'hôte d'agent assemble ceux
 * d'une session.
 */
import type { ParseKeys } from 'i18next'
import type { AskUserArgs } from '@shared/ask-user'
import type { ChildDecision, ChildProposal } from '@shared/children'
import { APP_TOOLS_SERVER_NAME } from '@shared/mcp'
import type { PanelTab } from '@shared/panel'

export { APP_TOOLS_SERVER_NAME }

export type ToolContent =
  { type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string }

export interface ToolResult {
  content: ToolContent[]
  isError?: boolean
  /**
   * L'utilisateur a refusé l'appel (fiche 122) : la carte dit « refusé ». Pour l'app seulement,
   * retiré avant l'envoi à l'agent, qui reçoit une erreur (`isError`).
   */
  refused?: true
}

/** Définition MCP d'un outil (`tools/list`). */
export interface ToolDefinition {
  name: string
  title?: string
  description: string
  inputSchema: Record<string, unknown>
  /** Indices MCP (fiche 165), posés à l'envoi par `withHints`. */
  annotations?: {
    readOnlyHint?: boolean
    destructiveHint?: boolean
    openWorldHint?: boolean
  }
}

export interface AppTool {
  definition: ToolDefinition
  /**
   * L'outil n'agit que dans l'app (question, panneau isolé) : autorisé sans demander à
   * l'utilisateur. Faux pour tout ce qui touche le système (commande, compilation…).
   */
  autoAllow: boolean
  /** Onglet du panneau latéral à ouvrir quand l'agent se sert de l'outil. */
  panel?: PanelTab
  /**
   * Exécute l'appel ; une erreur levée est renvoyée à l'agent comme résultat en erreur. `signal` est
   * levé quand l'agent a raccroché ou que le budget est dépassé (fiche 195) : l'outil peut s'arrêter.
   */
  call: (args: unknown, context?: { signal: AbortSignal }) => Promise<ToolResult>
  /** Budget de l'appel, s'il diffère de `DEFAULT_TOOL_BUDGET_MS` (serveur MCP). */
  budgetMs?: number
}

/** Ce qu'un module sait de la conversation pour proposer ses outils. */
export interface ToolContext {
  workspace: string
  /** Conversation de l'agent (un navigateur par conversation…). */
  conversationId: string
  /**
   * Pose une question à choix à l'utilisateur (carte de questions) : choix retenus, `null` s'il
   * passe, `'late'` s'il n'a pas répondu à temps pour l'agent — sa réponse arrive alors à `onLate`.
   */
  ask: (
    args: AskUserArgs,
    onLate?: (choices: string[] | null) => void
  ) => Promise<string[] | null | 'late'>
  /**
   * Propose une conversation fille (carte « Tâches proposées », fiche 112) : la décision de
   * l'utilisateur, ou `'late'` s'il n'a pas répondu à temps pour l'agent — elle arrive à `onLate`.
   */
  proposeChild: (
    proposal: ChildProposal,
    onLate?: (decision: ChildDecision) => void
  ) => Promise<ChildDecision | 'late'>
  /** Message envoyé à l'agent au nom de l'utilisateur dès qu'il est prêt (après une réponse tardive). */
  tellAgent: (text: string) => void
  /**
   * Partie de cette commande que les règles de l'agent refusent partout (son profil déclare des
   * règles d'approbation, fiche 215), ou `undefined`. Les outils de l'app ne la lancent pas : sans
   * cela, l'agent contournerait son propre refus en passant par eux (recette QA de la fiche 213).
   */
  deniedCommand?: (command: string) => string | undefined
}

/**
 * Ce que l'utilisateur lit d'un module dans Réglages › Serveurs MCP (fiche 099) : des clés de
 * traduction (`appToolFamilies.<id>`), à tenir d'accord avec `enabled` et les demandes d'accord.
 */
export interface AppToolAbout {
  title: ParseKeys
  /** Ce que le module permet, en une phrase. */
  summary: ParseKeys
  /** Quand il est proposé (`enabled`, ou les outils selon la conversation). */
  condition: ParseKeys
  /** Quand il demande l'accord de l'utilisateur ; absent s'il ne le demande jamais. */
  approval?: ParseKeys
}

export interface AppToolModule {
  id: string
  about: AppToolAbout
  /** Toujours déclaré, même si l'utilisateur coupe les familles (fiche 109). */
  required?: boolean
  /**
   * Allumé par un réglage d'une autre section (fiche 182) : jamais coupé par les familles, son
   * état est celui du réglage.
   */
  setting?: { section: 'memory'; enabled: () => boolean }
  /** Outils proposés seulement s'ils servent dans ce dossier (chaque outil coûte du contexte). */
  enabled?: (context: ToolContext) => boolean
  tools: (context: ToolContext) => AppTool[]
  /**
   * Tous les outils que le module peut donner, quels que soient le dossier et la conversation
   * (Réglages, fiche 099) ; `tools` par défaut.
   */
  catalog?: (context: ToolContext) => AppTool[]
}

/** Outils des modules retenus pour cette conversation, dans l'ordre des modules. */
export function moduleTools(modules: readonly AppToolModule[], context: ToolContext): AppTool[] {
  return modules
    .filter((module) => module.enabled?.(context) ?? true)
    .flatMap((module) => module.tools(context))
}

export const textResult = (text: string, isError = false): ToolResult => ({
  content: [{ type: 'text', text }],
  ...(isError ? { isError } : {})
})

/** L'utilisateur a refusé l'appel : une erreur pour l'agent, « refusé » sur la carte (fiche 122). */
export const refusedResult = (text: string): ToolResult => ({
  ...textResult(text, true),
  refused: true
})

/** Arguments d'un appel d'outil, lus comme un objet. */
export type ToolArgs = Record<string, unknown>

/** Arguments reçus, ou un objet vide si l'agent envoie autre chose qu'un objet. */
export const argsOf = (value: unknown): ToolArgs =>
  typeof value === 'object' && value !== null ? (value as ToolArgs) : {}

/** Point `[x, y]` d'un argument, arrondi ; `unit` (« points », « dp ») précise l'erreur à l'agent. */
export function pointArg(value: unknown, key: string, unit?: string): { x: number; y: number } {
  if (
    !Array.isArray(value) ||
    value.length !== 2 ||
    !value.every((n) => typeof n === 'number' && Number.isFinite(n))
  ) {
    throw new Error(`\`${key}\` : [x, y]${unit ? ` in ${unit}` : ''} expected`)
  }
  return { x: Math.round(value[0] as number), y: Math.round(value[1] as number) }
}

/**
 * Fabrique des outils d'un onglet du panneau (terminal, simulateur…) : autorisés sans demander —
 * chaque module dit pourquoi —, ils ouvrent l'onglet `panel` quand l'agent s'en sert et reçoivent
 * leurs arguments en objet ; une liste de contenus renvoyée devient le résultat.
 */
export function panelToolFactory(panel: PanelTab) {
  return (
    name: string,
    description: string,
    properties: ToolArgs,
    /** `signal` : levé quand l'agent raccroche ou que le budget est dépassé (fiche 195). */
    call: (args: ToolArgs, signal?: AbortSignal) => Promise<ToolResult | ToolContent[]>,
    required?: string[]
  ): AppTool => ({
    definition: {
      name,
      description,
      inputSchema: { type: 'object', properties, ...(required ? { required } : {}) }
    },
    autoAllow: true,
    panel,
    call: async (raw, context) => {
      const result = await call(argsOf(raw), context?.signal)
      return Array.isArray(result) ? { content: result } : result
    }
  })
}

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '')

/**
 * Titres qu'un agent donne à un appel d'outil de l'app, en entier (fiche 071) : Bob « Running Ask
 * User (bobine) », OpenCode « bobine_ask_user », d'autres « mcp__bobine__ask_user ». Le titre est
 * un texte libre de l'agent : un format approché laisserait passer une URL ou un chemin qui
 * contiennent ces mots.
 */
const TITLE_FORMATS = [
  new RegExp(`^Running (.+) \\(${APP_TOOLS_SERVER_NAME}\\)$`, 'i'),
  new RegExp(`^mcp__${APP_TOOLS_SERVER_NAME}__(\\w+)$`, 'i'),
  new RegExp(`^${APP_TOOLS_SERVER_NAME}_(\\w+)$`, 'i')
]

/** Outil de l'app désigné par le titre d'un appel d'outil de l'agent, dans un format connu. */
export function matchAppTool<T extends { definition: { name: string } }>(
  title: string | null | undefined,
  tools: readonly T[]
): T | undefined {
  const text = title?.trim() ?? ''
  for (const format of TITLE_FORMATS) {
    const name = format.exec(text)?.[1]
    if (name) return tools.find((tool) => normalize(tool.definition.name) === normalize(name))
  }
  return undefined
}

/**
 * Le titre nomme le serveur et un outil de l'app sans suivre un format connu : nouveau format d'un
 * agent, ou titre forgé. Jamais autorisé d'office ; seulement signalé dans le journal.
 */
export function resemblesAppTool(
  title: string | null | undefined,
  tools: readonly { definition: { name: string } }[]
): boolean {
  const flat = normalize(title ?? '')
  const server = normalize(APP_TOOLS_SERVER_NAME)
  if (!flat.includes(server)) return false
  const rest = flat.replace(server, ' ')
  return tools.some((tool) => rest.includes(normalize(tool.definition.name)))
}
