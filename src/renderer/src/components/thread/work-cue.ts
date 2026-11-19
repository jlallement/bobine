/**
 * Repère en bas du fil (fiche 261, écran E) : quand une carte de travail délégué, hors de l'écran,
 * passe à « a répondu » ou « a fini », une ligne fine au-dessus de la saisie le dit, jusqu'à ce que
 * la carte soit vue. Un état de l'interface, jamais un élément du fil.
 *
 * Logique pure, sans DOM : la visibilité d'une carte est demandée à `seen`. Les cibles viennent d'un
 * adaptateur (`work-cue-targets.ts`), seul à connaître les cartes d'aujourd'hui : la fiche 263 le
 * rebranchera sur la carte-réponse.
 */

/** État d'une cible, vu du repère. */
export type CueState = 'working' | 'replied' | 'finished' | 'idle'

/** Un élément repérable du fil : un travail délégué et la carte qui le montre. */
export interface CueTarget {
  /** Clé stable du travail (id de sa conversation). */
  key: string
  /** Élément du fil où se trouve sa carte (`data-work-anchor` dans le DOM). */
  itemId: number
  /** Nom dit par le repère : le rôle, ou le titre du travail. */
  label: string
  /** Rôle du travail : son avatar dans le repère. */
  role?: { icon: string; color: string } | undefined
  state: CueState
}

/** Ce que le repère retient d'un rendu à l'autre. */
export interface CueMemory {
  /** Dernier état connu de chaque cible. */
  states: ReadonlyMap<string, CueState>
  /** Travaux qui ont répondu hors de l'écran, pas encore vus : le plus ancien d'abord. */
  pending: readonly string[]
}

export const EMPTY_CUE: CueMemory = { states: new Map(), pending: [] }

const answered = (state: CueState | undefined) => state === 'replied' || state === 'finished'

/**
 * Nouvel état des cibles : un travail qui travaillait et qui a répondu ou fini pendant que sa carte
 * n'est pas à l'écran entre dans la file ; un travail disparu, ou reparti au travail, en sort. Un
 * travail vu pour la première fois (ouverture de la conversation) n'y entre jamais : on ne sait pas
 * quand il a répondu.
 */
export function noteTargets(
  memory: CueMemory,
  targets: readonly CueTarget[],
  seen: (target: CueTarget) => boolean
): CueMemory {
  const states = new Map(targets.map((target) => [target.key, target.state]))
  const pending = memory.pending.filter((key) => answered(states.get(key)))
  for (const target of targets) {
    if (memory.states.get(target.key) !== 'working' || !answered(target.state)) continue
    if (!pending.includes(target.key) && !seen(target)) pending.push(target.key)
  }
  return { states, pending: samePending(memory.pending, pending) ? memory.pending : pending }
}

/** Les travaux dont la carte est maintenant à l'écran sortent de la file (même objet sinon). */
export function dropSeen(
  memory: CueMemory,
  targets: readonly CueTarget[],
  seen: (target: CueTarget) => boolean
): CueMemory {
  if (memory.pending.length === 0) return memory
  const byKey = new Map(targets.map((target) => [target.key, target]))
  const pending = memory.pending.filter((key) => {
    const target = byKey.get(key)
    return !!target && !seen(target)
  })
  return pending.length === memory.pending.length ? memory : { ...memory, pending }
}

/** Un travail retiré de la file (« Voir » : la carte est montrée). */
export function dropKey(memory: CueMemory, key: string): CueMemory {
  return memory.pending.includes(key)
    ? { ...memory, pending: memory.pending.filter((k) => k !== key) }
    : memory
}

/** Ce que dit le repère : le plus ancien travail non vu, et combien attendent. */
export function cueSummary(
  memory: CueMemory,
  targets: readonly CueTarget[]
): { first: CueTarget; count: number } | undefined {
  const waiting = memory.pending.flatMap((key) => targets.filter((t) => t.key === key))
  const first = waiting[0]
  return first ? { first, count: waiting.length } : undefined
}

/** Une carte compte comme vue quand au moins cette hauteur (ou toute la carte) est à l'écran. */
export const SEEN_PX = 24

/**
 * La carte est-elle à l'écran ? Une part d'au moins `SEEN_PX` (ou toute la carte si elle est plus
 * petite) dans la zone visible de l'élément qui défile. Absente du DOM (long fil pas encore rendu,
 * fiche 193) : pas vue.
 */
export function isOnScreen(card: Element | null, scroller: Element | null): boolean {
  if (!card || !scroller) return false
  const box = card.getBoundingClientRect()
  const view = scroller.getBoundingClientRect()
  const overlap = Math.min(box.bottom, view.bottom) - Math.max(box.top, view.top)
  return overlap > 0 && overlap >= Math.min(SEEN_PX, box.height)
}

function samePending(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((key, i) => key === b[i])
}

/** Ce qui compte des cibles pour le repère : il ne recalcule rien tant que cela ne change pas. */
export function targetsSignature(targets: readonly CueTarget[]): string {
  return targets.map((t) => `${t.key}:${t.itemId}:${t.state}`).join('|')
}
