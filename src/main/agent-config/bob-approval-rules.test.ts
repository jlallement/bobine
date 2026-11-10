import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  statSync,
  symlinkSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  BOB_DEFAULT_ALLOWED_COMMANDS,
  type ApprovalRulesResult,
  type ApprovalRulesView
} from '@shared/approval-rules'
import { BACKUP_SUFFIX, BOB_APPROVAL_RULES, BobApprovalRules } from './bob-approval-rules'
import type { ApprovalRulesHooks } from './approval-rules'
import {
  ApprovalRulesSettings,
  approvalRulesHandlers,
  deniedCommandOf
} from './approval-rules-settings'

/** Dossier personnel jetable : jamais le vrai `~/.bob`. */
function setup(content?: string, hooks: ApprovalRulesHooks = {}) {
  const home = mkdtempSync(join(tmpdir(), 'bob-approval-home-'))
  const file = BOB_APPROVAL_RULES.file({ home })
  if (content !== undefined) {
    mkdirSync(join(home, '.bob', 'settings'), { recursive: true })
    writeFileSync(file, content)
  }
  const rules = new BobApprovalRules(file, 'bob', '~/.bob/settings/settings.json', hooks)
  return { home, file, rules }
}

const json = (file: string): Record<string, unknown> =>
  JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>

const approvalOf = (file: string) => json(file)['approval'] as Record<string, unknown>

function ok(result: ApprovalRulesResult): Extract<ApprovalRulesResult, { ok: true }> {
  if (!result.ok) throw new Error(`échec inattendu : ${JSON.stringify(result.error)}`)
  return result
}

function view(rules: BobApprovalRules): ApprovalRulesView {
  const read = rules.read()
  if (!read.ok) throw new Error(`lecture en échec : ${JSON.stringify(read.error)}`)
  return read.rules
}

const executor = (file: string) =>
  (approvalOf(file)['allowedExecutors'] as Record<string, unknown>[]).find(
    (e) => e['toolId'] === 'execute_command'
  )

/** Fichier tel que Bob IDE le laisse : clés inconnues, réglages hors `approval`. */
const BOB_IDE_FILE = `${JSON.stringify(
  {
    telemetry: { enabled: false },
    licenseConsent: true,
    approval: {
      autoApprovalEnabled: true,
      editApprovalPreviewMode: 'editor',
      allowed_permissions: ['read', 'edit'],
      allowedExecutors: [
        { toolId: 'execute_command', approvedCommands: ['ls', 'npm test'], deniedCommands: ['rm'] }
      ],
      forbiddenApprovalGroups: [],
      futureKey: { nested: [1, 2, 3] }
    },
    hooks: { PreToolUse: [] },
    zz: 'dernière clé'
  },
  null,
  2
)}\n`

