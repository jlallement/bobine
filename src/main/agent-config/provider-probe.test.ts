import { afterEach, describe, expect, it } from 'vitest'
import {
  hasOpenssl,
  selfSigned,
  startConnectProxy,
  startOpenAiCompatible,
  type FakeOpenAi,
  type FakeProxy,
  type SelfSigned
} from '../../../e2e/fixtures/openai-compatible.mts'
import { bypassesProxy, probeProvider } from './provider-probe'

const cleanups: (() => Promise<void> | void)[] = []
afterEach(async () => {
  for (const c of cleanups.splice(0)) await c()
}, 20_000)
const fake = async (...args: Parameters<typeof startOpenAiCompatible>): Promise<FakeOpenAi> => {
  const server = await startOpenAiCompatible(...args)
  cleanups.push(() => server.close())
  return server
}
const proxyTo = async (...args: Parameters<typeof startConnectProxy>): Promise<FakeProxy> => {
  const proxy = await startConnectProxy(...args)
  cleanups.push(() => proxy.close())
  return proxy
}
const tls = (): SelfSigned => {
  const cert = selfSigned(['localhost', '127.0.0.1'])
  cleanups.push(() => cert.remove())
  return cert
}

describe('« Tester » un fournisseur de modèles (fiche 104)', () => {
  it('répond : nombre de modèles, clé envoyée en Bearer, sans jeton de modèle', async () => {
    const server = await fake({ models: ['qwen3-32b', 'mistral-small'], apiKey: 'cle' })
    const result = await probeProvider({ baseURL: `${server.url}/`, apiKey: 'cle' })
    expect(result).toMatchObject({ ok: true, models: 2 })
    expect(server.requests).toEqual([
      { method: 'GET', path: '/v1/models', authorization: 'Bearer cle' }
    ])
  })

  it('clé refusée, adresse sans /models, connexion refusée, nom inconnu, délai', async () => {
    const server = await fake({ models: ['m'], apiKey: 'cle' })
    expect(await probeProvider({ baseURL: server.url, apiKey: 'mauvaise' })).toMatchObject({
      ok: false,
      cause: 'unauthorized',
      error: expect.stringContaining('401')
    })
    expect(await probeProvider({ baseURL: `${server.url}/pas-la`, apiKey: 'cle' })).toMatchObject({
      ok: false,
      cause: 'not-found'
    })
    expect(await probeProvider({ baseURL: 'http://127.0.0.1:9/v1' })).toMatchObject({
      ok: false,
      cause: 'refused'
    })
    expect(await probeProvider({ baseURL: 'http://nulle-part.invalid/v1' })).toMatchObject({
      ok: false,
      cause: 'dns'
    })
    const slow = await fake({ models: ['m'], delayMs: 2000 })
    expect(await probeProvider({ baseURL: slow.url }, {}, { timeoutMs: 300 })).toMatchObject({
      ok: false,
      cause: 'timeout'
    })
  })

  it.skipIf(!hasOpenssl())(
    'certificat d’entreprise : refusé sans le fichier, accepté avec (NODE_EXTRA_CA_CERTS)',
    async () => {
      const cert = tls()
      const server = await fake({ models: ['m'], tls: cert })
      expect(await probeProvider({ baseURL: server.url })).toMatchObject({
        ok: false,
        cause: 'certificate'
      })
      expect(
        await probeProvider({ baseURL: server.url }, { caCerts: cert.certFile })
      ).toMatchObject({ ok: true, models: 1 })
      expect(
        await probeProvider({ baseURL: server.url }, { caCerts: '/nulle/part.pem' })
      ).toMatchObject({
        ok: false,
        cause: 'certificate',
        error: expect.stringContaining('part.pem')
      })
    }
  )

  it.skipIf(!hasOpenssl())(
    'proxy : tunnel CONNECT vers un hôte que seul le proxy joint ; 407 et proxy injoignable classés',
    async () => {
      const cert = tls()
      const server = await fake({ models: ['a', 'b', 'c'], tls: cert })
      const proxy = await proxyTo({ host: '127.0.0.1', port: server.port })
      const network = { proxy: proxy.url, caCerts: cert.certFile, noProxy: 'interne.test' }
      // `localhost` n'est pas dans NO_PROXY ici : la demande passe par le proxy.
      const viaProxy = await probeProvider(
        { baseURL: `https://localhost:${server.port}/v1` },
        network
      )
      expect(viaProxy).toMatchObject({ ok: true, models: 3 })
      expect(proxy.connects).toEqual([`localhost:${server.port}`])
      // Une adresse en clair (http) passe aussi par le proxy.
      const plain = await fake({ models: ['x'] })
      const plainProxy = await proxyTo({ host: '127.0.0.1', port: plain.port })
      expect(
        await probeProvider(
          { baseURL: `http://localhost:${plain.port}/v1` },
          { ...network, proxy: plainProxy.url }
        )
      ).toMatchObject({ ok: true, models: 1 })
      expect(plainProxy.connects).toEqual([`localhost:${plain.port}`])

      const locked = await proxyTo({ host: '127.0.0.1', port: server.port }, { auth: 'u:p' })
      expect(
        await probeProvider(
          { baseURL: `https://localhost:${server.port}/v1` },
          { ...network, proxy: locked.url }
        )
      ).toMatchObject({ ok: false, cause: 'proxy', error: expect.stringContaining('identifi') })
      expect(
        await probeProvider(
          { baseURL: `https://localhost:${server.port}/v1` },
          { ...network, proxy: `http://u:p@127.0.0.1:${new URL(locked.url).port}` }
        )
      ).toMatchObject({ ok: true, models: 3 })
      expect(
        await probeProvider(
          { baseURL: `https://localhost:${server.port}/v1` },
          { ...network, proxy: 'http://127.0.0.1:9' }
        )
      ).toMatchObject({ ok: false, cause: 'proxy' })
    }
  )

  it('NO_PROXY : hôte, domaine, joker ; localhost par défaut', () => {
    expect(bypassesProxy('localhost', undefined)).toBe(true)
    expect(bypassesProxy('llm.interne.test', undefined)).toBe(false)
    expect(bypassesProxy('llm.interne.test', 'interne.test')).toBe(true)
    expect(bypassesProxy('llm.interne.test', '.interne.test, autre')).toBe(true)
    expect(bypassesProxy('interne.test', 'interne.test:8080')).toBe(true)
    expect(bypassesProxy('ailleurs.test', 'interne.test')).toBe(false)
    expect(bypassesProxy('ailleurs.test', '*')).toBe(true)
  })
})
