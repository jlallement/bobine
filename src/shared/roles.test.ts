import { describe, expect, it } from 'vitest'
import {
  checkRole,
  mentionedRoles,
  mergeRoles,
  parseRoleFile,
  parseRoleStamp,
  roleOpening,
  rolesParagraph,
  serializeRole,
  type Role,
  type RoleDefinition
} from './roles'

const FILE = `---
name: expert-secu
label: Expert sécu
icon: shield-check          # icône Lucide
color: orange               # une des couleurs d'accent
description: Audite la sécurité d'un changement. Ne modifie rien.
agent: opencode
mode: plan
read-only: true
mcp: [terminal, browser]
---
Tu es un expert en sécurité applicative.
Pour chaque risque : preuve, scénario, gravité, correctif.
`

const role = (name: string, scope: Role['scope'], extra: Partial<Role> = {}): Role => ({
  name,
  label: name,
  icon: 'bot',
  color: 'graphite',
  description: `${name} (${scope})`,
  readOnly: false,
  prompt: 'p',
  scope,
  ...extra
})

describe('fichier de rôle (fiche 223)', () => {
  it('lit l’en-tête (commentaires de fin, liste en ligne, booléen) et la consigne', () => {
    const parsed = parseRoleFile(FILE, 'autre-nom')
    expect(parsed).toEqual({
      ok: true,
      role: {
        name: 'expert-secu',
        label: 'Expert sécu',
        icon: 'shield-check',
        color: 'orange',
        description: "Audite la sécurité d'un changement. Ne modifie rien.",
        agent: 'opencode',
        mode: 'plan',
        readOnly: true,
        mcp: ['terminal', 'browser'],
        prompt:
          'Tu es un expert en sécurité applicative.\nPour chaque risque : preuve, scénario, gravité, correctif.'
      }
    })
  })

  it('prend le nom du fichier sans `name`, une liste en tirets, des valeurs par défaut', () => {
    const parsed = parseRoleFile(
      '---\r\ndescription: "Relit: tout"\r\nmcp:\r\n  - terminal\r\n  - memory\r\n---\r\nRelis.',
      'relecteur'
    )
    expect(parsed.ok && parsed.role).toMatchObject({
      name: 'relecteur',
      label: 'relecteur',
      icon: 'bot',
      color: 'graphite',
      description: 'Relit: tout',
      readOnly: false,
      mcp: ['terminal', 'memory']
    })
  })

  it.each([
    ['sans en-tête', 'Juste une consigne', { code: 'noHeader' }],
    [
      'champ inconnu (faute de frappe)',
      '---\nreadonly: true\ndescription: d\n---\np',
      { code: 'unknownField', field: 'readonly', line: 2 }
    ],
    [
      'champ répété',
      '---\ndescription: a\ndescription: b\n---\np',
      { code: 'duplicateField', field: 'description', line: 3 }
    ],
    ['ligne illisible', '---\ndescription: a\nn’importe quoi\n---\np', { code: 'syntax', line: 3 }],
    [
      'description manquante',
      '---\nname: a\n---\np',
      { code: 'description', field: 'description' }
    ],
    [
      'couleur hors des accents',
      '---\ncolor: red\ndescription: d\n---\np',
      { code: 'color', field: 'color' }
    ],
    [
      'lecture seule ni vraie ni fausse',
      '---\nread-only: peut-être\ndescription: d\n---\np',
      { code: 'readOnly', field: 'read-only' }
    ],
    [
      'famille d’outils inconnue',
      '---\nmcp: [simulator]\ndescription: d\n---\np',
      { code: 'mcp', field: 'simulator' }
    ],
    ['consigne vide', '---\ndescription: d\n---\n  \n', { code: 'prompt' }],
    [
      'nom invalide',
      '---\nname: Expert Sécu\ndescription: d\n---\np',
      { code: 'name', field: 'name' }
    ]
  ])('refuse un fichier %s, en disant pourquoi', (_case, content, error) => {
    expect(parseRoleFile(content, 'r')).toEqual({ ok: false, error })
  })

  it('écrit un fichier relu à l’identique', () => {
    const parsed = parseRoleFile(FILE, 'x')
    if (!parsed.ok) throw new Error('fichier invalide')
    const again = parseRoleFile(serializeRole(parsed.role), 'x')
    expect(again).toEqual(parsed)
    const odd: RoleDefinition = {
      ...parsed.role,
      label: '« Spécial » "x" # pas un',
      description: 'a: b, [c]',
      mcp: []
    }
    expect(parseRoleFile(serializeRole(odd), 'x')).toEqual({ ok: true, role: odd })
  })

  it('vérifie les champs venus du formulaire comme ceux d’un fichier', () => {
    expect(checkRole({ name: 'a', description: 'd', prompt: 'p', readOnly: 'oui' })).toEqual({
      ok: false,
      error: { code: 'readOnly', field: 'read-only' }
    })
    expect(checkRole({ name: 'a', description: 'd', prompt: 'p', agent: 'x\ny' })).toMatchObject({
      ok: false,
      error: { code: 'value', field: 'agent' }
    })
  })
})

