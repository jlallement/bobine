import { describe, expect, it } from 'vitest'
import {
  agentNetwork,
  effectiveNetwork,
  networkEnvChanges,
  networkFromEnv,
  parseNetworkSettings,
  sameNetwork
} from './network-env'

describe('réseau d’entreprise (fiche 104)', () => {
  it('lu dans l’environnement : HTTPS_PROXY avant HTTP_PROXY, minuscules acceptées', () => {
    expect(networkFromEnv({})).toEqual({})
    expect(
      networkFromEnv({
        http_proxy: 'http://h:1',
        HTTPS_PROXY: 'http://s:2',
        no_proxy: 'interne.test',
        NODE_EXTRA_CA_CERTS: '/ca.pem'
      })
    ).toEqual({ proxy: 'http://s:2', noProxy: 'interne.test', caCerts: '/ca.pem' })
  })

  it('les réglages saisis l’emportent sur le shell, champ par champ', () => {
    expect(
      effectiveNetwork(
        { proxy: 'http://saisi:1' },
        { HTTPS_PROXY: 'http://shell:2', NO_PROXY: 'x' }
      )
    ).toEqual({ proxy: 'http://saisi:1', noProxy: 'x' })
  })

  it('variables posées aux agents : seulement ce qui est saisi ; NO_PROXY local par défaut', () => {
    expect(networkEnvChanges({}, { HTTPS_PROXY: 'http://shell:2' })).toEqual({})
    expect(networkEnvChanges({ proxy: 'http://p:1' }, {})).toEqual({
      HTTPS_PROXY: 'http://p:1',
      HTTP_PROXY: 'http://p:1',
      NO_PROXY: 'localhost,127.0.0.1'
    })
    // Le shell a déjà un NO_PROXY : gardé tel quel.
    expect(networkEnvChanges({ proxy: 'http://p:1' }, { no_proxy: 'déjà' })).toEqual({
      HTTPS_PROXY: 'http://p:1',
      HTTP_PROXY: 'http://p:1'
    })
    expect(networkEnvChanges({ caCerts: '/ca.pem' }, {})).toEqual({
      NODE_EXTRA_CA_CERTS: '/ca.pem'
    })
  })

  it('saisie nettoyée : espaces, vides omis, ~ développé pour le fichier', () => {
    expect(parseNetworkSettings({ proxy: ' ', noProxy: 'a , b', caCerts: '' })).toEqual({
      noProxy: 'a , b'
    })
    expect(parseNetworkSettings({ caCerts: '~/ca.pem' }).caCerts).toBe(
      `${process.env['HOME']}/ca.pem`
    )
    expect(parseNetworkSettings('rien')).toEqual({})
  })
})

describe('réseau d’un agent lancé, et réglages changés depuis (fiche 276)', () => {
  it('l’environnement de l’agent : l’app, son profil, puis les variables posées au lancement', () => {
    expect(
      agentNetwork({ HTTPS_PROXY: 'http://shell:1' }, {}, { NODE_EXTRA_CA_CERTS: '/ca.pem' })
    ).toEqual({ proxy: 'http://shell:1', caCerts: '/ca.pem' })
    expect(agentNetwork({}, { HTTP_PROXY: 'http://profil:2' }, {})).toEqual({
      proxy: 'http://profil:2'
    })
  })

  it('même réseau : proxy, exceptions et certificats', () => {
    expect(sameNetwork({}, {})).toBe(true)
    expect(sameNetwork({ proxy: 'http://a:1' }, { proxy: 'http://a:1' })).toBe(true)
    expect(sameNetwork({ proxy: 'http://a:1' }, {})).toBe(false)
    expect(sameNetwork({ noProxy: 'x' }, { noProxy: 'y' })).toBe(false)
    expect(sameNetwork({ caCerts: '/a' }, {})).toBe(false)
  })
})
