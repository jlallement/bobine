import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  announcementOf,
  describeCapabilities,
  parseAnnouncement,
  sameAnnouncement,
  specificItems
} from './capabilities'
import { resolveProfiles } from './profiles'

const ctx = { appPath: '/app', execPath: '/electron', isPackaged: false, env: {} }
const profile = (id: string) => {
  const found = resolveProfiles(ctx).find((p) => p.id === id)
  if (!found) throw new Error(id)
  return found
}

/** Réponse de Bob 2.0.6 à `initialize` (relevée le 2026-10-14). */
const BOB_INIT = {
  protocolVersion: 1,
  agentCapabilities: {
    loadSession: true,
    sessionCapabilities: { list: {}, delete: {}, resume: {}, close: {} },
    promptCapabilities: { embeddedContext: true, image: true },
    mcpCapabilities: { http: true }
  },
  agentInfo: { name: 'bob-shell', title: 'Bob', version: '2.0.6' }
}

describe('capacités des agents (fiche 054)', () => {
  it('annonce : nom, version et ce que l’app utilise', () => {
    expect(announcementOf(BOB_INIT, '2026-10-14T08:00:00.000Z')).toEqual({
      name: 'Bob',
      version: '2.0.6',
      seenAt: '2026-10-14T08:00:00.000Z',
      load: true,
      resume: true,
      delete: true,
      image: true,
      embeddedContext: true,
      mcpHttp: true,
      list: true,
      additionalDirectories: false
    })
    expect(announcementOf({ protocolVersion: 1 }, 'x')).toMatchObject({ load: false, list: false })
    // OpenCode 2.0.31+ : autres dossiers annoncés (fiche 179).
    const withDirs = {
      ...BOB_INIT,
      agentCapabilities: {
        ...BOB_INIT.agentCapabilities,
        sessionCapabilities: { additionalDirectories: {} }
      }
    }
    expect(announcementOf(withDirs, 'x').additionalDirectories).toBe(true)
  })

  it('annonce relue des réglages ; mal formée : ignorée ; même annonce à la date près', () => {
    const a = announcementOf(BOB_INIT, '2026-10-14T08:00:00.000Z')
    expect(parseAnnouncement(JSON.parse(JSON.stringify(a)))).toEqual(a)
    expect(parseAnnouncement({ ...a, load: 'oui' })).toBeUndefined()
    expect(parseAnnouncement('Bob')).toBeUndefined()
    expect(sameAnnouncement(a, { ...a, seenAt: 'plus tard' })).toBe(true)
    expect(sameAnnouncement(a, { ...a, version: '2.0.7' })).toBe(false)
    expect(sameAnnouncement(undefined, a)).toBe(false)
    // Retenue avant la fiche 055 : `session/list` inconnu, pas affiché ; une nouvelle annonce la remplace.
    const { list: _list, ...old } = a
    expect(parseAnnouncement(old)).toEqual(old)
    expect(sameAnnouncement(old, a)).toBe(false)
    const view = describeCapabilities(profile('bob'), old)
    expect(view.announced?.items.some((i) => i.id === 'list')).toBe(false)
  })

  it('annoncé : oui ou non, avec ce que ça change', () => {
    const none = announcementOf({ protocolVersion: 1 }, 'x')
    const view = describeCapabilities(profile('opencode'), { ...none, resume: true })
    const byId = Object.fromEntries((view.announced?.items ?? []).map((i) => [i.id, i]))
    expect(byId['reopen']).toMatchObject({ supported: true })
    expect(byId['reopen']?.detail).toContain('session/resume')
    expect(byId['delete']).toMatchObject({ supported: false })
    expect(byId['delete']?.detail).toContain('reste chez l’agent')
    expect(describeCapabilities(profile('opencode'), undefined).announced).toBeUndefined()
  })

  it('propre à chaque agent : tiré de son profil', () => {
    expect(specificItems(profile('bob')).map((i) => i.id)).toEqual([
      'cost-bob-db',
      'subagent-cost-bob-db',
      'quota-bob-status',
      'subagent-calls',
      'start-mode',
      'agent-log',
      'always-scope',
      'compact-command',
      'rules-files',
      'ignore-files',
      'mcp-files',
      'approval-rules',
      'api-key',
      'auth-method-labels',
      'license',
      'tested-versions',
      'folder-trust'
    ])
    expect(specificItems(profile('opencode')).map((i) => i.id)).toEqual([
      'subagent-calls',
      'subagent-replay',
      'subagent-live',
      'subagent-background',
      'replay-diffs',
      'execute-errors',
      'child-model',
      'hidden-empty-sessions',
      'compact-command',
      'rules-files',
      'mcp-files',
      'model-providers',
      'terminal-login',
      'tested-versions'
    ])
    const bob = Object.fromEntries(specificItems(profile('bob')).map((i) => [i.id, i.detail]))
    expect(bob['compact-command']).toContain('`/compact`')
    expect(bob['agent-log']).toContain('`~/.bob/logs/shell/`')
    expect(bob['start-mode']).toContain('`bob/mode`')
    expect(bob['license']).toContain('`bob --show-license`')
    expect(bob['folder-trust']).toContain('IBM Bob la retient')
    expect(bob['ignore-files']).toContain('`.bobignore`')
    expect(bob['auth-method-labels']).toContain('(sso)')
    expect(bob['approval-rules']).toContain('`~/.bob/settings/settings.json`')
  })

  it('chaque repère de Bob et d’OpenCode figure dans la matrice de docs/agents.md', () => {
    const doc = readFileSync(join(__dirname, '../../../docs/agents.md'), 'utf8')
    const announced = describeCapabilities(profile('bob'), announcementOf(BOB_INIT, 'x'))
    const ids = new Set([
      ...(announced.announced?.items ?? []).map((i) => i.id),
      ...specificItems(profile('bob')).map((i) => i.id),
      ...specificItems(profile('opencode')).map((i) => i.id)
    ])
    expect([...ids].filter((id) => !doc.includes(`| \`${id}\` |`))).toEqual([])
  })
})
