import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parse } from 'jsonc-parser'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { startOpenAiCompatible, type FakeOpenAi } from '../../../e2e/fixtures/openai-compatible.mts'
import type { AgentProfile } from '../agent/profiles'
import { SettingsStore } from '../settings-store'
import { ApiKeyStore } from './api-keys'
import { ProvidersSettings } from './providers-settings'
import { OPENCODE_PROVIDERS } from './opencode-providers'

const profile = (id: string, extra: Partial<AgentProfile> = {}): AgentProfile => ({
  id,
  label: `Agent ${id}`,
  command: id,
  args: [],
  env: {},
  ...extra
})

/** Trousseau factice : les valeurs passent telles quelles. */
const fakeCipher = {
  available: () => Promise.resolve(true),
  encrypt: (text: string) => Promise.resolve(Buffer.from(text)),
  decrypt: (data: Buffer) => Promise.resolve({ text: data.toString(), reencrypt: false })
}

function setup(env: NodeJS.ProcessEnv = {}, network = {}) {
  const home = mkdtempSync(join(tmpdir(), 'providers-settings-'))
  const file = join(home, '.config', 'opencode', 'opencode.json')
  const apiKeys = new ApiKeyStore(join(home, 'api-keys.json'), fakeCipher)
  const profiles = [profile('opencode', { providers: OPENCODE_PROVIDERS }), profile('bob')]
  const providers = new ProvidersSettings({
    profiles,
    locations: { home },
    apiKeys,
    env,
    network: () => network
  })
  return { home, file, apiKeys, profiles, providers }
}
const json = (file: string): Record<string, unknown> =>
  parse(readFileSync(file, 'utf8')) as Record<string, unknown>

const servers: FakeOpenAi[] = []
afterEach(async () => {
  for (const s of servers.splice(0)) await s.close()
})

