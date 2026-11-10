import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parse } from 'jsonc-parser'
import { describe, expect, it } from 'vitest'
import { AgentProvidersConfig } from './provider-files'
import { OPENCODE_PROVIDERS } from './opencode-providers'

const setup = () => {
  const home = mkdtempSync(join(tmpdir(), 'providers-home-'))
  const config = new AgentProvidersConfig(OPENCODE_PROVIDERS, { home })
  const file = join(home, '.config', 'opencode', 'opencode.json')
  return { home, config, file }
}
const json = (file: string): Record<string, unknown> =>
  parse(readFileSync(file, 'utf8')) as Record<string, unknown>

const llmaas = {
  id: 'llmaas',
  name: 'LLMaaS interne',
  baseURL: 'https://llm.interne.test/v1',
  models: [
    { id: 'qwen3-32b', name: 'Qwen 3 32B' },
    { id: 'mistral-small', name: 'mistral-small' }
  ],
  enabled: true
}

describe('fournisseurs de modèles d’OpenCode (fiche 104)', () => {
  it('nouveau fournisseur : compatible OpenAI, clé attendue en {env:VAR}, jamais en clair', () => {
    const { config, file } = setup()
    config.save(llmaas)
    expect(json(file)).toEqual({
      provider: {
        llmaas: {
          npm: '@ai-sdk/openai-compatible',
          name: 'LLMaaS interne',
          options: { baseURL: 'https://llm.interne.test/v1', apiKey: '{env:LLMAAS_API_KEY}' },
          models: {
            'qwen3-32b': { name: 'Qwen 3 32B' },
            'mistral-small': { name: 'mistral-small' }
          }
        }
      }
    })
    const read = config.read()
    expect(read).toEqual({
      only: false,
      providers: [{ ...llmaas, key: { kind: 'env', env: 'LLMAAS_API_KEY' } }]
    })
    expect(config.display()).toBe('~/.config/opencode/opencode.json')
  })

  it('fichier existant : commentaires, autres réglages, champs inconnus du fournisseur et des modèles gardés ; .bak écrit', () => {
    const { config, file } = setup()
    mkdirSync(join(file, '..'), { recursive: true })
    writeFileSync(
      file,
      `{
  // écrit à la main
  "model": "llmaas/qwen3-32b",
  "provider": {
    "llmaas": {
      "npm": "@ai-sdk/openai",
      "name": "Ancien nom",
      "options": { "baseURL": "https://ancien.test/v1", "apiKey": "sk-en-clair", "headers": { "X-Org": "r&d" } },
      "models": { "qwen3-32b": { "name": "Qwen", "limit": { "context": 32000, "output": 8000 } }, "vieux": { "name": "À retirer" } }
    }
  }
}
`
    )
    const before = readFileSync(file, 'utf8')
    config.save({ ...llmaas, name: 'Nouveau nom' })
    const text = readFileSync(file, 'utf8')
    expect(text).toContain('// écrit à la main')
    expect(json(file)).toEqual({
      model: 'llmaas/qwen3-32b',
      provider: {
        llmaas: {
          npm: '@ai-sdk/openai',
          name: 'Nouveau nom',
          options: {
            baseURL: 'https://llm.interne.test/v1',
            apiKey: 'sk-en-clair',
            headers: { 'X-Org': 'r&d' }
          },
          models: {
            'qwen3-32b': { name: 'Qwen 3 32B', limit: { context: 32000, output: 8000 } },
            'mistral-small': { name: 'mistral-small' }
          }
        }
      }
    })
    expect(readFileSync(`${file}.bak`, 'utf8')).toBe(before)
    // Clé en clair : signalée ; « Définir la clé » la remplace par la variable.
    const read = config.read()
    expect('providers' in read && read.providers[0]?.key).toEqual({ kind: 'plain' })
    expect('providers' in read && read.providers[0]?.npm).toBe('@ai-sdk/openai')
    config.useKeyVariable('llmaas', 'LLMAAS_API_KEY')
    expect(json(file)).toMatchObject({
      provider: { llmaas: { options: { apiKey: '{env:LLMAAS_API_KEY}' } } }
    })
    expect(text).not.toContain('{env:')
  })

  it('activation : disabled_providers sans liste blanche, enabled_providers avec ; « seulement ceux-là »', () => {
    const { config, file } = setup()
    config.save(llmaas)
    config.save({ ...llmaas, id: 'autre', name: 'Autre', enabled: false })
    expect(json(file)['disabled_providers']).toEqual(['autre'])
    config.setEnabled('autre', true)
    expect(json(file)['disabled_providers']).toBeUndefined()

    config.setOnly(true)
    expect(json(file)['enabled_providers']).toEqual(['llmaas', 'autre'])
    config.setEnabled('autre', false)
    expect(json(file)['enabled_providers']).toEqual(['llmaas'])
    expect(json(file)['disabled_providers']).toBeUndefined()
    let read = config.read()
    expect('providers' in read && read.only).toBe(true)
    expect('providers' in read && read.providers.map((p) => [p.id, p.enabled])).toEqual([
      ['llmaas', true],
      ['autre', false]
    ])

    // Plus « seulement » : l'allowlist part, le désactivé le reste.
    config.setOnly(false)
    expect(json(file)['enabled_providers']).toBeUndefined()
    expect(json(file)['disabled_providers']).toEqual(['autre'])
    read = config.read()
    expect('providers' in read && read.providers.map((p) => p.enabled)).toEqual([true, false])
  })

  it('renommage : refuse d’écraser, suit dans les listes ; suppression nettoie les listes', () => {
    const { config, file } = setup()
    config.save(llmaas)
    config.save({ ...llmaas, id: 'autre', name: 'Autre' })
    config.setOnly(true)
    expect(() => config.save({ ...llmaas, id: 'autre' }, 'llmaas')).toThrow('existe déjà')
    config.save({ ...llmaas, id: 'interne' }, 'llmaas')
    expect(Object.keys(json(file)['provider'] as object)).toEqual(['autre', 'interne'])
    expect(json(file)['enabled_providers']).toEqual(['interne', 'autre'])
    config.remove('autre')
    expect(Object.keys(json(file)['provider'] as object)).toEqual(['interne'])
    expect(json(file)['enabled_providers']).toEqual(['interne'])
  })

  it('dernier fournisseur supprimé : plus de `"provider": {}`, fichier supprimé s’il est vide (fiche 126)', () => {
    const { config, file } = setup()
    config.save(llmaas)
    config.remove('llmaas')
    expect(existsSync(file)).toBe(false)
    mkdirSync(join(file, '..'), { recursive: true })
    writeFileSync(file, '{ "model": "a/b" }\n')
    config.save(llmaas)
    config.remove('llmaas')
    expect(json(file)).toEqual({ model: 'a/b' })
  })

  it('fichier illisible : signalé, jamais réécrit ; absent : aucun fournisseur', () => {
    const { config, file } = setup()
    expect(config.read()).toEqual({ providers: [], only: false })
    mkdirSync(join(file, '..'), { recursive: true })
    writeFileSync(file, '{ "provider": { oups ')
    expect(config.read()).toMatchObject({ error: expect.stringContaining('JSON invalide') })
    expect(() => config.save(llmaas)).toThrow('JSON invalide')
    expect(readFileSync(file, 'utf8')).toBe('{ "provider": { oups ')
    expect(existsSync(`${file}.bak`)).toBe(false)
  })

  it('opencode.jsonc préféré s’il existe ; XDG_CONFIG_HOME suivi', () => {
    const { home } = setup()
    const xdg = join(home, 'cfg')
    mkdirSync(join(xdg, 'opencode'), { recursive: true })
    writeFileSync(join(xdg, 'opencode', 'opencode.jsonc'), '{}')
    const config = new AgentProvidersConfig(OPENCODE_PROVIDERS, { home, xdgConfigHome: xdg })
    expect(config.file()).toBe(join(xdg, 'opencode', 'opencode.jsonc'))
    expect(config.display()).toBe('~/cfg/opencode/opencode.jsonc')
  })
})
