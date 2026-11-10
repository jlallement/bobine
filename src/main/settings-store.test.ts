import { createHash } from 'node:crypto'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { AgentAnnouncement } from './agent/capabilities'
import type { AgentProfile } from './agent/profiles'
import type { Settings } from './settings'
import { loadSettings, saveSettings } from './settings'
import { normalizeMessage } from '@shared/tips'
import { SettingsStore } from './settings-store'

const profile = (id: string, extra: Partial<AgentProfile> = {}): AgentProfile => ({
  id,
  label: `Agent ${id}`,
  command: id,
  args: [],
  env: {},
  ...extra
})

const announcement = (version: string): AgentAnnouncement => ({
  name: 'Agent',
  version,
  seenAt: '2026-10-20T10:00:00.000Z',
  load: true,
  resume: false,
  delete: false,
  image: false,
  embeddedContext: false,
  mcpHttp: true
})

function store(initial: Settings = { recentWorkspaces: [] }, profiles: AgentProfile[] = []) {
  const save = vi.fn<(settings: Settings) => void>()
  const changed = vi.fn()
  const settings = new SettingsStore({ initial, save, profiles })
  settings.onChange(changed)
  return { settings, save, changed }
}

describe('SettingsStore (fiche 089)', () => {
  it('éditeur choisi (fiche 156) : relu dans les préférences', () => {
    const { settings } = store()
    expect(settings.preferences().editor).toBeUndefined()
    settings.setPreferences({ editor: 'idea' })
    expect(settings.preferences().editor).toBe('idea')
  })

  it('enregistre chaque changement ; seuls ceux qui comptent pour l’app sont signalés', () => {
    const { settings, save, changed } = store()
    const folder = mkdtempSync(join(tmpdir(), 'reglages-'))

    settings.rememberWorkspace('bob', folder)
    settings.setNewConversation({ mode: 'plan' })
    settings.rememberControl('bob', 'mode', 'ask')
    settings.forgetWorkspace(folder)
    expect(save).toHaveBeenCalledTimes(4)
    expect(changed).not.toHaveBeenCalled()

    settings.setPreferences({ theme: 'dark' })
    settings.setNotifications(false)
    settings.setCommands([])
    settings.rememberTool('bob', 'Lire')
    settings.forgetTool('bob', 'Lire')
    settings.agentSeen('bob', announcement('1.0'))
    expect(save).toHaveBeenCalledTimes(10)
    expect(changed).toHaveBeenCalledTimes(6)
    expect(save).toHaveBeenLastCalledWith(settings.current)
    expect(settings.current).toMatchObject({
      profileId: 'bob',
      recentWorkspaces: [],
      newConversation: { mode: 'plan' },
      controls: { bob: { mode: 'ask' } },
      theme: 'dark',
      notifications: false,
      rememberedTools: {}
    })
  })

  it('rien d’écrit ni de signalé quand rien ne change (outil déjà retenu, même annonce)', () => {
    const { settings, save, changed } = store({
      recentWorkspaces: [],
      rememberedTools: { bob: ['Lire'] },
      agentsSeen: { bob: announcement('1.0') }
    })
    expect(settings.hasRememberedTool('bob', 'Lire')).toBe(true)
    settings.rememberTool('bob', 'Lire')
    settings.agentSeen('bob', { ...announcement('1.0'), seenAt: '2026-10-21T10:00:00.000Z' })
    expect(save).not.toHaveBeenCalled()
    expect(changed).not.toHaveBeenCalled()
    settings.agentSeen('bob', announcement('2.0'))
    expect(changed).toHaveBeenCalledTimes(1)
  })

  it('familles d’outils de Bobine (fiche 109) : coupées, rallumées, enregistrées une fois', () => {
    const { settings, save } = store()
    expect([...settings.appToolsOff()]).toEqual([])
    settings.setAppToolFamily('browser', false)
    settings.setAppToolFamily('browser', false)
    settings.setAppToolFamily('ios-simulator', false)
    expect([...settings.appToolsOff()]).toEqual(['browser', 'ios-simulator'])
    expect(save).toHaveBeenCalledTimes(2)
    settings.setAppToolFamily('browser', true)
    settings.setAppToolFamily('ios-simulator', true)
    expect(settings.current).not.toHaveProperty('appToolsOff')
    expect(save).toHaveBeenCalledTimes(4)
  })

  it('désabonnement : plus prévenu', () => {
    const { settings } = store()
    const listener = vi.fn()
    const unsubscribe = settings.onChange(listener)
    settings.setNotifications(false)
    unsubscribe()
    settings.setNotifications(true)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('nouvelle conversation dans un dossier disparu : refusée, rien d’enregistré', () => {
    const { settings, save } = store()
    expect(() => settings.setNewConversation({ workspace: '/nexiste/pas' })).toThrow('introuvable')
    expect(save).not.toHaveBeenCalled()
  })

  it('clés d’API sans coffre : état lu dans l’environnement, enregistrement refusé', async () => {
    const keyed = profile('bob', { apiKeys: [{ env: 'BOB_API_KEY', label: 'Clé' }] })
    const settings = new SettingsStore({
      initial: { recentWorkspaces: [] },
      save: () => {},
      profiles: [keyed],
      env: { BOB_API_KEY: 'x' }
    })
    expect(settings.keyInfo(keyed)).toEqual([
      { env: 'BOB_API_KEY', label: 'Clé', stored: false, fromEnvironment: true }
    ])
    expect(await settings.credentials(keyed)).toEqual({})
    expect(() => settings.setApiKey('bob', 'BOB_API_KEY', 'secret')).toThrow()
    expect(() => settings.setApiKey('bob', 'AUTRE', 'secret')).toThrow('AUTRE')
  })
})

describe('agents déclarés (fiche 141)', () => {
  const draft = {
    label: 'Agent maison',
    commandLine: 'npx -y @acme/agent --acp',
    envText: 'ACME_REGION=eu',
    apiKeyEnv: 'ACME_API_KEY',
    compactCommand: ''
  }
  const fakeKeys = () => {
    const keys = new Map<string, string>()
    return {
      keys,
      store: {
        has: (id: string, env: string) => keys.has(`${id}:${env}`),
        remove: (id: string, env: string) => keys.delete(`${id}:${env}`)
      } as unknown as NonNullable<ConstructorParameters<typeof SettingsStore>[0]['apiKeys']>
    }
  }

  it('ajouté, modifié, retiré : réglage enregistré et liste des profils tenue à jour', () => {
    const profiles = [profile('bob'), profile('mock')]
    const { settings, save, changed } = store({ recentWorkspaces: [] }, profiles)
    const id = settings.saveCustomAgent(draft)
    expect(id).toBe('custom-agent-maison')
    expect(settings.current.customAgents).toEqual([
      {
        id,
        label: 'Agent maison',
        command: 'npx',
        args: ['-y', '@acme/agent', '--acp'],
        env: { ACME_REGION: 'eu' },
        apiKeyEnv: 'ACME_API_KEY'
      }
    ])
    expect(profiles.map((p) => p.id)).toEqual(['bob', id, 'mock'])
    expect(save).toHaveBeenLastCalledWith(settings.current)
    expect(changed).toHaveBeenCalledTimes(1)

    // Même nom : un autre identifiant ; renommé : le même.
    expect(settings.saveCustomAgent(draft)).toBe('custom-agent-maison-2')
    expect(settings.saveCustomAgent({ ...draft, label: 'Autre nom' }, id)).toBe(id)
    expect(profiles.find((p) => p.id === id)?.label).toBe('Autre nom')

    settings.removeCustomAgent('custom-agent-maison-2')
    settings.removeCustomAgent(id)
    expect(settings.current.customAgents).toBeUndefined()
    expect(profiles.map((p) => p.id)).toEqual(['bob', 'mock'])
  })

  it('formulaire invalide ou agent inconnu : refusé, rien d’enregistré', () => {
    const { settings, save } = store()
    expect(() => settings.saveCustomAgent({ ...draft, commandLine: 'a "b' })).toThrow('guillemet')
    expect(() => settings.saveCustomAgent({ ...draft, label: '' })).toThrow('nom')
    expect(() => settings.saveCustomAgent('n’importe quoi')).toThrow()
    expect(() => settings.saveCustomAgent(draft, 'custom-absent')).toThrow('n’existe plus')
    expect(() => settings.removeCustomAgent('bob')).toThrow('n’existe plus')
    expect(save).not.toHaveBeenCalled()
  })

  it('lus au lancement : profils ajoutés à la liste partagée', () => {
    const profiles = [profile('bob')]
    store(
      {
        recentWorkspaces: [],
        customAgents: [{ id: 'custom-a', label: 'A', command: 'a', args: [], env: {} }]
      },
      profiles
    )
    expect(profiles.map((p) => p.id)).toEqual(['bob', 'custom-a'])
  })

  it('la clé d’API est oubliée quand l’agent est retiré ou que sa variable change', () => {
    const { keys, store: apiKeys } = fakeKeys()
    const settings = new SettingsStore({
      initial: { recentWorkspaces: [] },
      save: () => {},
      profiles: [],
      apiKeys
    })
    const id = settings.saveCustomAgent(draft)
    keys.set(`${id}:ACME_API_KEY`, 'secret')
    settings.saveCustomAgent({ ...draft, label: 'Renommé' }, id)
    expect(keys.size).toBe(1)
    settings.saveCustomAgent({ ...draft, apiKeyEnv: 'AUTRE_KEY' }, id)
    expect(keys.size).toBe(0)
    keys.set(`${id}:AUTRE_KEY`, 'secret')
    settings.removeCustomAgent(id)
    expect(keys.size).toBe(0)
  })
})

describe('avis de version déjà montrés (fiche 198)', () => {
  it('une fois par profil et par clé, retenu dans les réglages et relu au lancement', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'reglages-')), 'settings.json')
    const first = new SettingsStore({
      initial: { recentWorkspaces: [] },
      save: (s) => saveSettings(file, s),
      profiles: []
    })
    expect(first.claimVersionNotice('opencode', 'newer:2.3')).toBe(true)
    expect(first.claimVersionNotice('opencode', 'newer:2.3')).toBe(false)
    expect(first.claimVersionNotice('bob', 'newer:2.3')).toBe(true)

    // Après un redémarrage : relu du fichier, toujours vu.
    const again = new SettingsStore({ initial: loadSettings(file), save: () => {}, profiles: [] })
    expect(again.claimVersionNotice('opencode', 'newer:2.3')).toBe(false)
    expect(again.claimVersionNotice('opencode', 'older:1.18.31')).toBe(true)
  })

  it('la liste reste bornée', () => {
    const { settings } = store()
    for (let i = 0; i < 30; i++) settings.claimVersionNotice('x', `newer:${i}.0`)
    expect(settings.current.versionNotices?.['x']).toHaveLength(20)
    expect(settings.claimVersionNotice('x', 'newer:29.0')).toBe(false)
  })
})

