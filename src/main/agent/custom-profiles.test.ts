import { describe, expect, it } from 'vitest'
import type { CustomAgent } from '@shared/custom-agents'
import { describeCapabilities } from './capabilities'
import { applyCustomProfiles, customProfile } from './custom-profiles'
import { resolveProfiles, summarizeProfiles, type AgentProfile } from './profiles'

const agent = (id: string, extra: Partial<CustomAgent> = {}): CustomAgent => ({
  id,
  label: `Agent ${id}`,
  command: 'acme-agent',
  args: ['--acp'],
  env: { ACME_REGION: 'eu' },
  ...extra
})

const base = (id: string): AgentProfile => ({ id, label: id, command: id, args: [], env: {} })

describe('profil d’un agent déclaré (fiche 141)', () => {
  it('ne porte que des données : ni format, ni source, « Propre à » vide', () => {
    const profile = customProfile(agent('custom-acme'))
    expect(profile).toEqual({
      id: 'custom-acme',
      label: 'Agent custom-acme',
      command: 'acme-agent',
      args: ['--acp'],
      env: { ACME_REGION: 'eu' },
      custom: agent('custom-acme')
    })
    expect(describeCapabilities(profile, undefined).specific).toEqual([])
    // Pas de couleur propre : « Autres » dans le graphique de la consommation.
    expect(profile.chartSlot).toBeUndefined()
  })

  it('clé d’API et compaction déclarées : visibles dans « Propre à »', () => {
    const profile = customProfile(
      agent('custom-acme', { apiKeyEnv: 'ACME_API_KEY', compactCommand: '/compact' })
    )
    expect(profile.apiKeys?.map((k) => k.env)).toEqual(['ACME_API_KEY'])
    expect(profile.compactCommand).toBe('/compact')
    expect(
      describeCapabilities(profile, undefined)
        .specific.map((i) => i.id)
        .sort()
    ).toEqual(['api-key', 'compact-command'])
  })

  it('« ~/ » en tête de la commande : le dossier personnel', () => {
    expect(customProfile(agent('custom-a', { command: '~/bin/agent' }), '/Users/moi').command).toBe(
      '/Users/moi/bin/agent'
    )
  })

  it('rangé après les vrais agents, avant les agents factices ; remplacé en place', () => {
    const profiles = [base('bob'), base('opencode'), base('mock'), base('mock-peer')]
    const shared = profiles
    applyCustomProfiles(profiles, [agent('custom-a'), agent('custom-b')])
    expect(shared.map((p) => p.id)).toEqual([
      'bob',
      'opencode',
      'custom-a',
      'custom-b',
      'mock',
      'mock-peer'
    ])
    applyCustomProfiles(profiles, [agent('custom-b', { label: 'Renommé' })])
    expect(shared.map((p) => p.id)).toEqual(['bob', 'opencode', 'custom-b', 'mock', 'mock-peer'])
    expect(shared[2]?.label).toBe('Renommé')
    applyCustomProfiles(profiles, [])
    expect(shared.map((p) => p.id)).toEqual(['bob', 'opencode', 'mock', 'mock-peer'])
  })

  it('le résumé envoyé au renderer porte la déclaration, et dit si la commande manque', () => {
    const profiles = resolveProfiles({ appPath: '/app', execPath: '/x', isPackaged: true, env: {} })
    applyCustomProfiles(profiles, [agent('custom-acme', { command: 'nexiste-pas-du-tout' })])
    const summary = summarizeProfiles(profiles, '/nulle/part').find((p) => p.id === 'custom-acme')
    expect(summary).toMatchObject({
      available: false,
      command: 'nexiste-pas-du-tout --acp',
      custom: { id: 'custom-acme' }
    })
  })
})
