import { describe, expect, it, vi } from 'vitest'
import { excludedAmong } from './useAttachments'

describe('exclusions de l’agent avant de joindre (fiche 155)', () => {
  const paths = Array.from({ length: 250 }, (_, i) => `/projet/f${i}.txt`)

  it('sans vérification : rien d’exclu', async () => {
    expect(await excludedAmong(paths, undefined)).toEqual({ paths: [], files: [] })
  })

  it('vérifie par lots de 100 et réunit les réponses', async () => {
    const check = vi.fn(async (batch: string[]) => ({
      paths: batch.filter((p) => p.endsWith('0.txt')),
      files: ['.bobignore']
    }))
    const found = await excludedAmong(paths, check)
    expect(check.mock.calls.map(([batch]) => batch.length)).toEqual([100, 100, 50])
    expect(found.paths).toHaveLength(25)
    expect(found.files).toEqual(['.bobignore'])
  })

  it('un lot qui échoue est retenu en entier, sans fichier d’exclusion connu', async () => {
    const check = vi.fn(async (batch: string[]) => {
      if (batch[0] === '/projet/f100.txt') throw new Error('Chemins invalides')
      return { paths: [], files: ['.bobignore'] }
    })
    const found = await excludedAmong(paths, check)
    expect(found.paths).toEqual(paths.slice(100, 200))
    expect(found.files).toEqual(['.bobignore'])
  })
})
