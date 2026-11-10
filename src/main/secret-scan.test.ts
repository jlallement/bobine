import { describe, expect, it } from 'vitest'
import { addSecret, findSecret } from './secret-scan'

describe('détection des secrets (fiches 080, 182)', () => {
  it.each([
    ['sk-ant-api03-abcdefghijklmnopqrstuvwxyz', 'API key'],
    ['ghp_abcdefghijklmnopqrstuvwxyz0123', 'API key'],
    ['glpat-abcdefghijklmnopqrst', 'API key'], // gitleaks:allow — fake value for tests
    ['Authorization: Bearer abcdefghijklmnop', 'authorization'],
    ['AKIAABCDEFGHIJKLMNOP', 'AWS'], // gitleaks:allow — fake value for tests
    ['-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXk\n', 'private key'],
    ['clone https://moi:motdepasse@example.com/depot.git', 'password'],
    ['BOB_API_KEY=cle-tres-secrete', 'named like a secret'],
    ['{"password": "hunter22"}', 'named like a secret']
  ])('reconnaît %s', (text, what) => {
    expect(findSecret(text)).toContain(what)
  })

  it('valeur déclarée secrète (clé donnée à un agent)', () => {
    addSecret('ma-cle-personnelle-99')
    expect(findSecret('la clé est ma-cle-personnelle-99')).toBe('an API key given to an agent')
  })

  it.each([
    'commit 3f2a9c1e7b4d5a6f8e9d0c1b2a3f4e5d6c7b8a9f',
    'id 123e4567-e89b-12d3-a456-426614174000',
    'Les essais se lancent par `pnpm e2e --changed`.',
    'https://example.com/docs',
    'totalTokens: 5211 est un compteur'
  ])('pas de faux positif : %s', (text) => {
    expect(findSecret(text)).toBeUndefined()
  })
})

describe('formes ajoutées à la relecture (fiche 182)', () => {
  it.each([
    'AIzaSyA1234567890abcdefghijklmnopqrstuv', // gitleaks:allow — fake value for tests
    'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U', // gitleaks:allow — fake value for tests
    'npm_abcdefghijklmnopqrstuvwxyz0123456789',
    'hf_abcdefghijklmnopqrstuvwxyz0123456'
  ])('reconnaît %s', (text) => {
    expect(findSecret(text)).toBeDefined()
  })
})
