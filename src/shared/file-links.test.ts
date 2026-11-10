import { describe, expect, it } from 'vitest'
import { parseFileLink, webLinkTarget } from './file-links'

describe('parseFileLink (fiche 052)', () => {
  it('chemins relatifs, absolus, file://, lignes citées', () => {
    expect(parseFileLink('plan.md')).toEqual({ path: 'plan.md' })
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
