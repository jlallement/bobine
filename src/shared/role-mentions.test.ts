import { describe, expect, it } from 'vitest'
import { matchRoles, roleRecipients, searchable, splitRoleMentions } from './role-mentions'

const roles = [
  { name: 'security-expert', label: 'Expert sécu', description: 'Relit le code sensible.' },
  { name: 'back-architect', label: 'Architecte back', description: 'API, sécurité des API' },
  { name: 'ux-ui-expert', label: 'Expert UX/UI', description: 'Critique les écrans.' },
  { name: 'code-reviewer', label: 'Code reviewer', description: 'Relit un diff.' }
]

describe('searchable', () => {
  it('ignore la casse et les accents', () => {
    expect(searchable('Sécu ÉCRAN')).toBe('secu ecran')
  })
})

describe('matchRoles', () => {
  it('recherche vide : tous, dans l’ordre', () => {
    expect(matchRoles(roles, '').map((r) => r.name)).toEqual(roles.map((r) => r.name))
  })
  it('« sé » : le nom ou le libellé d’abord, puis la description', () => {
    expect(matchRoles(roles, 'sé').map((r) => r.name)).toEqual([
      'security-expert',
      'back-architect'
    ])
  })
  it('accents ignorés, mot du libellé', () => {
    expect(matchRoles(roles, 'secu').map((r) => r.name)).toEqual([
      'security-expert',
      'back-architect'
    ])
    expect(matchRoles(roles, 'ui').map((r) => r.name)).toEqual(['ux-ui-expert'])
    expect(matchRoles(roles, 'zzz')).toEqual([])
  })
  it('`descriptions: false` : nom et libellé seulement', () => {
    expect(matchRoles(roles, 'sé', { descriptions: false }).map((r) => r.name)).toEqual([
      'security-expert'
    ])
    expect(matchRoles(roles, 'diff', { descriptions: false })).toEqual([])
  })
})

describe('splitRoleMentions', () => {
  it('un rôle cité : retiré du texte', () => {
    expect(splitRoleMentions('@security-expert relis le diff', roles)).toEqual({
      names: ['security-expert'],
      text: 'relis le diff'
    })
  })
  it('plusieurs rôles, dans l’ordre du texte, sans doublon', () => {
    expect(
      splitRoleMentions('@code-reviewer et @security-expert, relisez. @code-reviewer', roles)
    ).toEqual({ names: ['code-reviewer', 'security-expert'], text: 'et , relisez.' })
  })
  it('rôle inconnu, fichier ou adresse : laissés en texte', () => {
    const text = 'Demande à @astronaute de lire @src/app.ts, écris à moi@security-expert.fr'
    expect(splitRoleMentions(text, roles)).toEqual({ names: [], text })
  })
  it('nom plus long qu’un rôle : pas le rôle', () => {
    expect(splitRoleMentions('@security-expert-2 x', roles).names).toEqual([])
  })
  it('indentation et listes gardées : seuls `@nom` et son espace partent', () => {
    const text = [
      '@code-reviewer relis :',
      '```python',
      'def f(x):',
      '    if x:',
      '        return  x',
      '```',
      '  - un point',
      '    - un sous-point'
    ].join('\n')
    expect(splitRoleMentions(text, roles).text).toBe(text.replace('@code-reviewer ', ''))
  })
  it('mention dans du code : pas une mention', () => {
    const fenced = 'Voici :\n```\n@code-reviewer garde-moi\n```'
    expect(splitRoleMentions(fenced, roles)).toEqual({ names: [], text: fenced })
    const inline = 'Le texte `@security-expert` reste.'
    expect(splitRoleMentions(inline, roles)).toEqual({ names: [], text: inline })
    expect(splitRoleMentions('`@code-reviewer` puis @code-reviewer relis', roles)).toEqual({
      names: ['code-reviewer'],
      text: '`@code-reviewer` puis relis'
    })
  })
  it('`(@nom)`, `@a,@nom`, casse ignorée', () => {
    expect(splitRoleMentions('Relis (@code-reviewer) le diff', roles)).toEqual({
      names: ['code-reviewer'],
      text: 'Relis le diff'
    })
    expect(splitRoleMentions('@a,@code-reviewer relis', roles)).toEqual({
      names: ['code-reviewer'],
      text: '@a,relis'
    })
    expect(splitRoleMentions('@Code-Reviewer relis', roles)).toEqual({
      names: ['code-reviewer'],
      text: 'relis'
    })
  })
  it('garde les retours à la ligne', () => {
    expect(splitRoleMentions('@code-reviewer Relis.\n/scenario echo', roles).text).toBe(
      'Relis.\n/scenario echo'
    )
  })
})

describe('roleRecipients', () => {
  it('jetons puis `@nom` tapés, sans doublon', () => {
    expect(
      roleRecipients(['ux-ui-expert'], '@security-expert @ux-ui-expert relisez', roles)
    ).toEqual({ names: ['ux-ui-expert', 'security-expert'], text: 'relisez' })
  })
  it('jeton d’un rôle disparu entre-temps : ignoré', () => {
    expect(roleRecipients(['ancien'], 'relis', roles)).toEqual({ names: [], text: 'relis' })
  })
  it('aucun rôle : le texte tel quel', () => {
    expect(roleRecipients([], '  @astronaute va  ', roles)).toEqual({
      names: [],
      text: '  @astronaute va  '
    })
  })
})
