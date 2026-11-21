import { describe, expect, it } from 'vitest'
import { isPathNotScheme, parseFileLink, webLinkTarget } from './file-links'

describe('parseFileLink (fiche 052)', () => {
  it('chemins relatifs, absolus, file://, lignes citées', () => {
    expect(parseFileLink('plan.md')).toEqual({ path: 'plan.md' })
    // Chemins Windows (fiche 229) : sous Windows (capacité `windowsPaths`), la lettre de lecteur
    // n'est pas un schéma ; sous macOS et Linux, comme avant (un schéma `c:`, pas un fichier).
    const win = { windowsPaths: true }
    expect(parseFileLink('C:\\Users\\ada\\a.ts:12', win)).toEqual({
      path: 'C:\\Users\\ada\\a.ts',
      line: 12
    })
    expect(parseFileLink('c:/x/plan.md', win)).toEqual({ path: 'c:/x/plan.md' })
    expect(parseFileLink('file:///C:/Users/ada/a%20b.md#L3', win)).toEqual({
      path: 'C:/Users/ada/a b.md',
      line: 3
    })
    expect(parseFileLink('C:\\Users\\ada\\a.ts:12')).toBeUndefined()
    expect(parseFileLink('c:/x/plan.md', { windowsPaths: false })).toBeUndefined()
    expect(parseFileLink('file:///C:/Users/ada/a%20b.md')).toEqual({ path: '/C:/Users/ada/a b.md' })
    expect(parseFileLink('./docs/a%20b.md')).toEqual({ path: './docs/a b.md' })
    expect(parseFileLink('src/app.ts:12')).toEqual({ path: 'src/app.ts', line: 12 })
    expect(parseFileLink('README.md:3')).toEqual({ path: 'README.md', line: 3 })
    expect(parseFileLink('src/app.ts:12:5')).toEqual({ path: 'src/app.ts', line: 12 })
    expect(parseFileLink('src/app.ts#L7-L9')).toEqual({ path: 'src/app.ts', line: 7 })
    expect(parseFileLink('docs/a.md#titre')).toEqual({ path: 'docs/a.md' })
    expect(parseFileLink('/Users/j/projet/README.md')).toEqual({
      path: '/Users/j/projet/README.md'
    })
    expect(parseFileLink('file:///Users/j/mon%20projet/a.md')).toEqual({
      path: '/Users/j/mon projet/a.md'
    })
  })

  it('liens web, ancres, courriels : pas des fichiers', () => {
    for (const href of [
      'javascript:alert(1)',
      'tel:0123456789',
      'https://example.com/a.md',
      'http://x',
      'mailto:a@b.c',
      '#section',
      '',
      undefined
    ]) {
      expect(parseFileLink(href)).toBeUndefined()
    }
  })
})

describe('webLinkTarget (fiche 154)', () => {
  it('adresses du poste : navigateur intégré', () => {
    for (const href of [
      'http://localhost:3000',
      'http://127.0.0.1:8080/x',
      'http://[::1]:5173/',
      'https://app.localhost/a?b=1',
      'HTTP://LOCALHOST'
    ]) {
      expect(webLinkTarget(href), href).toBe('integrated')
    }
  })

  it('autres http(s) : navigateur du Mac ; le reste n’est pas un lien web', () => {
    expect(webLinkTarget('https://example.com')).toBe('system')
    expect(webLinkTarget('http://localhost.evil.com')).toBe('system')
    expect(webLinkTarget('http://example.com/localhost')).toBe('system')
    for (const href of [
      'plan.md',
      'file:///a/b.md',
      'javascript:alert(1)',
      '#ancre',
      '',
      undefined
    ]) {
      expect(webLinkTarget(href), String(href)).toBeUndefined()
    }
  })
})

describe('isPathNotScheme (fiche 272, relecture)', () => {
  it('fichier sans dossier suivi d’une ligne ; jamais une adresse `hôte:port`', () => {
    for (const href of ['README.md:3', 'liste.js:17', 'deploy.sh:12', 'a.b.c.ts:4:2']) {
      expect(isPathNotScheme(href), href).toBe(true)
    }
    for (const href of [
      'example.com:8080',
      '127.0.0.1:3000',
      'docs.example.org:443',
      'localhost:3000',
      'javascript:alert(1)',
      '.env:1',
      'x.:1',
      'src/a.ts:1'
    ]) {
      expect(isPathNotScheme(href), href).toBe(false)
    }
  })

  it('Windows : `C:/x` et `C:\\x` seulement avec la capacité `windowsPaths`', () => {
    expect(isPathNotScheme('C:/Users/a.ts')).toBe(false)
    expect(isPathNotScheme('C:/Users/a.ts', { windowsPaths: true })).toBe(true)
    expect(isPathNotScheme('C:\\Users\\a.ts', { windowsPaths: true })).toBe(true)
  })

  it('temps linéaire : une entrée géante pleine de points se lit vite (rendu en streaming)', () => {
    const giant = ['.'.repeat(100_000), 'a.'.repeat(50_000) + ':x', 'a' + '.b'.repeat(50_000)]
    const start = performance.now()
    for (const href of giant) expect(isPathNotScheme(href)).toBe(false)
    // Seuil large : la règle quadratique d'avant y passait plusieurs secondes.
    expect(performance.now() - start).toBeLessThan(250)
  })
})
