import { describe, expect, it } from 'vitest'
import type { ProfileSummary } from '@shared/agent'
import { agentEntries, searchSettings, sectionLabel, SETTINGS_GROUPS } from './settings-search'

const labels = (query: string) => searchSettings(query).map((e) => `${e.section}:${e.label}`)

describe('searchSettings (fiche 051)', () => {
  it('sans casse ni accents, tous les mots, mots-clés compris', () => {
    expect(labels('mode')).toContain('appearance:Thème')
    expect(labels('VEILLE')[0]).toBe('general:Empêcher la mise en veille')
    expect(labels('sombre')).toContain('appearance:Thème')
    expect(labels('sepia')).toContain('appearance:Thème')
    expect(labels('police terminal')).toContain('appearance:Police du terminal')
    expect(labels('police terminal')).not.toContain('appearance:Police des réponses')
    expect(labels('   ')).toEqual([])
    expect(labels('introuvable xyz')).toEqual([])
  })

  it('raccourcis clavier par libellé ou par touches ; libellés qui suffisent d’abord', () => {
    expect(labels('⌘K')).toContain('shortcuts:Rechercher une conversation')
    const terminal = labels('terminal')
    expect(terminal).toContain('shortcuts:Terminal')
    expect(terminal).toContain('appearance:Taille du terminal')
  })

  it('« consommation », « coût », « jetons », « quota » mènent à « Mon activité » (fiche 144)', () => {
    for (const query of ['consommation', 'coût', 'jetons', 'quota']) {
      expect([query, searchSettings(query)[0]?.section]).toEqual([query, 'activity'])
    }
    expect(sectionLabel('activity')).toBe('Mon activité')
    // La remise à zéro est restée dans les réglages, dans Données.
    expect(labels('remettre à zéro')).toContain('data:Remettre à zéro')
  })

  it('quatorze onglets en trois groupes (Mémoire, fiche 182 ; Rôles, fiche 223), sans Consommation (fiches 136, 144)', () => {
    expect(SETTINGS_GROUPS.map((group) => group.length)).toEqual([4, 6, 4])
    expect(labels('equipe')).toContain('roles:Rôles')
    expect(SETTINGS_GROUPS.flat()).not.toContain('usage')
    expect(labels('sites autorises')).toContain('privacy:Autorisé sans demander')
    expect(labels('worktree')).toContain('data:Worktrees orphelins')
    expect(labels('proxy')).toContain('agents:Proxy')
  })

  it('la page de chaque agent installé : connexion, clés, fournisseurs, ce qui lui est propre (fiches 126, 136)', () => {
    const bob = {
      id: 'bob',
      label: 'IBM Bob',
      available: true,
      command: 'bob acp',
      capabilities: {
        specific: [{ id: 'quota', label: 'Quota de bobcoins', detail: 'Lu par `bob /usage`.' }]
      }
    } as unknown as ProfileSummary
    const opencode = {
      ...bob,
      id: 'opencode',
      label: 'OpenCode',
      providers: true,
      capabilities: { specific: [] }
    } as ProfileSummary
    const missing = { ...bob, id: 'autre', available: false } as ProfileSummary
    const keys = [{ profileId: 'bob', keys: [{ env: 'BOB_API_KEY', label: 'Clé d’API Bob' }] }]
    const entries = agentEntries([bob, opencode, missing], keys)
    expect(searchSettings('quota', entries).filter((e) => e.section === 'agents')).toEqual([
      expect.objectContaining({
        section: 'agents',
        label: 'Quota de bobcoins',
        place: 'IBM Bob',
        page: 'bob',
        target: 'bob:quota:0'
      })
    ])
    expect(searchSettings('propre opencode', entries)[0]).toEqual(
      expect.objectContaining({ label: 'Propre à OpenCode', page: 'opencode' })
    )
    expect(searchSettings('cle bob', entries)[0]).toEqual(
      expect.objectContaining({ label: 'Clé d’API Bob', page: 'bob', target: 'key:BOB_API_KEY' })
    )
    expect(
      searchSettings('fournisseurs', entries)
        .filter((e) => e.section === 'agents')
        .map((e) => e.page)
    ).toEqual(['opencode'])
    expect(entries.some((e) => e.page === 'autre')).toBe(false)
  })
})
