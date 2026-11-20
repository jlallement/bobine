import { describe, expect, it } from 'vitest'
import { highlightLines, languageOf, plainLines } from './code-lines'

describe('languageOf', () => {
  it('par l’extension, le nom, le #!', () => {
    expect(languageOf('src/app.ts')).toBe('ts')
    expect(languageOf('a/b.jsonc')).toBe('json')
    expect(languageOf('Makefile')).toBe('makefile')
    expect(languageOf('.env.local')).toBe('ini')
    expect(languageOf('scripts/verify', '#!/usr/bin/env bash\nset -e')).toBe('bash')
    expect(languageOf('bin/outil', '#!/usr/bin/env node\n')).toBe('javascript')
    expect(languageOf('LICENSE', 'MIT')).toBeUndefined()
    expect(languageOf('notes.txt')).toBeUndefined()
  })
})

describe('highlightLines', () => {
  it('colore et découpe en lignes', () => {
    const lines = highlightLines('const a = 1\nreturn a', 'ts')
    expect(lines).toHaveLength(2)
    expect(lines[0]?.[0]).toEqual({ text: 'const', className: 'hljs-keyword' })
    expect(lines[1]?.map((t) => t.text).join('')).toBe('return a')
  })

  it('reporte une classe ouverte sur plusieurs lignes', () => {
    const lines = highlightLines('/* un\ndeux */\nx', 'js')
    expect(lines[0]?.[0]?.className).toBe('hljs-comment')
    expect(lines[1]?.[0]).toEqual({ text: 'deux */', className: 'hljs-comment' })
    expect(lines[2]).toEqual([{ text: 'x' }])
  })

  it('langage inconnu ou absent : texte brut', () => {
    expect(highlightLines('a\n\nb', undefined)).toEqual(plainLines('a\n\nb'))
    expect(highlightLines('a\nb', 'pas-un-langage')).toEqual([[{ text: 'a' }], [{ text: 'b' }]])
  })

  it('n’insère jamais de HTML : le texte reste du texte', () => {
    const lines = highlightLines('<script>alert(1)</script>', 'html')
    expect(lines[0]?.map((t) => t.text).join('')).toBe('<script>alert(1)</script>')
  })
})
