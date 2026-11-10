import { t } from 'i18next'
import { isLocalHost } from './browser' /**
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

/**
 * Fichier désigné par un lien, ou `undefined` pour un lien web, une ancre, un courriel… :
 * `plan.md`, `./docs/a.md`, `src/app.ts:12`, `src/app.ts#L12`, `/chemin/absolu`, `file:///…`.
 */
export function parseFileLink(href: string | undefined): FileLink | undefined {
  if (!href || href.startsWith('#')) return undefined
  let raw = href
  // `README.md:3` a l'air d'un schéma (`README.md:`) : c'est un chemin suivi d'une ligne.
  const pathWithLine = /^[^:/]+\.[^:/]+:\d+(?::\d+)?$/.test(raw)
  if (!pathWithLine && /^[a-z][a-z0-9+.-]*:/i.test(raw)) {
    if (!/^file:/i.test(raw)) return undefined
    try {
      const url = new URL(raw)
      raw = decodeURIComponent(url.pathname) + url.hash
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
