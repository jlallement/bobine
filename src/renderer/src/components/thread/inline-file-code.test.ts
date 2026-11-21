import { describe, expect, it } from 'vitest'
import { inlineFileHref } from './inline-file-code'

describe('code en ligne qui désigne un fichier (fiche 272)', () => {
  it('chemin avec dossier ou ligne : un lien ; le reste : rien', () => {
    expect(inlineFileHref('src/liste.js:5')).toBe('src/liste.js:5')
    expect(inlineFileHref('src/stockage.js:32-68')).toBe('src/stockage.js:32')
    expect(inlineFileHref('README.md:3')).toBe('README.md:3')
    expect(inlineFileHref('test/cli.test.js')).toBe('test/cli.test.js')
    expect(inlineFileHref('package.json')).toBeUndefined()
    expect(inlineFileHref('npm test')).toBeUndefined()
    expect(inlineFileHref('sleep')).toBeUndefined()
    expect(inlineFileHref('https://exemple.org/a.js')).toBeUndefined()
  })

  it('une adresse n’est pas un chemin : IP, domaine, dépôt distant (revue de la fiche 272)', () => {
    for (const address of [
      '127.0.0.1:8080',
      'example.org:443',
      'github.com/org/repo.git',
      'api.example.com/v1/users.json',
      'localhost:3000'
    ]) {
      expect([address, inlineFileHref(address)]).toEqual([address, undefined])
    }
    // Les vrais chemins restent des liens, même avec un dossier à point.
    expect(inlineFileHref('.github/workflows/ci.yml')).toBe('.github/workflows/ci.yml')
    expect(inlineFileHref('server.js:3000')).toBe('server.js:3000')
  })
})