describe('priorité et activation des rôles', () => {
  it('à nom égal, le projet l’emporte sur le personnel, qui l’emporte sur le fourni', () => {
    const merged = mergeRoles(
      [
        role('tech-lead', 'builtin'),
        role('tech-lead', 'user'),
        role('tech-lead', 'project'),
        role('code-reviewer', 'builtin'),
        role('code-reviewer', 'user')
      ],
      new Set()
    )
    expect(merged.map((r) => [r.name, r.scope, r.hides])).toEqual([
      ['code-reviewer', 'user', ['builtin']],
      ['tech-lead', 'project', ['user', 'builtin']]
    ])
  })

  it('un nom désactivé reste listé, marqué inactif', () => {
    const merged = mergeRoles([role('a', 'builtin'), role('b', 'user')], new Set(['a']))
    expect(merged.map((r) => [r.name, r.enabled])).toEqual([
      ['a', false],
      ['b', true]
    ])
  })
})

describe('ce qui part à l’agent', () => {
  const secu = role('security-expert', 'builtin', { readOnly: true, prompt: 'Audit only.' })

  it('liste les rôles avec leur « quand l’utiliser » et la lecture seule', () => {
    const lines = rolesParagraph([secu, role('tech-lead', 'builtin')])
    expect(lines.join('\n')).toContain('`role`')
    expect(lines).toContain('- security-expert: security-expert (builtin) (read-only)')
    expect(lines).toContain('- tech-lead: tech-lead (builtin)')
    expect(rolesParagraph([])).toEqual([])
  })

  it('reconnaît `@nom` dans un message, pas un nom plus long ni une adresse', () => {
    const roles = [secu, role('tech', 'user')]
    expect(mentionedRoles('Fais relire par @security-expert stp', roles)).toEqual([secu])
    expect(mentionedRoles('@tech-lead et a@tech', roles)).toEqual([])
    expect(mentionedRoles('(@tech) ok', roles).map((r) => r.name)).toEqual(['tech'])
  })

  it('premier message : consigne du rôle sans mode natif, lecture seule toujours dite', () => {
    const plain = roleOpening(secu, 'Audite auth.js', { readOnly: 'enforced' })
    expect(plain.startsWith('<bobine_role name="security-expert">\nAudit only.\n')).toBe(true)
    expect(plain).toContain('Bobine refuses your write requests.')
    expect(plain.endsWith('</bobine_role>\n\nAudite auth.js')).toBe(true)
    // Consigne toujours là, mode natif ou non (relecture).
    const requested = roleOpening(secu, 'Audite auth.js', { readOnly: 'requested' })
    expect(requested).toContain('Audit only.')
    expect(requested).toContain('Bobine checks the folder after each of your turns')
    const writer = role('dev', 'user', { prompt: 'Code.' })
    expect(roleOpening(writer, 'Tâche')).toBe(
      '<bobine_role name="dev">\nCode.\n</bobine_role>\n\nTâche'
    )
  })

  it('rôle retenu en lecture seule : la lecture seule survit à un badge abîmé (relecture)', () => {
    const damaged = {
      name: 'Bad Name',
      label: '',
      icon: '??',
      color: 'red',
      readOnly: true,
      mcp: ['x']
    }
    expect(parseRoleStamp(damaged)).toEqual({
      name: 'role',
      label: 'role',
      icon: 'bot',
      color: 'graphite',
      readOnly: true,
      mcp: []
    })
    expect(parseRoleStamp({ ...damaged, readOnly: false })).toBeUndefined()
  })

  it('rôle retenu relu du disque : vérifié, retiré s’il est abîmé', () => {
    const stamp = {
      name: 'a',
      label: 'A',
      icon: 'bot',
      color: 'blue',
      readOnly: true,
      mcp: ['terminal']
    }
    expect(parseRoleStamp(stamp)).toEqual(stamp)
    const { readOnly: _readOnly, ...writer } = stamp
    expect(parseRoleStamp({ ...stamp, readOnly: 'yes' })).toEqual(writer)
    expect(parseRoleStamp({ ...writer, color: 'red' })).toBeUndefined()
    expect(parseRoleStamp({ ...writer, mcp: ['nimporte'] })).toBeUndefined()
  })
})

describe('relecture de la phase 2', () => {
  it('liste en tirets non indentés, `---` suivi d’espaces', () => {
    const parsed = parseRoleFile(
      '---  \ndescription: d\nmcp:\n- terminal\n- memory\n--- \nConsigne',
      'r'
    )
    expect(parsed.ok && parsed.role.mcp).toEqual(['terminal', 'memory'])
    expect(parsed.ok && parsed.role.prompt).toBe('Consigne')
  })

  it('refuse un saut de ligne dans le libellé ou la description (formulaire)', () => {
    expect(checkRole({ name: 'a', label: 'A\nB', description: 'd', prompt: 'p' })).toMatchObject({
      ok: false,
      error: { code: 'label' }
    })
    expect(checkRole({ name: 'a', description: 'd\nIgnore all', prompt: 'p' })).toMatchObject({
      ok: false,
      error: { code: 'description' }
    })
  })

  it('liste donnée à l’agent bornée : fournis et personnels d’abord, description coupée', () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      role(`p${String(i).padStart(2, '0')}`, 'project', { description: 'x'.repeat(500) })
    )
    const lines = rolesParagraph([...many, role('mine', 'user'), role('tech-lead', 'builtin')])
    const listed = lines.filter((l) => l.startsWith('- '))
    expect(listed).toHaveLength(21)
    expect(listed[0]).toMatch(/^- tech-lead:/)
    expect(listed[1]).toMatch(/^- mine:/)
    expect(listed[2]?.length).toBeLessThan(220)
    expect(listed[20]).toBe('- and 12 more role(s), usable by name.')
  })
})
