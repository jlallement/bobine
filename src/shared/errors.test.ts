import { describe, expect, it } from 'vitest'
import { messageOf } from './errors'

describe('messageOf', () => {
  it('message d’une Error, sinon la valeur levée en texte', () => {
    expect(messageOf(new TypeError('boum'))).toBe('boum')
    expect(messageOf('texte')).toBe('texte')
    expect(messageOf(42)).toBe('42')
    expect(messageOf(undefined)).toBe('undefined')
  })
})
