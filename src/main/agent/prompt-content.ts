/**
 * Construction du contenu d'un prompt ACP à partir du texte et des pièces jointes, selon ce que
 * l'agent accepte (`promptCapabilities`) :
 * - image : bloc `image` (si `image`) ;
 * - fichier texte raisonnable : bloc `resource` avec son contenu (si `embeddedContext`) ;
 * - sinon : `resource_link` (lien vers le fichier, que tout agent ACP doit accepter).
 */
import { readFile, stat } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import type { ContentBlock } from '../../shared/acp-sdk.mts'
import {
  basename,
  imageTypeOf,
  lineCount,
  MAX_EMBED_BYTES,
  MAX_IMAGE_BYTES,
  type AttachmentView,
  type PromptAttachment,
  type PromptCapabilities
} from '@shared/attachments'
import type { ContextSource } from '@shared/context-mentions'
import { t } from 'i18next'
import { messageOf } from '@shared/errors'
import { log } from '../log'

export interface BuiltPrompt {
  blocks: ContentBlock[]
  /** Pièces jointes telles qu'affichées dans le fil. */
  views: AttachmentView[]
}

/** Un fichier est considéré comme du texte s'il n'a pas d'octet nul au début. */
const looksLikeText = (buffer: Buffer): boolean => !buffer.subarray(0, 8192).includes(0)

/**
 * Textes de l'app joints au message, jamais affichés comme tels : demande de `/split` (fiche 118),
 * échange d'une bascule (fiche 108), nouvelles des filles et provenance d'un message (fiche 097),
 * contexte d'une branche (fiche 023), contexte de session (fiche 118). Réunis en un bloc, **après**
 * le message (fiche 125) : un agent qui titre sa session d'après le début du premier message (Bob)
 * garde le texte de l'utilisateur.
 */
export function withContext(
  blocks: ContentBlock[],
  contexts: readonly (string | false | undefined)[]
): ContentBlock[] {
  const context = contexts.filter(Boolean).join('\n\n')
  return context ? [...blocks, { type: 'text', text: context }] : blocks
}

/**
 * Contexte de session (fiche 118 ; index de la mémoire, fiche 182, lu sur le disque) : synchrone
 * quand rien n'est à lire, pour ne pas retarder l'envoi ; une erreur de lecture n'empêche pas
 * l'envoi (journal, sans contexte).
 */
export function sessionContextOf(
  options: {
    sessionContext?: (tools: readonly string[]) => string | undefined | Promise<string | undefined>
  },
  appTools: readonly string[] | undefined
): string | undefined | Promise<string | undefined> {
  const failed = (error: unknown) => {
    log.warn(`Contexte de session indisponible : ${String(error)}`)
    return undefined
  }
  try {
    const context = options.sessionContext?.(appTools ?? [])
    return context instanceof Promise ? context.catch(failed) : context
  } catch (error) {
    return failed(error)
  }
}

/** Texte collé tel qu'il part à l'agent : annoncé, puis tel quel (fiche 155). */
export function pastedTextBlock(text: string): string {
  const lines = lineCount(text)
  return `Texte collé (${lines} ${lines === 1 ? 'ligne' : 'lignes'}) :\n\n${text}`
}

export async function buildPrompt(
  text: string,
  attachments: PromptAttachment[],
  caps: PromptCapabilities,
  agentLabel: string,
  /** Contenu d'une mention `@git-changes` / `@terminal` (fiche 057), lu au moment de l'envoi. */
  contextText?: (source: ContextSource) => Promise<string>
): Promise<BuiltPrompt> {
  const blocks: ContentBlock[] = []
  const views: AttachmentView[] = []
  if (text.trim()) blocks.push({ type: 'text', text })

  for (const attachment of attachments) {
    if (attachment.kind === 'context') {
      // En texte : tout agent ACP l'accepte, et il le lit comme une partie du message.
      const content = contextText
        ? await contextText(attachment.source).catch(
            (e: unknown) => `Lecture impossible : ${messageOf(e)}`
          )
        : 'Contenu indisponible.'
      blocks.push({ type: 'text', text: `Contenu de @${attachment.source} :\n\n${content}` })
      views.push({ kind: 'context', source: attachment.source, name: attachment.source })
      continue
    }
    if (attachment.kind === 'text') {
      // Long texte collé (fiche 155) : un bloc de texte à part, que tout agent ACP accepte.
      blocks.push({ type: 'text', text: pastedTextBlock(attachment.text) })
      views.push(attachment)
      continue
    }
    if (attachment.kind === 'image') {
      if (!caps.image) throw new Error(t('attachments.noImages', { agent: agentLabel }))
      blocks.push({ type: 'image', mimeType: attachment.mimeType, data: attachment.data })
      views.push(attachment)
      continue
    }
    const { path } = attachment
    const name = basename(path)
    const info = await stat(path).catch(() => undefined)
    if (!info?.isFile()) throw new Error(`Fichier introuvable : ${name}`)
    const uri = pathToFileURL(path).href
    const imageType = imageTypeOf(name)

    if (imageType && caps.image && info.size <= MAX_IMAGE_BYTES) {
      const data = (await readFile(path)).toString('base64')
      blocks.push({ type: 'image', mimeType: imageType, data, uri })
      views.push({ kind: 'image', name, mimeType: imageType, data })
      continue
    }
    if (!imageType && caps.embeddedContext && info.size <= MAX_EMBED_BYTES) {
      const buffer = await readFile(path)
      if (looksLikeText(buffer)) {
        blocks.push({
          type: 'resource',
          resource: { uri, mimeType: 'text/plain', text: buffer.toString('utf8') }
        })
        views.push({ kind: 'file', name, path })
        continue
      }
    }
    blocks.push({ type: 'resource_link', uri, name, size: info.size })
    views.push({ kind: 'file', name, path })
  }

  if (blocks.length === 0) throw new Error(t('ipc.emptyMessage'))
  return { blocks, views }
}