describe('règles d’approbation de Bob : lecture (fiche 215)', () => {
  it('fichier absent : défauts de Bob (Lecture seule, liste par défaut signalée)', () => {
    const { rules } = setup()
    const v = view(rules)
    expect(v.exists).toBe(false)
    expect(v.file).toBe('~/.bob/settings/settings.json')
    expect(v.defaultGroups).toBe(true)
    expect(v.groups.filter((g) => g.enabled).map((g) => g.id)).toEqual(['read'])
    expect(v.commands).toEqual({
      allowed: [...BOB_DEFAULT_ALLOWED_COMMANDS],
      denied: [],
      defaultList: true
    })
    expect(v.outsideWorkspaceAllowed).toBe(false)
    expect(v.autoApprovalEnabled).toBe(true)
    expect(v.forbiddenGroups).toEqual([])
  })

  it('sans section `approval` : mêmes défauts', () => {
    const { rules } = setup('{ "telemetry": { "enabled": false } }')
    const v = view(rules)
    expect(v.exists).toBe(true)
    expect(v.commands.defaultList).toBe(true)
    expect(v.defaultGroups).toBe(true)
  })

  it('lit groupes, listes, hors du dossier, groupes interdits et inconnus', () => {
    const { rules } = setup(
      JSON.stringify({
        approval: {
          allowed_permissions: ['read', 'todo', 'groupe-futur'],
          allowedExecutors: [{ toolId: 'execute_command', approvedCommands: ['ls'] }],
          outsideWorkspaceAllowed: true,
          permissionOptions: [{ groupId: 'read', enableOutsideWorkspace: true }],
          forbiddenApprovalGroups: ['execute'],
          autoApprovalEnabled: false
        }
      })
    )
    const v = view(rules)
    expect(v.groups.find((g) => g.id === 'todo')).toMatchObject({ enabled: true })
    expect(v.groups.find((g) => g.id === 'execute')).toMatchObject({
      enabled: false,
      forbidden: true
    })
    expect(v.groups.find((g) => g.id === 'read')).toMatchObject({ outsideWorkspace: true })
    expect(v.groups.find((g) => g.id === 'edit')).toMatchObject({ outsideWorkspace: false })
    expect(v.otherGroups).toEqual(['groupe-futur'])
    // Entrée sans `deniedCommands` : liste vide, comme Bob IDE.
    expect(v.commands).toEqual({ allowed: ['ls'], denied: [], defaultList: false })
    expect(v.outsideWorkspaceAllowed).toBe(true)
    expect(v.autoApprovalEnabled).toBe(false)
    expect(v.forbiddenGroups).toEqual(['execute'])
  })

  it('`allowedExecutors` sans entrée `execute_command` : aucune commande (pas la liste par défaut)', () => {
    const { rules } = setup(
      JSON.stringify({
        approval: { allowedExecutors: [{ toolId: 'autre', approvedCommands: [] }] }
      })
    )
    expect(view(rules).commands).toEqual({ allowed: [], denied: [], defaultList: false })
  })

  it.each([
    ['JSON invalide', '{ "approval": ', 'invalid-json'],
    ['commentaire (Bob ne le lirait pas)', '{ // note\n "a": 1 }', 'invalid-json'],
    ['virgule de trop', '{ "a": 1, }', 'invalid-json'],
    ['fichier vide', '', 'invalid-json'],
    ['racine en tableau', '[]', 'unexpected-format'],
    ['approval en texte', '{ "approval": "oui" }', 'unexpected-format'],
    ['groupes en texte', '{ "approval": { "allowed_permissions": "read" } }', 'unexpected-format'],
    [
      'commande non textuelle',
      '{ "approval": { "allowedExecutors": [{ "toolId": "execute_command", "approvedCommands": [1] }] } }',
      'unexpected-format'
    ],
    [
      'entrée sans toolId',
      '{ "approval": { "allowedExecutors": [{ "approvedCommands": [] }] } }',
      'unexpected-format'
    ],
    [
      'option hors du dossier non booléenne',
      '{ "approval": { "permissionOptions": [{ "groupId": "read", "enableOutsideWorkspace": "oui" }] } }',
      'unexpected-format'
    ],
    [
      'interdits en texte',
      '{ "approval": { "forbiddenApprovalGroups": "edit" } }',
      'unexpected-format'
    ],
    [
      'hors du dossier nul',
      '{ "approval": { "outsideWorkspaceAllowed": null } }',
      'unexpected-format'
    ]
  ])('%s : erreur typée, rien écrit ni déplacé', (_name, content, code) => {
    const { file, rules, home } = setup(content)
    const read = rules.read()
    expect(read).toMatchObject({
      ok: false,
      error: { code, file: '~/.bob/settings/settings.json' }
    })
    const change = rules.change({ type: 'allowCommandEverywhere', prefix: 'npm test' })
    expect(change).toMatchObject({ ok: false, error: { code } })
    expect(readFileSync(file, 'utf8')).toBe(content)
    // Ni copie de sauvegarde, ni fichier mis de côté, ni temporaire.
    expect(readdirSync(join(home, '.bob', 'settings'))).toEqual(['settings.json'])
  })

  it('JSON invalide : la ligne de la première erreur est donnée', () => {
    const { rules } = setup('{\n  "a": 1,\n  "b": 2,\n}\n')
    expect(rules.read()).toMatchObject({ ok: false, error: { code: 'invalid-json', line: 4 } })
  })

  it('format inattendu : la clé en cause est nommée', () => {
    const { rules } = setup(
      '{ "approval": { "allowedExecutors": [{ "toolId": "execute_command", "deniedCommands": "rm" }] } }'
    )
    expect(rules.read()).toMatchObject({
      ok: false,
      error: { code: 'unexpected-format', detail: 'approval.allowedExecutors[0].deniedCommands' }
    })
  })

  it('fichier illisible (droits) : erreur typée, rien écrit', () => {
    if (process.getuid?.() === 0) return // root lit tout
    const { file, rules } = setup('{}')
    chmodSync(file, 0o000)
    try {
      expect(rules.read()).toMatchObject({ ok: false, error: { code: 'unreadable' } })
      expect(rules.change({ type: 'setGroup', group: 'edit', enabled: true })).toMatchObject({
        ok: false,
        error: { code: 'unreadable' }
      })
    } finally {
      chmodSync(file, 0o600)
    }
    expect(readFileSync(file, 'utf8')).toBe('{}')
  })
})

