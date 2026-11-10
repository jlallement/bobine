import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { AgentBlocker, AgentSnapshot } from '@shared/agent'
import type { DiagnosticCheck } from '@shared/diagnostics'
import type { AgentProfile } from './agent/profiles'
import {
  agentGroup,
  isTestedVersion,
  systemGroups,
  tildify,
  type AgentCheck,
  type SystemFacts
} from './diagnostics'
import type { Run } from './simulator/run'

const home = '/Users/essai'
const workspace = mkdtempSync(join(tmpdir(), 'diag-'))

/** Commandes simulées : réponse par commande (premier mot et premier argument). */
function fakeRun(
  answers: Record<string, { code?: number; stdout?: string; stderr?: string }>
): Run {
  return async (file, args) => {
    const key = `${file.split('/').at(-1)} ${args[0] ?? ''}`.trim()
    const answer = answers[key] ?? { code: 1, stderr: `${key} : inconnu` }
    return {
      code: answer.code ?? 0,
      stdout: Buffer.from(answer.stdout ?? ''),
      stderr: answer.stderr ?? ''
    }
  }
}

const devices = JSON.stringify({
  devices: {
    'com.apple.CoreSimulator.SimRuntime.iOS-26-0': [
      { udid: 'a', name: 'iPhone 17', state: 'Booted', isAvailable: true },
      { udid: 'b', name: 'iPad', state: 'Shutdown', isAvailable: true }
    ]
  }
})

function facts(overrides: Partial<SystemFacts> = {}): SystemFacts {
  return {
    app: { version: '0.1.1', electron: '38.2.0', os: '26.0', packaged: true },
    workspace,
    home,
    shell: { path: '/bin/zsh' },
    run: fakeRun({
      'xcode-select -p': { stdout: '/Applications/Xcode.app/Contents/Developer\n' },
      'xcrun xcodebuild': { stdout: 'Xcode 26.0\nBuild version 17A324\n' },
      'xcrun simctl': { stdout: devices },
      'axe --version': { stdout: '1.8.0\n' },
      'xattr -p': { code: 1 }
    }),
    xcrun: 'xcrun',
    axe: `${home}/Applications/Bobine.app/Contents/Resources/axe/axe`,
    androidSdk: `${home}/Library/Android/sdk`,
    ...overrides
  }
}

const check = (groups: { id: string; checks: DiagnosticCheck[] }[], group: string, id: string) =>
  groups.find((g) => g.id === group)?.checks.find((c) => c.id === id)

