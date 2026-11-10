/**
 * Modèles d'un agent retenus par l'app (fiche 108) : la liste de son réglage de catégorie `model`
 * vue à sa dernière session, et les derniers modèles utilisés avec lui. Ils servent à proposer
 * « Continuer avec … » sans lancer l'agent. Rien n'est supposé d'un agent : un agent sans réglage
 * de modèle (Bob) n'a rien de retenu.
 */
import type { SessionControl } from '@shared/agent'

export interface ModelOption {
  value: string
  name: string
}

export interface ModelsSeen {
  /** Identifiant du réglage chez l'agent (`model` chez OpenCode). */
  controlId: string
  options: ModelOption[]
  /** Derniers modèles utilisés, le plus récent d'abord. */
  recent: string[]
}

/** Derniers modèles retenus par agent, au plus. */
export const MAX_RECENT_MODELS = 3
/** Modèles retenus par agent, au plus (OpenCode en propose une quarantaine, fiche 092). */
const MAX_MODELS = 200

/** Réglage du modèle de la session : le premier `select` de catégorie `model`. */
export function modelControl(controls: readonly SessionControl[]): SessionControl | undefined {
  return controls.find((c) => c.category === 'model' && c.type === 'select')
}

/**
 * Ce qu'il faut retenir après un instantané de l'agent : `undefined` si rien n'a changé (pas de
 * réglage de modèle, même liste, même modèle en tête des récents).
 */
export function noteModels(
  previous: ModelsSeen | undefined,
  controls: readonly SessionControl[]
): ModelsSeen | undefined {
  const control = modelControl(controls)
  if (!control) return undefined
  const options = control.options
    .slice(0, MAX_MODELS)
    .map((o) => ({ value: o.value, name: o.name }))
  const current = typeof control.currentValue === 'string' ? control.currentValue : undefined
  const recent = current
    ? [current, ...(previous?.recent ?? []).filter((v) => v !== current)].slice(
        0,
        MAX_RECENT_MODELS
      )
    : (previous?.recent ?? [])
  const next = { controlId: control.id, options, recent }
  return JSON.stringify(next) === JSON.stringify(previous) ? undefined : next
}

/** Lecture de `settings.json` : entrées mal formées ignorées. */
export function parseModelsSeen(raw: unknown): Record<string, ModelsSeen> {
  if (typeof raw !== 'object' || raw === null) return {}
  const text = (v: unknown): v is string => typeof v === 'string' && v.length > 0
  const entries = Object.entries(raw).flatMap(([profileId, value]) => {
    const r = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>
    if (!text(r['controlId'])) return []
    const options = (Array.isArray(r['options']) ? r['options'] : []).flatMap((o: unknown) => {
      const option = (typeof o === 'object' && o !== null ? o : {}) as Record<string, unknown>
      return text(option['value']) && text(option['name'])
        ? [{ value: option['value'], name: option['name'] }]
        : []
    })
    const recent = (Array.isArray(r['recent']) ? r['recent'] : []).filter(text)
    return [
      [
        profileId,
        {
          controlId: r['controlId'],
          options: options.slice(0, MAX_MODELS),
          recent: recent.slice(0, MAX_RECENT_MODELS)
        }
      ] as const
    ]
  })
  return Object.fromEntries(entries)
}
