import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { addRecentWorkspace, loadSettings, peekPreferences, saveSettings } from './settings'

const tempFile = () => join(mkdtempSync(join(tmpdir(), 'bob-settings-')), 'settings.json')

describe('settings', () => {
  it('fichier absent ou corrompu : valeurs par défaut', () => {
    const file = tempFile()
    expect(loadSettings(file)).toEqual({ recentWorkspaces: [] })
    writeFileSync(file, '{ pas du json')
    expect(loadSettings(file)).toEqual({ recentWorkspaces: [] })
  })

  it('ignore les champs mal typés', () => {
    const file = tempFile()
    writeFileSync(
      file,
      JSON.stringify({
        profileId: 42,
        workspace: '/a',
        recentWorkspaces: ['/a', 3, '', '/b'],
        notifications: 'non'
      })
    )
    expect(loadSettings(file)).toEqual({
      profileId: undefined,
      workspace: '/a',
      recentWorkspaces: ['/a', '/b']
    })
  })

  it('aller-retour sauvegarde / lecture, sans fichier temporaire résiduel', () => {
    const file = tempFile()
    const settings = {
      profileId: 'codex',
      workspace: '/p',
      recentWorkspaces: ['/p'],
      notifications: false
    }
    saveSettings(file, settings)
    expect(loadSettings(file)).toEqual(settings)
    expect(() => readFileSync(`${file}.tmp`)).toThrow()
  })

  it('fenêtre (fiche 093) : gardée, valeurs mal formées écartées', () => {
    const file = tempFile()
    const window = { x: -1200, y: 40, width: 1100, height: 700, maximized: true }
    saveSettings(file, { recentWorkspaces: [], window })
    expect(loadSettings(file).window).toEqual(window)
    writeFileSync(file, JSON.stringify({ window: { x: 0, y: 0, width: 'large', height: 700 } }))
    expect(loadSettings(file)).not.toHaveProperty('window')
  })

  it('agents déclarés (fiche 141) : gardés s’ils sont valides, sinon rien', () => {
    const file = tempFile()
    const acme = { id: 'custom-acme', label: 'Acme', command: 'acme', args: ['--acp'], env: {} }
    saveSettings(file, { recentWorkspaces: [], customAgents: [acme] })
    expect(loadSettings(file).customAgents).toEqual([acme])
    writeFileSync(file, JSON.stringify({ customAgents: [{ id: 'bob', label: 'x', command: 'x' }] }))
    expect(loadSettings(file)).not.toHaveProperty('customAgents')
  })

  it('accueil du premier lancement (fiche 188) : marque gardée, mal formée écartée', () => {
    const file = tempFile()
    const onboarding = {
      outcome: 'finished' as const,
      at: '2026-11-07T08:00:00.000Z',
      version: '0.10.0'
    }
    saveSettings(file, { recentWorkspaces: [], onboarding })
    expect(loadSettings(file).onboarding).toEqual(onboarding)
    writeFileSync(file, JSON.stringify({ onboarding: { outcome: 'done' } }))
    expect(loadSettings(file)).not.toHaveProperty('onboarding')
  })

  it('familles d’outils de Bobine coupées (fiche 109) : textes sans doublon, sinon rien', () => {
    const file = tempFile()
    saveSettings(file, { recentWorkspaces: [], appToolsOff: ['browser'] })
    expect(loadSettings(file).appToolsOff).toEqual(['browser'])
    writeFileSync(
      file,
      JSON.stringify({ appToolsOff: ['browser', 3, '', 'browser', 'ios-simulator'] })
    )
    expect(loadSettings(file).appToolsOff).toEqual(['browser', 'ios-simulator'])
    writeFileSync(file, JSON.stringify({ appToolsOff: 'browser' }))
    expect(loadSettings(file)).not.toHaveProperty('appToolsOff')
  })

  it('réglages de session par profil : valeurs mal typées écartées', () => {
    const file = tempFile()
    writeFileSync(
      file,
      JSON.stringify({
        controls: {
          codex: { mode: 'read-only', verbose: true, x: 3 },
          vide: { y: null },
          mauvais: 'z'
        }
      })
    )
    expect(loadSettings(file).controls).toEqual({ codex: { mode: 'read-only', verbose: true } })
  })

  it('récents : en tête, sans doublon, 5 au plus', () => {
    let recents: string[] = []
    for (const w of ['/1', '/2', '/3', '/4', '/5', '/6']) recents = addRecentWorkspace(recents, w)
    expect(recents).toEqual(['/6', '/5', '/4', '/3', '/2'])
    expect(addRecentWorkspace(recents, '/3')).toEqual(['/3', '/6', '/5', '/4', '/2'])
  })

  it('préférences lues avant que l’app soit prête : sans mettre de côté un fichier abîmé', () => {
    const dir = mkdtempSync(join(tmpdir(), 'peek-'))
    const file = join(dir, 'settings.json')
    expect(peekPreferences(file)).toEqual({})
    writeFileSync(file, JSON.stringify({ logLevel: 'detailed', language: 'en', profileId: 'bob' }))
    expect(peekPreferences(file)).toEqual({ logLevel: 'detailed', language: 'en' })
    writeFileSync(file, '{ abîmé')
    expect(peekPreferences(file)).toEqual({})
    expect(readFileSync(file, 'utf8')).toBe('{ abîmé')
  })
})

describe('avis de version déjà montrés : réglages abîmés (fiche 198)', () => {
  it('versionNotices mal formé : ignoré sans planter, le reste relu', () => {
    const dir = mkdtempSync(join(tmpdir(), 'reglages-avis-'))
    const file = join(dir, 'settings.json')
    for (const bad of [42, 'x', null, [], { opencode: 'newer:2.3' }, { bob: [1, null, ''] }]) {
      writeFileSync(file, JSON.stringify({ profileId: 'bob', versionNotices: bad }))
      const settings = loadSettings(file)
      expect(settings.profileId).toBe('bob')
      expect(settings.versionNotices).toBeUndefined()
    }
    writeFileSync(
      file,
      JSON.stringify({ versionNotices: { opencode: ['newer:2.3', 7, 'newer:2.3'], bob: 'x' } })
    )
    expect(loadSettings(file).versionNotices).toEqual({ opencode: ['newer:2.3'] })
  })
})

describe('astuces dans settings.json (fiche 191)', () => {
  it('relues et validées : astuces inconnues et jour invalide ignorés', () => {
    const file = tempFile()
    writeFileSync(
      file,
      JSON.stringify({
        recentWorkspaces: [],
        tipsEnabled: false,
        tipsState: { hidden: ['aside', 'inconnue'], lastShownDay: 'demain' }
      })
    )
    expect(loadSettings(file)).toMatchObject({
      tipsEnabled: false,
      tipsState: { hidden: ['aside'] }
    })
    expect(loadSettings(file).tipsState).not.toHaveProperty('lastShownDay')
  })
})
