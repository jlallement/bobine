/**
 * Canaux des fichiers de la conversation (liens de fichiers, fiches 052 et 272 ; vue des fichiers,
 * fiche 271), rangés avec `IpcInvokeContract`.
 */
import type {
  FileLinkCheck,
  FileLinkOutcome,
  FileOpenOutcome,
  MarkdownDocument
} from './file-links'
import type { FileContent, FileListing, FileRoot } from './files'

export interface FilesIpcContract {
  /**
   * Clic sur un lien de fichier dans la conversation (fiche 052) : aperçu d'un `.md`, ouverture
   * dans l'app par défaut, ou le Finder (dossier, exécutable, hors du dossier, ⌥-clic).
   */
  'files:openLink': {
    args: [id: string, href: string, options?: { base?: string; reveal?: boolean }]
    result: FileLinkOutcome
  }
  /**
   * Parmi des liens de fichiers d'un message (code en ligne, fiche 272), ceux qui existent dans le
   * dossier de la conversation : un seul appel par message, borné, confiné au dossier.
   */
  'files:existing': { args: [id: string, hrefs: string[], base?: string]; result: FileLinkCheck }
  /** Relit un document Markdown du dossier pour l'aperçu. */
  'files:readMarkdown': { args: [id: string, path: string]; result: MarkdownDocument }
  /** Vue des fichiers (fiche 271) : racines de la conversation (dossier, autres dossiers). */
  'files:roots': { args: [id: string]; result: FileRoot[] }
  /** Un niveau d'un dossier d'une racine (chemin relatif, `''` pour la racine). */
  'files:list': { args: [id: string, root: number, dir: string]; result: FileListing }
  /** Plusieurs dossiers d'une racine en une fois (relecture) : un seul appel à git (C2). */
  'files:listMany': {
    args: [id: string, root: number, dirs: string[]]
    /** Paires `[dossier, contenu ou erreur]` (jamais un objet : un dossier peut s'appeler `__proto__`). */
    result: [string, FileListing | { error: string }][]
  }
  /** Un fichier pour l'affichage, en lecture seule (texte, image ou binaire). */
  'files:read': {
    /** `known` : version déjà affichée ; inchangée, rien n'est relu (`unchanged`). */
    args: [id: string, root: number, path: string, known?: { modified: number; size: number }]
    result: FileContent
  }
  /** Filtre de l'onglet Fichiers : chemins relatifs classés comme la mention `@`. */
  'files:search': {
    args: [id: string, root: number, query: string]
    /** `excluded` : invisible pour l'agent (fiche 155), marqué comme dans l'arbre. */
    result: { path: string; excluded?: true }[]
  }
  /** Montre un fichier d'une racine dans le Finder. */
  'files:reveal': { args: [id: string, root: number, path: string]; result: undefined }
  /** Ouvre un fichier d'une racine avec l'app par défaut (jamais un exécutable). */
  'files:open': { args: [id: string, root: number, path: string]; result: FileOpenOutcome }
}

export const FILES_CHANNELS = [
  'files:openLink',
  'files:existing',
  'files:readMarkdown',
  'files:roots',
  'files:list',
  'files:listMany',
  'files:read',
  'files:search',
  'files:reveal',
  'files:open'
] as const
