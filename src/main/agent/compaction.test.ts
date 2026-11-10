import { describe, expect, it } from 'vitest'
import { compactCommandOf, isCompactionRequest } from './compaction'

describe('commande de compaction (fiches 039, 126, 140)', () => {
  it('annoncée sous un nom usuel, sinon celle du profil', () => {
    expect(compactCommandOf([{ name: 'compact', description: '' }], '/compress')).toBe('/compact')
    expect(compactCommandOf([{ name: 'review', description: '' }], '/compress')).toBe('/compress')
    expect(compactCommandOf([], undefined)).toBeUndefined()
  })

  it('demande de compaction : la commande de la session, ou un nom usuel tapé seul', () => {
    expect(isCompactionRequest(' /resumer ', '/resumer')).toBe(true)
    expect(isCompactionRequest('/compress', '/compact')).toBe(true)
    expect(isCompactionRequest('/compact', undefined)).toBe(true)
    expect(isCompactionRequest('/compress maintenant ?', '/compress')).toBe(false)
    expect(isCompactionRequest('compact', undefined)).toBe(false)
  })
})
