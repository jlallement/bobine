/**
 * « Enregistrer comme rôle » sur le compte rendu d'une fille sans rôle (fiche 223, maquette
 * 01-C2) : l'assistant de création s'ouvre prérempli de ce qui a marché — la demande faite à la
 * fille comme consigne, son agent et son modèle, la lecture seule si elle n'a rien modifié.
 * L'utilisateur nomme le rôle et relit tout avant de l'enregistrer : rien n'est écrit sans lui.
 */
import type { RoleDraft } from './role-draft'
import { openRoleWizard } from './roles-store'

export interface SavedChild {
  id: string
  /** Agent de la fille ; absent si elle n'est plus dans la liste des conversations. */
  profileId?: string | undefined
  /** Sa consigne (premier message, `child-started.prompt`). */
  prompt: string
  /** Fichiers modifiés selon son compte rendu. */
  fileCount: number
}

/** Préremplissage de l'assistant ; `model` : valeur du réglage de modèle de sa session. */
export function childRolePrefill(child: SavedChild, model?: string): Partial<RoleDraft> {
  return {
    prompt: child.prompt.trim(),
    ...(child.profileId ? { agent: child.profileId } : {}),
    ...(model ? { model } : {}),
    readOnly: child.fileCount === 0
  }
}

/** Modèle choisi dans la session de la fille (réglage de catégorie `model`), s'il y en a un. */
async function childModel(id: string): Promise<string | undefined> {
  try {
    const view = await window.api.conversations.view(id)
    const control = view.snapshot?.controls.find(
      (c) => c.category === 'model' && c.type === 'select'
    )
    return typeof control?.currentValue === 'string' ? control.currentValue : undefined
  } catch {
    // Fille supprimée ou session illisible : l'assistant s'ouvre sans modèle.
    return undefined
  }
}

export async function saveChildAsRole(child: SavedChild): Promise<void> {
  openRoleWizard(childRolePrefill(child, await childModel(child.id)))
}

/**
 * Geste du compte rendu d'une fille dans le fil de sa mère : absent si la fille a un rôle, n'a
 * pas fini avec succès, ou si sa consigne n'est plus dans le fil.
 */
export function saveAsRoleAction(
  report: { childId: string; outcome: string; fileCount: number },
  launch: { prompt: string; role?: unknown } | undefined,
  children: readonly { id: string; profileId: string }[] | undefined
): (() => void) | undefined {
  if (!launch || launch.role || report.outcome !== 'done' || !launch.prompt.trim()) return undefined
  const profileId = children?.find((c) => c.id === report.childId)?.profileId
  return () =>
    void saveChildAsRole({
      id: report.childId,
      profileId,
      prompt: launch.prompt,
      fileCount: report.fileCount
    })
}
