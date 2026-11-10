import { useState } from 'react'
import {
  basename,
  isImageType,
  isLongPaste,
  MAX_ATTACHMENTS,
  MAX_IMAGE_BYTES,
  MAX_PASTED_TEXT_CHARS,
  type ExcludedPaths,
  type PromptAttachment,
  type PromptCapabilities
} from '@shared/attachments'
import type { ContextSource } from '@shared/context-mentions'
import { t } from 'i18next'

type NewDraft =
  | { kind: 'image'; name: string; mimeType: string; data: string }
  | { kind: 'file'; name: string; path: string }
  /** `@git-changes`, `@terminal` (fiche 057) : le main lira le contenu à l'envoi. */
  | { kind: 'context'; name: string; source: ContextSource }
  /** Long texte collé (fiche 155). */
  | { kind: 'text'; name: string; text: string }

/** Pièce jointe en préparation dans la zone de saisie. */
export type DraftAttachment = NewDraft & { id: string }

let nextId = 1

/** Contenu base64 d'un fichier (sans le préfixe `data:`). */
function readBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ''))
    reader.onerror = () => reject(reader.error ?? new Error(t('attachments.readFailed')))
    reader.readAsDataURL(file)
  })
}

/** Pièce jointe déjà préparée (brouillon, message en attente), avec ses champs d'affichage. */
function toDraft(a: PromptAttachment): NewDraft {
  if (a.kind === 'image' || a.kind === 'text') return a
  if (a.kind === 'context') return { ...a, name: a.source }
  return { ...a, name: basename(a.path) }
}

/** Ce qui part vers le main (sans les champs d'affichage). */
export function toPromptAttachment(item: DraftAttachment): PromptAttachment {
  switch (item.kind) {
    case 'image':
      return { kind: 'image', name: item.name, mimeType: item.mimeType, data: item.data }
    case 'context':
      return { kind: 'context', source: item.source }
    case 'text':
      return { kind: 'text', name: item.name, text: item.text }
    case 'file':
      return { kind: 'file', path: item.path }
  }
}

/** Fichiers que l'agent de la conversation exclut, parmi ceux à joindre (fiche 155). */
export const excludedIn =
  (id: string | null | undefined) =>
  (paths: string[]): Promise<ExcludedPaths> =>
    id ? window.api.workspace.excludedPaths(id, paths) : Promise.resolve({ paths: [], files: [] })

/** Fichiers exclus par l'agent, en attente de confirmation (fiche 155). */
export interface PendingExclusion {
  paths: string[]
  /** Fichiers d'exclusion qui les écartent (`.bobignore`…) ; vide : vérification impossible. */
  files: string[]
}

/** Chemins vérifiés par lots : le main en refuse plus d'une centaine à la fois. */
const EXCLUSION_BATCH = 100

/**
 * Chemins que l'agent exclut, vérifiés par lots. Un lot qui échoue (IPC refusée, dossier absent) est
 * retenu en entier : mieux vaut demander que joindre sans savoir.
 */
export async function excludedAmong(
  paths: readonly string[],
  check: ((paths: string[]) => Promise<ExcludedPaths>) | undefined
): Promise<ExcludedPaths> {
  const result: ExcludedPaths = { paths: [], files: [] }
  if (!check) return result
  for (let i = 0; i < paths.length; i += EXCLUSION_BATCH) {
    const batch = paths.slice(i, i + EXCLUSION_BATCH)
    const found = await check(batch).catch(() => ({ paths: batch, files: [] }))
    result.paths.push(...found.paths)
    for (const file of found.files) if (!result.files.includes(file)) result.files.push(file)
  }
  return result
}

/**
 * Pièces jointes du message en cours : images collées ou glissées (lues ici, en mémoire), fichiers
 * glissés, choisis ou mentionnés (seulement leur chemin : le main les lira), longs textes collés.
 * Un fichier que l'agent exclut (`checkExcluded`, fiche 155) attend une confirmation.
 */