describe('règles d’approbation de Bob : écriture impossible (fiche 215)', () => {
  it('dossier en lecture seule : erreur typée, fichier intact', () => {
    if (process.getuid?.() === 0) return // root écrit partout
    const { file, rules, home } = setup('{ "a": 1 }')
    const dir = join(home, '.bob', 'settings')
    chmodSync(dir, 0o500)
    try {
      expect(rules.change({ type: 'setGroup', group: 'edit', enabled: true })).toMatchObject({
        ok: false,
        error: { code: 'write-failed' }
      })
    } finally {
      chmodSync(dir, 0o700)
    }
    expect(readFileSync(file, 'utf8')).toBe('{ "a": 1 }')
    expect(readdirSync(dir)).toEqual(['settings.json'])
  })
})

describe('règles d’approbation de Bob : commandes (fiche 215)', () => {
  it('fichier absent : crée seulement ce qu’il faut, liste par défaut recopiée', () => {
    const { file, rules } = setup()
    const result = ok(rules.change({ type: 'addCommand', prefix: 'npm test', list: 'allowed' }))
    expect(json(file)).toEqual({
      approval: {
        allowedExecutors: [
          {
            toolId: 'execute_command',
            approvedCommands: [...BOB_DEFAULT_ALLOWED_COMMANDS, 'npm test'],
            deniedCommands: []
          }
        ]
      }
    })
    expect(result.rules.commands.defaultList).toBe(false)
    expect(result.rules.exists).toBe(true)
    // Rien à sauvegarder : le fichier n'existait pas.
    expect(existsSync(`${file}${BACKUP_SUFFIX}`)).toBe(false)
    expect(statSync(file).mode & 0o777).toBe(0o600)
  })

  it('sans `allowedExecutors` : la liste par défaut est recopiée (piège vu le 2026-11-09)', () => {
    const { file, rules } = setup('{ "approval": { "allowed_permissions": ["read"] } }')
    ok(rules.change({ type: 'addCommand', prefix: 'make', list: 'denied' }))
    expect(executor(file)).toEqual({
      toolId: 'execute_command',
      approvedCommands: [...BOB_DEFAULT_ALLOWED_COMMANDS],
      deniedCommands: ['make']
    })
    // Retirer une commande de la liste par défaut la recopie aussi, sans elle.
    const other = setup('{}')
    ok(other.rules.change({ type: 'removeCommand', prefix: 'du', list: 'allowed' }))
    expect(executor(other.file)?.['approvedCommands']).toEqual(
      BOB_DEFAULT_ALLOWED_COMMANDS.filter((c) => c !== 'du')
    )
  })

  it('ajouter à une liste retire de l’autre ; retirer ; doublon ignoré', () => {
    const { file, rules } = setup(BOB_IDE_FILE)
    ok(rules.change({ type: 'addCommand', prefix: 'rm', list: 'allowed' }))
    expect(executor(file)).toMatchObject({
      approvedCommands: ['ls', 'npm test', 'rm'],
      deniedCommands: []
    })
    ok(rules.change({ type: 'addCommand', prefix: 'npm test', list: 'denied' }))
    expect(executor(file)).toMatchObject({
      approvedCommands: ['ls', 'rm'],
      deniedCommands: ['npm test']
    })
    const again = ok(rules.change({ type: 'addCommand', prefix: 'npm  test ', list: 'denied' }))
    expect(again.notice.unchanged).toBe(true)
    ok(rules.change({ type: 'removeCommand', prefix: 'npm test', list: 'denied' }))
    expect(executor(file)).toMatchObject({ approvedCommands: ['ls', 'rm'], deniedCommands: [] })
    const absent = ok(rules.change({ type: 'removeCommand', prefix: 'absente', list: 'allowed' }))
    expect(absent.notice.unchanged).toBe(true)
  })

  it('préfixe normalisé, préfixe d’un seul mot signalé, préfixe vide refusé', () => {
    const { file, rules } = setup('{}')
    const multi = ok(
      rules.change({ type: 'addCommand', prefix: '  npm\t run   build\n', list: 'allowed' })
    )
    expect(multi.notice).toMatchObject({ prefix: 'npm run build', singleWord: false })
    expect(executor(file)?.['approvedCommands']).toContain('npm run build')
    const single = ok(rules.change({ type: 'addCommand', prefix: ' git ', list: 'allowed' }))
    expect(single.notice).toMatchObject({ prefix: 'git', singleWord: true })
    expect(rules.change({ type: 'addCommand', prefix: '   ', list: 'allowed' })).toMatchObject({
      ok: false,
      error: { code: 'invalid-command' }
    })
    expect(
      rules.change({ type: 'addCommand', prefix: 'x'.repeat(1001), list: 'allowed' })
    ).toMatchObject({ ok: false, error: { code: 'invalid-command' } })
  })

  it('entrée écrite à la main avec des espaces de trop : reconnue pour la bascule', () => {
    const { file, rules } = setup(
      '{ "approval": { "allowedExecutors": [{ "toolId": "execute_command", "approvedCommands": ["npm  test"], "deniedCommands": [] }] } }'
    )
    ok(rules.change({ type: 'addCommand', prefix: 'npm test', list: 'denied' }))
    expect(executor(file)).toMatchObject({ approvedCommands: [], deniedCommands: ['npm test'] })
  })

  it('`allowedExecutors` sans entrée `execute_command` : entrée ajoutée, les autres gardées', () => {
    const { file, rules } = setup(
      '{ "approval": { "allowedExecutors": [{ "toolId": "autre", "approvedCommands": ["x"], "futur": 1 }] } }'
    )
    ok(rules.change({ type: 'addCommand', prefix: 'npm test', list: 'allowed' }))
    expect(approvalOf(file)['allowedExecutors']).toEqual([
      { toolId: 'autre', approvedCommands: ['x'], futur: 1 },
      { toolId: 'execute_command', approvedCommands: ['npm test'], deniedCommands: [] }
    ])
  })

  it('clés inconnues, ordre et le reste du fichier gardés ; copie de sauvegarde', () => {
    const { file, rules } = setup(BOB_IDE_FILE)
    chmodSync(file, 0o640)
    ok(rules.change({ type: 'addCommand', prefix: 'npm run lint', list: 'allowed' }))
    const after = json(file)
    expect(Object.keys(after)).toEqual(['telemetry', 'licenseConsent', 'approval', 'hooks', 'zz'])
    expect(Object.keys(after['approval'] as object)).toEqual([
      'autoApprovalEnabled',
      'editApprovalPreviewMode',
      'allowed_permissions',
      'allowedExecutors',
      'forbiddenApprovalGroups',
      'futureKey'
    ])
    const before = JSON.parse(BOB_IDE_FILE) as Record<string, unknown>
    const expected = structuredClone(before) as { approval: { allowedExecutors: unknown[] } }
    expected.approval.allowedExecutors = [
      {
        toolId: 'execute_command',
        approvedCommands: ['ls', 'npm test', 'npm run lint'],
        deniedCommands: ['rm']
      }
    ]
    expect(after).toEqual(expected)
    // Mise en forme gardée : seules les lignes de la liste changent.
    const text = readFileSync(file, 'utf8')
    expect(text.split('\n').slice(0, 12)).toEqual(BOB_IDE_FILE.split('\n').slice(0, 12))
    expect(text.endsWith('}\n')).toBe(true)
    // Copie : le fichier tel qu'il était, sous un nom propre à Bobine ; droits gardés.
    expect(readFileSync(`${file}${BACKUP_SUFFIX}`, 'utf8')).toBe(BOB_IDE_FILE)
    expect(statSync(file).mode & 0o777).toBe(0o640)
    // Aucun temporaire laissé.
    expect(readdirSync(join(file, '..')).sort()).toEqual([
      'settings.json',
      `settings.json${BACKUP_SUFFIX}`
    ])
  })

  it('lien symbolique : la cible est réécrite, le lien reste', () => {
    const { home, rules } = setup()
    const real = join(home, 'dotfiles-settings.json')
    writeFileSync(real, '{ "telemetry": { "enabled": false } }\n')
    mkdirSync(join(home, '.bob', 'settings'), { recursive: true })
    const link = BOB_APPROVAL_RULES.file({ home })
    symlinkSync(real, link)
    ok(rules.change({ type: 'setGroup', group: 'edit', enabled: true }))
    expect(lstatSync(link).isSymbolicLink()).toBe(true)
    expect(readFileSync(link, 'utf8')).toBe(readFileSync(real, 'utf8'))
    expect(json(real)).toEqual({
      telemetry: { enabled: false },
      approval: { allowed_permissions: ['read', 'edit'] }
    })
  })

  it('lien symbolique cassé : refusé, rien écrit', () => {
    const { home, rules } = setup()
    mkdirSync(join(home, '.bob', 'settings'), { recursive: true })
    symlinkSync(join(home, 'absent.json'), BOB_APPROVAL_RULES.file({ home }))
    expect(rules.change({ type: 'setGroup', group: 'edit', enabled: true })).toMatchObject({
      ok: false,
      error: { code: 'unreadable' }
    })
    expect(existsSync(join(home, 'absent.json'))).toBe(false)
  })
})

