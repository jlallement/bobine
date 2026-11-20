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
})
