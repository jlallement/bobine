import { describe, expect, it } from 'vitest'
import { maskUrlCredentials } from './url-credentials'

describe('identifiants d’une adresse masqués (fiche 275)', () => {
  it('nom et mot de passe, nom seul : masqués ; adresse sans identifiants : telle quelle', () => {
    expect(maskUrlCredentials('http://jean:s3cr3t@proxy.exemple:3128')).toBe(
      'http://•••@proxy.exemple:3128'
    )
    expect(maskUrlCredentials('https://jean@proxy.exemple')).toBe('https://•••@proxy.exemple')
    expect(maskUrlCredentials('http://proxy.exemple:3128')).toBe('http://proxy.exemple:3128')
  })

  it('dans un message (erreur d’agent) : chaque adresse, mot de passe avec @ ou : compris', () => {
    expect(maskUrlCredentials('ECONNREFUSED http://a:b:c@p:1 puis socks5://x%40y:z@q:2, fin')).toBe(
      'ECONNREFUSED http://•••@p:1 puis socks5://•••@q:2, fin'
    )
    // Mot de passe tapé avec un @ non encodé : rien de lui ne reste.
    expect(maskUrlCredentials('http://jean:p@ss@proxy:3128')).toBe('http://•••@proxy:3128')
    expect(maskUrlCredentials('courriel jean@exemple.fr')).toBe('courriel jean@exemple.fr')
  })
})
