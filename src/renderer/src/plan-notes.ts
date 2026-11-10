/**
 * Remarques en cours sur un plan (fiche 040), par conversation et version du plan : gardées en
 * changeant de conversation, et retrouvées après un redémarrage (stockage local du renderer,
 * fiche 043). Les remarques envoyées sont effacées par le composant.
 */
import type { PlanNote } from '@shared/plan-doc'

const STORAGE_KEY = 'bob:remarques-plan'
const MAX_PLANS = 50

let cache: Map<string, PlanNote[]> | null = null

const isNote = (v: unknown): v is PlanNote =>
  typeof v === 'object' &&
  v !== null &&
  typeof (v as PlanNote).quote === 'string' &&
  typeof (v as PlanNote).comment === 'string'

function all(): Map<string, PlanNote[]> {
  if (cache) return cache
  cache = new Map()
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    if (typeof raw === 'object' && raw !== null) {
      for (const [key, notes] of Object.entries(raw)) {
        if (Array.isArray(notes) && notes.length > 0) cache.set(key, notes.filter(isNote))
      }
    }
  } catch {
    // Stockage indisponible ou illisible : remarques en mémoire seulement.
  }
  return cache
}

export const planNotesKey = (conversationId: string, series: string, version: number): string =>
  `${conversationId}:${series}:${version}`

export function loadPlanNotes(key: string): PlanNote[] {
  return all().get(key) ?? []
}

/** Liste vide : plan oublié. Les plans les plus anciens sortent au-delà de la limite. */
export function savePlanNotes(key: string, notes: PlanNote[]): void {
  const current = all()
  current.delete(key)
  if (notes.length > 0) current.set(key, notes)
  for (const old of [...current.keys()].slice(0, Math.max(0, current.size - MAX_PLANS))) {
    current.delete(old)
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(current)))
  } catch {
    // Stockage indisponible : tant pis, les remarques restent en mémoire.
  }
}

/** Tests : oublie le cache, le stockage est relu. */
export function resetPlanNotesCache(): void {
  cache = null
}
