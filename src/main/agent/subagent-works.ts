/**
 * Travail des sous-agents rejoué à part (profil `subagentReplay`, fiche 053), gardé en mémoire :
 * un même travail n'est rejoué qu'une fois, les plus récents restent, un échec est oublié (on peut
 * réessayer). Sorti du gestionnaire des conversations (fiche 089).
 */
import type { TranscriptItem } from '@shared/transcript'
import { replaySession, type ReplayOptions } from './session-replay'

/** Travaux gardés en mémoire (fiche 053). */
const MAX_SUBAGENT_WORKS = 8

export class SubagentWorks {
  private readonly works = new Map<string, Promise<TranscriptItem[]>>()
  private readonly replay: (options: ReplayOptions) => Promise<TranscriptItem[]>
  private readonly max: number

  constructor(
    options: {
      replay?: (options: ReplayOptions) => Promise<TranscriptItem[]>
      max?: number
    } = {}
  ) {
    this.replay = options.replay ?? replaySession
    this.max = options.max ?? MAX_SUBAGENT_WORKS
  }

  /**
   * Travail de la session `sessionId` ; la consigne, déjà sur la carte du sous-agent, est retirée.
   * `fresh` : le sous-agent travaille encore (fiche 122), relu à chaque fois et jamais gardé.
   */
  load(options: ReplayOptions, { fresh = false } = {}): Promise<TranscriptItem[]> {
    const key = `${options.profile.id}:${options.sessionId}`
    const known = this.works.get(key)
    if (known && !fresh) return known
    const work = this.replay(options).then((items) =>
      items[0]?.kind === 'user' ? items.slice(1) : items
    )
    if (fresh) return work
    this.works.set(key, work)
    work.catch(() => this.works.delete(key))
    for (const old of [...this.works.keys()].slice(0, -this.max)) this.works.delete(old)
    return work
  }
}
