import { t } from 'i18next'
import { isLocalHost } from './browser'
import { isDriveAbsolute } from './windows-paths.ts'

/**
 * Liens vers des fichiers dans la conversation (fiche 052) : ce qu'un lien désigne, et ce que
 * l'app en a fait.
 */

export interface FileLink {
  /** Chemin tel que le lien le donne : relatif (au dossier de base) ou absolu. */
  path: string
  /** Ligne citée (`:12`, `#L12`). */
  line?: number
}

/** Aperçu d'un document Markdown du dossier de la conversation. */
export interface MarkdownDocument {
  /** Chemin absolu. */
  path: string
  /** Chemin relatif au dossier de la conversation. */
  relative: string
  /** Dossier du document : base de ses propres liens relatifs. */
  dir: string
  text: string
  /** Document trop long : seul le début est montré. */
  truncated?: boolean
}

/** Ce que l'app a fait d'un clic sur un lien de fichier. */
export type FileLinkOutcome =
  | { kind: 'preview'; document: MarkdownDocument }
  | { kind: 'opened'; path: string }
  | {
      kind: 'revealed'
      path: string
      /** Demandé (⌥-clic), dossier, hors du dossier de la conversation, ou exécutable. */
      reason: 'requested' | 'folder' | 'outside' | 'executable'
    }
  | { kind: 'missing'; path: string }
  /** Page HTML du dossier, ouverte dans le navigateur intégré (fiche 064). */
  | { kind: 'browser'; path: string; url: string }

/**
 * Existence de fichiers cités en code (fiche 272, recette de la rc.3) : ceux qui existent, et ceux
 * qui n'ont pas pu être vérifiés à temps (inconnus : ni oui ni non) ; les autres n'existent pas.
 */
export interface FileLinkCheck {
  existing: string[]
  unknown: string[]
}

/** Fichier ouvert par le système depuis l'onglet Modifications ou l'aperçu (fiche 071). */
export type FileOpenOutcome = Extract<FileLinkOutcome, { kind: 'opened' | 'revealed' | 'missing' }>

/** Ce qu'il faut dire à l'utilisateur quand le fichier n'a pas été ouvert ; rien sinon. */
export function openOutcomeNote(outcome: FileLinkOutcome): string | undefined {
  const name = outcome.kind === 'preview' ? outcome.document.path : outcome.path
  const file = name.split('/').at(-1) ?? name
  if (outcome.kind === 'missing') return t('fileLink.missing', { path: outcome.path })
  if (outcome.kind !== 'revealed') return undefined
  if (outcome.reason === 'executable') {
    return t('fileLink.executable', { file })
  }
  if (outcome.reason === 'outside') {
    return t('fileLink.outside', { file })
  }
  return undefined
}

const MARKDOWN = /\.(md|markdown|mdx)$/i
const HTML = /\.html?$/i

export const isMarkdownPath = (path: string) => MARKDOWN.test(path)
export const isHtmlPath = (path: string) => HTML.test(path)

/** Une adresse IP (`127.0.0.1`). */
const IP = /^\d{1,3}(?:\.\d{1,3}){3}$/
/**
 * Premier segment d'un chemin à dossiers qui a l'air d'un nom de domaine (`github.com`,
 * `docs.rs`, `example.ch`) : des labels, le dernier en lettres. Un dossier à point en tête
 * (`.github`) n'en est pas un.
 */
const DOMAIN_LIKE = /^(?!\.)[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,24}$/i
/**
 * `hôte:port` sans dossier : seulement les domaines de premier niveau qui ne sont jamais des
 * extensions de fichier courantes (`example.org:443`) ; `deploy.sh:12`, `logo.ai:1`, `x.dev:1`
 * restent des fichiers. Un domaine hors de cette liste est pris pour un fichier : risque accepté.
 */
const HOST_TLD = /\.(?:com|org|net|edu|gov|info|io|fr|de|uk|eu|ch|nl|be|it|es|us|ca|jp|localhost)$/i

/**
 * Chemin sans `./` en tête : ni compte (`user@…`), ni adresse (domaine ou IP, `hôte:port`).
 * Seule règle d'adresse, partagée par les chemins en code (fiche 272) et `isPathNotScheme`.
 */
