import { describe, expect, it } from 'vitest'
import { agentsOf, familyRows } from './delete-family'

describe('confirmation de suppression d’une mère (fiche 228)', () => {
  it('descendance : chaque fille suivie des siennes, avec sa profondeur', () => {
    const rows = familyRows(
      [
        { id: 'pf', title: 'pf', motherId: 'f1' },
        { id: 'f1', title: 'f1', motherId: 'm' },
        { id: 'ppf', title: 'ppf', motherId: 'pf' },
        { id: 'f2', title: 'f2', motherId: 'm' }
      ],
      'm'
    )
    expect(rows.map((r) => `${r.depth}:${r.member.id}`)).toEqual(['0:f1', '1:pf', '2:ppf', '0:f2'])
  })

  it('agents : ceux qui suppriment, ceux qui gardent, sans doublon', () => {
    expect(
      agentsOf([
        { profileLabel: 'Bob' },
        { profileLabel: 'OpenCode', agentDeletes: true },
        { profileLabel: 'OpenCode', agentDeletes: true },
        { profileLabel: 'Bob' }
      ])
    ).toEqual({ deleting: ['OpenCode'], keeping: ['Bob'] })
  })
})
