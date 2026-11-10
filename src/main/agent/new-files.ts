/**
 * Fichier nouveau, d'après le disque au moment de la proposition (fiche 203, correctif de recette
 * avec Bob 2.0.9). La convention de l'app : un diff sans ancien texte (`oldText` nul) est une
 * création (badge « nouveau fichier », « Création de … »). OpenCode la suit ; Bob 2.0.9 envoie
 * `oldText: ""` pour un fichier qu'il crée, comme pour un fichier vide qu'il réécrit. Seul le
 * disque les distingue, et seulement AVANT l'écriture : quand l'agent propose l'outil (`tool_call`
 * en attente, demande d'autorisation). Le constat est gardé avec l'appel (`ToolCallSoFar`), puis
 * chaque diff `oldText: ""` d'un fichier constaté absent est remis à la convention (`null`) : le
 * fil enregistré, le rejeu et la réouverture n'ont rien d'autre à savoir. Générique (ADR-0011) :
 * seuls les champs ACP sont lus.
 *
 * Sans alias (`@shared`) : chargé avec `tool-call-memory.ts` par la sonde, sous Node.
 */
import { lstatSync } from 'node:fs'
import { isAbsolute } from 'node:path'
import type {
  SessionUpdate,
  ToolCallContent,
  ToolCallLocation,
  ToolCallUpdate
} from '../../shared/acp-sdk.mts'
import type { ToolCallSoFar } from './tool-call-memory'

/** Le chemin existe-t-il ? Au moindre doute (droits…), oui : rien n'est dit « nouveau ». */
export type FileExists = (path: string) => boolean

/** `lstat` seulement : rien n'est lu, un lien n'est pas suivi (un lien cassé existe). */
export const existsOnDisk: FileExists = (path) => {
  try {
    return lstatSync(path, { throwIfNoEntry: false }) !== undefined
  } catch {
    return true
  }
}

/** Ce qu'une proposition d'outil dit de ses fichiers (champs ACP). */
interface Proposal {
  locations?: readonly ToolCallLocation[] | null | undefined
  content?: readonly ToolCallContent[] | null | undefined
}

/** Fichiers visés : emplacements et chemins des diffs, absolus seulement (sinon, rien de vérifié). */
function proposedPaths(part: Proposal): string[] {
  const paths = [
    ...(part.locations ?? []).map((l) => l.path),
    ...(part.content ?? []).flatMap((c) => (c.type === 'diff' ? [c.path] : []))
  ]
  return [...new Set(paths.filter((p) => typeof p === 'string' && isAbsolute(p)))]
}

/**
 * Constate, pour un outil d'écriture (`kind: edit`) pas encore lancé, quels fichiers proposés
 * n'existent pas. Chaque chemin n'est regardé qu'une fois par appel : la première fois qu'il est
 * proposé ; plus tard, l'agent a pu l'écrire.
 */
export function noteProposedFiles(soFar: ToolCallSoFar, part: Proposal, exists: FileExists): void {
  if (soFar.kind !== 'edit') return
  for (const path of proposedPaths(part)) {
    if (soFar.checkedPaths.has(path)) continue
    soFar.checkedPaths.add(path)
    if (!exists(path)) soFar.absentPaths.add(path)
  }
}

/** Les diffs `oldText: ""` d'un fichier constaté absent, remis à la convention (`oldText: null`). */
export function withNewFiles<T extends SessionUpdate | ToolCallUpdate>(
  part: T,
  soFar: ToolCallSoFar | undefined
): T {
  if (!soFar || soFar.absentPaths.size === 0) return part
  if (
    'sessionUpdate' in part &&
    part.sessionUpdate !== 'tool_call' &&
    part.sessionUpdate !== 'tool_call_update'
  )
    return part
  const current = (part as ToolCallUpdate).content
  if (!Array.isArray(current)) return part
  let changed = false
  const content = current.map((c) => {
    if (c.type !== 'diff' || c.oldText !== '' || !soFar.absentPaths.has(c.path)) return c
    changed = true
    return { ...c, oldText: null }
  })
  return changed ? { ...part, content } : part
}
