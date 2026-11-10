/**
 * Remarques en cours sur les modifications (fiche 085), par conversation : gardées en changeant de
 * conversation et retrouvées après un redémarrage (stockage local du renderer, comme celles du plan,
 * `plan-notes.ts`). Envoyées, elles sont effacées.
 */
import { useState } from 'react'
import type { DiffNote } from '@shared/diff-notes'

const STORAGE_KEY = 'bobine:remarques-diff'
/** Conversations dont on garde les remarques (les plus récemment modifiées). */
const MAX_CONVERSATIONS = 50

let cache: Map<string, DiffNote[]> | null = null

const isNote = (v: unknown): v is DiffNote => {
  if (typeof v !== 'object' || v === null) return false
  const note = v as Partial<DiffNote>
  return (
    typeof note.id === 'string' &&
    (note.view === 'conversation' || note.view === 'git') &&
    typeof note.file === 'string' &&
    typeof note.path === 'string' &&
    (note.side === 'new' || note.side === 'old') &&
    typeof note.from === 'number' &&
    typeof note.to === 'number' &&
    typeof note.code === 'string' &&
    typeof note.comment === 'string'
  )
}

function all(): Map<string, DiffNote[]> {
  if (cache) return cache
  cache = new Map()
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    if (typeof raw === 'object' && raw !== null) {
      for (const [id, notes] of Object.entries(raw)) {
        const valid = Array.isArray(notes) ? notes.filter(isNote) : []
        if (valid.length > 0) cache.set(id, valid)
      }
    }
  } catch {
    // Stockage indisponible ou illisible : remarques en mémoire seulement.
  }
  return cache
}

export function loadDiffNotes(conversationId: string): DiffNote[] {
  return all().get(conversationId) ?? []
}

/** Liste vide : conversation oubliée. Les plus anciennes sortent au-delà de la limite. */
export function saveDiffNotes(conversationId: string, notes: DiffNote[]): void {
  const current = all()
  current.delete(conversationId)
  if (notes.length > 0) current.set(conversationId, notes)
  for (const old of [...current.keys()].slice(0, Math.max(0, current.size - MAX_CONVERSATIONS))) {
    current.delete(old)
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(current)))
  } catch {
    // Stockage indisponible : les remarques restent en mémoire.
  }
}

const IMPORTED_KEY = 'bobine:relectures-importees'
/** Remarques de relecture déjà reprises, gardées au plus (les plus récentes). */
const MAX_IMPORTED = 1000

let imported: string[] | null = null

/**
 * Remarques de relecture (fiche 177) déjà reprises en remarques de diff : une remarque supprimée
 * ou envoyée ne revient pas à la prochaine ouverture de l'onglet.
 */
function importedIds(): string[] {
  if (imported) return imported
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(IMPORTED_KEY) ?? '[]')
    imported = Array.isArray(raw) ? raw.filter((id): id is string => typeof id === 'string') : []
  } catch {
    imported = []
  }
  return imported
}

/** Les remarques de `candidates` pas encore reprises ; elles sont notées comme reprises. */
export function takeNewReviewNotes(candidates: readonly DiffNote[]): DiffNote[] {
  const seen = new Set(importedIds())
  const fresh = candidates.filter((note) => !seen.has(note.id))
  if (fresh.length === 0) return []
  imported = [...importedIds(), ...fresh.map((n) => n.id)].slice(-MAX_IMPORTED)
  try {
    localStorage.setItem(IMPORTED_KEY, JSON.stringify(imported))
  } catch {
    // Stockage indisponible : reprises en mémoire seulement.
  }
  return fresh
}

/** Tests : oublie le cache, le stockage est relu. */
export function resetDiffNotesCache(): void {
  cache = null
  imported = null
}

/** Remarques d'une conversation, gardées à chaque changement. */
export function useDiffNotes(conversationId: string) {
  const [notes, setNotes] = useState(() => loadDiffNotes(conversationId))
  const update = (next: DiffNote[]) => {
    setNotes(next)
    saveDiffNotes(conversationId, next)
  }
  return {
    notes,
    /** Ajoute la remarque, ou remplace celle qui a le même identifiant. */
    save: (note: DiffNote) =>
      update(
        notes.some((n) => n.id === note.id)
          ? notes.map((n) => (n.id === note.id ? note : n))
          : [...notes, note]
      ),
    remove: (id: string) => update(notes.filter((n) => n.id !== id)),
    /** Remarques de relecture reprises (fiche 177), après les autres. */
    addAll: (added: DiffNote[]) => {
      if (added.length > 0) update([...notes, ...added])
    },
    clear: () => update([])
  }
}
