/**
 * Clic sur un lien de fichier dans la conversation (fiche 052) ou sur « Ouvrir » dans l'onglet
 * Modifications (fiche 071). Le fichier vient de l'agent : l'ouvrir ne doit jamais rien exécuter.
 * Un `.md` du dossier est lu pour l'aperçu ; un autre fichier du dossier s'ouvre dans l'app par
 * défaut ; un dossier, un exécutable ou un fichier hors du dossier de la conversation est seulement
 * montré dans le Finder.
 */
import { open, realpath, stat } from 'node:fs/promises'
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path'
import {
  isHtmlPath,
  isMarkdownPath,
  parseFileLink,
  type FileLinkOutcome,
  type FileOpenOutcome,
  type MarkdownDocument
} from '@shared/file-links'
import { t } from 'i18next'

/** Aperçu : au-delà, seul le début du document est montré. */
const MAX_MARKDOWN_BYTES = 1_000_000

/** Types que macOS exécute, installe ou ouvre ailleurs quand on les « ouvre ». */
const RISKY_EXTENSIONS = new Set([
  'app',
  'command',
  'tool',
  'terminal',
  'sh',
  'bash',
  'zsh',
  'fish',
  'csh',
  'ksh',
  'py',
  'pyw',
  'rb',
  'pl',
  'php',
  'scpt',
  'scptd',
  'applescript',
  'workflow',
  'action',
  'shortcut',
  'pkg',
  'mpkg',
  'dmg',
  'jar',
  'webloc',
  'inetloc',
  'fileloc',
  'afploc',
  'ftploc',
  'term',
  'webarchive',
  'url',
  'mobileconfig',
  'prefpane',
  'kext',
  'plugin',
  'bundle',
  'osax'
])

/** Ouvertures par le système (`shell`), remplaçables en essai. */
export interface FileOpeners {
  /** Rend un message d'erreur, vide si le fichier s'est ouvert (comme `shell.openPath`). */
  openPath: (path: string) => Promise<string>
  reveal: (path: string) => void
  /**
   * Page HTML à ouvrir dans le navigateur intégré (fiche 064) : son adresse d'aperçu, servie depuis
   * son dossier. Absente : app par défaut, comme les autres fichiers.
   */
  previewHtml?: (dir: string, file: string) => Promise<string>
}

/** `target` est-il `root` ou dans `root` ? (chemins déjà résolus) */
export const inside = (root: string, target: string) =>
  target === root || target.startsWith(root + sep)

/** Chemin réel (liens symboliques résolus) ; le chemin résolu s'il n'existe pas. */
export async function real(path: string): Promise<string> {
  try {
    return await realpath(path)
  } catch {
    return resolve(path)
  }
}

/** Ce qu'il advient d'un clic sur `href`, relatif à `base` (un dossier du dossier de travail). */
export async function openFileLink(
  workspace: string,
  href: string,
  options: { base?: string; reveal?: boolean },
  openers: FileOpeners
): Promise<FileLinkOutcome> {
  const link = parseFileLink(href)
  if (!link) throw new Error(t('fileLink.invalid', { href }))
  const root = await real(workspace)
  const base = options.base ? await real(options.base) : root
  const from = inside(root, base) ? base : root
  const target = resolve(from, link.path)
  const info = await stat(target).catch(() => null)
  if (!info) return { kind: 'missing', path: target }
  const reveal = (reason: Extract<FileLinkOutcome, { kind: 'revealed' }>['reason']) => {
    openers.reveal(target)
    return { kind: 'revealed' as const, path: target, reason }
  }
  if (options.reveal) return reveal('requested')
  if (info.isDirectory()) return reveal('folder')
  // Chemin réel : un lien symbolique du dossier ne mène pas au-dehors en douce.
  if (!inside(root, await real(target))) return reveal('outside')
  if (isMarkdownPath(target)) return { kind: 'preview', document: await readMarkdown(root, target) }
  if (isHtmlPath(target) && openers.previewHtml) {
    return {
      kind: 'browser',
      path: target,
      url: await openers.previewHtml(dirname(target), target)
    }
  }
  if (mayExecute(target, info.mode)) return reveal('executable')
  const error = await openers.openPath(target)
  if (error) throw new Error(error)
  return { kind: 'opened', path: target }
}

/**
 * « Ouvrir » un fichier du dossier de la conversation avec l'app par défaut (onglet Modifications,
 * aperçu d'un document — fiche 071) : mêmes garde-fous que les liens. Lève si le chemin sort du
 * dossier.
 */
export async function openWorkspaceFile(
  workspace: string,
  path: string,
  openers: Pick<FileOpeners, 'openPath' | 'reveal'>
): Promise<FileOpenOutcome> {
  const given = resolve(workspace)
  const root = await real(workspace)
  const target = resolve(given, path)
  if (!inside(given, target) && !inside(root, target)) {
    throw new Error(t('fileLink.pathOutside', { path }))
  }
  const info = await stat(target).catch(() => null)
  if (!info) return { kind: 'missing', path: target }
  const reveal = (reason: 'folder' | 'outside' | 'executable') => {
    openers.reveal(target)
    return { kind: 'revealed' as const, path: target, reason }
  }
  if (info.isDirectory()) return reveal('folder')
  if (!inside(root, await real(target))) return reveal('outside')
  if (mayExecute(target, info.mode)) return reveal('executable')
  const error = await openers.openPath(target)
  if (error) throw new Error(error)
  return { kind: 'opened', path: target }
}

/** Le système exécuterait ou installerait ce fichier en l'« ouvrant » (extension, bit `x`). */
function mayExecute(target: string, mode: number): boolean {
  return RISKY_EXTENSIONS.has(extname(target).slice(1).toLowerCase()) || (mode & 0o111) !== 0
}

/** Document Markdown du dossier de la conversation, pour l'aperçu (début seul s'il est long). */
export async function readMarkdown(workspace: string, path: string): Promise<MarkdownDocument> {
  const root = await real(workspace)
  const target = await real(isAbsolute(path) ? path : resolve(root, path))
  if (!inside(root, target)) throw new Error(t('fileLink.documentOutside', { path }))
  if (!isMarkdownPath(target)) throw new Error(t('fileLink.notMarkdown', { path }))
  const handle = await open(target, 'r')
  try {
    const { size } = await handle.stat()
    const length = Math.min(size, MAX_MARKDOWN_BYTES)
    const buffer = Buffer.alloc(length)
    await handle.read(buffer, 0, length, 0)
    return {
      path: target,
      relative: relative(root, target),
      dir: dirname(target),
      text: buffer.toString('utf8'),
      ...(size > MAX_MARKDOWN_BYTES ? { truncated: true } : {})
    }
  } finally {
    await handle.close()
  }
}