describe('règles d’approbation de Bob : « Autoriser partout » et groupes (fiche 215)', () => {
  it('première fois : ajoute aussi le groupe `execute` (read recopié) et le dit', () => {
    const { file, rules } = setup('{}')
    const first = ok(rules.change({ type: 'allowCommandEverywhere', prefix: 'npm test' }))
    expect(first.notice).toEqual({ prefix: 'npm test', singleWord: false, executeGroup: 'added' })
    expect(approvalOf(file)['allowed_permissions']).toEqual(['read', 'execute'])
    expect(executor(file)?.['approvedCommands']).toEqual([
      ...BOB_DEFAULT_ALLOWED_COMMANDS,
      'npm test'
    ])
    expect(first.rules.groups.find((g) => g.id === 'execute')?.enabled).toBe(true)
    const second = ok(rules.change({ type: 'allowCommandEverywhere', prefix: 'npm run build' }))
    expect(second.notice.executeGroup).toBe('already')
    expect(approvalOf(file)['allowed_permissions']).toEqual(['read', 'execute'])
  })

  it('commande refusée partout puis autorisée : retirée des refusées', () => {
    const { file, rules } = setup(BOB_IDE_FILE)
    ok(rules.change({ type: 'allowCommandEverywhere', prefix: 'rm' }))
    expect(executor(file)).toMatchObject({ deniedCommands: [] })
    expect(approvalOf(file)['allowed_permissions']).toEqual(['read', 'edit', 'execute'])
  })

  it('`execute` interdit par l’administration : commande ajoutée, groupe jamais permis', () => {
    const { file, rules } = setup('{ "approval": { "forbiddenApprovalGroups": ["execute"] } }')
    const result = ok(rules.change({ type: 'allowCommandEverywhere', prefix: 'npm test' }))
    expect(result.notice.executeGroup).toBe('forbidden')
    expect(approvalOf(file)['allowed_permissions']).toBeUndefined()
    expect(approvalOf(file)['forbiddenApprovalGroups']).toEqual(['execute'])
  })

  it('groupe interdit : refusé (erreur typée), rien écrit ; le couper reste possible', () => {
    const content =
      '{ "approval": { "allowed_permissions": ["read", "edit"], "forbiddenApprovalGroups": ["edit", "mcp"] } }'
    const { file, rules, home } = setup(content)
    expect(rules.change({ type: 'setGroup', group: 'mcp', enabled: true })).toMatchObject({
      ok: false,
      error: { code: 'forbidden-group', detail: 'mcp' }
    })
    expect(readFileSync(file, 'utf8')).toBe(content)
    expect(readdirSync(join(home, '.bob', 'settings'))).toEqual(['settings.json'])
    ok(rules.change({ type: 'setGroup', group: 'edit', enabled: false }))
    expect(approvalOf(file)).toEqual({
      allowed_permissions: ['read'],
      forbiddenApprovalGroups: ['edit', 'mcp']
    })
  })

  it('activer / couper un groupe ; groupes inconnus gardés ; défaut `read` recopié', () => {
    const { file, rules } = setup('{ "approval": {} }')
    ok(rules.change({ type: 'setGroup', group: 'todo', enabled: true }))
    expect(approvalOf(file)['allowed_permissions']).toEqual(['read', 'todo'])
    const same = ok(rules.change({ type: 'setGroup', group: 'todo', enabled: true }))
    expect(same.notice.unchanged).toBe(true)
    ok(rules.change({ type: 'setGroup', group: 'read', enabled: false }))
    expect(approvalOf(file)['allowed_permissions']).toEqual(['todo'])
    const other = setup('{ "approval": { "allowed_permissions": ["groupe-futur"] } }')
    ok(other.rules.change({ type: 'setGroup', group: 'edit', enabled: true }))
    expect(approvalOf(other.file)['allowed_permissions']).toEqual(['groupe-futur', 'edit'])
  })

  it('hors du dossier : interrupteur global et option par groupe', () => {
    const { file, rules } = setup(
      '{ "approval": { "permissionOptions": [{ "groupId": "edit", "enableOutsideWorkspace": false, "futur": true }] } }'
    )
    ok(rules.change({ type: 'setOutsideWorkspaceAllowed', enabled: true }))
    expect(approvalOf(file)['outsideWorkspaceAllowed']).toBe(true)
    ok(rules.change({ type: 'setGroupOutsideWorkspace', group: 'edit', enabled: true }))
    ok(rules.change({ type: 'setGroupOutsideWorkspace', group: 'read', enabled: true }))
    expect(approvalOf(file)['permissionOptions']).toEqual([
      { groupId: 'edit', enableOutsideWorkspace: true, futur: true },
      { groupId: 'read', enableOutsideWorkspace: true }
    ])
    ok(rules.change({ type: 'setGroupOutsideWorkspace', group: 'read', enabled: false }))
    expect(approvalOf(file)['permissionOptions']).toEqual([
      { groupId: 'edit', enableOutsideWorkspace: true, futur: true },
      { groupId: 'read', enableOutsideWorkspace: false }
    ])
    const absent = ok(
      rules.change({ type: 'setGroupOutsideWorkspace', group: 'mcp', enabled: false })
    )
    expect(absent.notice.unchanged).toBe(true)
    ok(rules.change({ type: 'setOutsideWorkspaceAllowed', enabled: false }))
    expect(approvalOf(file)['outsideWorkspaceAllowed']).toBe(false)
    const v = view(rules)
    expect(v.groups.find((g) => g.id === 'edit')?.outsideWorkspace).toBe(true)
  })

  it('`forbiddenApprovalGroups` n’est jamais écrit, quel que soit le changement', () => {
    const { file, rules } = setup('{}')
    ok(rules.change({ type: 'allowCommandEverywhere', prefix: 'npm test' }))
    ok(rules.change({ type: 'setGroup', group: 'edit', enabled: true }))
    ok(rules.change({ type: 'setOutsideWorkspaceAllowed', enabled: true }))
    ok(rules.change({ type: 'setGroupOutsideWorkspace', group: 'edit', enabled: true }))
    ok(rules.change({ type: 'addCommand', prefix: 'rm', list: 'denied' }))
    expect('forbiddenApprovalGroups' in approvalOf(file)).toBe(false)
  })
})

