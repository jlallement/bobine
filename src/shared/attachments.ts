/**
 * Pièces jointes d'un message : images (collées, glissées) et fichiers (glissés, choisis, mentionnés
 * avec `@`). Le renderer ne lit jamais le disque : il transmet les images collées (base64) et des
 * chemins ; le main lit les fichiers et construit les blocs ACP selon ce que l'agent accepte.
 */

import type { ContentBlock } from './acp-sdk.mts'
import { CONTEXT_MENTIONS, type ContextSource } from './context-mentions'
import { t } from 'i18next'

export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'] as const
export const MAX_ATTACHMENTS = 10
/** Taille maximale d'une image, en octets (une fois décodée). */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
/** Au-delà, un fichier texte est envoyé comme lien (`resource_link`) plutôt qu'en contenu. */
export const MAX_EMBED_BYTES = 256 * 1024
/**
 * Texte collé qui devient une pièce jointe (fiche 155) : au-delà de ces lignes ou de ces caractères,
 * il noierait la zone de saisie.
 */
export const PASTE_AS_ATTACHMENT = { lines: 40, chars: 4000 } as const
/** Taille maximale d'un texte collé joint, en caractères. */
export const MAX_PASTED_TEXT_CHARS = 1_000_000

/** Nombre de lignes d'un texte (une fin de ligne finale ne compte pas pour une ligne de plus). */
export const lineCount = (text: string): number =>
  text === '' ? 0 : text.replace(/\r?\n$/, '').split(/\r?\n/).length

/** Le texte collé est assez long pour partir en pièce jointe. */
export const isLongPaste = (text: string): boolean =>
  text.length > PASTE_AS_ATTACHMENT.chars || lineCount(text) > PASTE_AS_ATTACHMENT.lines

/** Pièce jointe telle que le renderer la transmet au main. */
export type PromptAttachment =
  | { kind: 'image'; name: string; mimeType: string; data: string }
  | { kind: 'file'; path: string }
  /** `@git-changes`, `@terminal` (fiche 057) : contenu lu par le main au moment de l'envoi. */
  | { kind: 'context'; source: ContextSource }
  /** Long texte collé (fiche 155) : part en bloc de texte à part. */
  | { kind: 'text'; name: string; text: string }

/** Image jointe (collée, capture d'écran, page ou écran d'un simulateur). */
export type ImageAttachment = Extract<PromptAttachment, { kind: 'image' }>

/**
 * Capture d'écran impossible (fiche 124) : autorisation « Enregistrement de l'écran » refusée ou
 * restreinte (la commande n'est pas lancée), ou capture qui échoue sans que l'utilisateur ait
 * annulé (macOS a refusé l'image).
 */
export interface ScreenCaptureUnavailable {
  kind: 'unavailable'
  reason: 'denied' | 'restricted' | 'failed'
}

/** Issue d'une capture d'écran : l'image, `null` si l'utilisateur a annulé (Échap), ou l'empêchement. */
export type ScreenCaptureResult = ImageAttachment | ScreenCaptureUnavailable | null

/** Pièce jointe telle qu'elle apparaît dans le fil (message de l'utilisateur). */
export type AttachmentView =
  | { kind: 'image'; name: string; mimeType: string; data: string }
  | { kind: 'file'; name: string; path?: string }
  | { kind: 'context'; source: ContextSource; name: string }
  | { kind: 'text'; name: string; text: string }

/**
 * Chemins que les fichiers d'exclusion de l'agent écartent (fiche 155), et ces fichiers (`.bobignore`…),
 * tels que son profil les déclare. Aucun fichier déclaré : rien d'exclu.
 */
export interface ExcludedPaths {
  paths: string[]
  files: string[]
}

/** Fichier du dossier de travail proposé par la recherche `@`. */
export interface WorkspaceFile {
  /** Chemin absolu. */
  path: string
  /** Chemin relatif au dossier de travail (affiché et inséré dans le message). */
  relative: string
}

/** Ce que l'agent accepte dans un prompt (`promptCapabilities` d'ACP). */
export interface PromptCapabilities {
  image: boolean
  embeddedContext: boolean
}

const EXTENSION_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp'
}

/** Type d'image d'après l'extension, sinon `undefined`. */
export function imageTypeOf(name: string): string | undefined {
  const ext = /\.([^./]+)$/.exec(name.toLowerCase())?.[1]
  return ext ? EXTENSION_TYPES[ext] : undefined
}

