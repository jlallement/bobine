import { describe, expect, it } from 'vitest'
import {
  attachmentName,
  base64Bytes,
  imageTypeOf,
  insertMention,
  isLongPaste,
  lineCount,
  MAX_ATTACHMENTS,
  MAX_PASTED_TEXT_CHARS,
  mentionAt,
  parseAttachments,
  PASTE_AS_ATTACHMENT
} from './attachments'

describe('pièces jointes', () => {
  it('parseAttachments : images et chemins valides', () => {
    expect(parseAttachments(undefined)).toEqual([])
    expect(
      parseAttachments([
        { kind: 'image', name: 'capture.png', mimeType: 'image/png', data: 'iVBORw0KGgo=' },
        { kind: 'file', path: '/projet/README.md' }
      ])
    ).toEqual([
      { kind: 'image', name: 'capture.png', mimeType: 'image/png', data: 'iVBORw0KGgo=' },
      { kind: 'file', path: '/projet/README.md' }
    ])
  })

  it('parseAttachments : refuse le reste', () => {
    expect(() => parseAttachments('x')).toThrow('invalides')
    expect(() => parseAttachments([{ kind: 'file', path: 'relatif' }])).toThrow('Chemin')
    expect(() => parseAttachments([{ kind: 'file', path: '/a\0b' }])).toThrow('Chemin')
    expect(() =>
      parseAttachments([{ kind: 'image', name: 'a', mimeType: 'image/svg+xml', data: 'AA==' }])
    ).toThrow('Format')
    expect(() =>
      parseAttachments([
        { kind: 'image', name: 'a', mimeType: 'image/png', data: 'pas du base64!' }
      ])
    ).toThrow('illisible')
    expect(() =>
      parseAttachments([
        { kind: 'image', name: 'a', mimeType: 'image/png', data: 'A'.repeat(8 * 1024 * 1024) }
      ])
    ).toThrow('trop lourde')
    expect(() =>
      parseAttachments(
        Array.from({ length: MAX_ATTACHMENTS + 1 }, () => ({ kind: 'file', path: '/a' }))
      )
    ).toThrow('Au plus')
    expect(() => parseAttachments([{ kind: 'audio' }])).toThrow('inconnue')
  })

  it('imageTypeOf et base64Bytes', () => {
    expect(imageTypeOf('Capture.PNG')).toBe('image/png')
    expect(imageTypeOf('photo.jpeg')).toBe('image/jpeg')
    expect(imageTypeOf('notes.md')).toBeUndefined()
    expect(base64Bytes('AAAA')).toBe(3)
    expect(base64Bytes('AAA=')).toBe(2)
    expect(base64Bytes('AA==')).toBe(1)
  })

  it('mention @ : détectée avant le curseur, puis remplacée par le chemin', () => {
    expect(mentionAt('regarde @src/ap', 15)).toEqual({ query: 'src/ap', start: 8 })
    expect(mentionAt('@', 1)).toEqual({ query: '', start: 0 })
    expect(mentionAt('mail@exemple.fr', 15)).toBeUndefined()
    expect(mentionAt('regarde @src fin', 16)).toBeUndefined()
    const mention = mentionAt('voir @ap et', 8)
    if (!mention) throw new Error('mention attendue')
    expect(insertMention('voir @ap et', mention, 'src/app.ts')).toEqual({
      text: 'voir @src/app.ts  et',
      caret: 17
    })
  })
})

describe('long texte collé (fiche 155)', () => {
  it('seuils : 40 lignes ou 4 000 caractères', () => {
    expect(lineCount('')).toBe(0)
    expect(lineCount('un\ndeux\n')).toBe(2)
    expect(lineCount('un\r\ndeux')).toBe(2)
    expect(isLongPaste('ligne\n'.repeat(PASTE_AS_ATTACHMENT.lines))).toBe(false)
    expect(isLongPaste('ligne\n'.repeat(PASTE_AS_ATTACHMENT.lines + 1))).toBe(true)
    expect(isLongPaste('x'.repeat(PASTE_AS_ATTACHMENT.chars))).toBe(false)
    expect(isLongPaste('x'.repeat(PASTE_AS_ATTACHMENT.chars + 1))).toBe(true)
  })

  it('parseAttachments : texte joint valide, vide ou trop long refusé', () => {
    expect(parseAttachments([{ kind: 'text', name: 'Texte collé', text: 'a\nb' }])).toEqual([
      { kind: 'text', name: 'Texte collé', text: 'a\nb' }
    ])
    expect(() => parseAttachments([{ kind: 'text', name: 'x', text: '' }])).toThrow()
    expect(() => parseAttachments([{ kind: 'text', name: 'x', text: 3 }])).toThrow()
    expect(() =>
      parseAttachments([{ kind: 'text', name: 'x', text: 'y'.repeat(MAX_PASTED_TEXT_CHARS + 1) }])
    ).toThrow()
    expect(attachmentName({ kind: 'text', name: 'Texte collé', text: 'a' })).toBe('Texte collé')
  })
})
