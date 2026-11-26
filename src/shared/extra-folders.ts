/**
 * Autres dossiers d'une conversation, ajout par un chemin (fiche 290) : ce que le main répond au
 * renderer, partagé par l'IPC. Le chemin vient de la fenêtre native, de la saisie ou d'un dossier
 * glissé ; le main seul le vérifie (`main/conversations/extra-folder-check.ts`), le renderer
 * affiche la raison d'un refus par sa clé de traduction.
 */

/** Raisons d'un refus, une par cause qu'on peut corriger soi-même. */
export const EXTRA_FOLDER_REFUSALS = [
  /** Rien de saisi (espaces et guillemets retirés). */
  'empty',
  /** Plus de `MAX_FOLDER_INPUT` caractères. */
  'tooLong',
  /** Caractère de contrôle (retour à la ligne, NUL…) : plusieurs chemins collés, ou rien d'un chemin. */
  'invalid',
  /** Ni absolu ni `~/…` : relatif, `~autre`, `C:dossier`, `\dossier` (Windows). */
  'notAbsolute',
  /** Adresse d'un autre schéma que `file://` (`http://…`), ou `file://` d'un autre ordinateur. */
  'notLocal',
  /** Racine d'un disque, d'un lecteur ou d'un partage, ou le dossier personnel lui-même. */
  'tooBroad',
  /** Rien à ce chemin (ou un lien qui ne mène nulle part). */
  'notFound',
  /** Un fichier, pas un dossier. */
  'notDirectory',
  /** Le dossier existe mais ne se lit pas (droits). */
  'unreadable',
  /** macOS refuse l'accès (protection des données : Documents, Bureau, disques externes…). */
  'privacy',
  /** La vérification n'aboutit pas dans le délai (partage réseau figé). */
  'timeout',
  /** C'est le dossier de travail de la conversation. */
  'isWorkspace',
  /** Un sous-dossier du dossier de travail : l'agent y a déjà accès. */
  'insideWorkspace',
  /** Déjà dans les autres dossiers de la conversation. */
  'alreadyAdded',
  /** L'agent répond : la liste ne change pas pendant un tour (la session ne peut pas repartir). */
  'busy'
] as const

export type ExtraFolderRefusal = (typeof EXTRA_FOLDER_REFUSALS)[number]

/**
 * Réponse d'un ajout. `folder` : le dossier retenu (liens suivis) ; dans un refus, le chemin tel
 * que le main l'a compris (`~` développé, normalisé), quand il en a un, pour le montrer.
 */
export type AddFolderResult =
  { ok: true; folder: string } | { ok: false; reason: ExtraFolderRefusal; folder?: string }

/**
 * Longueur maximale d'un chemin reçu, en caractères. Au-delà de ce que les systèmes acceptent
 * (`PATH_MAX` : 1 024 sous macOS, 4 096 sous Linux, 260 sous Windows sans préfixe `\\?\`) : un
 * vrai chemin passe toujours, un collage démesuré est refusé avant tout traitement.
 */
export const MAX_FOLDER_INPUT = 4096

/** Clé de traduction de la raison d'un refus (`{{folder}}` : le chemin compris, s'il y en a un). */
export const extraFolderRefusalKey = (reason: ExtraFolderRefusal) =>
  `sessionTab.folderRefusal.${reason}` as const
