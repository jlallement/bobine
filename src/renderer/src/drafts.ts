/**
 * Brouillons de la zone de saisie, par conversation (fiche 026) : retrouvés en revenant sur une
 * conversation, et après un redémarrage (stockage local du renderer, si disponible).
 *
 * Fiche 155 : le brouillon garde aussi ses pièces jointes. En mémoire, toutes ; sur le disque, les
 * images seulement si l'ensemble reste sous `MAX_STORED_DRAFTS_CHARS` (le stockage local est petit),
 * et, s'il refuse encore, sans les images puis sans les textes collés. Faute de mieux, le brouillon
 * reste en mémoire.
 */
import type { PromptAttachment } from '@shared/attachments'

export interface Draft {
  text: string
  attachments: PromptAttachment[]
}

const STORAGE_KEY = 'bob:brouillons'
const MAX_DRAFTS = 50
/** Au-delà (en caractères de JSON, ≈ octets), les images des brouillons ne sont pas écrites. */
export const MAX_STORED_DRAFTS_CHARS = 2_000_000

const EMPTY: Draft = { text: '', attachments: [] }

let drafts: Map<string, Draft> | null = null
let timer: ReturnType<typeof setTimeout> | undefined

/** Pièces jointes relues du disque : seulement celles qui ont la forme attendue. */
function storedAttachments(raw: unknown): PromptAttachment[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((a): a is PromptAttachment => {
    if (typeof a !== 'object' || a === null) return false
    const r = a as Record<string, unknown>
    switch (r['kind']) {
      case 'file':
        return typeof r['path'] === 'string'
      case 'context':
        return typeof r['source'] === 'string'
      case 'text':
        return typeof r['name'] === 'string' && typeof r['text'] === 'string'
      case 'image':
        return ['name', 'mimeType', 'data'].every((k) => typeof r[k] === 'string')
      default:
        return false
    }
  })
}

/** Brouillon relu : texte seul (avant la fiche 155) ou texte et pièces jointes. */
function storedDraft(raw: unknown): Draft | undefined {
  if (typeof raw === 'string') return { text: raw, attachments: [] }
  if (typeof raw !== 'object' || raw === null) return undefined
  const r = raw as Record<string, unknown>
  return {
    text: typeof r['text'] === 'string' ? r['text'] : '',
    attachments: storedAttachments(r['attachments'])
  }
}

function all(): Map<string, Draft> {
  if (drafts) return drafts
  drafts = new Map()
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    if (typeof raw === 'object' && raw !== null) {
      for (const [id, value] of Object.entries(raw)) {
        const draft = storedDraft(value)
        if (draft) drafts.set(id, draft)
      }
    }
  } catch {
    // Stockage indisponible ou illisible : brouillons en mémoire seulement.
  }
  return drafts
}

const isEmpty = (draft: Draft) => !draft.text.trim() && draft.attachments.length === 0

/** Ce qu'on écrit, en laissant de côté les pièces jointes de ces genres. */
function serialize(current: Map<string, Draft>, without: PromptAttachment['kind'][]): string {
  const out: Record<string, Draft> = {}
  for (const [id, draft] of current) {
    const attachments = draft.attachments.filter((a) => !without.includes(a.kind))
    if (draft.text.trim() || attachments.length > 0) out[id] = { text: draft.text, attachments }
  }
  return JSON.stringify(out)
}

/** Écrit les brouillons, du plus complet au plus léger, jusqu'à ce que le stockage accepte. */
function persist(current: Map<string, Draft>): void {
  const full = serialize(current, [])
  const attempts = [
    ...(full.length <= MAX_STORED_DRAFTS_CHARS ? [full] : []),
    serialize(current, ['image']),
    serialize(current, ['image', 'text'])
  ]
  for (const value of attempts) {
    try {
      localStorage.setItem(STORAGE_KEY, value)
      return
    } catch {
      // Stockage plein ou indisponible : on essaie plus léger.
    }
  }
  // Rien n'est passé : le brouillon reste en mémoire.
}

export function loadDraft(conversationId: string): Draft {
  return all().get(conversationId) ?? EMPTY
}

/** Brouillon vide : effacé (message envoyé). Écrit sur le disque un peu plus tard. */
export function saveDraft(conversationId: string, draft: Draft): void {
  const current = all()
  const previous = current.get(conversationId) ?? EMPTY
  if (previous.text === draft.text && previous.attachments === draft.attachments) return
  if (isEmpty(previous) && isEmpty(draft)) return
  // Supprimé puis remis : le plus récent passe en dernier.
  current.delete(conversationId)
  if (!isEmpty(draft)) current.set(conversationId, draft)
  for (const id of [...current.keys()].slice(0, Math.max(0, current.size - MAX_DRAFTS))) {
    current.delete(id)
  }
  clearTimeout(timer)
  timer = setTimeout(() => persist(current), 300)
}

/** Essais : écrit tout de suite, puis oublie le cache (comme après un redémarrage). */
export function flushDraftsForTests(): void {
  clearTimeout(timer)
  if (drafts) persist(drafts)
  drafts = null
}
