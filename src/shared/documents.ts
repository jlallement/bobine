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
