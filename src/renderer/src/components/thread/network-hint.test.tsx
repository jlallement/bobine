import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { withCode } from './network-hint'

const shown = (text: string, value: string) =>
  render(<p>{withCode((slot) => text.replace('{{proxy}}', slot), value)}</p>).container
    .firstElementChild as HTMLElement

describe('adresse dans un texte traduit (fiches 275, 276)', () => {
  it('en code, collée à ses parenthèses et à la ponctuation qui la suit, texte inchangé', () => {
    const fr = shown('Un proxy est défini ({{proxy}}) : vérifiez-le.', 'http://•••@p:3128')
    expect(fr.textContent).toBe('Un proxy est défini (http://•••@p:3128) : vérifiez-le.')
    expect(fr.querySelector('.network-addr')?.textContent).toBe('(http://•••@p:3128)')
    const en = shown('A proxy is set ({{proxy}}): check it.', 'http://p:1')
    expect(en.textContent).toBe('A proxy is set (http://p:1): check it.')
    expect(en.querySelector('.network-addr')?.textContent).toBe('(http://p:1):')
    expect(en.querySelector('code')?.title).toBe('http://p:1')
  })

  it('valeur en tête ou en fin de texte', () => {
    expect(shown('{{proxy}} injoignable', 'p').textContent).toBe('p injoignable')
    expect(shown('Proxy : {{proxy}}', 'p').querySelector('.network-addr')?.textContent).toBe('p')
  })
})
