/**
 * Famille d'une conversation (fiche 228) : ses filles (fiche 097), leurs filles, et ce qu'il advient
 * d'elles quand la mère est supprimée ou archivée. Fonctions pures sur les enregistrements : le
 * gestionnaire les applique.
 */
import { t } from 'i18next'
import type { FamilyMember } from '@shared/children'
import type { ConversationRecord } from './store'

type Linked = Pick<ConversationRecord, 'id' | 'startedFrom'>

export const memberOf = (
  record: Pick<ConversationRecord, 'id' | 'title' | 'startedFrom'>
): FamilyMember => ({
  id: record.id,
  title: record.title,
  motherId: record.startedFrom?.id ?? ''
})

/**
 * Descendance de `id` par `startedFrom`, des plus profondes aux plus proches (l'ordre où les
 * supprimer : une fille ne perd jamais sa mère avant d'être traitée). Résiste aux boucles.
 */
export function descendants<R extends Linked>(records: readonly R[], id: string): R[] {
  const byMother = new Map<string, R[]>()
  for (const record of records) {
    const mother = record.startedFrom?.id
    if (mother && mother !== record.id)
      byMother.set(mother, [...(byMother.get(mother) ?? []), record])
  }
  const seen = new Set<string>([id])
  const out: R[] = []
  const visit = (motherId: string) => {
    for (const child of byMother.get(motherId) ?? []) {
      if (seen.has(child.id)) continue
      seen.add(child.id)
      visit(child.id)
      out.push(child)
    }
  }
  visit(id)
  return out
}

/**
 * Liens morts laissés par une version précédente (mère supprimée sans ses filles) : retirés des
 * enregistrements, pour qu'une fille ait une mère présente ou aucun lien. Rend les filles réparées.
 */
export function repairOrphans(records: readonly ConversationRecord[]): ConversationRecord[] {
  const ids = new Set(records.map((r) => r.id))
  const dead = (id: string | undefined) => id !== undefined && !ids.has(id)
  const orphans = records.filter((r) => dead(r.startedFrom?.id) || dead(r.archivedWith))
  for (const orphan of orphans) {
    if (dead(orphan.startedFrom?.id)) delete orphan.startedFrom
    if (dead(orphan.archivedWith)) delete orphan.archivedWith
  }
  return orphans
}

/**
 * Membres touchés quand `id` est archivée (`archived`) ou en sort : elle, puis sa descendance non
 * archivée ; en sortant, elle et les descendantes archivées avec elle (`archivedWith`), pas celles
 * archivées avant (fille fusionnée puis nettoyée, fiche 110).
 */
export function archiveMembers<
  R extends Linked & Pick<ConversationRecord, 'archived' | 'archivedWith'>
>(records: readonly R[], id: string, archived: boolean): R[] {
  const self = records.filter((r) => r.id === id)
  const family = descendants(records, id).reverse()
  return [
    ...self,
    ...family.filter((r) => (archived ? !r.archived : r.archived && r.archivedWith === id))
  ]
}

/** Archivage refusé : `record` répond encore (la conversation archivée, ou l'une de ses filles). */
export function busyArchiveError(
  record: Pick<ConversationRecord, 'id' | 'title'>,
  top: string
): string {
  return record.id === top
    ? t('conversations.error.busyArchive')
    : t('conversations.error.busyArchiveChild', { title: record.title })
}
