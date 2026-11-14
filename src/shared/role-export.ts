/**
 * Installer un rôle dans un agent (fiche 223, phase 4, ADR-0047) : comme mode natif de Bob
 * (`custom_modes.yaml`) ou comme agent d'OpenCode (`agents/<id>.md`). À sens unique, toujours sur
 * un geste de l'utilisateur, après une copie de sauvegarde ; Bobine ne touche jamais une entrée
 * qu'elle n'a pas écrite. Le format est déclaré par le profil de l'agent (`roleExport`, ADR-0011) :
 * l'interface ne connaît que ces types.
 */

/** Format d'installation déclaré par un profil (un adaptateur par format, côté main). */
export const ROLE_EXPORT_FORMATS = ['bob-custom-modes', 'opencode-agents'] as const
export type RoleExportFormat = (typeof ROLE_EXPORT_FORMATS)[number]

/** Pour l'utilisateur (tous ses projets) ou pour le projet de la conversation seulement. */
export type RoleExportScope = 'user' | 'project'

/** Le rôle à installer, désigné comme dans Réglages › Rôles. */
export interface RoleExportRef {
  /** Portée du rôle dans Bobine (`builtin`, `user`, `project`). */
  scope: 'builtin' | 'user' | 'project'
  name: string
  /** Conversation dont le dossier est le projet ; jamais un chemin venu du renderer. */
  conversationId?: string
}

/** Où installer. */
export interface RoleExportTarget {
  profileId: string
  scope: RoleExportScope
}

export type RoleExportErrorCode =
  /** Identifiant réservé par l'agent (`plan`, `build`…). */
  | 'reserved'
  /** Une entrée de cet identifiant existe, que Bobine n'a pas écrite : rien n'est changé. */
  | 'foreign'
  /** L'entrée écrite par Bobine a été modifiée depuis : rien sans confirmation. */
  | 'handEdited'
  /** Le fichier (ou un dossier du projet sur son chemin) est un lien symbolique : refusé. */
  | 'link'
  /** Fichier illisible ou d'un format inattendu : jamais réécrit. */
  | 'invalidFile'
  /** Portée projet sans dossier de projet. */
  | 'noProject'
  /** Agent sans installation de rôles déclarée, ou rôle inconnu. */
  | 'unsupported'
  /** Fichier modifié pendant l'écriture, à chaque essai. */
  | 'changed'
  | 'writeFailed'

export interface RoleExportError {
  code: RoleExportErrorCode
  /** Identifiant en cause, ou détail technique (ligne de l'erreur YAML…). */
  detail?: string
  /** Fichier en cause, affiché (`~/…` ou relatif au projet). */
  file?: string
}

/** Un emplacement possible : son chemin affiché, et s'il existe déjà. */
export interface RoleExportPlace {
  scope: RoleExportScope
  /** Chemin affiché : `~/.bob/settings/custom_modes.yaml`, `.opencode/agents/x.md`. */
  file: string
  /** Le fichier existe : il sera copié avant d'être écrit. */
  exists: boolean
}

/** Ce que montre la feuille « Installer dans… » avant d'écrire. */
export interface RoleExportPreview {
  profileId: string
  profileLabel: string
  format: RoleExportFormat
  /** Identifiant du mode ou de l'agent (le nom du rôle). */
  id: string
  /** Libellé du rôle. */
  label: string
  /** Nom sous lequel l'agent le liste (libellé pour un mode de Bob, identifiant pour OpenCode). */
  listedAs: string
  /** Fichier partagé avec d'autres modes : seule l'entrée de Bobine y est écrite. */
  sharedFile: boolean
  /** La consigne remplace la consigne de base de l'agent. */
  replacesBasePrompt: boolean
  readOnly: boolean
  /** Portée proposée d'abord : celle du rôle (projet → ce projet). */
  defaultScope: RoleExportScope
  /** Emplacements possibles ; `project` absent sans dossier de projet. */
  places: RoleExportPlace[]
  /** Texte exact écrit (l'entrée du mode, ou le fichier de l'agent), en lecture seule. */
  text: string
  /** Déjà refusé avant d'écrire (identifiant réservé). */
  error?: RoleExportError
}

/** Où en est une installation, d'après le registre de Bobine et le fichier de l'agent. */
export type RoleExportState =
  /** Le fichier a ce que Bobine a écrit, et le rôle n'a pas changé. */
  | 'upToDate'
  /** Le rôle a changé depuis : « Mettre à jour ». */
  | 'roleChanged'
  /** L'entrée a été modifiée à la main depuis : rien sans confirmation. */
  | 'handEdited'
  /** L'entrée n'est plus dans le fichier (retirée à la main) : « Mettre à jour » la remet. */
  | 'missing'
  /** Fichier illisible ou lien : rien n'est fait. */
  | 'unreadable'

export interface RoleExportStatus {
  /** Clé de l'installation (`roles:exportRemove`) : jamais un chemin. */
  key: string
  profileId: string
  profileLabel: string
  format: RoleExportFormat
  scope: RoleExportScope
  file: string
  id: string
  state: RoleExportState
  useInBobine: boolean
}

export type RoleExportResult =
  { ok: true; status: RoleExportStatus } | { ok: false; error: RoleExportError }

export type RoleExportRemoveResult = { ok: true } | { ok: false; error: RoleExportError }

/** Options d'une installation. */
export interface RoleExportOptions {
  /** Dans Bobine, lancer ce rôle dans ce mode (ou avec cet agent) quand la session l'a. */
  useInBobine: boolean
  /** Remplacer une entrée de Bobine modifiée à la main depuis (après confirmation). */
  overwrite?: boolean
}

const SCOPES: readonly RoleExportScope[] = ['user', 'project']

/** Vérifie une cible venue du renderer. */
export function parseRoleExportTarget(value: unknown): RoleExportTarget {
  const o = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>
  const profileId = o['profileId']
  const scope = o['scope']
  if (typeof profileId !== 'string' || !profileId) throw new Error('Paramètre invalide : profileId')
  if (!SCOPES.includes(scope as RoleExportScope)) throw new Error('Paramètre invalide : scope')
  return { profileId, scope: scope as RoleExportScope }
}

/** Vérifie les options venues du renderer. */
export function parseRoleExportOptions(value: unknown): RoleExportOptions {
  const o = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>
  if (typeof o['useInBobine'] !== 'boolean') throw new Error('Paramètre invalide : useInBobine')
  if (o['overwrite'] !== undefined && typeof o['overwrite'] !== 'boolean') {
    throw new Error('Paramètre invalide : overwrite')
  }
  return { useInBobine: o['useInBobine'], ...(o['overwrite'] ? { overwrite: true } : {}) }
}

/** Vérifie la désignation d'un rôle venue du renderer. */
export function parseRoleExportRef(value: unknown): RoleExportRef {
  const o = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>
  const scope = o['scope']
  const name = o['name']
  const conversationId = o['conversationId']
  if (scope !== 'builtin' && scope !== 'user' && scope !== 'project') {
    throw new Error('Paramètre invalide : scope')
  }
  if (typeof name !== 'string' || !name.trim()) throw new Error('Paramètre invalide : name')
  if (conversationId !== undefined && (typeof conversationId !== 'string' || !conversationId)) {
    throw new Error('Paramètre invalide : conversationId')
  }
  return { scope, name: name.trim(), ...(conversationId ? { conversationId } : {}) }
}