describe('diagnostic — l’app et son environnement (fiche 061)', () => {
  it('tout va bien : versions, dossier, PATH, Xcode, simulateurs, AXe, SDK Android', async () => {
    const groups = await systemGroups(facts())
    expect(groups.map((g) => g.id)).toEqual(['app', 'environment', 'ios', 'android'])
    expect(groups.flatMap((g) => g.checks).every((c) => c.level === 'ok')).toBe(true)
    expect(check(groups, 'app', 'version')?.detail).toBe(
      '0.1.1 (app installée) · Electron 38.2.0 · macOS 26.0'
    )
    expect(check(groups, 'ios', 'xcode')?.detail).toBe(
      'Xcode 26.0 · /Applications/Xcode.app/Contents/Developer'
    )
    expect(check(groups, 'ios', 'simulators')?.detail).toBe('2 disponibles, 1 démarré')
    expect(check(groups, 'ios', 'axe')?.detail).toBe(
      '1.8.0 · ~/Applications/Bobine.app/Contents/Resources/axe/axe'
    )
    expect(check(groups, 'android', 'sdk')?.detail).toBe('~/Library/Android/sdk')
  })

  it('sans simulateur (Linux, fiche 145) : ni groupe iOS ni commande Xcode', async () => {
    const asked: string[] = []
    const run: Run = async (file, args) => {
      asked.push(file)
      return fakeRun({})(file, args)
    }
    const groups = await systemGroups(facts({ xcrun: undefined, run }))
    expect(groups.map((g) => g.id)).toEqual(['app', 'environment', 'android'])
    expect(asked.filter((file) => /xcode-select|xcrun/.test(file))).toEqual([])
  })

  it('les problèmes, avec la marche à suivre', async () => {
    const groups = await systemGroups(
      facts({
        workspace: join(workspace, 'disparu'),
        shell: { path: '/bin/zsh', problem: '/bin/zsh n’a pas répondu en 10 s' },
        run: fakeRun({
          'xcode-select -p': { stdout: '/Library/Developer/CommandLineTools\n' },
          'axe --version': { stdout: '1.8.0' },
          'xattr -p': { stdout: '0083;…' }
        }),
        androidSdk: undefined
      })
    )
    expect(check(groups, 'app', 'workspace')?.level).toBe('warning')
    expect(check(groups, 'environment', 'shell-path')).toMatchObject({
      level: 'warning',
      action: 'reload-shell-env'
    })
    expect(check(groups, 'ios', 'xcode')).toMatchObject({
      level: 'warning',
      command: 'sudo xcode-select -s /Applications/Xcode.app'
    })
    // Sans Xcode complet, pas de simulateurs à lister.
    expect(check(groups, 'ios', 'simulators')).toBeUndefined()
    expect(check(groups, 'ios', 'axe')).toMatchObject({
      level: 'warning',
      detail: expect.stringContaining('en quarantaine'),
      command:
        'xattr -dr com.apple.quarantine "$HOME/Applications/Bobine.app/Contents/Resources/axe"'
    })
    expect(check(groups, 'android', 'sdk')?.level).toBe('optional')
  })

  it('aucun dossier choisi (fiche 093) : dit tel quel, pas « introuvable »', async () => {
    const groups = await systemGroups(facts({ workspace: '' }))
    expect(check(groups, 'app', 'workspace')).toMatchObject({
      level: 'warning',
      detail: 'Aucun dossier choisi'
    })
  })

  it('facultatifs : ni Xcode ni AXe', async () => {
    const groups = await systemGroups(
      facts({ run: fakeRun({ 'xcode-select -p': { code: 2 } }), axe: undefined })
    )
    expect(check(groups, 'ios', 'xcode')?.level).toBe('optional')
    expect(check(groups, 'ios', 'axe')).toMatchObject({ level: 'optional' })
  })

  it('enregistrement de l’écran (captures, fiche 062) : autorisé, à demander, refusé', async () => {
    const level = async (screenAccess: SystemFacts['screenAccess']) =>
      check(await systemGroups(facts({ screenAccess })), 'environment', 'screen-recording')
    expect((await level('granted'))?.level).toBe('ok')
    expect((await level('not-determined'))?.level).toBe('optional')
    expect(await level('denied')).toMatchObject({
      level: 'warning',
      command: expect.stringContaining('Privacy_ScreenCapture')
    })
    expect(await level(undefined)).toBeUndefined()
  })

  it('dossier personnel abrégé', () => {
    expect(tildify('/Users/essai/projets', home)).toBe('~/projets')
    expect(tildify('/Users/essai2/projets', home)).toBe('/Users/essai2/projets')
  })
})