describe('règles d’approbation de Bob : écritures concurrentes (fiche 215)', () => {
  it('fichier modifié entre la lecture et l’écriture : relu, changement refait dessus', () => {
    let file = ''
    let once = true
    const hooks: ApprovalRulesHooks = {
      beforeWrite: () => {
        if (!once) return
        once = false
        // Bob IDE ajoute une commande pendant ce temps.
        const data = json(file) as {
          approval: { allowedExecutors: { approvedCommands: string[] }[] }
        }
        data.approval.allowedExecutors[0]?.approvedCommands.push('banc-ide')
        writeFileSync(file, JSON.stringify(data, null, 2))
      }
    }
    const setupResult = setup(BOB_IDE_FILE, hooks)
    file = setupResult.file
    ok(setupResult.rules.change({ type: 'addCommand', prefix: 'banc-externe', list: 'allowed' }))
    // Les deux restent, comme Bob IDE le fait de son côté (fiche 213).
    expect(executor(file)?.['approvedCommands']).toEqual([
      'ls',
      'npm test',
      'banc-ide',
      'banc-externe'
    ])
  })

  it('fichier créé par un autre outil pendant ce temps : relu aussi', () => {
    let home = ''
    let once = true
    const hooks: ApprovalRulesHooks = {
      beforeWrite: () => {
        if (!once) return
        once = false
        mkdirSync(join(home, '.bob', 'settings'), { recursive: true })
        writeFileSync(BOB_APPROVAL_RULES.file({ home }), '{ "licenseConsent": true }')
      }
    }
    const s = setup(undefined, hooks)
    home = s.home
    ok(s.rules.change({ type: 'setGroup', group: 'edit', enabled: true }))
    expect(json(s.file)).toEqual({
      licenseConsent: true,
      approval: { allowed_permissions: ['read', 'edit'] }
    })
  })

  it('fichier modifié à chaque essai : erreur typée, rien écrit par Bobine', () => {
    let file = ''
    let n = 0
    const hooks: ApprovalRulesHooks = {
      beforeWrite: () => writeFileSync(file, JSON.stringify({ n: ++n }))
    }
    const s = setup('{}', hooks)
    file = s.file
    expect(s.rules.change({ type: 'setGroup', group: 'edit', enabled: true })).toMatchObject({
      ok: false,
      error: { code: 'changed' }
    })
    expect(json(file)).toEqual({ n: 3 })
    expect(existsSync(`${file}${BACKUP_SUFFIX}`)).toBe(false)
  })

  it('fichier abîmé pendant ce temps : erreur typée, jamais écrasé', () => {
    let file = ''
    const hooks: ApprovalRulesHooks = { beforeWrite: () => writeFileSync(file, '{ abîmé') }
    const s = setup('{}', hooks)
    file = s.file
    expect(s.rules.change({ type: 'setGroup', group: 'edit', enabled: true })).toMatchObject({
      ok: false,
      error: { code: 'invalid-json' }
    })
    expect(readFileSync(file, 'utf8')).toBe('{ abîmé')
  })
})

