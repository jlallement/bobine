import { describe, expect, it, vi } from 'vitest'

// Un partage réseau muet : le chemin réel du dossier ne revient jamais.
vi.mock('./file-links', () => ({ real: () => new Promise<string>(() => {}) }))

const { existingFileLinks } = await import('./file-exists')

describe('vérification bornée dans le temps (fiche 272, rc.3)', () => {
  it('chemin réel du dossier muet : rendu au délai, tout « inconnu », jamais « absent »', async () => {
    const started = Date.now()
    expect(
      await existingFileLinks('/partage/muet', ['liste.js', 'absent.js'], { timeoutMs: 50 })
    ).toEqual({ existing: [], unknown: ['liste.js', 'absent.js'] })
    expect(Date.now() - started).toBeLessThan(1000)
  })
})