describe('astuces (fiche 191)', () => {
  it('activées par défaut ; masquées gardées ; « Tout réafficher » garde le quota du jour', () => {
    const { settings, save } = store()
    expect(settings.preferences().tipsEnabled).toBe(true)
    settings.setPreferences({ tipsEnabled: false })
    expect(settings.preferences().tipsEnabled).toBe(false)
    settings.recordTip('aside', 'shown', '2026-11-07')
    settings.recordTip('aside', 'never', '2026-11-07')
    expect(settings.tips()).toEqual({ hidden: ['aside'], lastShownDay: '2026-11-07' })
    expect(save.mock.lastCall?.[0].tipsState).toEqual({
      hidden: ['aside'],
      lastShownDay: '2026-11-07'
    })
    expect(settings.resetTips()).toEqual({ hidden: [], lastShownDay: '2026-11-07' })
  })
})

describe('message répété (fiche 191)', () => {
  it('une empreinte, jamais le texte ; rien gardé quand les astuces sont coupées', () => {
    const { settings, save } = store()
    const text = 'Fais le point sur les PR ouvertes du dépôt'
    expect(settings.noteSentMessage('/projet', text, '2026-11-05')).toBe(false)
    expect(settings.noteSentMessage('/autre', text, '2026-11-06')).toBe(false)
    expect(settings.noteSentMessage('/projet', `${text} !`, '2026-11-06')).toBe(false)
    expect(settings.noteSentMessage('/projet', text.toUpperCase(), '2026-11-07')).toBe(true)
    expect(JSON.stringify(save.mock.lastCall?.[0])).not.toContain('PR ouvertes')
    settings.setPreferences({ tipsEnabled: false })
    const before = settings.tips().sent
    expect(
      settings.noteSentMessage('/projet', 'Un tout autre message assez long', '2026-11-07')
    ).toBe(false)
    expect(settings.tips().sent).toEqual(before)
  })
})

