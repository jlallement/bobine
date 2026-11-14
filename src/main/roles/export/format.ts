/**
 * Adaptateur d'un format d'installation de rôle (fiche 223, phase 4, ADR-0047) : où l'agent lit
 * ses modes ou ses agents, ce que Bobine y écrit, et comment retrouver ou retirer **sa seule**
 * entrée. Fonctions pures sur le texte du fichier : rien ici ne touche au disque (le service
 * `service.ts` lit, sauvegarde et écrit), ce qui permet aux sondes de vérifier exactement ce que
 * Bobine écrit.
 */
import { createHash } from 'node:crypto'
import type { RoleExportError, RoleExportFormat, RoleExportScope } from '@shared/role-export'

/** Ce qui part dans le fichier de l'agent, tiré du rôle (textes déjà dans la bonne langue). */
export interface ExportedRole {
  /** Identifiant du mode ou de l'agent : le nom du rôle. */
  id: string
  label: string
  description: string
  prompt: string
  readOnly: boolean
}

/** Dossiers où l'agent cherche ses fichiers (jamais les vrais dans les essais). */
export interface ExportLocations {
  home: string
  /** `XDG_CONFIG_HOME` (OpenCode) ; absent : `<home>/.config`. */
  xdgConfigHome?: string
}

/** Notre entrée dans le texte du fichier. */
export type EntryRead =
  | { kind: 'absent' }
  | { kind: 'present'; fingerprint: string }
  | { kind: 'invalid'; error: RoleExportError }

export type TextChange = { text: string | null; fingerprint?: string } | { error: RoleExportError }

export interface RoleExportAdapter {
  format: RoleExportFormat
  /**
   * Fichier où écrire ; `root` : le dossier personnel ou celui du projet, sous lequel aucun dossier
   * du chemin ne doit être un lien (projet : posé par un dépôt).
   */
  place: (
    scope: RoleExportScope,
    id: string,
    loc: ExportLocations,
    workspace?: string
  ) => { file: string; root: string; shown: string }
  /** Identifiants que l'agent garde pour lui (comparés sans la casse). */
  reserved: readonly string[]
  /** Texte montré par « Voir ce qui sera écrit » : l'entrée du mode, ou le fichier entier. */
  entryText: (role: ExportedRole) => string
  /** Empreinte de l'entrée telle que Bobine l'écrirait pour ce rôle. */
  fingerprintOf: (role: ExportedRole) => string
  /** Notre entrée dans le texte du fichier (`undefined` : fichier absent). */
  find: (text: string | undefined, id: string) => EntryRead
  /** Texte du fichier une fois l'entrée posée (ajoutée ou remplacée) ; le reste tel quel. */
  put: (text: string | undefined, role: ExportedRole) => TextChange
  /** Texte du fichier une fois l'entrée retirée ; `null` : supprimer le fichier. */
  drop: (text: string, id: string) => TextChange
}

/** Empreinte stable d'un texte ou d'une valeur. */
export function fingerprint(value: unknown): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  return createHash('sha256').update(text).digest('hex').slice(0, 32)
}

/**
 * Ligne ajoutée à la consigne d'un rôle en lecture seule : l'agent l'applique lui-même (ses droits
 * le tiennent aussi). Texte pour l'agent, en anglais (ADR-0014).
 */
export const EXPORT_READ_ONLY_LINE =
  'You are read-only: do not create, edit, delete or move files, do not commit, and do not run ' +
  'commands that write.'

/** Consigne écrite dans l'agent : celle du rôle, plus la lecture seule. */
export const exportedPrompt = (role: ExportedRole): string =>
  role.readOnly ? `${role.prompt.trimEnd()}\n\n${EXPORT_READ_ONLY_LINE}` : role.prompt.trimEnd()

/** Chemin affiché : `~` pour le dossier personnel, relatif pour le projet. */
export function shownPath(file: string, root: string, scope: RoleExportScope): string {
  const base = root.replace(/\/+$/, '')
  if (!file.startsWith(`${base}/`)) return file
  return scope === 'user' ? `~${file.slice(base.length)}` : file.slice(base.length + 1)
}
