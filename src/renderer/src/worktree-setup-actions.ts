/** Actions de la carte « Préparation du worktree » (fiche 175) pour la conversation affichée. */
export function worktreeSetupActions(id: string, warn: (message: string) => void) {
  const fail = (error: unknown) => warn(String(error))
  return {
    onApprove: (signature: string) =>
      void window.api.conversations.approveWorktreeSetup(id, signature).catch(fail),
    onSkip: () => void window.api.conversations.skipWorktreeSetup(id).catch(fail),
    onStop: () => void window.api.conversations.stopWorktreeSetup(id).catch(fail)
  }
}
