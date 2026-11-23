/**
 * Dossier d'une nouvelle tâche planifiée (fiche 276, T12) : celui de la conversation ouverte
 * (espace Code), sinon le plus récent des dossiers récents ; les autres à un clic, sans la fenêtre
 * de macOS. Le dossier ouvert d'abord, puis les récents, chacun une fois.
 */
export function taskFolders(current: string | undefined, recents: readonly string[]): string[] {
  return [...new Set([...(current ? [current] : []), ...recents.filter(Boolean)])]
}

/** Dossier proposé d'office pour une nouvelle tâche ; chaîne vide : aucun à proposer. */
export function initialTaskFolder(current: string | undefined, recents: readonly string[]): string {
  return taskFolders(current, recents)[0] ?? ''
}

/**
 * Projet d'une conversation pour une tâche planifiée : la racine du dépôt pour une conversation en
 * worktree (jamais le worktree, effacé à la fin de son travail) ; rien pour une discussion, dont
 * le dossier est tenu par Bobine.
 */
export function codeProject(
  conversation: { workspace: string; project?: string; space?: string } | null | undefined
): string | undefined {
  if (!conversation || conversation.space === 'discussion') return undefined
  return conversation.project ?? conversation.workspace
}
