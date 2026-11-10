import type { TranscriptItem } from './transcript'

/**
 * Sous-agents vus par l'app (fiche 010). Aucun agent ne transmet le travail de ses sous-agents par
 * ACP (pas de `subagent_update`) : chacun lance un sous-agent par un appel d'outil à sa façon. Le
 * profil de l'agent sait le reconnaître (`SubagentFormat`, `main/agent/adapters.ts`, fiche 140) ;
 * le main pose alors sur la mise à jour une marque générique, `_meta["bobine/subagent"]`, la seule
 * chose que l'app lit ensuite (fil, suivi des sous-agents). Formats relevés : `bob-subagents.ts`,
 * `opencode-subagents.ts`.
 */

/**
 * Ce que l'app a vu du sous-agent pendant qu'il travaillait (fiche 053), gardé avec la carte : début
 * et fin (heures en ms), coût (lu hors protocole, `costSource`), session à rejouer (`subagentReplay`).
 */
export interface SubagentRun {
  startedAt?: number
  endedAt?: number
  cost?: { amount: number; currency: string }
  /** Session du sous-agent, que l'agent sait rejouer (profil `subagentReplay`). */
  sessionId?: string
  /**
   * Lancé en arrière-plan (fiche 122) : son outil a rendu la main, il travaille encore. La carte le
   * dit en cours jusqu'à `endedAt`, même après la fin du tour.
   */
  background?: boolean
  /** Réponse finale lue dans sa session, quand l'outil n'a rendu qu'un accusé de lancement. */
  answer?: string
  /** Suivi perdu avant sa fin (agent arrêté, nouvelle session) : on ne sait pas comment il a fini. */
  lost?: boolean
}

export interface Subagent {
  /** Type de sous-agent (`explore`, `general`…), s'il est connu. */
  type?: string
  /** Ce qui lui est demandé, en une phrase (description). */
  task: string
  /** Consigne complète, quand l'agent la transmet en plus de la description. */
  prompt?: string
}

/**
 * Éléments du fil avec, après chaque carte de sous-agent, les outils de son travail rangés sous
 * elle (fiche 078) : pour compter ses modifications de fichiers comme celles de l'agent.
 */
export function withSubagentWork(items: readonly TranscriptItem[]): TranscriptItem[] {
  return items.flatMap((item) =>
    item.kind === 'tool' && item.work ? [item, ...item.work] : [item]
  )
}

/** Clé de la marque posée par le main sur une mise à jour (jamais envoyée par un agent). */
export const SUBAGENT_META = 'bobine/subagent'

/** Ce que le profil a reconnu dans un appel d'outil (fiche 140). */
export interface SubagentMark {
  /** Sous-agent lancé par cet appel, s'il est reconnu dans cette mise à jour. */
  subagent?: Subagent
  /** Session du sous-agent nommée par son résultat, sûre à renvoyer à l'agent. */
  sessionId?: string
}

/** Marque posée par le main sur cet appel d'outil, ou `undefined`. */
export function subagentMarkOf(update: {
  _meta?: Record<string, unknown> | null
}): SubagentMark | undefined {
  const mark: unknown = update._meta?.[SUBAGENT_META]
  return typeof mark === 'object' && mark !== null ? (mark as SubagentMark) : undefined
}

/** Le même appel d'outil, avec sa marque. */
export function withSubagentMark<T extends { _meta?: Record<string, unknown> | null }>(
  update: T,
  mark: SubagentMark
): T {
  return { ...update, _meta: { ...update._meta, [SUBAGENT_META]: mark } }
}

/**
 * Réponse du sous-agent telle qu'on la montre. Règle générique (fiche 140) : les paires de balises
 * qui enveloppent toute la réponse sont retirées, l'une après l'autre (`<task_result>…</task_result>`,
 * `<task id="…">…</task>`, `<subagent …>…</subagent>` en sont des cas relevés). Un texte qui n'a
 * pas cette forme est rendu tel quel.
 */
export function subagentResult(output: string): string {
  let text = output.trim()
  for (let depth = 0; depth < 5; depth++) {
    const inner = /^<([A-Za-z][\w-]*)\b[^>]*>([\s\S]*)<\/\1>$/.exec(text)?.[2]
    if (inner === undefined) break
    text = inner.trim()
  }
  return text
}

/** Durée lisible : « < 1 s », « 8 s », « 1 min 05 s », « 1 h 02 min ». */
export function formatDuration(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  if (seconds < 1) return '< 1 s'
  if (seconds < 60) return `${seconds} s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min ${String(seconds % 60).padStart(2, '0')} s`
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min`
}

/**
 * `subagent` d'une carte d'outil : reconnu dans cette mise à jour (marque posée par le main d'après
 * le profil, fiche 140), sinon celui déjà reconnu.
 */
export function withSubagent(
  update: { rawInput?: unknown; _meta?: Record<string, unknown> | null },
  previous?: Subagent
): { subagent?: Subagent } {
  // Une mise à jour sans `rawInput` n'apprend rien de neuf : on garde ce qui était reconnu.
  const subagent =
    update.rawInput == null && previous ? previous : (subagentMarkOf(update)?.subagent ?? previous)
  return subagent ? { subagent } : {}
}
