import { describe, expect, it } from 'vitest'
import { CLOSE_GRACE_MS, mayCloseTab } from './tab-close-guard'

describe('✕ d’un onglet du panneau (fiche 272)', () => {
  it('second clic d’un double clic : ne ferme jamais', () => {
    expect(mayCloseTab('changes', { detail: 2 }, 10_000, null)).toBe(false)
  })

  it('clic juste après l’activation de l’onglet : ne ferme pas ; plus tard, si', () => {
    const activation = { tab: 'changes', at: 1000 }
    expect(mayCloseTab('changes', { detail: 1 }, 1000 + 200, activation)).toBe(false)
    expect(mayCloseTab('changes', { detail: 1 }, 1000 + CLOSE_GRACE_MS, activation)).toBe(true)
    // Un autre onglet n'est pas concerné.
    expect(mayCloseTab('browser', { detail: 1 }, 1000 + 200, activation)).toBe(true)
  })

  it('clic clavier (detail 0) ou simple : ferme', () => {
    expect(mayCloseTab('changes', { detail: 0 }, 5000, null)).toBe(true)
    expect(mayCloseTab('changes', { detail: 1 }, 5000, null)).toBe(true)
  })
})