describe('astuces : enregistrement et vie privée (fiche 191, relecture)', () => {
  it('premier jour des astuces : celui de l’accueil du premier lancement (fiche 188), sinon aujourd’hui', () => {
    const at = new Date(2026, 10, 3, 10, 0).toISOString()
    const welcomed = store({
      recentWorkspaces: [],
      onboarding: { outcome: 'finished', at, version: '0.10.0' }
    })
    expect(welcomed.settings.tipsSince('2026-11-07').firstDay).toBe('2026-11-03')
    expect(store().settings.tipsSince('2026-11-07').firstDay).toBe('2026-11-07')
  })

  it('un message envoyé enregistre sans déclencher « réglages changés »', () => {
    const { settings, save, changed } = store()
    save.mockClear()
    settings.noteSentMessage('/projet', 'Fais le point sur les PR ouvertes', '2026-11-05')
    settings.recordTip('aside', 'shown', '2026-11-05')
    settings.tipsSince('2026-11-05')
    expect(save).toHaveBeenCalledTimes(3)
    expect(changed).not.toHaveBeenCalled()
  })

  it('empreinte : HMAC avec une clé propre à l’installation, jamais un SHA-256 nu', () => {
    const text = 'Fais le point sur les PR ouvertes'
    const a = store()
    const b = store()
    a.settings.noteSentMessage('/projet', text, '2026-11-05')
    b.settings.noteSentMessage('/projet', text, '2026-11-05')
    const keyA = a.settings.tips().sent?.[0]?.key
    const keyB = b.settings.tips().sent?.[0]?.key
    const plain = createHash('sha256')
      .update(`/projet\0${normalizeMessage(text)}`)
      .digest('hex')
      .slice(0, 32)
    expect(keyA).toMatch(/^[0-9a-f]{32}$/)
    expect(keyA).not.toBe(plain)
    expect(keyA).not.toBe(keyB)
    expect(a.settings.tips().salt).toMatch(/^[0-9a-f]{64}$/)
    // Même installation : même empreinte, le compte des jours se suit.
    a.settings.noteSentMessage('/projet', text, '2026-11-06')
    expect(a.settings.tips().sent).toEqual([{ key: keyA, days: ['2026-11-05', '2026-11-06'] }])
  })

  it('empreintes effacées : astuces coupées, ou « Planifier… » masquée ou utilisée', () => {
    for (const end of ['off', 'never', 'used'] as const) {
      const { settings } = store()
      settings.noteSentMessage('/projet', 'Fais le point sur les PR ouvertes', '2026-11-05')
      expect(settings.tips().sent).toHaveLength(1)
      if (end === 'off') settings.setPreferences({ tipsEnabled: false })
      else settings.recordTip('scheduled', end, '2026-11-05')
      expect(settings.tips().sent, end).toBeUndefined()
    }
  })
})
