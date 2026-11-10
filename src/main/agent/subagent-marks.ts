/**
 * Marque des appels d'outil qui lancent un sous-agent (fiche 140) : le format du profil
 * (`SubagentFormat`) les reconnaît, la marque générique `_meta["bobine/subagent"]` le dit au reste
 * de l'app (fil, suivi des sous-agents), qui ne connaît aucun format d'agent. Le titre d'un appel
 * est retenu : une mise à jour suivante peut porter l'entrée sans le titre.
 */
import type { SessionUpdate, ToolCallContent, ToolCallUpdate } from '../../shared/acp-sdk.mts'
import { withSubagentMark, type SubagentMark } from '@shared/subagent'
import type { SubagentFormat } from './adapters'

/** Texte du résultat d'un outil (contenu texte et sortie brute). */
export function outputOf(update: {
  content?: ToolCallContent[] | null
  rawOutput?: unknown
}): string {
  const parts = (update.content ?? []).flatMap((c) =>
    c.type === 'content' && c.content.type === 'text' ? [c.content.text] : []
  )
  if (typeof update.rawOutput === 'string') parts.push(update.rawOutput)
  return parts.join('\n')
}

export class SubagentMarker {
  private readonly format: SubagentFormat | undefined
  /** Dernier titre annoncé, par appel. */
  private readonly titles = new Map<string, string>()
  /** Appels reconnus comme sous-agents, jusqu'à leur fin. */
  private readonly known = new Set<string>()

  constructor(format: SubagentFormat | undefined) {
    this.format = format
  }

  /** La mise à jour, marquée si elle concerne un sous-agent ; telle quelle sinon. */
  mark(update: SessionUpdate): SessionUpdate {
    if (update.sessionUpdate !== 'tool_call' && update.sessionUpdate !== 'tool_call_update') {
      return update
    }
    if (!this.format) return update
    const { toolCallId } = update
    if (update.title) this.titles.set(toolCallId, update.title)
    const subagent = this.format.subagentOf(this.titles.get(toolCallId), update.rawInput)
    if (subagent) this.known.add(toolCallId)
    const ended = update.status === 'completed' || update.status === 'failed'
    const sessionId =
      ended && this.known.has(toolCallId)
        ? this.format.sessionId?.(outputOf(update), update.rawOutput)
        : undefined
    if (ended) {
      this.titles.delete(toolCallId)
      this.known.delete(toolCallId)
    }
    const mark: SubagentMark = {
      ...(subagent ? { subagent } : {}),
      ...(sessionId ? { sessionId } : {})
    }
    return Object.keys(mark).length ? withSubagentMark(update, mark) : update
  }

  /**
   * Appel d'outil d'une demande d'autorisation, marqué s'il lance un sous-agent : le titre de la
   * carte, s'il est connu, l'emporte sur celui de la demande (souvent plus générique).
   */
  markPermission(toolCall: ToolCallUpdate): ToolCallUpdate {
    if (!this.format) return toolCall
    const title = this.titles.get(toolCall.toolCallId) ?? toolCall.title ?? undefined
    const subagent = this.format.subagentOf(title, toolCall.rawInput)
    if (!subagent) return toolCall
    this.known.add(toolCall.toolCallId)
    return withSubagentMark(toolCall, { subagent })
  }

  /** Nouvelle session : plus rien n'est retenu. */
  clear(): void {
    this.titles.clear()
    this.known.clear()
  }
}
