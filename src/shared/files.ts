/**
 * Vue des fichiers du dossier de la conversation (fiche 271, ADR-0065) : ce que le main rend au
 * renderer, et l'ordre de l'arbre. Le renderer désigne toujours un fichier par sa racine (dossier de
 * la conversation, puis ses autres dossiers, fiche 179) et un chemin relatif, jamais un chemin
 * absolu ; le main vérifie.
 */

/** Dossier montré à la racine de l'arbre. */
export interface FileRoot {
  /** Rang : 0 pour le dossier de la conversation (ou son worktree), puis ses autres dossiers. */
  index: number
  /** Nom du dossier. */
  name: string
  /** Chemin absolu (infobulle, copie du chemin). */
  path: string
  /** Dossier de la conversation disparu ou démonté (Q19). */
  missing?: true
  /** Autre dossier que l'agent ne reçoit pas : marqué « non transmis » (Q26, fiche 179). */
  notSent?: true
}

/** Une entrée d'un dossier. */
export interface FileEntry {
  name: string
  /** Chemin relatif à la racine, séparé par `/`. */
  path: string
  kind: 'dir' | 'file'
  /** Taille en octets (fichier). */
  size?: number
  /** Ignoré par git (`node_modules`, `build`…) : montré, atténué. */
  ignored?: true
  /** Exclu pour l'agent (`.bobignore`, fiche 155). */
  excluded?: true
  /** S'exécuterait si on l'ouvrait (bit `x`, script, `.app`…) : jamais « Ouvrir avec l'app par défaut ». */
  executable?: true
  /** Lien symbolique : `outside` s'il mène hors des dossiers de la conversation (jamais suivi). */
  link?: 'inside' | 'outside'
  /** Ni fichier ni dossier (FIFO, socket, périphérique) : montré grisé, jamais ouvert (B1). */
  special?: true
}

/** Contenu d'un dossier, un niveau. */
export interface FileListing {
  entries: FileEntry[]
  /** Entrées au-delà de la borne, non listées. */
  more: number
  /** Ce qui rend une entrée invisible pour l'agent (`.bobignore`…), pour le dire (fiche 155). */
  exclusionFiles?: string[]
}

/** Fichier lu pour l'affichage, en lecture seule. */
export type FileContent =
  | {
      kind: 'text'
      text: string
      /** Taille du fichier, en octets. */
      size: number
      /** Seul le début est montré (`MAX_TEXT_BYTES`). */
      truncated: boolean
      /** Date de modification (ms) : un fichier relu qui a changé se signale. */
      modified: number
      executable?: true
    }
  | {
      kind: 'image'
      /** `data:` lisible par une balise `img` (jamais insérée dans le DOM : un SVG reste inerte). */
      url: string
      size: number
      modified: number
      /** SVG : son source, pour la bascule « Source ». */
      text?: string
      executable?: true
    }
  | { kind: 'binary'; size: number; modified: number; executable?: true }
  /** Relecture : le fichier n'a pas changé depuis la version que le renderer a déjà (C4). */
  | { kind: 'unchanged'; size: number; modified: number }

/** Un fichier désigné dans la vue (racine, chemin relatif), et la ligne à montrer. */
export interface FileTarget {
  root: number
  path: string
  line?: number
}

/** Bornes de lecture (fiche 271, Q24 et Q39). */
export const MAX_DIR_ENTRIES = 2000
export const MAX_TEXT_BYTES = 1_000_000
export const MAX_IMAGE_BYTES = 20_000_000
/** Au-delà, le texte est montré sans coloration. */
export const MAX_HIGHLIGHT_BYTES = 200_000

/** Jamais listés. */
export const NEVER_LISTED = new Set(['.git', '.DS_Store'])

const IMAGE_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  ico: 'image/x-icon',
  bmp: 'image/bmp',
  svg: 'image/svg+xml'
}

/** Extension en minuscules, sans le point (`''` sans extension). */
export function extensionOf(path: string): string {
  const name = path.slice(path.lastIndexOf('/') + 1)
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : ''
}

/** Type d'image affichable, ou `undefined`. */
export const imageType = (path: string): string | undefined => IMAGE_TYPES[extensionOf(path)]

/**
 * Fichiers qu'un lien du fil ouvre ailleurs que dans l'onglet Fichiers (Q11) : PDF, documents de
 * bureautique, archives, médias. Le reste (texte, code, Markdown, images) s'ouvre dans l'onglet.
 */
const ELSEWHERE = new Set([
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'key',
  'numbers',
  'pages',
  'odt',
  'ods',
  'odp',
  'rtf',
  'zip',
  'gz',
  'tgz',
  'bz2',
  'xz',
  '7z',
  'rar',
  'dmg',
  'pkg',
  'mp3',
  'wav',
  'm4a',
  'aac',
  'flac',
  'mp4',
  'mov',
  'avi',
  'mkv',
  'webm',
  'app'
])

export const opensElsewhere = (path: string): boolean => ELSEWHERE.has(extensionOf(path))

/** Ordre naturel, insensible à la casse (`file2` avant `file10`). */
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

/**
 * Ordre de l'arbre (Q22) : dossiers d'abord, puis fichiers ; dans chaque groupe, les noms à point
 * en tête (comme Claude Code), puis l'ordre naturel.
 */
export function compareEntries(a: Pick<FileEntry, 'name' | 'kind'>, b: typeof a): number {
  if (a.kind !== b.kind) return a.kind === 'dir' ? -1 : 1
  const dotA = a.name.startsWith('.')
  const dotB = b.name.startsWith('.')
  if (dotA !== dotB) return dotA ? -1 : 1
  return collator.compare(a.name, b.name) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)
}

/** `chemin:42` tapé dans le filtre (Q35) : le chemin et la ligne. */
export function splitFilterLine(query: string): { query: string; line?: number } {
  const match = /^(.*\S):(\d+)$/.exec(query.trim())
  if (!match?.[1] || !match[2]) return { query: query.trim() }
  const line = Number(match[2])
  return line > 0 ? { query: match[1], line } : { query: match[1] }
}

/** Dossiers parents d'un chemin relatif (`a/b/c.ts` → `a`, `a/b`). */
export function parentDirs(path: string): string[] {
  const parts = path.split('/').slice(0, -1)
  return parts.map((_, i) => parts.slice(0, i + 1).join('/'))
}

/** Nom et dossier d'un chemin relatif (`docs/guide.md` → `guide.md`, `docs` ; à la racine : `''`). */
export function nameAndDir(path: string): { name: string; dir: string } {
  const at = path.lastIndexOf('/')
  return at < 0 ? { name: path, dir: '' } : { name: path.slice(at + 1), dir: path.slice(0, at) }
}
