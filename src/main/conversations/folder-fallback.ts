/**
 * Dossier d'une nouvelle conversation qui n'existe plus (0.9.1, D21) : une conversation ne part
 * jamais d'un dossier disparu. Le plus souvent, c'est le worktree d'une conversation nettoyée :
 * on repart alors du dépôt d'où il venait (même sous-dossier s'il existe encore), sinon du dossier
 * par défaut des nouvelles conversations, sinon d'aucun : l'app demande le dossier (fiche 093).
 * Jamais d'un autre projet pris au hasard (dossiers récents), ni du worktree d'une autre
 * conversation. La conversation le dit.
 */
import { join, sep } from 'node:path'
import type { Message } from '@shared/i18n/message'
import { isDirectory } from '../agent/process-utils'
import { WORKTREES_DIR } from '../changes/worktrees'
import { hasFolder, NO_FOLDER } from './agentless'

/** Dépôt d'un dossier pris dans un worktree de Bobine (`<dépôt>/.worktrees/<nom>/…`), et le sous-dossier. */
export function worktreeOrigin(folder: string): string[] {
  const marker = `${sep}${WORKTREES_DIR}${sep}`
  // Le dernier : un worktree pris dans un autre remonte à son propre dépôt, pas plus haut.
  const at = folder.lastIndexOf(marker)
  if (at < 0) return []
  const root = folder.slice(0, at)
  const inside = folder
    .slice(at + marker.length)
    .split(sep)
    .slice(1)
    .join(sep)
  return inside ? [join(root, inside), root] : [root]
}

/**
 * Dossier à prendre pour `wanted` : lui s'il existe (ou s'il n'y en a pas), sinon le premier qui
 * existe parmi l'origine de son worktree et `others` ; `gone` : le dossier disparu, à dire.
 */
export function usableFolder(
  wanted: string,
  others: readonly (string | undefined)[]
): { workspace: string; gone?: string } {
  if (!hasFolder(wanted) || isDirectory(wanted)) return { workspace: wanted }
  for (const folder of [...worktreeOrigin(wanted), ...others]) {
    if (
      folder &&
      hasFolder(folder) &&
      folder !== wanted &&
      !insideWorktrees(folder) &&
      isDirectory(folder)
    ) {
      return { workspace: folder, gone: wanted }
    }
  }
  return { workspace: NO_FOLDER, gone: wanted }
}

/** Dossier pris dans un worktree de Bobine (celui d'une autre conversation, peut-être). */
function insideWorktrees(folder: string): boolean {
  return (
    folder.includes(`${sep}${WORKTREES_DIR}${sep}`) || folder.endsWith(`${sep}${WORKTREES_DIR}`)
  )
}

/** Ce que la conversation dit du dossier disparu, et d'où elle part à la place. */
export function folderGoneMessage(gone: string, workspace: string): Message {
  return hasFolder(workspace)
    ? { key: 'conversations.notice.folderFallback', params: { folder: gone, fallback: workspace } }
    : { key: 'conversations.notice.folderGone', params: { folder: gone } }
}
