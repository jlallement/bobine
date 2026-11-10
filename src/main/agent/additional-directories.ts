/**
 * Autres dossiers de la conversation (fiche 179) : champ `additionalDirectories` de `session/new`,
 * `session/load` et `session/resume`, envoyé seulement à un agent qui annonce
 * `sessionCapabilities.additionalDirectories` (rien n'est supposé d'un agent qui ne l'annonce pas,
 * Bob compris). Liste complète à chaque ouverture : le protocole ne prévoit pas de la changer en
 * cours de session.
 */
import { isAbsolute } from 'node:path'
import { log } from '../log'
import { isDirectory } from './process-utils'

/** Champ à ajouter à la requête d'ouverture de session (vide si rien n'est à envoyer). */
export function additionalDirectoriesParam(
  supported: boolean,
  folders: readonly string[] | undefined
): { additionalDirectories?: string[] } {
  if (!supported || !folders?.length) return {}
  // Chemins absolus et dossiers encore là : un dossier disparu n'est pas envoyé (ACP l'exige).
  const kept = folders.filter((folder) => isAbsolute(folder) && isDirectory(folder))
  const dropped = folders.filter((folder) => !kept.includes(folder))
  if (dropped.length > 0) log.warn('Autres dossiers introuvables, non envoyés :', dropped)
  return kept.length > 0 ? { additionalDirectories: kept } : {}
}

/** Autres dossiers que l'agent a lus dans un message, pour une session donnée (fiche 179, D13). */
export interface ToldDirectories {
  sessionId: string
  folders: string[]
}

/**
 * Ligne de contexte (en anglais, pour l'agent : ADR-0014) quand la liste envoyée diffère de celle
 * que l'agent a lue : un agent peut recevoir `additionalDirectories` sans en parler à son modèle
 * (OpenCode, recette 0.9). Rien si les deux listes sont les mêmes.
 */
export function directoriesContext(
  told: readonly string[],
  sent: readonly string[]
): string | undefined {
  const removed = told.filter((folder) => !sent.includes(folder))
  if (removed.length === 0 && sent.every((folder) => told.includes(folder))) return undefined
  const list = sent.length > 0 ? sent.join(', ') : 'none'
  const gone = removed.length > 0 ? ` (removed ${removed.join(', ')})` : ''
  return `Additional working directories for this conversation: ${list}${gone}`
}

/**
 * Autres dossiers d'une session : le champ de la requête d'ouverture (liste retenue), puis la
 * ligne de contexte du prochain message, une fois par changement. `told` : ce que l'agent a lu,
 * gardé par l'app (la session rouverte garde son historique, l'hôte d'agent est recréé).
 */
/** Où l'app garde ce que l'agent a lu des autres dossiers (dans la fiche de la conversation). */
export interface ToldStore {
  get(): ToldDirectories | undefined
  set(told: ToldDirectories): void
}

export class SessionDirectories {
  private sent: string[] = []
  private readonly folders: () => readonly string[] | undefined
  private readonly told: ToldStore | undefined

  constructor(folders: () => readonly string[] | undefined, told?: ToldStore) {
    this.folders = folders
    this.told = told
  }

  /** Champ de `session/new`, `session/load` ou `session/resume` ; la liste envoyée est retenue. */
  param(supported: boolean): { additionalDirectories?: string[] } {
    const param = additionalDirectoriesParam(supported, this.folders())
    this.sent = param.additionalDirectories ?? []
    return param
  }

  /** Ligne à joindre au message envoyé dans cette session, si l'agent ne connaît pas la liste. */
  context(sessionId: string): string | undefined {
    if (!this.told) return undefined
    const told = this.told.get()
    const line = directoriesContext(told?.sessionId === sessionId ? told.folders : [], this.sent)
    if (line) this.told.set({ sessionId, folders: [...this.sent] })
    return line
  }
}
