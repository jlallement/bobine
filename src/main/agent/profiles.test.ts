import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { UNTRUSTED_WORKSPACE } from './bob-contract'
import { OPENCODE_SUBAGENT_STREAM } from './opencode-contract'
import { findExecutable, resolveProfiles, summarizeProfiles } from './profiles'
import bobExpected from '../../../scripts/bob-probe.expected.json'
import opencodeExpected from '../../../scripts/opencode-probe.expected.json'

function fakeBin(...commands: string[]): string {
  const dir = mkdtempSync(join(tmpdir(), 'bob-bin-'))
  for (const command of commands) {
    const file = join(dir, command)
    writeFileSync(file, '#!/bin/sh\n')
    chmodSync(file, 0o755)
  }
  mkdirSync(join(dir, 'un-dossier'))
  writeFileSync(join(dir, 'non-executable'), '')
  return dir
}

const ctx = { appPath: '/app', execPath: '/electron', isPackaged: false, env: {} }
/** En développement, l'agent factice demandé, comme le font les essais de bout en bout. */
const withMock = { ...ctx, env: { BOBINE_AGENT_PROFILE: 'mock' } }

describe('profils', () => {
  it('Bob, OpenCode, et l’agent factice en développement (Claude Code et Codex ne sont plus proposés)', () => {
    // L'agent factice seulement sur demande (essais), et après les vrais agents.
    expect(resolveProfiles(ctx).map((p) => p.id)).toEqual(['bob', 'opencode'])
    expect(resolveProfiles(withMock).map((p) => p.id)).toEqual(['bob', 'opencode', 'mock'])
    expect(resolveProfiles({ ...ctx, env: { BOBINE_MOCK_AGENT: '1' } }).map((p) => p.id)).toEqual([
      'bob',
      'opencode',
      'mock'
    ])
    expect(resolveProfiles({ ...withMock, isPackaged: true }).map((p) => p.id)).toEqual([
      'bob',
      'opencode'
    ])
  })

  it('Bob : `bob acp`, sans réglage supposé ni --auto-approve / --trust', () => {
    const bob = resolveProfiles(ctx).find((p) => p.id === 'bob')
    expect([bob?.command, ...(bob?.args ?? [])]).toEqual(['bob', 'acp'])
    expect(bob?.defaultControls).toBeUndefined()
  })

  it('Bob : confiance mémorisée, approuvée par `bob`, et coût lu dans sa base locale', () => {
    const bob = resolveProfiles(ctx).find((p) => p.id === 'bob')
    expect(bob?.trust).toEqual({
      pattern: UNTRUSTED_WORKSPACE,
      flag: '--trust',
      remembered: true,
      approveCommand: 'bob'
    })
    expect(bob?.costSource).toMatchObject({ id: 'bob-db', currency: 'bobcoins' })
  })

  it('OpenCode : pas de refus de dossier reconnu, travail des sous-agents en direct', () => {
    const opencode = resolveProfiles(ctx).find((p) => p.id === 'opencode')
    expect(opencode?.trust).toBeUndefined()
    expect(opencode?.costSource).toBeUndefined()
    expect(opencode?.subagentStream).toBe(OPENCODE_SUBAGENT_STREAM)
  })

  it('agent factice : astuce d’accueil ; aucun vrai agent n’en a', () => {
    const [bob, opencode, mock] = resolveProfiles(withMock)
    expect(mock?.welcomeHint).toContain('`/scenario`')
    expect(bob?.welcomeHint).toBeUndefined()
    expect(opencode?.welcomeHint).toBeUndefined()
  })

  it('portée de « Toujours » (fiche 214) : déclarée pour Bob, jamais supposée pour les autres', () => {
    const [bob, opencode, mock] = resolveProfiles(withMock)
    expect(bob?.alwaysScope).toEqual({
      lasts: 'conversation',
      covers: { execute: 'parts', edit: 'all-edits' }
    })
    expect(opencode?.alwaysScope).toBeUndefined()
    expect(mock?.alwaysScope).toBeUndefined()
    // Essais : l'agent factice peut la déclarer comme Bob.
    const scoped = resolveProfiles({
      ...withMock,
      env: { ...withMock.env, MOCK_AGENT_ALWAYS_SCOPE: 'bob' }
    })
    expect(scoped[2]?.alwaysScope).toEqual(bob?.alwaysScope)
  })

  it('OpenCode : ACP natif (`opencode acp`), sans réglage supposé', () => {
    const opencode = resolveProfiles(ctx).find((p) => p.id === 'opencode')
    expect([opencode?.command, ...(opencode?.args ?? [])]).toEqual(['opencode', 'acp'])
    expect(opencode?.defaultControls).toBeUndefined()
  })

  it('findExecutable : seulement les fichiers exécutables', () => {
    const dir = fakeBin('npx')
    expect(findExecutable('npx', `/nexiste:${dir}`)).toBe(join(dir, 'npx'))
    expect(findExecutable('bob', dir)).toBeUndefined()
    expect(findExecutable('non-executable', dir)).toBeUndefined()
    expect(findExecutable('un-dossier', dir)).toBeUndefined()
    expect(findExecutable(join(dir, 'npx'), undefined)).toBe(join(dir, 'npx'))
  })

  it('résumé : profil indisponible avec la raison et le conseil d’installation', () => {
    const dir = fakeBin('npx')
    const summary = summarizeProfiles(
      resolveProfiles({ ...withMock, execPath: process.execPath }),
      dir
    )
    expect(summary.map((p) => [p.id, p.available])).toEqual([
      ['bob', false],
      ['opencode', false],
      ['mock', true]
    ])
    expect(summary[0]?.reason).toContain('bob')
    expect(summary[0]?.reason).toContain('Bob Shell')
  })
})

