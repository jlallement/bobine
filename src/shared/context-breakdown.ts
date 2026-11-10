/**
 * Place occupée dans le contexte de l'agent, par catégorie (onglet « Session », fiche 166). Bobine
 * ne voit pas le contexte du modèle : elle estime ce qu'elle connaît (le fil, ses propres outils,
 * les définitions des autres serveurs MCP) et attribue le reste à l'agent, sans le détailler.
 * Aucun coût ici (fiche 113 : le coût reste dans la puce de consommation).
 */
import type { ToolCallContent } from './acp-sdk.mts'
import type { TerminalState } from './terminal-output'
import type { TranscriptItem } from './transcript'
import { estimateTokens, type ConversationUsage } from './usage'

export type ContextLineId = 'messages' | 'bobine' | 'memory' | 'mcp' | 'agent' | 'free'

export interface ContextLine {
  id: ContextLineId
  tokens: number
  /** Estimation (affichée avec « ≈ ») ; « Libre » se déduit du total de l'agent. */
  estimated: boolean
  /**
   * Autres serveurs MCP (ligne `mcp`) : serveurs activés, ceux dont le poids est connu (résultat
   * de « Tester » en cache), mesure en cours. Rien n'est mesuré sans le demander (fiche 166).
   */
  mcp?: McpMeasure
}

export interface McpMeasure {
  servers: number
  measured: number
  testing: boolean
}

export interface ContextBreakdown {
  /** Total donné par l'agent (`usage_update`) ; absent : Bob, ou pas encore de mise à jour. */
  total?: { used: number; size: number; ratio: number }
  /** Somme des estimations (« ≈ N utilisés » sans total). */
  estimated: number
  /** Lignes dans l'ordre affiché ; leur somme vaut `total.size` quand il y a un total. */
  lines: ContextLine[]
}

export interface ContextInputs {
  items: readonly TranscriptItem[]
  terminals?: Readonly<Record<string, TerminalState>> | undefined
  usage?: ConversationUsage | undefined
  /** Poids des outils de Bobine que la session a reçus (fiche 109) ; absent : pas encore lu. */
  appTools?: number | undefined
  /**
   * Poids des définitions des autres serveurs MCP connus (fiche 060) ; absent : aucun serveur
   * activé, pas de ligne.
   */
  mcp?: (McpMeasure & { tokens: number }) | undefined
  /** Index de la mémoire joint à la session en cours (fiche 182) ; absent : pas de ligne. */
  memory?: number | undefined
}

/**
 * Premier élément du fil encore dans le contexte : après la dernière compaction (commande
 * `/compact` de l'app, `compaction_update`, baisse nette de `used`) ou passation à une nouvelle
 * session. Ces éléments comptent (la commande, le résumé, le message de passation).
 */
export function contextStart(items: readonly TranscriptItem[], usage?: ConversationUsage): number {
  let start = usage?.contextSince ?? 0
  for (const item of items) {
    const marker =
      (item.kind === 'user' && item.compaction) ||
      item.kind === 'compaction' ||
      item.kind === 'handover'
    if (marker && item.id > start) start = item.id
  }
  return start
}

function contentText(content: ToolCallContent, terminals: ContextInputs['terminals']): string {
  if (content.type === 'diff')
    return `${content.path}\n${content.oldText ?? ''}\n${content.newText}`
  if (content.type === 'terminal') return terminals?.[content.terminalId]?.output ?? ''
  return content.content.type === 'text' ? content.content.text : ''
}

/** Texte qu'un élément du fil met dans le contexte de l'agent (ni réflexion, ni avis de l'app). */
function itemText(item: TranscriptItem, terminals: ContextInputs['terminals']): string {
  switch (item.kind) {
    case 'user':
    case 'agent':
      return item.text
    case 'tool':
      // Le travail d'un sous-agent reste dans le contexte du sous-agent.
      return [item.title, ...item.content.map((c) => contentText(c, terminals))].join('\n')
    case 'compaction':
      return item.summary
    default:
      return ''
  }
}

/** Jetons estimés des messages du fil encore dans le contexte (≈ caractères / 4). */
export function messagesTokens(
  input: Pick<ContextInputs, 'items' | 'terminals' | 'usage'>
): number {
  const start = contextStart(input.items, input.usage)
  return input.items
    .filter((item) => item.id >= start)
    .reduce((sum, item) => sum + estimateTokens(itemText(item, input.terminals)), 0)
}

/** Lignes ramenées à `target` à proportion, en entiers dont la somme vaut exactement `target`. */
function scaledTo(lines: readonly ContextLine[], sum: number, target: number): ContextLine[] {
  const exact = lines.map((line) => (line.tokens * target) / sum)
  const scaled = lines.map((line, i) => ({ ...line, tokens: Math.floor(exact[i] ?? 0) }))
  // Reste des arrondis : aux plus grandes parties décimales.
  let rest = target - scaled.reduce((n, line) => n + line.tokens, 0)
  const order = exact
    .map((value, i) => ({ i, frac: value - Math.floor(value) }))
    .sort((a, b) => b.frac - a.frac)
  for (const { i } of order) {
    if (rest <= 0) break
    const line = scaled[i]
    if (line) line.tokens += 1
    rest--
  }
  return scaled
}

/**
 * Lignes du contexte. Avec un total : Messages, Outils de Bobine, Autres MCP, Agent (le reste du
 * total, jamais négatif) et Libre, dont la somme vaut la taille ; des estimations plus grandes que
 * le total sont ramenées à proportion (toujours marquées « ≈ »). Sans total : seulement ce que
 * Bobine connaît, tel quel.
 */
export function contextBreakdown(input: ContextInputs): ContextBreakdown {
  const known: ContextLine[] = [
    { id: 'messages', tokens: messagesTokens(input), estimated: true },
    ...(input.appTools ? [{ id: 'bobine' as const, tokens: input.appTools, estimated: true }] : []),
    ...(input.memory ? [{ id: 'memory' as const, tokens: input.memory, estimated: true }] : []),
    ...(input.mcp && input.mcp.servers > 0
      ? [
          {
            id: 'mcp' as const,
            tokens: input.mcp.tokens,
            estimated: true,
            mcp: {
              servers: input.mcp.servers,
              measured: input.mcp.measured,
              testing: input.mcp.testing
            }
          }
        ]
      : [])
  ]
  const estimated = known.reduce((sum, line) => sum + line.tokens, 0)
  const context = input.usage?.context
  if (!context || context.size <= 0) return { estimated, lines: known }
  const { size } = context
  const used = Math.min(Math.max(0, context.used), size)
  // Estimations plus grandes que le total de l'agent : ramenées à proportion de `used`, pour que
  // les lignes occupées fassent exactement le total annoncé (« Agent » vaut alors 0).
  const lines = estimated > used ? scaledTo(known, estimated, used) : known
  const sum = lines.reduce((n, line) => n + line.tokens, 0)
  const agent = Math.max(0, used - sum)
  const free = size - used
  return {
    total: { used, size, ratio: used / size },
    estimated,
    lines: [
      ...lines,
      { id: 'agent', tokens: agent, estimated: true },
      { id: 'free', tokens: free, estimated: false }
    ]
  }
}