describe('diagnostic — un agent (fiche 061)', () => {
  const profile: AgentProfile = {
    id: 'bob',
    label: 'IBM Bob',
    command: 'bob',
    args: ['acp'],
    env: {},
    installHint: 'Installez Bob Shell (commande `bob`).',
    testedVersions: ['2.0.6']
  }
  const announcement = {
    name: 'IBM Bob',
    version: '2.0.6',
    seenAt: '2026-10-14T20:00:00.000Z',
    load: true,
    resume: true,
    delete: true,
    image: true,
    embeddedContext: true,
    mcpHttp: true
  }
  const snapshot = (over: Partial<AgentSnapshot>): AgentSnapshot => ({
    status: 'ready',
    info: { profileId: 'bob', profileLabel: 'IBM Bob', workspace: `${home}/projet` },
    controls: [],
    commands: [],
    promptCapabilities: { image: true, embeddedContext: true },
    queued: [],
    ...over
  })
  const run = (over: Partial<AgentCheck>) =>
    agentGroup(
      profile,
      {
        workspace: `${home}/projet`,
        executable: `${home}/.local/bin/bob`,
        announcement,
        ...over
      },
      { home, anotherInstalled: true }
    ).checks
  const blocked = (blocker: AgentBlocker) =>
    run({ snapshot: snapshot({ status: 'needs-action', blocker }) }).at(-1)

  it('introuvable : facultatif si un autre agent est installé, en erreur sinon', () => {
    const missing = { workspace: `${home}/projet` }
    expect(agentGroup(profile, missing, { home, anotherInstalled: true }).checks).toEqual([
      expect.objectContaining({ level: 'optional', action: 'reload-shell-env' })
    ])
    expect(agentGroup(profile, missing, { home, anotherInstalled: false }).checks[0]?.level).toBe(
      'error'
    )
  })

  it('prête : commande, version, session supprimée, modèles', () => {
    const checks = run({
      session: 'deleted',
      snapshot: snapshot({
        controls: [
          {
            id: 'model',
            name: 'Modèle',
            category: 'model',
            type: 'select',
            currentValue: 'b',
            options: [
              { value: 'a', name: 'Rapide' },
              { value: 'b', name: 'Précis' }
            ]
          }
        ]
      })
    })
    expect(checks.map((c) => [c.id, c.level, c.detail])).toEqual([
      ['command', 'ok', '~/.local/bin/bob'],
      ['start', 'ok', 'IBM Bob 2.0.6'],
      ['session', 'ok', 'prête dans ~/projet'],
      ['models', 'ok', '2 proposés, Précis par défaut']
    ])
  })

  it('version que l’app n’a pas vérifiée : avertissement après le démarrage (fiche 140)', () => {
    const checks = run({
      announcement: { ...announcement, version: '2.0.7' },
      session: 'deleted',
      snapshot: snapshot({})
    })
    expect(checks.map((c) => [c.id, c.level])).toEqual([
      ['command', 'ok'],
      ['start', 'ok'],
      ['version', 'warning'],
      ['session', 'ok']
    ])
    expect(checks[2]).toMatchObject({
      label: 'Version',
      detail: 'Bobine a été vérifié avec 2.0.6',
      fix: expect.stringContaining('IBM Bob')
    })
    // Version non annoncée, ou profil sans versions vérifiées : rien à comparer.
    const silent = run({
      announcement: { ...announcement, version: undefined },
      snapshot: snapshot({})
    })
    expect(silent.some((c) => c.id === 'version')).toBe(false)
    const unknown = agentGroup(
      { ...profile, testedVersions: undefined },
      {
        workspace: `${home}/projet`,
        executable: `${home}/.local/bin/bob`,
        announcement: { ...announcement, version: '9.9.9' }
      },
      { home, anotherInstalled: true }
    )
    expect(unknown.checks.some((c) => c.id === 'version')).toBe(false)
  })

  it('versions vérifiées : exacte, ou sous-version d’une entrée', () => {
    expect(isTestedVersion(['1.19', '2.0.31'], '1.19.3')).toBe(true)
    expect(isTestedVersion(['1.19', '2.0.31'], 'v2.0.31')).toBe(true)
    expect(isTestedVersion(['1.19', '2.0.31'], '2.0.32')).toBe(false)
    expect(isTestedVersion(['1.19'], '1.190.0')).toBe(false)
  })

  it('pas de session d’essai : proposée, sans être ouverte', () => {
    expect(run({ session: 'skipped', snapshot: snapshot({}) }).at(-1)).toMatchObject({
      id: 'session',
      level: 'optional',
      action: 'try-session'
    })
  })

  it('ne démarre pas', () => {
    expect(
      run({
        announcement: undefined,
        snapshot: snapshot({ status: 'error', detail: 'spawn EACCES' })
      })
    ).toEqual([
      expect.objectContaining({ id: 'command' }),
      expect.objectContaining({ id: 'start', level: 'error', detail: 'spawn EACCES' })
    ])
  })

  it('blocages : dossier, connexion, licence, avec la marche à suivre', () => {
    expect(
      blocked({
        kind: 'trust',
        message: 'not trusted',
        canTrustForSession: true,
        trustRemembered: true
      })
    ).toMatchObject({
      id: 'trust',
      level: 'warning',
      fix: expect.stringContaining('«\u00a0Faire confiance à ce dossier\u00a0»')
    })
    expect(
      blocked({
        kind: 'auth',
        methods: [{ id: 'sso', name: 'SSO' }],
        apiKey: {
          env: 'BOB_API_KEY',
          label: 'Clé',
          stored: false,
          fromEnvironment: false
        },
        authenticating: false
      })
    ).toMatchObject({
      id: 'auth',
      level: 'error',
      fix: 'Pour vous connecter\u00a0: ouvrez une conversation et choisissez «\u00a0SSO\u00a0», ou enregistrez une clé d’API dans Réglages › Agents.',
      action: 'open-agents-settings'
    })
    expect(
      blocked({
        kind: 'auth',
        methods: [
          {
            id: 'login',
            name: 'Login',
            step: { id: 'login', label: 'Se connecter', command: 'opencode auth login' }
          }
        ],
        authenticating: false
      })
    ).toMatchObject({ command: 'opencode auth login' })
    expect(
      blocked({
        kind: 'license',
        message: 'A license agreement is required',
        steps: [{ id: 'show-license', label: 'Lire', command: 'bob --show-license' }]
      })
    ).toMatchObject({ id: 'license', level: 'error', command: 'bob --show-license' })
  })
})
