/**
 * « Où en était-on ? » (fiche 156) : en rouvrant une conversation inactive depuis plus d'un jour,
 * un résumé court construit par Bobine depuis le fil, le dernier plan et git — sans appeler le
 * modèle, sans rien envoyer à l'agent.
 */
import { stripAppContext } from './app-context'
import type { TranscriptItem } from './transcript'

/** Inactive depuis plus longtemps que ceci : la carte s'affiche à la réouverture. */
export const RESUME_AFTER_MS = 24 * 3600 * 1000

/** Tâches montrées au plus par liste ; au-delà, « et N autres ». */
export const RESUME_MAX_TASKS = 5

/** Fichiers montrés au plus. */
export const RESUME_MAX_FILES = 8

const MAX_TEXT = 240

export interface ResumeSummary {
  /** Dernière activité (ms) : dernier message envoyé ou dernière réponse. */
  lastAt: number
  /** Dernière demande de l'utilisateur, coupée. */
  request?: string
  /** Tâches du dernier plan, faites et pas encore faites (en cours d'abord). */
  done: string[]
  todo: { text: string; running: boolean }[]
  /** Sans plan : le début de la dernière réponse. */
  reply?: string
  /** Fichiers modifiés et pas commités (relatifs au dossier), s'ils sont connus. */
  files: string[]
}

/** Dernière activité du fil : la plus récente heure d'un message ou d'une réponse. */
export function lastActivity(items: TranscriptItem[]): number | undefined {
  let last: number | undefined
  for (const item of items) {
    if ((item.kind === 'user' || item.kind === 'agent') && item.at !== undefined) {
      last = last === undefined ? item.at : Math.max(last, item.at)
    }
  }
  return last
}

/** Texte sur une ligne, coupé à `max` caractères. */
export function shorten(text: string, max = MAX_TEXT): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat
}

/** Premier paragraphe d'une réponse, sans les marques Markdown les plus visibles. */
function replyExcerpt(text: string): string | undefined {
  const paragraph = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .find((p) => p && !p.startsWith('```'))
  if (!paragraph) return undefined
  return shorten(paragraph.replace(/^#+\s*/, '').replace(/\*\*|__|`/g, ''))
}

/**
 * Le résumé à montrer en rouvrant la conversation à `now`, ou `null` : fil sans heure, ou activité
 * de moins d'un jour. `files` : les fichiers modifiés non commités, s'ils sont connus.
 */
export function resumeSummary(
  items: TranscriptItem[],
  now: number,
  files: string[] = []
): ResumeSummary | null {
  const lastAt = lastActivity(items)
  if (lastAt === undefined || now - lastAt <= RESUME_AFTER_MS) return null
  const user = items.findLast(
    (item): item is Extract<TranscriptItem, { kind: 'user' }> =>
      item.kind === 'user' && !item.from && !item.compaction && !!item.text.trim()
  )
  const request = user ? stripAppContext(user.text) : undefined
  const plan = items.findLast(
    (item): item is Extract<TranscriptItem, { kind: 'plan' }> => item.kind === 'plan'
  )
  const entries = plan?.entries ?? []
  const done = entries.filter((e) => e.status === 'completed').map((e) => shorten(e.content))
  const todo = [
    ...entries.filter((e) => e.status === 'in_progress'),
    ...entries.filter((e) => e.status === 'pending')
  ].map((e) => ({ text: shorten(e.content), running: e.status === 'in_progress' }))
  const lastReply = items.findLast(
    (item): item is Extract<TranscriptItem, { kind: 'agent' }> => item.kind === 'agent'
  )
  const reply = !plan && lastReply ? replyExcerpt(lastReply.text) : undefined
  return {
    lastAt,
    ...(request ? { request: shorten(request) } : {}),
    done,
    todo,
    ...(reply ? { reply } : {}),
    files
  }
}