export function pathLike(text: string): boolean {
  const [first = '', ...rest] = text.split('/')
  if (first.indexOf('@') > 0) return false
  if (rest.length > 0) return !IP.test(first) && !DOMAIN_LIKE.test(first)
  const [host = '', port] = first.split(':')
  return port === undefined || (!IP.test(host) && !HOST_TLD.test(host))
}

/**
 * Un lien qui a l'air d'un schéma mais désigne un fichier : `README.md:3` (nom sans dossier, avec
 * une extension, suivi d'une ligne) ; jamais une adresse `hôte:port` (`example.com:8080`,
 * `127.0.0.1:3000`, même règle que `pathLike`) ; sous Windows, `C:\x` ou `C:/x`. Seule règle,
 * partagée par la lecture d'un lien (`parseFileLink`) et par le rendu Markdown, qui sinon le
 * viderait (lien en code ou lien Markdown : un seul chemin, fiche 272). En temps linéaire : elle
 * tourne à chaque rendu en streaming.
 */
export function isPathNotScheme(href: string, options: { windowsPaths?: boolean } = {}): boolean {
  if (options.windowsPaths === true && isDriveAbsolute(href)) return true
  const name = /^([^:/]+):\d+(?::\d+)?$/.exec(href)?.[1]
  // Un point qui n'est ni le premier ni le dernier caractère : une extension.
  return !!name && name.slice(1, -1).includes('.') && pathLike(href)
}

/**
 * Fichier désigné par un lien, ou `undefined` pour un lien web, une ancre, un courriel… :
 * `plan.md`, `./docs/a.md`, `src/app.ts:12`, `src/app.ts#L12`, `/chemin/absolu`, `file:///…`.
 */
export function parseFileLink(
  href: string | undefined,
  options: { windowsPaths?: boolean } = {}
): FileLink | undefined {
  if (!href || href.startsWith('#')) return undefined
  const windows = options.windowsPaths === true
  let raw = href
  // `README.md:3` a l'air d'un schéma (`README.md:`) : c'est un chemin suivi d'une ligne. Sous
  // Windows seulement (capacité `windowsPaths`, fiche 229), de même `C:\x` ou `C:/x` : un chemin,
  // pas un schéma `c:`. Ailleurs, comme avant.
  const pathWithLine = isPathNotScheme(raw, options)
  if (!pathWithLine && /^[a-z][a-z0-9+.-]*:/i.test(raw)) {
    if (!/^file:/i.test(raw)) return undefined
    try {
      const url = new URL(raw)
      // `file:///C:/x` sous Windows : le chemin est `C:/x`, sans la barre avant la lettre.
      const path = decodeURIComponent(url.pathname)
      raw = (windows && /^\/[a-z]:\//i.test(path) ? path.slice(1) : path) + url.hash
    } catch {
      return undefined
    }
  } else {
    try {
      raw = decodeURIComponent(raw)
    } catch {
      // Pourcentage isolé : le chemin est pris tel quel.
    }
    raw = raw.replace(/\?.*$/, '')
  }
  let line: number | undefined
  const anchor = /#L(\d+)(?:-L?\d+)?$/.exec(raw)
  if (anchor) {
    line = Number(anchor[1])
    raw = raw.slice(0, anchor.index)
  } else {
    raw = raw.replace(/#.*$/, '')
    const suffix = /:(\d+)(?::\d+)?$/.exec(raw)
    if (suffix) {
      line = Number(suffix[1])
      raw = raw.slice(0, suffix.index)
    }
  }
  if (!raw) return undefined
  return { path: raw, ...(line ? { line } : {}) }
}

/**
 * Où mène un lien web (fiche 154) : une adresse du poste (`localhost`, `127.0.0.1`, `[::1]`,
 * `*.localhost`) s'ouvre dans le navigateur intégré, toute autre `http(s)` dans le navigateur du
 * Mac ; `undefined` pour le reste (fichier, ancre, autre schéma : jamais ouvert par ce chemin).
 */
export function webLinkTarget(href: string | undefined): 'integrated' | 'system' | undefined {
  if (!href) return undefined
  let url: URL
  try {
    url = new URL(href)
  } catch {
    return undefined
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined
  const host = url.hostname.toLowerCase()
  return isLocalHost(host) && !host.endsWith('.test') ? 'integrated' : 'system'
}
