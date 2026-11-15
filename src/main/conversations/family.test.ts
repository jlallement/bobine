import { describe, expect, it } from 'vitest'
import { archiveMembers, descendants, repairOrphans } from './family'
import type { ConversationRecord } from './store'

const record = (id: string, mother?: string, extra: Partial<ConversationRecord> = {}) =>
  ({
    id,
    title: id,
    profileId: 'p',
    workspace: '/w',
    updatedAt: '2026-11-15T10:00:00.000Z',
    ...(mother ? { startedFrom: { id: mother, title: mother } } : {}),
    ...extra
  }) as ConversationRecord

describe('famille d’une conversation (fiche 228)', () => {
  it('descendance : des plus profondes aux plus proches, sans les autres familles', () => {
    const records = [
      record('m'),
      record('f1', 'm'),
      record('pf', 'f1'),
      record('f2', 'm'),
      record('autre'),
      record('fa', 'autre')
    ]
    expect(descendants(records, 'm').map((r) => r.id)).toEqual(['pf', 'f1', 'f2'])
    expect(descendants(records, 'f2')).toEqual([])
  })

  it('descendance : une boucle (données abîmées) ne tourne pas sans fin', () => {
    const records = [record('a', 'b'), record('b', 'a'), record('c', 'c')]
    expect(descendants(records, 'a').map((r) => r.id)).toEqual(['b'])
    expect(descendants(records, 'c')).toEqual([])
  })

  it('liens morts : retirés (mère et archivage), les vivants gardés', () => {
    const records = [
      record('m'),
      record('f', 'm', { archivedWith: 'm' }),
      record('orpheline', 'partie'),
      record('archivee', undefined, { archived: true, archivedWith: 'partie' })
    ]
    expect(repairOrphans(records).map((r) => r.id)).toEqual(['orpheline', 'archivee'])
    expect(records[1]?.startedFrom?.id).toBe('m')
    expect(records[1]?.archivedWith).toBe('m')
    expect(records[2]?.startedFrom).toBeUndefined()
    expect(records[3]?.archivedWith).toBeUndefined()
    expect(records[3]?.archived).toBe(true)
    expect(repairOrphans(records)).toEqual([])
  })

  it('archivage : elle et sa descendance non archivée ; en sortant, celles archivées avec elle', () => {
    const records = [
      record('m'),
      record('f1', 'm'),
      record('pf', 'f1'),
      record('fusionnee', 'm', { archived: true })
    ]
    expect(archiveMembers(records, 'm', true).map((r) => r.id)).toEqual(['m', 'f1', 'pf'])
    const archived = [
      record('m', undefined, { archived: true }),
      record('f1', 'm', { archived: true, archivedWith: 'm' }),
      record('pf', 'f1', { archived: true, archivedWith: 'm' }),
      record('fusionnee', 'm', { archived: true })
    ]
    expect(archiveMembers(archived, 'm', false).map((r) => r.id)).toEqual(['m', 'f1', 'pf'])
  })
})
