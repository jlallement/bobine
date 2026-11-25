import { describe, expect, it } from 'vitest'
import type { SessionControl } from '@shared/agent'
import { expectedReadOnly, modeHeld } from './options'

const modes = (current: string): SessionControl => ({
  id: 'mode',
  name: 'Session Mode',
  category: 'mode',
  type: 'select',
  currentValue: current,
  options: [
    { value: 'build', name: 'participant' },
    { value: 'participant', name: 'Participant' }
  ]
})

describe('lecture seule d’un participant (revue sécurité, fiche 285)', () => {
  it('mode natif reconnu par sa valeur seulement, jamais par son nom', () => {
    expect(modeHeld([modes('participant')], 'participant')).toBe(true)
    // Un mode `build` nommé « participant » (fourni par le dépôt) n'est pas le mode installé.
    expect(modeHeld([modes('build')], 'participant')).toBe(false)
    expect(modeHeld([{ ...modes('participant'), category: 'model' }], 'participant')).toBe(false)
  })

  it('profil introuvable : rien n’est promis', () => {
    expect(expectedReadOnly(undefined, true, undefined)).toBe('unverified')
    expect(expectedReadOnly({ id: 'bob' }, true, undefined)).toBe('enforced')
    expect(
      expectedReadOnly({ id: 'oc', writesWithoutAsking: true }, true, {
        id: 'participant',
        readOnly: true,
        stale: 'roleChanged'
      })
    ).toBe('requested')
    // Hors dépôt git : jamais « garantie », même installé.
    expect(
      expectedReadOnly({ id: 'oc', writesWithoutAsking: true }, false, {
        id: 'participant',
        readOnly: true
      })
    ).toBe('unverified')
  })
})
