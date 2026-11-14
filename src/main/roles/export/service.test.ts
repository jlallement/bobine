import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import type { RoleDefinition } from '@shared/roles'
import { backupFile } from './backup'
import { BOB_CUSTOM_MODES } from './bob-custom-modes'
import { OPENCODE_AGENTS } from './opencode-agents'
import { RoleExportRegistry } from './registry'
import { RoleExports, roleToExport, type ExportProfile } from './service'

/** Tout se passe dans un dossier jetable : jamais le vrai ~/.bob ni ~/.config/opencode. */
let root: string
let home: string
let project: string
let data: string

const PROFILES: ExportProfile[] = [
  { id: 'bob', label: 'IBM Bob', roleExport: BOB_CUSTOM_MODES },
  { id: 'opencode', label: 'OpenCode', roleExport: OPENCODE_AGENTS },
  { id: 'other', label: 'Autre' }
]

const definition: RoleDefinition = {
  name: 'code-reviewer',
  label: 'Code reviewer',
  icon: 'scan-eye',
  color: 'blue',
  description: 'Reviews a change before merge.',
  readOnly: true,
  prompt: 'You are a strict code reviewer.'
}
const role = (changes: Partial<RoleDefinition> = {}, scope: 'user' | 'project' = 'user') =>
  roleToExport({ ...definition, ...changes, scope })

let writes = 0
function service(beforeWrite?: () => void) {
  return new RoleExports({
    profiles: () => PROFILES,
    locations: { home },
    registry: new RoleExportRegistry(join(data, 'role-exports.json')),
    backupDir: join(data, 'backups'),
    beforeWrite: () => {
      writes++
      beforeWrite?.()
    }
  })
}

const bobFile = () => join(home, '.bob', 'settings', 'custom_modes.yaml')
const bobProjectFile = () => join(project, '.bob', 'custom_modes.yaml')
const openCodeFile = (id = 'code-reviewer') =>
  join(home, '.config', 'opencode', 'agents', `${id}.md`)
/** Premier élément d'une liste, ou échec du test. */
function first<T>(list: readonly T[]): T {
  const item = list[0]
  if (item === undefined) throw new Error('liste vide')
  return item
}

const backups = () => (existsSync(join(data, 'backups')) ? readdirSync(join(data, 'backups')) : [])

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'bobine-export-'))
  home = join(root, 'home')
  project = join(root, 'projet')
  data = join(root, 'data')
  for (const dir of [home, project, data]) mkdirSync(dir)
  writes = 0
})
afterEach(() => rmSync(root, { recursive: true, force: true }))

const userTarget = (profileId = 'bob') => ({ profileId, scope: 'user' as const })

