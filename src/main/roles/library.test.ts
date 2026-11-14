import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  utimesSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { builtinRoles } from './builtin'
import { RoleLibrary } from './library'

const file = (description: string, extra = '') =>
  `---\ndescription: ${description}\n${extra}---\nConsigne : ${description}.\n`

function setup() {
  const root = mkdtempSync(join(tmpdir(), 'roles-'))
  const userDir = join(root, 'donnees', 'roles')
  const project = join(root, 'projet')
  const projectDir = join(project, '.bobine', 'roles')
  mkdirSync(userDir, { recursive: true })
  mkdirSync(projectDir, { recursive: true })
  const off = new Set<string>()
  const logs: string[] = []
  const library = new RoleLibrary({
    userDir,
    builtin: builtinRoles,
    off: () => off,
    setEnabled: (name, enabled) => (enabled ? off.delete(name) : off.add(name)),
    log: (message) => logs.push(message)
  })
  return { root, userDir, project, projectDir, library, logs }
}

describe('bibliothèque des rôles (fiche 223)', () => {
  it('les sept rôles fournis sont actifs d’office, avec leur consigne en anglais', () => {
    const { library } = setup()
    const roles = library.active()
    expect(roles.map((r) => r.name)).toEqual([
      'back-architect',
      'code-reviewer',
      'flutter-expert',
      'front-architect',
      'security-expert',
      'tech-lead',
      'ux-ui-expert'
    ])
    expect(roles.every((r) => r.scope === 'builtin' && r.enabled)).toBe(true)
    expect(roles.filter((r) => r.readOnly).map((r) => r.name)).toEqual([
      'code-reviewer',
      'security-expert',
      'tech-lead'
    ])
    // Aucun agent, mode ni modèle imposé (ADR-0011).
    expect(roles.some((r) => r.agent || r.mode || r.model)).toBe(false)
  })

  it('projet > personnel > fourni à nom égal ; un fichier invalide est signalé sans bloquer les autres', () => {
    const { library, userDir, projectDir, project } = setup()
    writeFileSync(join(userDir, 'tech-lead.md'), file('Lead perso'))
    writeFileSync(join(projectDir, 'tech-lead.md'), file('Lead du projet'))
    writeFileSync(join(projectDir, 'casse.md'), '---\ncolor: red\ndescription: x\n---\np')
    writeFileSync(join(projectDir, 'flutter.md'), file('Flutter du projet'))
    const listing = library.list(project)
    const lead = listing.roles.find((r) => r.name === 'tech-lead')
    expect(lead).toMatchObject({ scope: 'project', description: 'Lead du projet' })
    expect(lead?.hides).toEqual(['user', 'builtin'])
    expect(listing.roles.find((r) => r.name === 'flutter')?.scope).toBe('project')
    expect(listing.problems).toEqual([
      {
        scope: 'project',
        file: join(projectDir, 'casse.md'),
        error: { code: 'color', field: 'color' }
      }
    ])
    // Sans projet : le personnel l'emporte sur le fourni.
    expect(library.find(undefined, 'tech-lead')?.description).toBe('Lead perso')
  })

  it('relit à chaud un fichier modifié, ajouté ou retiré', () => {
    const { library, projectDir, project } = setup()
    const path = join(projectDir, 'doc.md')
    writeFileSync(path, file('Version 1'))
    expect(library.find(project, 'doc')?.description).toBe('Version 1')
    writeFileSync(path, file('Version 2'))
    // Même taille possible : la date suffit.
    utimesSync(path, new Date(), new Date(Date.now() + 5_000))
    expect(library.find(project, 'doc')?.description).toBe('Version 2')
    writeFileSync(join(projectDir, 'autre.md'), file('Autre'))
    expect(library.find(project, '@Autre')?.name).toBe('autre')
  })

  it('un rôle désactivé n’est plus proposé, mais reste listé', () => {
    const { library } = setup()
    library.setEnabled('tech-lead', false)
    expect(library.find(undefined, 'tech-lead')).toBeUndefined()
    expect(library.list().roles.find((r) => r.name === 'tech-lead')?.enabled).toBe(false)
    library.setEnabled('tech-lead', true)
    expect(library.find(undefined, 'tech-lead')).toBeDefined()
  })

  it('enregistre, renomme et supprime un rôle ; refuse un nom pris et un rôle invalide', () => {
    const { library, userDir, project, projectDir } = setup()
    const draft = {
      name: 'doc-writer',
      label: 'Rédacteur',
      icon: 'book-open',
      color: 'green',
      description: 'Écrit la doc.',
      readOnly: false,
      prompt: 'Write docs.'
    }
    expect(library.save('user', draft)).toMatchObject({ ok: true })
    expect(readFileSync(join(userDir, 'doc-writer.md'), 'utf8')).toContain('label: Rédacteur')
    expect(library.save('user', draft)).toEqual({
      ok: false,
      error: { code: 'duplicateName', field: 'name' }
    })
    expect(library.save('user', { ...draft, name: 'doc' }, undefined, 'doc-writer')).toMatchObject({
      ok: true
    })
    expect(existsSync(join(userDir, 'doc-writer.md'))).toBe(false)
    expect(library.find(undefined, 'doc')?.label).toBe('Rédacteur')
    expect(library.save('user', { ...draft, color: 'red' })).toMatchObject({ ok: false })
    expect(library.save('project', draft, project)).toMatchObject({ ok: true })
    expect(existsSync(join(projectDir, 'doc-writer.md'))).toBe(true)
    expect(() => library.save('project', draft)).toThrow()
    expect(library.remove('user', 'doc')).toBe(true)
    expect(library.remove('user', 'doc')).toBe(false)
    expect(library.find(undefined, 'doc')).toBeUndefined()
  })
})
