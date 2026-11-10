/**
 * Ce que l'agent a déjà dit d'un appel d'outil, gardé jusqu'à sa fin (fiche 202). Un
 * `tool_call_update` terminé ne répète pas tout : OpenCode 2.2.5 donne l'entrée de son `write`
 * (`rawInput`) en `in_progress`, et le diff seulement dans sa demande d'autorisation, quand il en
 * fait une ; sa fin, elle, ne porte qu'un texte. Générique : seuls les champs ACP sont retenus.
 *
 * Sans alias (`@shared`) : la sonde `pnpm opencode-probe` le charge sous Node, sans bundler.
 */
import type {
  SessionUpdate,
  ToolCallContent,
  ToolCallUpdate,
  ToolKind
} from '../../shared/acp-sdk.mts'

export type Diff = Extract<ToolCallContent, { type: 'diff' }>

/** Un appel d'outil tel que ses mises à jour successives l'ont décrit. */
export interface ToolCallSoFar {
  title?: string
  kind?: ToolKind
  /** Dernière entrée brute non vide (une mise à jour peut la renvoyer vide : `{}`). */
  rawInput?: unknown
  /** Diffs de sa demande d'autorisation, s'il y en a eu une. */
  permissionDiffs: Diff[]
  /** Fichiers proposés déjà regardés sur le disque (`new-files.ts`, fiche 203). */
  checkedPaths: Set<string>
  /** Parmi eux, ceux qui n'existaient pas quand l'agent les a proposés : des créations. */
  absentPaths: Set<string>
}

/** Appels suivis au plus : ceux qu'un agent ne termine jamais sortent les premiers. */
const MAX_CALLS = 500

const isEmptyInput = (input: unknown) =>
  input === undefined ||
  input === null ||
  (typeof input === 'object' && Object.keys(input).length === 0)

const diffsOf = (content: readonly ToolCallContent[] | null | undefined): Diff[] =>
  (content ?? []).flatMap((c) => (c.type === 'diff' ? [c] : []))

export class ToolCallMemory {
  private readonly calls = new Map<string, ToolCallSoFar>()

  /** Ce que l'appel a dit jusqu'ici, cette mise à jour comprise ; rien si ce n'est pas un outil. */
  note(update: SessionUpdate): ToolCallSoFar | undefined {
    if (update.sessionUpdate !== 'tool_call' && update.sessionUpdate !== 'tool_call_update') {
      return undefined
    }
    return this.merge(update.toolCallId, update)
  }

  /** L'appel d'outil d'une demande d'autorisation : ses diffs sont ce qui sera écrit. */
  notePermission(toolCall: ToolCallUpdate): ToolCallSoFar {
    const known = this.merge(toolCall.toolCallId, { ...toolCall, title: undefined })
    const diffs = diffsOf(toolCall.content)
    if (diffs.length > 0) known.permissionDiffs = diffs
    return known
  }

  /** L'appel est fini (terminé, en échec, annulé) : plus rien à compléter. */
  forget(toolCallId: string): void {
    this.calls.delete(toolCallId)
  }

  clear(): void {
    this.calls.clear()
  }

  private merge(
    id: string,
    part: Pick<ToolCallUpdate, 'kind' | 'rawInput'> & { title?: string | null | undefined }
  ): ToolCallSoFar {
    const known = this.calls.get(id) ?? {
      permissionDiffs: [],
      checkedPaths: new Set<string>(),
      absentPaths: new Set<string>()
    }
    // Remis en dernier : le plus récemment servi sort le dernier.
    this.calls.delete(id)
    this.calls.set(id, known)
    if (part.title) known.title = part.title
    if (part.kind) known.kind = part.kind
    if (!isEmptyInput(part.rawInput)) known.rawInput = part.rawInput
    while (this.calls.size > MAX_CALLS) {
      const oldest = this.calls.keys().next().value
      if (oldest === undefined) break
      this.calls.delete(oldest)
    }
    return known
  }
}

/**
 * Règle générique (fiche 202) : un outil terminé dont la fin ne porte pas le diff qu'avait sa
 * demande d'autorisation le garde — c'est ce que l'utilisateur a accepté, et ce qui a été écrit.
 * Seulement pour les fichiers sans diff dans la fin ; sans contenu dans la fin, rien (la carte
 * garde déjà celui de la demande).
 */
export function withPermissionDiffs(update: SessionUpdate, soFar?: ToolCallSoFar): SessionUpdate {
  if (update.sessionUpdate !== 'tool_call' && update.sessionUpdate !== 'tool_call_update') {
    return update
  }
  if (update.status !== 'completed' || !Array.isArray(update.content)) return update
  if (!soFar || soFar.permissionDiffs.length === 0) return update
  const known = new Set(diffsOf(update.content).map((d) => d.path))
  const added = soFar.permissionDiffs.filter((d) => !known.has(d.path))
  return added.length === 0 ? update : { ...update, content: [...update.content, ...added] }
}