describe('installer un rôle dans Bob', () => {
  it('aperçu : chemins, portée du rôle par défaut, texte exact', () => {
    const preview = service().preview(role({}, 'project'), 'bob', project)
    expect(preview).toMatchObject({
      profileLabel: 'IBM Bob',
      format: 'bob-custom-modes',
      id: 'code-reviewer',
      defaultScope: 'project',
      places: [
        { scope: 'user', file: '~/.bob/settings/custom_modes.yaml', exists: false },
        { scope: 'project', file: '.bob/custom_modes.yaml', exists: false }
      ]
    })
    expect(preview.text).toContain('slug: code-reviewer')
    expect(
      service()
        .preview(role(), 'bob')
        .places.map((p) => p.scope)
    ).toEqual(['user'])
    expect(service().preview(role(), 'bob', project).defaultScope).toBe('user')
  })

  it('installe, dit « à jour », puis « le rôle a changé » et met à jour', () => {
    const exports = service()
    const result = exports.install(role(), userTarget(), undefined, { useInBobine: true })
    expect(result).toMatchObject({ ok: true, status: { state: 'upToDate', scope: 'user' } })
    const value = parse(readFileSync(bobFile(), 'utf8')) as { customModes: { slug: string }[] }
    expect(value.customModes.map((m) => m.slug)).toEqual(['code-reviewer'])
    expect(backups()).toEqual([]) // fichier neuf : rien à copier

    const changed = role({ prompt: 'You are an even stricter code reviewer.' })
    expect(exports.status(changed)).toMatchObject([{ state: 'roleChanged', profileId: 'bob' }])
    // Icône ou couleur : rien qui entre dans Bob.
    expect(exports.status(role({ color: 'pink' }))).toMatchObject([{ state: 'upToDate' }])
    expect(exports.install(changed, userTarget(), undefined, { useInBobine: true })).toMatchObject({
      ok: true,
      status: { state: 'upToDate' }
    })
    expect(readFileSync(bobFile(), 'utf8')).toContain('even stricter')
    expect(backups()).toHaveLength(1)
    expect(readFileSync(join(data, 'backups', first(backups())), 'utf8')).toContain(
      'You are a strict'
    )
  })

  it('garde les autres modes et les commentaires du fichier, copie avant d’écrire', () => {
    mkdirSync(join(home, '.bob', 'settings'), { recursive: true })
    const original = '# à moi\ncustomModes:\n  - slug: traducteur # le mien\n    name: Traducteur\n'
    writeFileSync(bobFile(), original)
    expect(service().install(role(), userTarget(), undefined, { useInBobine: false }).ok).toBe(true)
    const text = readFileSync(bobFile(), 'utf8')
    expect(text.startsWith(original)).toBe(true)
    expect(readFileSync(join(data, 'backups', first(backups())), 'utf8')).toBe(original)
    expect(backups()[0]).toMatch(/-bob-custom-modes-custom_modes\.yaml$/)
    expect(service().remove(first(service().status(role())).key)).toEqual({ ok: true })
    expect(readFileSync(bobFile(), 'utf8')).toBe(original)
  })

  it('conflit : un mode du même nom que Bobine n’a pas écrit n’est jamais touché', () => {
    mkdirSync(join(project, '.bob'), { recursive: true })
    const theirs = 'customModes:\n  - slug: code-reviewer\n    name: Le mien\n'
    writeFileSync(bobProjectFile(), theirs)
    const result = service().install(role(), { profileId: 'bob', scope: 'project' }, project, {
      useInBobine: true
    })
    expect(result).toEqual({
      ok: false,
      error: { code: 'foreign', detail: 'code-reviewer', file: '.bob/custom_modes.yaml' }
    })
    expect(readFileSync(bobProjectFile(), 'utf8')).toBe(theirs)
    expect(backups()).toEqual([])
    expect(service().status(role(), project)).toEqual([])
  })

  it('modifié à la main : dit, rien sans confirmation ; remplacé ou retiré si confirmé', () => {
    const exports = service()
    exports.install(role(), userTarget(), undefined, { useInBobine: false })
    const edited = readFileSync(bobFile(), 'utf8').replace('Code reviewer', 'Mon relecteur')
    writeFileSync(bobFile(), edited)
    expect(exports.status(role())).toMatchObject([{ state: 'handEdited' }])
    expect(exports.install(role(), userTarget(), undefined, { useInBobine: false })).toMatchObject({
      ok: false,
      error: { code: 'handEdited' }
    })
    const key = first(exports.status(role())).key
    expect(exports.remove(key)).toMatchObject({ ok: false, error: { code: 'handEdited' } })
    expect(readFileSync(bobFile(), 'utf8')).toBe(edited)
    expect(
      exports.install(role(), userTarget(), undefined, { useInBobine: false, overwrite: true })
    ).toMatchObject({ ok: true, status: { state: 'upToDate' } })
    writeFileSync(bobFile(), readFileSync(bobFile(), 'utf8').replace('Code reviewer', 'X'))
    expect(exports.remove(key, true)).toEqual({ ok: true })
    expect(parse(readFileSync(bobFile(), 'utf8'))).toEqual({ customModes: [] })
    expect(exports.status(role())).toEqual([])
  })

  it('entrée retirée à la main : « absent », la mise à jour la remet', () => {
    const exports = service()
    exports.install(role(), userTarget(), undefined, { useInBobine: false })
    writeFileSync(bobFile(), 'customModes: []\n')
    expect(exports.status(role())).toMatchObject([{ state: 'missing' }])
    expect(exports.install(role(), userTarget(), undefined, { useInBobine: false }).ok).toBe(true)
    expect(exports.status(role())).toMatchObject([{ state: 'upToDate' }])
  })

  it('noms réservés de Bob refusés, sans rien écrire', () => {
    for (const name of ['agent', 'plan', 'ask']) {
      expect(
        service().install(role({ name }), userTarget(), undefined, { useInBobine: false })
      ).toEqual({ ok: false, error: { code: 'reserved', detail: name } })
      expect(service().preview(role({ name }), 'bob').error).toEqual({
        code: 'reserved',
        detail: name
      })
    }
    expect(existsSync(bobFile())).toBe(false)
  })

  it('liens refusés : le fichier, ou un dossier du projet', () => {
    const elsewhere = join(root, 'ailleurs')
    mkdirSync(elsewhere)
    writeFileSync(join(elsewhere, 'modes.yaml'), 'customModes: []\n')
    mkdirSync(join(home, '.bob', 'settings'), { recursive: true })
    symlinkSync(join(elsewhere, 'modes.yaml'), bobFile())
    expect(
      service().install(role(), userTarget(), undefined, { useInBobine: false })
    ).toMatchObject({ ok: false, error: { code: 'link' } })
    symlinkSync(elsewhere, join(project, '.bob'))
    expect(
      service().install(role(), { profileId: 'bob', scope: 'project' }, project, {
        useInBobine: false
      })
    ).toMatchObject({ ok: false, error: { code: 'link' } })
    expect(readFileSync(join(elsewhere, 'modes.yaml'), 'utf8')).toBe('customModes: []\n')
  })

  it('fichier illisible : jamais réécrit', () => {
    mkdirSync(join(home, '.bob', 'settings'), { recursive: true })
    writeFileSync(bobFile(), 'customModes: [\n')
    expect(
      service().install(role(), userTarget(), undefined, { useInBobine: false })
    ).toMatchObject({ ok: false, error: { code: 'invalidFile' } })
    expect(readFileSync(bobFile(), 'utf8')).toBe('customModes: [\n')
  })

  it('fichier changé pendant l’écriture : refait sur la nouvelle version', () => {
    mkdirSync(join(home, '.bob', 'settings'), { recursive: true })
    writeFileSync(bobFile(), 'customModes: []\n')
    let once = true
    const exports = service(() => {
      if (!once) return
      once = false
      writeFileSync(bobFile(), 'customModes:\n  - slug: ide\n    name: Bob IDE\n')
    })
    expect(exports.install(role(), userTarget(), undefined, { useInBobine: false }).ok).toBe(true)
    const value = parse(readFileSync(bobFile(), 'utf8')) as { customModes: { slug: string }[] }
    expect(value.customModes.map((m) => m.slug)).toEqual(['ide', 'code-reviewer'])
    expect(writes).toBe(2)
  })
})

