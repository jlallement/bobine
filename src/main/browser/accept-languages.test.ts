import { describe, expect, it } from 'vitest'
import { acceptLanguages } from './accept-languages'

describe('langues du navigateur intégré (fiche 272)', () => {
  it('les langues préférées de macOS, chacune suivie de sa base, sans doublon', () => {
    expect(acceptLanguages(['de-DE', 'fr-FR', 'en-US'])).toBe('de-DE,de,fr-FR,fr,en-US,en')
    expect(acceptLanguages(['pt_BR', 'pt-PT'])).toBe('pt-BR,pt,pt-PT')
    expect(acceptLanguages([])).toBe('')
  })
})
