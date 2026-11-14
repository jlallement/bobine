import { describe, expect, it } from 'vitest'
import { readOnlyShown, roleProfile } from './role-view'

const profiles = [
  { id: 'mock', label: 'Factice', available: true },
  { id: 'silent', label: 'Silencieux', available: true, writesWithoutAsking: true },
  { id: 'gone', label: 'Absent', available: false }
]

describe('roleProfile', () => {
  it('agent du rôle s’il est disponible (identifiant ou nom), sinon celui de la mère', () => {
    expect(roleProfile({ agent: 'silent' }, profiles, 'mock')?.id).toBe('silent')
    expect(roleProfile({ agent: 'Silencieux' }, profiles, 'mock')?.id).toBe('silent')
    expect(roleProfile({ agent: 'gone' }, profiles, 'mock')?.id).toBe('mock')
    expect(roleProfile({}, profiles, 'silent')?.id).toBe('silent')
  })
})

describe('readOnlyShown', () => {
  it('garantie, seulement demandée, ou rien', () => {
    expect(readOnlyShown(true, profiles[0])).toBe('enforced')
    expect(readOnlyShown(true, profiles[1])).toBe('requested')
    expect(readOnlyShown(false, profiles[1])).toBeUndefined()
    expect(readOnlyShown(true, undefined)).toBe('enforced')
  })
})