describe('fournisseurs de modèles dans les réglages (fiche 104)', () => {
  it('un onglet par agent qui en déclare le format ; clé : enregistrée, de l’environnement, ou aucune', async () => {
    const { providers, apiKeys } = setup({ AUTRE_API_KEY: 'x' })
    expect(providers.list()).toEqual([
      {
        profileId: 'opencode',
        label: 'Agent opencode',
        file: '~/.config/opencode/opencode.json',
        providers: [],
        only: false
      }
    ])
    providers.save('opencode', {
      id: 'llmaas',
      name: 'LLMaaS',
      baseURL: 'https://llm.test/v1',
      models: [{ id: 'qwen', name: 'Qwen' }]
    })
    providers.save('opencode', {
      id: 'autre',
      baseURL: 'https://autre.test/v1',
      models: [{ id: 'm' }],
      enabled: false
    })
    expect(() =>
      providers.save('opencode', { id: 'Mauvais Id', baseURL: 'https://x', models: [{ id: 'm' }] })
    ).toThrow('Identifiant du fournisseur')
    expect(() =>
      providers.save('bob', { id: 'x', baseURL: 'https://x', models: [{ id: 'm' }] })
    ).toThrow('Pas de fournisseurs')
    let [view] = providers.list()
    expect(
      view?.providers.map((p) => [p.id, p.enabled, p.key, p.keyStored, p.keyFromEnvironment])
    ).toEqual([
      ['llmaas', true, { kind: 'env', env: 'LLMAAS_API_KEY' }, false, false],
      ['autre', false, { kind: 'env', env: 'AUTRE_API_KEY' }, false, true]
    ])
    await providers.setKey('opencode', 'llmaas', 'secret-llmaas')
    expect(apiKeys.has('opencode', 'LLMAAS_API_KEY')).toBe(true)
    ;[view] = providers.list()
    expect(view?.providers[0]).toMatchObject({ keyStored: true })
    // Les variables des fournisseurs sont posées au lancement, avec celles du profil.
    expect(providers.keySpecs(profile('opencode', { providers: OPENCODE_PROVIDERS }))).toEqual([
      { env: 'LLMAAS_API_KEY', label: 'LLMaaS' },
      { env: 'AUTRE_API_KEY', label: 'autre' }
    ])
    expect(providers.keySpecs(profile('bob'))).toEqual([])
    providers.removeKey('opencode', 'llmaas')
    expect(apiKeys.has('opencode', 'LLMAAS_API_KEY')).toBe(false)
  })

  it('clé en clair dans le fichier : signalée ; « Définir » la remplace par {env:VAR} et la chiffre', async () => {
    const { providers, file, apiKeys } = setup()
    mkdirSync(join(file, '..'), { recursive: true })
    writeFileSync(
      file,
      JSON.stringify({
        provider: {
          llmaas: {
            npm: '@ai-sdk/openai-compatible',
            options: { baseURL: 'https://llm.test/v1', apiKey: 'sk-clair' },
            models: { qwen: {} }
          }
        }
      })
    )
    const [before] = providers.list()
    expect(before?.providers[0]).toMatchObject({
      name: 'llmaas',
      key: { kind: 'plain' },
      keyStored: false,
      models: [{ id: 'qwen', name: 'qwen' }]
    })
    await providers.setKey('opencode', 'llmaas', 'sk-nouvelle')
    expect(json(file)).toMatchObject({
      provider: { llmaas: { options: { apiKey: '{env:LLMAAS_API_KEY}' } } }
    })
    expect(readFileSync(file, 'utf8')).not.toContain('sk-nouvelle')
    expect(await apiKeys.credentials('opencode', [{ env: 'LLMAAS_API_KEY', label: '' }])).toEqual({
      LLMAAS_API_KEY: 'sk-nouvelle'
    })
  })

  it('« Tester » avec la clé enregistrée, sinon celle de l’environnement ; Diagnostic ligne par ligne', async () => {
    const server = await startOpenAiCompatible({ models: ['a', 'b'], apiKey: 'bonne' })
    servers.push(server)
    const { providers } = setup({ ENV_API_KEY: 'bonne' })
    providers.save('opencode', { id: 'llmaas', baseURL: server.url, models: [{ id: 'a' }] })
    providers.save('opencode', { id: 'env', baseURL: server.url, models: [{ id: 'a' }] })
    providers.save('opencode', {
      id: 'off',
      baseURL: 'http://127.0.0.1:9/v1',
      models: [{ id: 'a' }],
      enabled: false
    })
    expect(await providers.test('opencode', 'llmaas')).toMatchObject({
      ok: false,
      cause: 'unauthorized'
    })
    await providers.setKey('opencode', 'llmaas', 'bonne')
    expect(await providers.test('opencode', 'llmaas')).toMatchObject({ ok: true, models: 2 })
    expect(await providers.test('opencode', 'env')).toMatchObject({ ok: true, models: 2 })
    expect(server.requests.at(-1)?.authorization).toBe('Bearer bonne')

    const group = await providers.diagnose(['opencode', 'bob'])
    expect(group.id).toBe('providers')
    expect(group.checks.map((c) => [c.id, c.level])).toEqual([
      ['opencode:llmaas', 'ok'],
      ['opencode:env', 'ok'],
      ['opencode:off', 'optional']
    ])
    expect(group.checks[0]?.detail).toContain('2 modèles')
    // Agent non installé : ses fournisseurs ne sont pas testés ; aucun : ligne facultative.
    const none = await providers.diagnose(['bob'])
    expect(none.checks).toEqual([
      expect.objectContaining({ id: 'none', level: 'optional', action: 'open-agents-settings' })
    ])
    providers.setEnabled('opencode', 'off', true)
    const failed = await providers.diagnose(['opencode'])
    expect(failed.checks[2]).toMatchObject({
      level: 'error',
      detail: expect.stringContaining('Connexion refusée'),
      fix: expect.stringContaining('Rien n’écoute'),
      action: 'open-agents-settings'
    })
  })

  it('fichier illisible : erreur dans la vue et le Diagnostic, rien d’écrit', async () => {
    const { providers, file } = setup()
    mkdirSync(join(file, '..'), { recursive: true })
    writeFileSync(file, '{ oups')
    expect(providers.list()[0]?.error).toContain('JSON invalide')
    expect(() =>
      providers.save('opencode', { id: 'x', baseURL: 'https://x.test', models: [{ id: 'm' }] })
    ).toThrow('JSON invalide')
    const group = await providers.diagnose(['opencode'])
    expect(group.checks[0]).toMatchObject({ id: 'opencode:file', level: 'warning' })
    expect(readFileSync(file, 'utf8')).toBe('{ oups')
  })

  it('posées au lancement de l’agent : clés des fournisseurs et réseau saisi (SettingsStore)', async () => {
    const { providers, apiKeys, profiles } = setup()
    providers.save('opencode', {
      id: 'llmaas',
      baseURL: 'https://llm.test/v1',
      models: [{ id: 'a' }]
    })
    await providers.setKey('opencode', 'llmaas', 'secret')
    const settings = new SettingsStore({
      initial: { recentWorkspaces: [] },
      save: vi.fn(),
      profiles,
      apiKeys,
      env: {},
      providerKeys: (p) => providers.keySpecs(p)
    })
    const opencode = profiles[0]
    const bob = profiles[1]
    if (!opencode || !bob) throw new Error('profils')
    expect(await settings.credentials(opencode)).toEqual({ LLMAAS_API_KEY: 'secret' })
    expect(await settings.credentials(bob)).toEqual({})
    settings.setNetwork({ proxy: ' http://proxy.test:3128 ', caCerts: '/certs/entreprise.pem' })
    expect(settings.network()).toEqual({
      proxy: 'http://proxy.test:3128',
      caCerts: '/certs/entreprise.pem'
    })
    expect(await settings.credentials(bob)).toEqual({
      HTTPS_PROXY: 'http://proxy.test:3128',
      HTTP_PROXY: 'http://proxy.test:3128',
      NO_PROXY: 'localhost,127.0.0.1',
      NODE_EXTRA_CA_CERTS: '/certs/entreprise.pem'
    })
    settings.setNetwork({ proxy: 'http://proxy.test:3128', noProxy: 'interne.test' })
    expect((await settings.credentials(bob))['NO_PROXY']).toBe('interne.test')
    settings.setNetwork({})
    expect(await settings.credentials(bob)).toEqual({})
  })
})
