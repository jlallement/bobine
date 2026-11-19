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
  /**
   * Travaux qui viennent de répondre hors de l'écran, pas encore montrés : leur carte peut encore
   * arriver sous les yeux (l'état d'une fille arrive avant son compte rendu, ajouté en bas du fil).
   * Ils sont revus après `SETTLE_MS` (`settle`).
   */
  settling: readonly string[]
  /** Travaux qui ont répondu hors de l'écran, pas encore vus : le plus ancien d'abord. */
  pending: readonly string[]
}

export const EMPTY_CUE: CueMemory = { states: new Map(), settling: [], pending: [] }

/** Délai avant de dire qu'un travail a répondu hors de l'écran (sa carte a pu arriver entre-temps). */
export const SETTLE_MS = 600

const answered = (state: CueState | undefined) => state === 'replied' || state === 'finished'

/**
 * Nouvel état des cibles : un travail qui travaillait et qui a répondu ou fini pendant que sa carte
 * n'est pas à l'écran attend d'être revu (`settling`) ; un travail disparu, ou reparti au travail,
 * sort des deux files. Un travail vu pour la première fois (ouverture de la conversation) n'y
 * entre jamais : on ne sait pas quand il a répondu.
 */
export function noteTargets(
  memory: CueMemory,
  targets: readonly CueTarget[],
  seen: (target: CueTarget) => boolean
): CueMemory {
  const states = new Map(targets.map((target) => [target.key, target.state]))
  const keep = (key: string) => answered(states.get(key))
  const pending = memory.pending.filter(keep)
  const settling = memory.settling.filter(keep)
  for (const target of targets) {
    if (memory.states.get(target.key) !== 'working' || !answered(target.state)) continue
    const known = pending.includes(target.key) || settling.includes(target.key)
    if (!known && !seen(target)) settling.push(target.key)
  }
  return {
    states,
    settling: sameKeys(memory.settling, settling) ? memory.settling : settling,
    pending: sameKeys(memory.pending, pending) ? memory.pending : pending
  }
}

/** Revue après le délai : les travaux toujours hors de l'écran passent au repère. */
export function settle(
  memory: CueMemory,
  targets: readonly CueTarget[],
  seen: (target: CueTarget) => boolean
): CueMemory {
  if (memory.settling.length === 0) return memory
  const byKey = new Map(targets.map((target) => [target.key, target]))
  const shown = memory.settling.filter((key) => {
    const target = byKey.get(key)
    return !!target && !seen(target)
  })
  return { ...memory, settling: [], pending: [...memory.pending, ...shown] }
}

/** Les travaux dont la carte est maintenant à l'écran sortent des files (même objet sinon). */
export function dropSeen(
  memory: CueMemory,
  targets: readonly CueTarget[],
  seen: (target: CueTarget) => boolean
): CueMemory {
  if (memory.pending.length === 0 && memory.settling.length === 0) return memory
  const byKey = new Map(targets.map((target) => [target.key, target]))
  const unseen = (key: string) => {
    const target = byKey.get(key)
    return !!target && !seen(target)
  }
  const pending = memory.pending.filter(unseen)
  const settling = memory.settling.filter(unseen)
  if (pending.length === memory.pending.length && settling.length === memory.settling.length) {
    return memory
  }
  return { ...memory, pending, settling }
}

/** Un travail retiré des files (« Voir » : la carte est montrée). */
export function dropKey(memory: CueMemory, key: string): CueMemory {
  if (!memory.pending.includes(key) && !memory.settling.includes(key)) return memory
  return {
    ...memory,
    pending: memory.pending.filter((k) => k !== key),
    settling: memory.settling.filter((k) => k !== key)
  }
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

function sameKeys(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((key, i) => key === b[i])
}

/** Ce qui compte des cibles pour le repère : il ne recalcule rien tant que cela ne change pas. */
export function targetsSignature(targets: readonly CueTarget[]): string {
  return targets.map((t) => `${t.key}:${t.itemId}:${t.state}`).join('|')
}
