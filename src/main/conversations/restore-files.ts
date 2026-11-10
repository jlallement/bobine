/**
 * Remettre les fichiers dans leur état d'alors (fiche 023) : pour chaque fichier modifié par l'agent
 * depuis le point de départ d'une branche, ses modifications sont défaites à partir du contenu
 * actuel (`undoEdits` : diffs complets de Bob, extraits d'OpenCode). Si ce n'est pas possible sans
 * risque — quelqu'un l'a modifié depuis —, le fichier n'est pas touché. Rien hors du dossier de la
 * conversation.
 */
import { readFile, rm, writeFile } from 'node:fs/promises'
import { isAbsolute, relative, resolve } from 'node:path'
import { undoEdits, type FileChange } from '@shared/branch'

export type RestoreStatus =
  /** Sera remis dans son état d'avant. */
  | 'restore'
  /** Déjà dans son état d'avant : rien à faire. */
  | 'unchanged'
  /** Modifié depuis par quelqu'un d'autre (ou supprimé) : pas touché. */
  | 'conflict'
  /** Hors du dossier de la conversation : pas touché. */
  | 'outside'

export interface RestorePlanItem {
  path: string
  status: RestoreStatus
  /** Le fichier avait été créé par l'agent : il sera supprimé. */
  created: boolean
  /** Contenu à remettre (`null` : supprimer le fichier). */
  target?: string | null
}

function inside(root: string, path: string): boolean {
  const rel = relative(resolve(root), resolve(root, path))
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel)
}

export async function planRestore(
  root: string,
  changes: readonly FileChange[]
): Promise<RestorePlanItem[]> {
  return Promise.all(
    changes.map(async (change): Promise<RestorePlanItem> => {
      const created = !change.edits[0]?.oldText
      const path = resolve(root, change.path)
      if (!inside(root, change.path)) return { path, status: 'outside', created }
      const current = await readFile(path, 'utf8').catch(() => null)
      const undone = undoEdits(current, change.edits)
      if (undone && 'deleted' in undone) return { path, status: 'restore', created, target: null }
      if (undone) {
        const status = undone.content === current ? 'unchanged' : 'restore'
        return { path, status, created, target: undone.content }
      }
      // Déjà dans son état d'avant : diff complet revenu au texte de départ, ou fichier créé par
      // l'agent puis supprimé.
      if (current !== null && current === change.edits[0]?.oldText) {
        return { path, status: 'unchanged', created }
      }
      // Fichier créé par l'agent puis déjà supprimé : il est dans son état d'avant.
      if (created && current === null) return { path, status: 'unchanged', created }
      return { path, status: 'conflict', created }
    })
  )
}

/** Remet en place les fichiers du plan marqués `restore` ; rend ceux qui l'ont été. */
export async function applyRestore(
  root: string,
  changes: readonly FileChange[]
): Promise<{ restored: string[]; skipped: string[] }> {
  const plan = await planRestore(root, changes)
  const restored: string[] = []
  const skipped: string[] = []
  for (const item of plan) {
    if (item.status === 'unchanged') continue
    if (item.status !== 'restore' || item.target === undefined) {
      skipped.push(item.path)
      continue
    }
    try {
      if (item.target === null) await rm(item.path, { force: true })
      else await writeFile(item.path, item.target)
      restored.push(item.path)
    } catch {
      skipped.push(item.path)
    }
  }
  return { restored, skipped }
}