describe('installer un rôle dans OpenCode', () => {
  it('écrit le fichier de l’agent ; un fichier qui n’est pas à Bobine n’est pas touché', () => {
    const exports = service()
    expect(
      exports.install(role(), userTarget('opencode'), undefined, { useInBobine: true })
    ).toMatchObject({ ok: true, status: { file: '~/.config/opencode/agents/code-reviewer.md' } })
    expect(readFileSync(openCodeFile(), 'utf8')).toContain('mode: primary')
    writeFileSync(openCodeFile('security'), 'à moi\n')
    expect(
      exports.install(role({ name: 'security' }), userTarget('opencode'), undefined, {
        useInBobine: false
      })
    ).toMatchObject({ ok: false, error: { code: 'foreign' } })
    expect(readFileSync(openCodeFile('security'), 'utf8')).toBe('à moi\n')
  })

  it('retirer supprime le fichier, après une copie', () => {
    const exports = service()
    exports.install(role(), userTarget('opencode'), undefined, { useInBobine: false })
    expect(exports.remove(first(exports.status(role())).key)).toEqual({ ok: true })
    expect(existsSync(openCodeFile())).toBe(false)
    expect(backups()).toHaveLength(1)
  })

  it('noms réservés d’OpenCode refusés', () => {
    for (const name of ['build', 'plan', 'general', 'explore']) {
      expect(
        service().install(role({ name }), userTarget('opencode'), undefined, {
          useInBobine: false
        })
      ).toMatchObject({ ok: false, error: { code: 'reserved' } })
    }
  })
})

describe('mode natif pour Bobine (useInBobine)', () => {
  it('seulement coché, pour ce profil ; le projet seulement dans son dossier, préféré', () => {
    const exports = service()
    expect(exports.nativeMode('bob', 'code-reviewer')).toBeUndefined()
    exports.install(role(), userTarget(), undefined, { useInBobine: false })
    expect(exports.nativeMode('bob', 'code-reviewer')).toBeUndefined()
    exports.install(role(), userTarget(), undefined, { useInBobine: true })
    expect(exports.nativeMode('bob', 'code-reviewer')).toEqual({
      id: 'code-reviewer',
      readOnly: true
    })
    expect(exports.nativeMode('opencode', 'code-reviewer')).toBeUndefined()
    exports.install(role({ readOnly: false }), { profileId: 'bob', scope: 'project' }, project, {
      useInBobine: true
    })
    expect(exports.nativeMode('bob', 'code-reviewer', project)).toEqual({
      id: 'code-reviewer',
      readOnly: false
    })
    expect(exports.nativeMode('bob', 'code-reviewer', join(root, 'autre'))?.readOnly).toBe(true)
  })
})

describe('registre et copies', () => {
  it('registre illisible : repart vide, rien de ce que Bobine avait écrit n’est touché', () => {
    const exports = service()
    exports.install(role(), userTarget(), undefined, { useInBobine: false })
    writeFileSync(join(data, 'role-exports.json'), '{ abîmé')
    expect(exports.status(role())).toEqual([])
    expect(exports.install(role(), userTarget(), undefined, { useInBobine: false })).toMatchObject({
      ok: false,
      error: { code: 'foreign' }
    })
  })

  it('copies datées, en nombre borné', () => {
    const dir = join(data, 'copies')
    for (let i = 0; i < 5; i++) {
      backupFile(dir, '/x/custom_modes.yaml', 'bob-custom-modes', `v${i}`, {
        now: new Date(Date.UTC(2026, 10, 14, 10, 0, i)),
        keep: 3
      })
    }
    const kept = readdirSync(dir).sort()
    expect(kept).toHaveLength(3)
    expect(kept.map((f) => readFileSync(join(dir, f), 'utf8'))).toEqual(['v2', 'v3', 'v4'])
    // Même seconde : un second nom, rien d'écrasé.
    const now = new Date(Date.UTC(2026, 10, 14, 11))
    const a = backupFile(dir, '/x/a.md', 'opencode-agents', 'a', { now })
    const b = backupFile(dir, '/x/a.md', 'opencode-agents', 'b', { now })
    expect(a).not.toBe(b)
  })
})
