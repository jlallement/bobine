import { describe, expect, it } from 'vitest'
import { invocableRole } from './invocable'

describe('rôles invoquables (fiche 285)', () => {
  it('le rôle fourni « Participant » ni dans la barre Équipe ni dans les mentions', () => {
    expect(invocableRole({ enabled: true, name: 'participant', scope: 'builtin' })).toBe(false)
    // Un rôle de l'utilisateur du même nom reste le sien.
    expect(invocableRole({ enabled: true, name: 'participant', scope: 'user' })).toBe(true)
    expect(invocableRole({ enabled: true, name: 'tech-lead', scope: 'builtin' })).toBe(true)
    expect(invocableRole({ enabled: false, name: 'tech-lead', scope: 'builtin' })).toBe(false)
  })
})
