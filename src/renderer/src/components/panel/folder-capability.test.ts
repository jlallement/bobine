import { describe, expect, it } from 'vitest'
import { folderCapability } from './folder-capability'

describe('capacité « autres dossiers » pendant un redémarrage (fiche 290)', () => {
  it('agent prêt ou qui répond : ce qu’il annonce', () => {
    expect(folderCapability({ id: 'c1', on: true }, 'c1', false, 'ready')).toBe(false)
    expect(folderCapability(null, 'c1', true, 'busy')).toBe(true)
  })

  it('agent qui redémarre : la dernière capacité vue pour cette conversation', () => {
    expect(folderCapability({ id: 'c1', on: true }, 'c1', false, 'starting')).toBe(true)
    expect(folderCapability({ id: 'c1', on: false }, 'c1', false, 'starting')).toBe(false)
  })

  it('autre conversation, ou rien de vu : ce qu’annonce l’instantané', () => {
    expect(folderCapability({ id: 'c1', on: true }, 'c2', false, 'starting')).toBe(false)
    expect(folderCapability(null, 'c1', false, undefined)).toBe(false)
  })
})