export function useAttachments(
  caps: PromptCapabilities | undefined,
  agentLabel: string,
  warn: (message: string) => void,
  options: {
    /** Pièces jointes du brouillon, au montage (fiche 155). */
    initial?: readonly PromptAttachment[]
    checkExcluded?: (paths: string[]) => Promise<ExcludedPaths>
  } = {}
) {
  const [items, setItems] = useState<DraftAttachment[]>(() =>
    (options.initial ?? []).map((a) => ({ ...toDraft(a), id: `pj-${nextId++}` }))
  )
  const [pending, setPending] = useState<PendingExclusion | null>(null)

  const push = (item: NewDraft) =>
    setItems((current) => {
      if (current.length >= MAX_ATTACHMENTS) {
        warn(t('attachments.tooMany', { max: MAX_ATTACHMENTS }))
        return current
      }
      if (item.kind === 'file' && current.some((c) => c.kind === 'file' && c.path === item.path)) {
        return current
      }
      if (
        item.kind === 'context' &&
        current.some((c) => c.kind === 'context' && c.source === item.source)
      ) {
        return current
      }
      return [...current, { ...item, id: `pj-${nextId++}` }]
    })

  const addPath = (path: string) => push({ kind: 'file', path, name: basename(path) })
  const addContext = (source: ContextSource) => push({ kind: 'context', source, name: source })

  /** Chemins exclus mis en attente de confirmation ; rend ceux qui le sont. */
  const hold = (excluded: ExcludedPaths): Set<string> => {
    const held = new Set(excluded.paths)
    if (held.size > 0) {
      setPending((current) => ({
        paths: [...new Set([...(current?.paths ?? []), ...held])],
        files: [...new Set([...(current?.files ?? []), ...excluded.files])]
      }))
    }
    return held
  }

  /** Fichiers choisis ou déposés : ceux que l'agent exclut attendent une confirmation. */
  const addPaths = async (paths: string[]) => {
    if (paths.length === 0) return
    const held = hold(await excludedAmong(paths, options.checkExcluded))
    for (const path of paths) if (!held.has(path)) addPath(path)
  }

  const addImage = async (file: File) => {
    if (!caps?.image) {
      warn(t('attachments.noImages', { agent: agentLabel }))
      return
    }
    if (!isImageType(file.type)) {
      warn(t('attachments.unsupportedImage', { type: file.type || file.name }))
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      warn(t('attachments.imageTooLarge', { name: file.name }))
      return
    }
    const data = await readBase64(file)
    push({
      kind: 'image',
      name: file.name || t('attachments.pastedImage'),
      mimeType: file.type,
      data
    })
  }

  /**
   * Fichiers collés ou glissés : images lues en mémoire, le reste par son chemin. Tout ce qui a un
   * chemin, images comprises, passe d'abord par les exclusions de l'agent (fiche 155) ; une image
   * exclue confirmée est jointe par son chemin (le main la lit).
   */
  const addFiles = async (files: File[]) => {
    const withPath = files.map((file) => ({ file, path: window.api.files.pathFor(file) }))
    const held = hold(
      await excludedAmong(
        withPath.flatMap(({ path }) => (path ? [path] : [])),
        options.checkExcluded
      )
    )
    for (const { file, path } of withPath) {
      if (path && held.has(path)) continue
      if (file.type.startsWith('image/') && (caps?.image || !path)) await addImage(file)
      else if (path) addPath(path)
      else warn(t('attachments.failed', { name: file.name }))
    }
  }

  /** Long texte collé (fiche 155) : une puce plutôt que la saisie. */
  const addText = (text: string) => {
    if (text.length > MAX_PASTED_TEXT_CHARS) {
      warn(t('attachments.check.textSize'))
      return
    }
    push({ kind: 'text', name: t('attachments.pastedText'), text })
  }

  return {
    items,
    addPath,
    addPaths,
    addContext,
    addFiles,
    addText,
    /**
     * Collage : fichiers joints, long texte en puce (fiche 155). `false` : un texte ordinaire, que la
     * zone de saisie reçoit comme d'habitude.
     */
    paste: (data: DataTransfer): boolean => {
      const files = [...data.files]
      if (files.length > 0) {
        void addFiles(files)
        return true
      }
      const pasted = data.getData('text/plain')
      if (!isLongPaste(pasted)) return false
      addText(pasted)
      return true
    },
    /** Fichiers exclus par l'agent qui attendent « Joindre quand même » ou « Ne pas joindre ». */
    pending,
    resolvePending: (attach: boolean) => {
      if (attach) for (const path of pending?.paths ?? []) addPath(path)
      setPending(null)
    },
    remove: (id: string) => setItems((current) => current.filter((c) => c.id !== id)),
    /** Image annotée (fiche 067) à la place de l'image jointe. */
    replaceImage: (id: string, image: Extract<PromptAttachment, { kind: 'image' }>) =>
      setItems((current) =>
        current.map((c) => (c.id === id && c.kind === 'image' ? { ...image, id } : c))
      ),
    clear: () => setItems([]),
    /** Capture d'écran (fiche 062), déjà réduite et encodée par le main. */
    addCaptured: (image: Extract<PromptAttachment, { kind: 'image' }>) => {
      if (!caps?.image) {
        warn(t('attachments.noImages', { agent: agentLabel }))
        return
      }
      push(image)
    },
    /** Remet des pièces jointes déjà préparées (message en attente qu'on modifie). */
    restore: (attachments: PromptAttachment[]) => {
      for (const a of attachments) push(toDraft(a))
    },
    /** Ce qui part vers le main (sans les champs d'affichage). */
    toSend: (): PromptAttachment[] => items.map(toPromptAttachment)
  }
}
