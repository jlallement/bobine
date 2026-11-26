/**
 * Fusion et nettoyage d'une fille faits depuis son onglet Git (fiche 287) : dits dans le fil de sa
 * mère, comme ceux faits depuis une carte (élément `children-merge`, fiches 120, 264). La carte de
 * la mère et Modifications › Travaux lisent cet élément : sans lui, une fille fusionnée puis
 * nettoyée depuis son onglet Git (branche supprimée, conversation archivée) restait « À revoir »
 * (recette Bricole, 02:05).
 */
import { randomUUID } from 'node:crypto'
import type { ConversationSummary } from '@shared/agent'
import { mergeActive, type ChildrenMerge, type ChildrenMergeRow } from '@shared/children-merge'
import { lastMergeFor } from '@shared/work-groups'
import type { ConversationManager } from './manager'

export type MergeRecordHost = Pick<ConversationManager, 'state' | 'view' | 'post'>

/** Ce que la fusion d'une fille a donné, tel que sa ligne le garde. */
export interface MergedFacts {
  base: string
  branch: string
  /** Commit de la base après elle, court. */
  commit?: string
  /** Ce que la branche apportait, lu juste avant la fusion. */
  fileCount?: number
  added?: number
  removed?: number
}

export class ChildMergeRecorder {
  private readonly host: MergeRecordHost
  private readonly now: () => number

  constructor(host: MergeRecordHost, now: () => number = Date.now) {
    this.host = host
    this.now = now
  }

  /** Mère de la fille, si elle en a une (et qu'elle n'est ni supprimée ni archivée). */
  motherOf(childId: string): string | undefined {
    return this.summary(childId)?.startedFrom?.id
  }

  private summary(id: string): ConversationSummary | undefined {
    return this.host.state().conversations.find((c) => c.id === id)
  }

  /** La fille vient d'être fusionnée depuis son onglet Git : une ligne « fusionné » chez sa mère. */
  merged(childId: string, facts: MergedFacts): void {
    const motherId = this.motherOf(childId)
    const child = this.summary(childId)
    if (!motherId || !child) return
    const at = this.now()
    const row: ChildrenMergeRow = {
      childId,
      title: child.title,
      branch: facts.branch,
      state: 'merged',
      ...(facts.commit ? { commit: facts.commit } : {}),
      ...(facts.fileCount !== undefined ? { fileCount: facts.fileCount } : {}),
      ...(facts.added !== undefined ? { added: facts.added } : {}),
      ...(facts.removed !== undefined ? { removed: facts.removed } : {})
    }
    this.post(motherId, {
      runId: randomUUID(),
      base: facts.base,
      cleanup: false,
      status: 'done',
      rows: [row],
      startedAt: at,
      endedAt: at
    })
  }

  /**
   * La fille vient d'être nettoyée depuis son onglet Git (worktree et branche supprimés). Sa
   * dernière ligne fusionnée chez sa mère est dite nettoyée ; sans ligne (fusion faite hors de
   * Bobine, PR fusionnée), une ligne fusionnée et nettoyée est posée si `merged` dit que la branche
   * était dans la base. `motherId` : lu avant le nettoyage (la fille est archivée par lui).
   */
  cleaned(
    childId: string,
    motherId: string | undefined,
    merged: (MergedFacts & { title: string }) | undefined
  ): void {
    if (!motherId) return
    const items = this.host.view(motherId).transcript.items
    const last = lastMergeFor(items, [childId])
    const row = last?.rows.find((r) => r.childId === childId)
    if (
      last &&
      row &&
      !mergeActive(last) &&
      (row.state === 'merged' || row.state === 'up-to-date')
    ) {
      if (row.cleaned) return
      this.post(motherId, {
        ...last,
        rows: last.rows.map((r) => (r.childId === childId ? { ...r, cleaned: true } : r))
      })
      return
    }
    if (!merged) return
    const at = this.now()
    this.post(motherId, {
      runId: randomUUID(),
      base: merged.base,
      cleanup: true,
      status: 'done',
      rows: [
        {
          childId,
          title: merged.title,
          branch: merged.branch,
          state: 'merged',
          cleaned: true,
          ...(merged.commit ? { commit: merged.commit } : {})
        }
      ],
      startedAt: at,
      endedAt: at
    })
  }

  private post(motherId: string, merge: ChildrenMerge): void {
    this.host.post(motherId, { type: 'children-merge', merge })
  }
}
