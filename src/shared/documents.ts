/**
 * Documents d'une discussion (fiche 224) : les fichiers de son dossier tenu par Bobine, tels que
 * le panneau « Documents » et les cartes du fil les montrent.
 */
export interface DiscussionDocument {
  /** Nom du fichier, sans dossier. */
  name: string
  /** Taille en octets. */
  size: number
  /** ISO 8601 — dernière modification. */
  modifiedAt: string
}

/**
 * Aperçu d'un document : texte brut (texte, Markdown, CSV…, et le texte d'un document Word ou RTF
 * tiré par `textutil` sur macOS), image, ou rien (« Ouvrir » reste possible).
 */
export type DocumentPreview =
  | { kind: 'text'; text: string; truncated: boolean }
  | { kind: 'image'; mimeType: string; data: string }
  | { kind: 'none' }
