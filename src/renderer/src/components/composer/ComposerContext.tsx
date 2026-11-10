import type { AgentConfigureRequest, AgentSettingsView } from '@shared/agent'
import { BranchChip, ComposerFocus, WorkspaceMenu } from '../common/Menus'
import type { GitBranchInfo } from '../common/Menus'

/**
 * Dossier et branche git, sur une ligne discrète sous la zone de saisie (fiche 092) : la barre
 * garde sa place pour le mode, le modèle et l'agent. Mêmes menus au clic qu'avant.
 */
export function ComposerContext(props: {
  settings: AgentSettingsView | null
  /** Réponse ou démarrage en cours : pas de dossier à changer. */
  locked: boolean
  /** Branche du worktree de la conversation (fiche 036) : montrée à la place du dossier. */
  branch: string | undefined
  /** Branche git du dossier (fiche 049). */
  gitBranch: GitBranchInfo | undefined
  onConfigure: (request: AgentConfigureRequest) => void
  onChooseWorkspace: () => void
  onNewWorktree: (() => void) | undefined
  /** Menu du dossier (fiche 158) : le montrer dans le gestionnaire de fichiers, y ouvrir le terminal. */
  onRevealWorkspace?: () => void
  onOpenTerminalHere?: () => void
  /** Rend le focus à la zone de saisie, après un choix dans le menu du dossier. */
  onFocusInput: () => void
}) {
  const { settings, branch, gitBranch } = props
  // Conversation en worktree : sa branche est déjà la puce du dossier.
  const ownBranch = gitBranch && gitBranch.name !== branch ? gitBranch : undefined
  if (!settings && !ownBranch) return null
  return (
    <ComposerFocus.Provider value={props.onFocusInput}>
      <div className="composer-context" data-testid="composer-context">
        {settings && (
          <WorkspaceMenu
            settings={settings}
            disabled={props.locked}
            {...(branch ? { branch } : {})}
            onConfigure={props.onConfigure}
            onChooseWorkspace={props.onChooseWorkspace}
            {...(props.onNewWorktree ? { onNewWorktree: props.onNewWorktree } : {})}
            {...(props.onRevealWorkspace ? { onReveal: props.onRevealWorkspace } : {})}
            {...(props.onOpenTerminalHere ? { onOpenTerminal: props.onOpenTerminalHere } : {})}
          />
        )}
        {ownBranch && <BranchChip branch={ownBranch} />}
      </div>
    </ComposerFocus.Provider>
  )
}
