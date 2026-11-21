import { describe, expect, it } from 'vitest'
import { mayCloseTab } from './tab-close-guard'

describe('✕ d’un onglet du panneau (fiche 272)', () => {
  it('second clic d’un double clic : ne ferme jamais ; clic simple ou clavier : ferme', () => {
    expect(mayCloseTab({ detail: 2 })).toBe(false)
    expect(mayCloseTab({ detail: 1 })).toBe(true)
    expect(mayCloseTab({ detail: 0 })).toBe(true)
  })
})
