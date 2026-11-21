import { describe, expect, it } from 'vitest'
import { inlineFileHref } from './inline-file-code'

const links = (cases: string[]) => cases.map((c) => [c, inlineFileHref(c) !== undefined])

describe('code en ligne qui désigne un fichier (fiche 272)', () => {
  it('chemins : un lien, la plage ramenée à sa première ligne', () => {
    expect(inlineFileHref('src/liste.js:5')).toBe('src/liste.js:5')
    expect(inlineFileHref('src/stockage.js:32-68')).toBe('src/stockage.js:32')
    expect(inlineFileHref('README.md:3')).toBe('README.md:3')
    expect(inlineFileHref('test/cli.test.js')).toBe('test/cli.test.js')
    expect(inlineFileHref('.github/workflows/ci.yml')).toBe('.github/workflows/ci.yml')
    expect(inlineFileHref('server.js:3000')).toBe('server.js:3000')
    // Revue : faux négatifs d'avant.
    const files = [
      'deploy.sh:12',
      './a.sh:1',
      'install.sh',
      'logo.ai:1',
      'main.app:2',
      'x.dev:1',
      'index.co:3',
      'package.json',
      '../lib/x.ts',
      '@types/node/index.d.ts'
    ]
    expect(links(files)).toEqual(files.map((f) => [f, true]))
  })

  it('pas un fichier : commande, mot, URL, version, compte, adresse', () => {
    const others = [
      'npm test',
      'sleep',
      'https://exemple.org/a.js',
      '127.0.0.1:8080',
      'example.org:443',
      'github.com/org/repo.git',
      'api.example.com/v1/users.json',
      'localhost:3000',
      // Revue : faux positifs d'avant.
      'v1.2.3:4',
      '1.2.3:4',
      'admin@10.0.0.1:22',
      'user@host.com:22',
      'example.ch/x.js',
      'docs.rs/serde.html'
    ]
    expect(links(others)).toEqual(others.map((o) => [o, false]))
  })
})
