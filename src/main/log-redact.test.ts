import { describe, expect, it } from 'vitest'
import { addSecret, EXCERPT_CHARS, excerpt, MASK, redact } from './log-redact'

describe('extraits du journal (fiche 080)', () => {
  it('masque clés, jetons, en-têtes et le jeton du serveur d’outils', () => {
    const text = [
      'Authorization: Bearer abcdefghijklmnop',
      '{"apiKey":"s3cr3t-valeur","totalTokens":5211}',
      'BOB_API_KEY=cle-tres-secrete',
      'sk-ant-api03-abcdefghijklmnopqrstuvwxyz',
      'http://127.0.0.1:5000/mcp/0123456789abcdef0123456789abcdef0123456789abcdef'
    ].join('\n')
    const out = redact(text)
    expect(out).not.toMatch(/abcdefghijklmnop|s3cr3t|cle-tres|sk-ant|0123456789abcdef0/)
    expect(out).toContain(`Bearer ${MASK}`)
    expect(out).toContain(`"apiKey":"${MASK}"`)
    // Un compteur de jetons n'est pas un secret.
    expect(out).toContain('"totalTokens":5211')
    expect(out).toContain(`/mcp/${MASK}`)
  })

  it('valeurs déclarées secrètes (clé donnée à un agent) masquées partout', () => {
    addSecret('ma-cle-personnelle-42')
    addSecret('court')
    expect(redact('env: X=ma-cle-personnelle-42 ; court')).toBe(`env: X=${MASK} ; court`)
  })

  it('extrait : JSON sur une ligne, tronqué au-delà de 500 caractères', () => {
    expect(excerpt({ a: 1, b: 'deux\ntrois' })).toBe('{"a":1,"b":"deux\\ntrois"}')
    expect(excerpt('  plusieurs\n  lignes  ')).toBe('plusieurs lignes')
    const long = excerpt('x'.repeat(EXCERPT_CHARS + 20))
    expect(long).toBe(`${'x'.repeat(EXCERPT_CHARS)}… (+20 car.)`)
  })
})
