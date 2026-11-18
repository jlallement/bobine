/**
 * Dossier de la mère avant le lancement d'une fille en worktree (fiche 240, ADR-0055). Une fille
 * part du dernier commit : le non commité de la mère n'est pas dans son worktree. Bobine le dit
 * avant, et l'utilisateur choisit : committer d'abord, partir quand même, ou (rôle cité avec `@`)
 * demander un avis en lecture seule, dans le dossier de la mère, non commité compris.
 */
import type { CommitFile } from './worktree-cycle'

/** Modifications non commitées du dossier d'une mère, et le commit d'où partirait la fille. */
export interface FolderDirty {
  /** Nombre de modifications (fichiers suivis modifiés, nouveaux, supprimés). */
  count: number
  /** Les fichiers, relatifs à la racine du dépôt : « Committer d'abord » les prend tous. */
  files: CommitFile[]
  /** Commit de départ, en abrégé. */
  commit: string
  /** Branche extraite ; absente : HEAD détachée. */
  branch?: string
  /** Sujet du commit de départ. */
  subject?: string
  /** Titre de la mère, d'où proposer le message de commit. */
  title?: string
}

/**
 * Choix de l'utilisateur devant un dossier modifié : partir quand même (sans le non commité), ou
 * un avis en lecture seule dans le dossier de la mère (rôles cités avec `@` seulement). Committer
 * d'abord ne se transmet pas : le dossier est propre ensuite.
 */
export type UncommittedChoice = 'anyway' | 'readOnly'
export const UNCOMMITTED_CHOICES: readonly UncommittedChoice[] = ['anyway', 'readOnly']

/** Ce qu'une fille a laissé derrière elle en partant : rappelé dans la mère. */
export interface LeftBehind {
  /** Modifications non commitées du dossier de la mère au lancement. */
  count: number
  /** Commit d'où la fille est partie, en abrégé. */
  commit: string
}

/** Choix lu depuis le renderer ou une élicitation ; rien d'autre n'est accepté. */
export function parseUncommittedChoice(value: unknown): UncommittedChoice | undefined {
  if (value === undefined) return undefined
  if (UNCOMMITTED_CHOICES.includes(value as UncommittedChoice)) return value as UncommittedChoice
  throw new Error('Paramètre invalide : uncommitted')
}

/** Ce que l'agent de la mère lit d'une fille partie sans le non commité (en anglais, ADR-0014). */
export function leftBehindText(left: LeftBehind): string {
  return `It started from commit ${left.commit} WITHOUT the ${left.count} uncommitted change(s) of your folder: it has not seen them, and its work does not include them.`
}

/** Fichiers cités par l'avertissement renvoyé à l'agent. */
const CITED = 8

/**
 * Avertissement de `start_child` quand le dossier de la mère a du non commité (critère de la
 * fiche 240) : combien, lesquels, et ce qui manquera à la fille.
 */
export function uncommittedWarning(dirty: FolderDirty): string {
  const cited = dirty.files.slice(0, CITED).map((f) => f.path)
  const more = dirty.count > cited.length ? `, and ${dirty.count - cited.length} more` : ''
  return `Warning: this folder has ${dirty.count} uncommitted change(s) (${cited.join(', ')}${more}). A child conversation starts from the last commit (${dirty.commit}) in its own worktree: these changes are NOT there, so the child will not see them. Commit your work before starting children that need it.`
}
