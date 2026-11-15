/**
 * Confirmation de suppression d'une mère (fiche 228) : sa descendance rangée sous ses mères, et
 * les agents chez qui « Supprimer aussi chez… » supprimerait une session.
 */
import type { ConversationSummary } from '@shared/agent'
import type { FamilyMember } from '@shared/children'

export interface FamilyRow {
  member: FamilyMember
  /** 0 : fille directe ; 1 : petite-fille… */
  depth: number
}

/** Descendance de `rootId` à afficher : chaque fille suivie des siennes, dans l'ordre reçu. */
export function familyRows(family: readonly FamilyMember[], rootId: string): FamilyRow[] {
  const byMother = new Map<string, FamilyMember[]>()
  for (const member of family) {
    byMother.set(member.motherId, [...(byMother.get(member.motherId) ?? []), member])
  }
  const rows: FamilyRow[] = []
  const seen = new Set<string>([rootId])
  const visit = (motherId: string, depth: number) => {
    for (const member of byMother.get(motherId) ?? []) {
      if (seen.has(member.id)) continue
      seen.add(member.id)
      rows.push({ member, depth })
      visit(member.id, depth + 1)
    }
  }
  visit(rootId, 0)
  return rows
}

type AgentSide = Partial<Pick<ConversationSummary, 'profileLabel' | 'agentDeletes'>>

/**
 * Agents concernés par « Supprimer aussi chez… » : ceux qui savent supprimer une session (la case
 * n'apparaît que s'il y en a un), et ceux qui ne le savent pas (leurs sessions restent chez eux).
 * Chaque conversation supprimée l'est chez son propre agent.
 */
export function agentsOf(conversations: readonly AgentSide[]): {
  deleting: string[]
  keeping: string[]
} {
  const labels = (deletes: boolean) => [
    ...new Set(
      conversations.flatMap((c) =>
        !!c.agentDeletes === deletes && c.profileLabel ? [c.profileLabel] : []
      )
    )
  ]
  const deleting = labels(true)
  const keeping = labels(false).filter((label) => !deleting.includes(label))
  return { deleting, keeping }
}