describe('règles d’approbation : profils et IPC (fiche 215)', () => {
  it('seuls les profils qui déclarent le format ; arguments du renderer vérifiés', () => {
    const home = mkdtempSync(join(tmpdir(), 'bob-approval-home-'))
    const settings = new ApprovalRulesSettings(
      [{ id: 'bob', approvalRules: BOB_APPROVAL_RULES }, { id: 'opencode' }],
      { home }
    )
    const handlers = approvalRulesHandlers(settings)
    expect(handlers['approvalRules:get']('opencode')).toEqual({
      ok: false,
      error: { code: 'unsupported' }
    })
    const read = handlers['approvalRules:get']('bob')
    expect(read).toMatchObject({ ok: true, rules: { file: '~/.bob/settings/settings.json' } })
    expect(() => handlers['approvalRules:get']('')).toThrow(/profileId/)
    expect(() =>
      handlers['approvalRules:change']('bob', {
        type: 'setGroup',
        group: 'root',
        enabled: true
      } as never)
    ).toThrow(/change/)
    expect(() => handlers['approvalRules:change']('bob', { type: 'effacerTout' } as never)).toThrow(
      /change/
    )
    const changed = handlers['approvalRules:change']('bob', {
      type: 'allowCommandEverywhere',
      prefix: 'npm test'
    })
    expect(changed).toMatchObject({ ok: true, notice: { executeGroup: 'added' } })
    expect(approvalOf(BOB_APPROVAL_RULES.file({ home }))['allowed_permissions']).toEqual([
      'read',
      'execute'
    ])
    // Sans réglages (essais de l'IPC) : rien n'est lu ni écrit.
    expect(approvalRulesHandlers(undefined)['approvalRules:get']('bob')).toEqual({
      ok: false,
      error: { code: 'unsupported' }
    })
  })
})

describe('commandes refusées partout, pour les outils de l’app (fiche 215, recette QA)', () => {
  it('relues à chaque appel ; profil sans règles ou fichier illisible : rien de refusé', () => {
    const { home, file } = setup('{}')
    const denied = deniedCommandOf({ id: 'bob', approvalRules: BOB_APPROVAL_RULES }, home)
    expect(denied?.('node --version', '/w')).toBeUndefined()
    writeFileSync(
      file,
      JSON.stringify({
        approval: {
          allowedExecutors: [
            {
              toolId: 'execute_command',
              approvedCommands: ['node'],
              deniedCommands: ['node --version']
            }
          ]
        }
      })
    )
    expect(denied?.('npm test && node --version', '/w')).toBe('node --version')
    expect(denied?.('node script.js', '/w')).toBeUndefined()
    writeFileSync(file, '{ abîmé')
    expect(denied?.('node --version', '/w')).toBeUndefined()
    expect(deniedCommandOf({ id: 'opencode' }, home)).toBeUndefined()
  })
})