describe('profils : sous-agents (fiche 053)', () => {
  it('Bob : coût des sous-agents lu dans sa base ; OpenCode : leur session se rejoue', () => {
    const [bob, opencode, mock] = resolveProfiles(withMock)
    expect(bob?.costSource?.subagents).toBeTypeOf('function')
    expect(bob?.subagentReplay).toBeUndefined()
    expect(opencode).toMatchObject({ subagentReplay: true })
    expect(opencode?.costSource?.subagents).toBeUndefined()
    expect(mock?.args).not.toContain('--bob-db')
    expect(mock?.costSource).toBeUndefined()
  })

  it('agent factice : base de Bob seulement sous un dossier personnel d’essai', () => {
    const withCosts = { BOBINE_AGENT_PROFILE: 'mock', MOCK_AGENT_COST_SOURCE: 'bob-db' }
    const mock = (env: Record<string, string>) =>
      resolveProfiles({ ...ctx, env }).find((p) => p.id === 'mock')
    expect(mock(withCosts)?.args).not.toContain('--bob-db')
    const home = '/tmp/essai'
    const args = mock({ ...withCosts, BOBINE_CONFIG_HOME: home })?.args ?? []
    expect(args.slice(args.indexOf('--bob-db'))).toEqual(['--bob-db', '/tmp/essai/.bob/db/bob.db'])
    expect(mock({ ...withCosts, BOBINE_CONFIG_HOME: home })?.costSource?.id).toBe('bob-db')
  })
})

describe('profils : libellés des méthodes de connexion (fiche 205)', () => {
  it('Bob : « sso », la méthode relevée par la sonde, libellée dans la langue de l’app', () => {
    const bob = resolveProfiles(ctx).find((p) => p.id === 'bob')
    const announced = bobExpected.observations.initialize.authMethods
    expect(Object.keys(bob?.authMethodLabels ?? {})).toEqual(announced)
    expect(bob?.authMethodLabels?.['sso']?.label).toBe('Se connecter par SSO')
    // L'agent factice l'imite pour sa méthode SSO simulée ; OpenCode n'en déclare aucun.
    const mock = resolveProfiles(withMock).find((p) => p.id === 'mock')
    expect(mock?.authMethodLabels?.['mock-sso']?.label).toBe('Se connecter par SSO')
    expect(resolveProfiles(ctx).find((p) => p.id === 'opencode')?.authMethodLabels).toBeUndefined()
  })
})

describe('profils : indépendance aux agents (fiche 140)', () => {
  it('versions vérifiées : celles des sondes en font partie', () => {
    const [bob, opencode] = resolveProfiles(ctx)
    expect(bob?.testedVersions).toContain(bobExpected.bobVersion)
    expect(opencode?.testedVersions).toContain(opencodeExpected.opencodeVersion)
    // Dernier passage sans modèle (fiche 198) : sa version compte aussi comme essayée.
    expect(opencode?.testedVersions).toContain(opencodeExpected.offline?.opencodeVersion)
    // Aucun plancher bloquant sans incompatibilité documentée.
    expect(bob?.minVersion).toBeUndefined()
    expect(opencode?.minVersion).toBeUndefined()
  })

  it('sous-agents, règles, MCP, fournisseurs : portés par chaque profil', () => {
    const [bob, opencode, mock] = resolveProfiles(withMock)
    for (const profile of [bob, opencode, mock]) {
      expect(profile?.subagentFormat?.subagentOf).toBeTypeOf('function')
    }
    // Chaque agent reconnaît son format, pas celui de l'autre ; l'agent factice, les deux.
    const bobCall = ['Running subagent: Lire', { description: 'Lire', name: 'explore' }] as const
    const openCodeCall = ['subagent', { agent: 'explore', prompt: 'Lis a.txt' }] as const
    expect(bob?.subagentFormat?.subagentOf(...bobCall)).toBeDefined()
    expect(bob?.subagentFormat?.subagentOf(...openCodeCall)).toBeUndefined()
    expect(opencode?.subagentFormat?.subagentOf(...openCodeCall)).toBeDefined()
    expect(opencode?.subagentFormat?.subagentOf(...bobCall)).toBeUndefined()
    expect(mock?.subagentFormat?.subagentOf(...bobCall)).toBeDefined()
    expect(mock?.subagentFormat?.subagentOf(...openCodeCall)).toBeDefined()
    expect(bob?.rules?.summary()).toContain('.bob/rules')
    expect(opencode?.rules?.summary()).toContain('opencode')
    expect(bob?.mcpConfig?.globalFile({ home: '/h' })).toBe('/h/.bob/settings/mcp.json')
    expect(opencode?.providers?.file({ home: '/h' })).toBe('/h/.config/opencode/opencode.json')
    expect(bob?.providers).toBeUndefined()
  })
})

describe('profils : règles d’approbation (fiche 215)', () => {
  it('agent factice : seulement avec un dossier personnel d’essai, jamais le vrai ~/.bob', () => {
    const mock = (env: Record<string, string>) =>
      resolveProfiles({ ...withMock, env: { ...withMock.env, ...env } }).find(
        (p) => p.id === 'mock'
      )
    expect(mock({})?.approvalRules).toBeUndefined()
    expect(
      summarizeProfiles(resolveProfiles(withMock), '').find((p) => p.id === 'mock')?.approvalRules
    ).toBeUndefined()
    const home = mkdtempSync(join(tmpdir(), 'bob-approval-home-'))
    const declared = mock({ BOBINE_CONFIG_HOME: home })?.approvalRules
    expect(declared?.file({ home })).toBe(join(home, '.bob', 'settings', 'settings.json'))
    expect(resolveProfiles(ctx).find((p) => p.id === 'bob')?.approvalRules).toBeDefined()
  })
})