export const isImageType = (mimeType: string): boolean =>
  (IMAGE_TYPES as readonly string[]).includes(mimeType)

/** Taille décodée d'une chaîne base64. */
export const base64Bytes = (data: string): number =>
  Math.floor((data.length * 3) / 4) - (data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0)

export const basename = (path: string): string => path.split(/[\\/]/).filter(Boolean).at(-1) ?? path

/**
 * Valide une liste de pièces jointes venue du renderer (le main fait autorité).
 * Renvoie la liste typée, ou lève une erreur lisible.
 */
export function parseAttachments(value: unknown): PromptAttachment[] {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) throw new Error(t('attachments.check.list'))
  if (value.length > MAX_ATTACHMENTS) {
    throw new Error(t('attachments.check.tooMany', { max: MAX_ATTACHMENTS }))
  }
  return value.map((raw): PromptAttachment => {
    if (typeof raw !== 'object' || raw === null) throw new Error(t('attachments.check.item'))
    const a = raw as Record<string, unknown>
    if (a['kind'] === 'image') {
      const { name, mimeType, data } = a
      if (typeof name !== 'string' || typeof mimeType !== 'string' || typeof data !== 'string') {
        throw new Error(t('attachments.check.image'))
      }
      if (!isImageType(mimeType))
        throw new Error(t('attachments.check.imageType', { type: mimeType }))
      if (!/^[A-Za-z0-9+/]*={0,2}$/.test(data) || data.length === 0)
        throw new Error(t('attachments.check.imageData'))
      if (base64Bytes(data) > MAX_IMAGE_BYTES)
        throw new Error(t('attachments.check.imageSize', { name }))
      return { kind: 'image', name: name.slice(0, 200), mimeType, data }
    }
    if (a['kind'] === 'file') {
      const path = a['path']
      if (typeof path !== 'string' || !path.startsWith('/') || path.includes('\0')) {
        throw new Error(t('attachments.check.path'))
      }
      return { kind: 'file', path }
    }
    if (a['kind'] === 'context') {
      const source = CONTEXT_MENTIONS.find((m) => m.source === a['source'])?.source
      if (!source) throw new Error(t('attachments.check.mention'))
      return { kind: 'context', source }
    }
    if (a['kind'] === 'text') {
      const { name, text } = a
      if (typeof name !== 'string' || typeof text !== 'string' || text.length === 0) {
        throw new Error(t('attachments.check.text'))
      }
      if (text.length > MAX_PASTED_TEXT_CHARS) throw new Error(t('attachments.check.textSize'))
      return { kind: 'text', name: name.slice(0, 200), text }
    }
    throw new Error(t('attachments.check.kind'))
  })
}

/** Mention `@` en cours de saisie juste avant le curseur : sa recherche et sa position. */
export function mentionAt(
  text: string,
  caret: number
): { query: string; start: number } | undefined {
  const before = text.slice(0, caret)
  const match = /(^|\s)@([^\s@]*)$/.exec(before)
  if (!match) return undefined
  const query = match[2] ?? ''
  return { query, start: caret - query.length - 1 }
}

/** Remplace la mention en cours par `@chemin ` ; renvoie le texte et la nouvelle position du curseur. */
export function insertMention(
  text: string,
  mention: { query: string; start: number },
  path: string
): { text: string; caret: number } {
  const end = mention.start + 1 + mention.query.length
  const inserted = `@${path} `
  return {
    text: text.slice(0, mention.start) + inserted + text.slice(end),
    caret: mention.start + inserted.length
  }
}

/** Nom affiché d'une pièce jointe à envoyer. */
export const attachmentName = (a: PromptAttachment): string =>
  a.kind === 'image' || a.kind === 'text'
    ? a.name
    : a.kind === 'context'
      ? `@${a.source}`
      : basename(a.path)

const safeDecode = (uri: string): string => {
  try {
    return decodeURI(uri)
  } catch {
    return uri
  }
}

/** Pièce jointe d'un bloc de contenu rejoué (image, fichier embarqué ou lien), sinon `undefined`. */
export function attachmentOf(content: ContentBlock): AttachmentView | undefined {
  switch (content.type) {
    case 'image':
      return { kind: 'image', name: 'image', mimeType: content.mimeType, data: content.data }
    case 'resource':
      return { kind: 'file', name: basename(safeDecode(content.resource.uri)) }
    case 'resource_link':
      return { kind: 'file', name: content.name || basename(safeDecode(content.uri)) }
    default:
      return undefined
  }
}
