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

/**
 * Extensions qu'« Ouvrir » confie à l'app par défaut du Mac (fiche 224, relecture) : documents et
 * images seulement. Un fichier écrit par l'agent qui s'exécuterait à l'ouverture (`.command`,
 * `.terminal`, `.app`, `.webloc`, `.html`, `.svg`…) n'a que « Afficher dans le Finder ».
 */
export const OPENABLE_EXTENSIONS: ReadonlySet<string> = new Set([
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'odt',
  'ods',
  'odp',
  'rtf',
  'txt',
  'md',
  'csv',
  'tsv',
  'pages',
  'numbers',
  'key',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'heic',
  'tif',
  'tiff'
])

/** « Ouvrir » est proposé pour ce document. */
export function canOpenDocument(name: string): boolean {
  const dot = name.lastIndexOf('.')
  return dot > 0 && OPENABLE_EXTENSIONS.has(name.slice(dot + 1).toLowerCase())
}
