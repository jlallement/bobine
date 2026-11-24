import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  symlinkSync,
  utimesSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { builtinRoles } from './builtin'
import { rolesHandlers } from './ipc'
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
    // Fiche 262 : Expert UX/UI est un rôle de conseil (il propose, un autre applique).
    expect(roles.filter((r) => r.readOnly).map((r) => r.name)).toEqual([
      'code-reviewer',
      'security-expert',
      'tech-lead',
      'ux-ui-expert'
    ])
    // Aucun agent, mode ni modèle imposé (ADR-0011).
    expect(roles.some((r) => r.agent || r.mode || r.model)).toBe(false)
  })

  it('fiche 262 : Expert UX/UI fourni suit la lecture seule ; une copie modifiée par l’utilisateur garde la sienne', () => {
    const { library, userDir } = setup()
    // Sans copie : la valeur fournie, relue à chaque lecture (rien n'est copié sur le disque).
    expect(library.find(undefined, 'ux-ui-expert')).toMatchObject({
      scope: 'builtin',
      readOnly: true
    })
    // Copie enregistrée depuis Réglages › Rôles (seulement après une modification) : elle reste.
    writeFileSync(join(userDir, 'ux-ui-expert.md'), file('Mon designer, qui code'))
    expect(library.find(undefined, 'ux-ui-expert')).toMatchObject({
      scope: 'user',
      readOnly: false
    })
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
      error: {
        code: 'nameTaken',
        field: 'name',
        taken: { label: 'Rédacteur', scope: 'user' },
        suggestion: 'doc-writer-2'
      }
    })
    expect(
      library.save('user', { ...draft, name: 'doc' }, undefined, { previousName: 'doc-writer' })
    ).toMatchObject({ ok: true })
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

  it('modifier : la description réécrite dans le fichier, le reste gardé ; supprimer le rôle du projet fait revenir le fourni', () => {
    // Remplace l'e2e `roles-gestion` n° 17 et 19 sur un vrai dossier.
    const { library, project, projectDir } = setup()
    const reviewer = library.find(project, 'code-reviewer')
    expect(reviewer?.scope).toBe('builtin')
    const draft = {
      name: 'code-reviewer',
      label: 'Relecteur du projet',
      icon: reviewer?.icon ?? 'bot',
      color: reviewer?.color ?? 'blue',
      description: 'Relit les PR du projet.',
      readOnly: true,
      prompt: 'Review the diff.'
    }
    // Fichier du projet posé à la main (partagé par git), comme dans le dépôt d'essai.
    writeFileSync(
      join(projectDir, 'code-reviewer.md'),
      `---\nlabel: ${draft.label}\ndescription: ${draft.description}\nread-only: true\n---\n${draft.prompt}\n`
    )
    expect(library.find(project, 'code-reviewer')?.scope).toBe('project')
    expect(
      library.save('project', { ...draft, description: 'Relit chaque commit.' }, project, {
        previousName: 'code-reviewer'
      })
    ).toMatchObject({ ok: true })
    const text = readFileSync(join(projectDir, 'code-reviewer.md'), 'utf8')
    expect(text).toContain('description: Relit chaque commit.')
    expect(text).not.toContain('Relit les PR du projet.')
    expect(text).toContain('label: Relecteur du projet')
    expect(text).toContain('Review the diff.')
    expect(library.remove('project', 'code-reviewer', project)).toBe(true)
    expect(existsSync(join(projectDir, 'code-reviewer.md'))).toBe(false)
    expect(library.list(project).roles.filter((r) => r.scope !== 'builtin')).toEqual([])
    expect(library.find(project, 'code-reviewer')?.scope).toBe('builtin')
  })

  it('n’écrit jamais à travers un lien du projet (relecture)', () => {
    const { library, root, project, projectDir } = setup()
    const victim = join(root, 'zshrc')
    writeFileSync(victim, 'intact')
    const draft = { name: 'x', description: 'd', prompt: 'p', readOnly: false }
    // `<nom>.md` lien vers un fichier de l'utilisateur.
    symlinkSync(victim, join(projectDir, 'x.md'))
    expect(library.save('project', draft, project)).toEqual({
      ok: false,
      error: { code: 'link', field: 'name' }
    })
    expect(readFileSync(victim, 'utf8')).toBe('intact')
    // `.bobine/roles` lien vers un autre dossier.
    const elsewhere = join(root, 'ailleurs')
    mkdirSync(elsewhere)
    const linked = join(root, 'projet-lien')
    mkdirSync(join(linked, '.bobine'), { recursive: true })
    symlinkSync(elsewhere, join(linked, '.bobine', 'roles'))
    expect(library.save('project', draft, linked)).toMatchObject({
      ok: false,
      error: { code: 'link' }
    })
    expect(existsSync(join(elsewhere, 'x.md'))).toBe(false)
    writeFileSync(join(elsewhere, 'y.md'), file('Lien'))
    expect(library.find(linked, 'y')).toBeUndefined()
    expect(library.remove('project', 'y', linked)).toBe(false)
    expect(existsSync(join(elsewhere, 'y.md'))).toBe(true)
  })

  it('n’écrase pas le fichier d’un autre rôle (nom déclaré dans l’en-tête)', () => {
    const { library, userDir } = setup()
    // `a.md` déclare le rôle `autre` : enregistrer le rôle `a` écraserait ce fichier.
    writeFileSync(join(userDir, 'a.md'), `---\nname: autre\ndescription: d\n---\np\n`)
    const result = library.save('user', {
      name: 'a',
      description: 'd',
      prompt: 'p',
      readOnly: false
    })
    expect(result).toEqual({ ok: false, error: { code: 'duplicateName', field: 'name' } })
    expect(readFileSync(join(userDir, 'a.md'), 'utf8')).toContain('name: autre')
  })

  // Fiche 268 : « le second rôle de même icône écrase le premier ». L'identifiant d'un rôle est son
  // nom (`<nom>.md`), jamais l'icône ; ce qui cachait un rôle sans un mot, c'était un nom déjà pris
  // dans une autre portée (projet > personnel > fourni).
  describe('collisions à la création (fiche 268)', () => {
    const role = (name: string, extra: Record<string, unknown> = {}) => ({
      name,
      label: name,
      icon: 'shield-check',
      color: 'orange' as const,
      description: `Rôle ${name}.`,
      readOnly: true,
      prompt: `Consigne de ${name}.`,
      ...extra
    })

    it('deux rôles de même icône et même couleur, noms différents : tous deux gardés', () => {
      const { library, userDir } = setup()
      expect(library.save('user', role('expert-web', { label: 'Expert web' }))).toMatchObject({
        ok: true
      })
      expect(library.save('user', role('expert-mobile', { label: 'Expert mobile' }))).toMatchObject(
        { ok: true }
      )
      expect(readFileSync(join(userDir, 'expert-web.md'), 'utf8')).toContain(
        'Consigne de expert-web.'
      )
      expect(readFileSync(join(userDir, 'expert-mobile.md'), 'utf8')).toContain(
        'Consigne de expert-mobile.'
      )
      const mine = library.active().filter((r) => r.scope === 'user')
      expect(mine.map((r) => [r.name, r.icon, r.color])).toEqual([
        ['expert-mobile', 'shield-check', 'orange'],
        ['expert-web', 'shield-check', 'orange']
      ])
    })

    it('même libellé, identifiants différents : deux rôles (le libellé n’est pas une clé)', () => {
      const { library } = setup()
      library.save('user', role('expert', { label: 'Expert' }))
      expect(library.save('user', role('expert-2', { label: 'Expert' }))).toMatchObject({
        ok: true
      })
      expect(library.active().filter((r) => r.label === 'Expert')).toHaveLength(2)
    })

    it('identifiant d’un rôle fourni : refusé à la création, sauf « Enregistrer en personnel »', () => {
      const { library, userDir } = setup()
      expect(library.save('user', role('security-expert'))).toEqual({
        ok: false,
        error: {
          code: 'nameTaken',
          field: 'name',
          taken: { label: expect.any(String) as string, scope: 'builtin' },
          suggestion: 'security-expert-2'
        }
      })
      expect(existsSync(join(userDir, 'security-expert.md'))).toBe(false)
      expect(library.find(undefined, 'security-expert')?.scope).toBe('builtin')
      // Le geste explicite de l'écran d'un rôle fourni le remplace (ADR-0045), comme avant.
      expect(
        library.save('user', role('security-expert'), undefined, {
          replaceBuiltin: 'security-expert'
        })
      ).toMatchObject({ ok: true })
      expect(library.find(undefined, 'security-expert')?.scope).toBe('user')
      // Une seconde fois : le personnel existe, refusé.
      expect(
        library.save('user', role('security-expert'), undefined, {
          replaceBuiltin: 'security-expert'
        })
      ).toMatchObject({ ok: false, error: { code: 'nameTaken', taken: { scope: 'user' } } })
    })

    it('rôle du projet contre rôle personnel : ni l’un ni l’autre ne cache l’autre à la création', () => {
      const { library, userDir, project, projectDir } = setup()
      library.save('user', role('expert-perf', { label: 'Perso' }))
      // Avant : écrit dans le projet, il cachait le personnel (simple remarque dans l'assistant).
      expect(library.save('project', role('expert-perf', { label: 'Projet' }), project)).toEqual({
        ok: false,
        error: {
          code: 'nameTaken',
          field: 'name',
          taken: { label: 'Perso', scope: 'user' },
          suggestion: 'expert-perf-2'
        }
      })
      expect(existsSync(join(projectDir, 'expert-perf.md'))).toBe(false)
      // Dans l'autre sens : un personnel créé pendant qu'un rôle du projet a ce nom ne serait
      // jamais visible dans ce projet (avant : sans un mot).
      library.save('project', role('relecteur', { label: 'Relecteur maison' }), project)
      expect(library.save('user', role('relecteur'), project)).toMatchObject({
        ok: false,
        error: { code: 'nameTaken', taken: { label: 'Relecteur maison', scope: 'project' } }
      })
      expect(existsSync(join(userDir, 'relecteur.md'))).toBe(false)
      expect(library.list(project).roles.find((r) => r.name === 'expert-perf')?.label).toBe('Perso')
    })

    it('renommer vers un identifiant pris : refusé, le rôle reste où il était', () => {
      const { library, userDir } = setup()
      library.save('user', role('a'))
      library.save('user', role('b'))
      expect(library.save('user', role('b'), undefined, { previousName: 'a' })).toMatchObject({
        ok: false,
        error: { code: 'nameTaken', suggestion: 'b-2' }
      })
      expect(
        library.save('user', role('code-reviewer'), undefined, { previousName: 'a' })
      ).toMatchObject({
        ok: false,
        error: { code: 'nameTaken', taken: { scope: 'builtin' } }
      })
      expect(readFileSync(join(userDir, 'a.md'), 'utf8')).toContain('Consigne de a.')
      // Garder son nom en modifiant le reste : permis (ce n'est pas une création).
      expect(
        library.save('user', role('a', { icon: 'bug' }), undefined, { previousName: 'a' })
      ).toMatchObject({ ok: true })
    })

    it('suggestion libre : évite les noms pris et les fichiers déjà là', () => {
      const { library, userDir } = setup()
      library.save('user', role('qa'))
      library.save('user', role('qa-2'))
      writeFileSync(join(userDir, 'qa-3.md'), 'pas un rôle')
      expect(library.save('user', role('qa'))).toMatchObject({
        error: { code: 'nameTaken', suggestion: 'qa-4' }
      })
      expect(library.save('user', role('qa-2'))).toMatchObject({
        error: { code: 'nameTaken', suggestion: 'qa-4' }
      })
    })

    it('`replaceBuiltin` n’exempte que le rôle fourni de ce nom, sous ce nom (revue QA)', () => {
      const { library, userDir } = setup()
      // Le nom d'un autre rôle fourni ne vaut pas permission.
      expect(
        library.save('user', role('code-reviewer'), undefined, { replaceBuiltin: 'tech-lead' })
      ).toMatchObject({ ok: false, error: { code: 'nameTaken', taken: { scope: 'builtin' } } })
      // L'ancien drapeau booléen (écran d'avant, IPC forgée) n'exempte plus rien.
      expect(
        library.save('user', role('code-reviewer'), undefined, {
          replaceBuiltin: true as unknown as string
        })
      ).toMatchObject({ ok: false, error: { code: 'nameTaken' } })
      // Le bon rôle fourni, mais un autre identifiant : une création, refusée si prise.
      library.save('user', role('mine'))
      expect(
        library.save('user', role('mine'), undefined, { replaceBuiltin: 'mine' })
      ).toMatchObject({ ok: false, error: { code: 'nameTaken', taken: { scope: 'user' } } })
      expect(existsSync(join(userDir, 'code-reviewer.md'))).toBe(false)
    })

    it('IPC forgée : un `previousName` absent de la portée ne fait pas sauter le contrôle', () => {
      const { library, userDir, project } = setup()
      library.save('project', role('relecteur', { label: 'Relecteur maison' }), project)
      const handlers = rolesHandlers({ library, folderOf: () => project })
      // Ni `code-reviewer` ni `relecteur` n'existent en personnel : ce n'est pas un renommage.
      expect(
        handlers['roles:save']('user', role('code-reviewer'), {
          conversationId: 'c',
          previousName: 'code-reviewer'
        })
      ).toMatchObject({ ok: false, error: { code: 'nameTaken', taken: { scope: 'builtin' } } })
      expect(
        handlers['roles:save']('user', role('relecteur'), {
          conversationId: 'c',
          previousName: 'relecteur'
        })
      ).toMatchObject({ ok: false, error: { code: 'nameTaken', taken: { scope: 'project' } } })
      expect(() =>
        handlers['roles:save']('user', role('x'), { replaceBuiltin: true as unknown as string })
      ).toThrow()
      expect(existsSync(join(userDir, 'code-reviewer.md'))).toBe(false)
      expect(existsSync(join(userDir, 'relecteur.md'))).toBe(false)
    })

    it('suggestion du main : rôles cachés et fichiers non lus compris, long nombre gardé', () => {
      const { library, userDir, project, projectDir } = setup()
      // `qa-2` personnel caché par `qa-2` du projet : son nom reste pris.
      library.save('user', role('qa'))
      writeFileSync(join(userDir, 'qa-2.md'), file('Caché', 'name: qa-2\n'))
      writeFileSync(join(projectDir, 'qa-2.md'), file('Projet', 'name: qa-2\n'))
      // Fichier écarté (en-tête faux) : son nom de fichier reste pris.
      writeFileSync(join(userDir, 'qa-3.md'), 'pas un rôle')
      expect(library.suggestName('user', 'qa', project)).toBe('qa-4')
      library.save('user', role('release-2024'))
      expect(library.suggestName('user', 'release-2024')).toBe('release-2024-2')
    })
  })
})
