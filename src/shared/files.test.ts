import { describe, expect, it } from 'vitest'
import { nameAndDir } from './files'

describe('nameAndDir (résultats du filtre)', () => {
  it('un fichier à la racine n’a pas de dossier', () => {
    expect(nameAndDir('.env')).toEqual({ name: '.env', dir: '' })
    expect(nameAndDir('README.md')).toEqual({ name: 'README.md', dir: '' })
  })

  it('un fichier dans un dossier : son nom et son dossier', () => {
    expect(nameAndDir('docs/guide.md')).toEqual({ name: 'guide.md', dir: 'docs' })
    expect(nameAndDir('a/b/c.ts')).toEqual({ name: 'c.ts', dir: 'a/b' })
  })
})
