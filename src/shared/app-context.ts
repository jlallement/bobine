/**
 * Ce que Bobine joint au message de l'utilisateur (fiche 125) : contexte de session (fiche 118),
 * demande de `/split`, échange d'une bascule (fiche 108) ou d'une branche (fiche 023), nouvelles des
 * filles et message d'une autre conversation (fiche 097). Tout part **après** le texte de
 * l'utilisateur : un agent qui titre sa session d'après le début du premier message (Bob) garde le
 * texte de l'utilisateur. Mais un titre peut encore en porter la suite (titre long, ou session d'avant
 * la fiche 125) : `stripAppContext` le coupe au premier bloc de Bobine. Générique : ce sont les
 * débuts des blocs de l'app, quel que soit l'agent.
 */

/** Début de chaque bloc que l'app joint ; les modules qui les écrivent partent de ces textes. */
export const APP_CONTEXT_OPENINGS = {
  capabilities: '<bobine_capabilities>',
  childrenRequest: '<child_conversations_request>',
  childNews: '<child_conversations>',
  handover: 'This conversation started with another assistant',
  renewal: 'This conversation started in an earlier session of yours',
  branch: 'This conversation continues an earlier one',
  origin: 'The message above comes from your',
  aside: '<bobine_aside>',
  memory: '<bobine_memory>',
  memoryOutcomes: '<bobine_memory_outcomes>'
} as const

/**
 * Moment où le contexte de session part (fiches 118, 223) : session neuve (`opened`), session
 * rouverte dont l'historique a déjà reçu le contexte complet (`resumed` : `session/load` ou
 * `session/resume`), ou premier message après une compaction (`compacted`).
 */
export type SessionMoment = 'opened' | 'resumed' | 'compacted'

/** Débuts d'avant la fiche 125 (le contexte partait avant le message), dans d'anciens titres. */
const LEGACY_OPENINGS = ['The next message comes from your']

const MARKERS: readonly string[] = [...Object.values(APP_CONTEXT_OPENINGS), ...LEGACY_OPENINGS]

/** Longueur minimale d'un début de bloc coupé par l'agent, reconnu en fin de titre. */
const minPrefix = (marker: string) => (marker.startsWith('<') ? 4 : 12)

/** Début d'un bloc coupé en fin de texte (« … <bobine_capab… ») : sa position, sinon -1. */
function truncatedMarkerAt(text: string): number {
  for (const marker of MARKERS) {
    for (let length = marker.length - 1; length >= minPrefix(marker); length--) {
      if (text.endsWith(marker.slice(0, length))) return text.length - length
    }
  }
  return -1
}

/**
 * Texte de l'utilisateur seul : coupé au premier bloc de Bobine, ou à un début de bloc tronqué en
 * fin de texte ; `undefined` s'il ne reste rien.
 */
export function stripAppContext(text: string): string | undefined {
  const cuts = MARKERS.map((marker) => text.indexOf(marker)).filter((at) => at >= 0)
  let head = cuts.length ? text.slice(0, Math.min(...cuts)) : text
  // L'agent a coupé son titre au milieu d'un bloc : « Ajoute un test <bobine_capab… ».
  const bare = head.replace(/\s*(…|\.\.\.)$/, '')
  const truncated = truncatedMarkerAt(bare)
  if (truncated >= 0) head = bare.slice(0, truncated)
  const result = head.trim()
  return result || undefined
}
