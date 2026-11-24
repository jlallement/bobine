import { describe, expect, it } from 'vitest'
import { invocableRole } from './invocable'

describe('rôles invoquables (fiche 285)', () => {
  it('un rôle interne (« Participant ») ni dans la barre Équipe ni dans les mentions', () => {
    expect(invocableRole({ enabled: true, internal: true })).toBe(false)
    // Un rôle de l'utilisateur, même nommé « participant », n'est pas interne : il reste le sien.
    expect(invocableRole({ enabled: true })).toBe(true)
    expect(invocableRole({ enabled: false })).toBe(false)
  })
})
