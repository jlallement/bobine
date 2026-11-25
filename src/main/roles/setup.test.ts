import { describe, expect, it } from 'vitest'
import { verifiedOnDisk } from './setup'

describe('mode installé vérifié sur le disque (fiche 285)', () => {
  it('seulement pour le Participant fourni ; les autres rôles comme avant (fiche 223)', () => {
    expect(verifiedOnDisk({ name: 'participant', scope: 'builtin' })).toBe(true)
    expect(verifiedOnDisk({ name: 'participant', scope: 'project' })).toBe(false)
    expect(verifiedOnDisk({ name: 'code-reviewer', scope: 'builtin' })).toBe(false)
  })
})
