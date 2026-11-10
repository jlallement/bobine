import { describe, expect, it } from 'vitest'
import { appCommandOf, mergeCommands } from './app-commands'
import {
  expandCommand,
  parseCommandFile,
  parseUserCommands,
  toAgentCommands,
  userCommandOf,
  type UserCommand
} from './user-commands'

const revue: UserCommand = {
  name: 'revue',
  description: 'Revue du projet',
  hint: '<fichier>',
  prompt: 'Fais une revue de $ARGUMENTS.',
  scope: 'project',
  file: '/p/.bobine/commands/revue.md'
}
const salut: UserCommand = {
  name: 'salut',
  description: 'Dire bonjour',
  prompt: 'Dis bonjour',
  scope: 'global'
}

describe('parseUserCommands', () => {
  it('keeps valid commands only, lowercased and deduplicated', () => {
    expect(
      parseUserCommands([
        { name: 'Revue', description: 'x', prompt: 'p', hint: '' },
        { name: 'bad name', prompt: 'p' },
        { name: 'vide', prompt: '' },
        { name: 'revue', prompt: 'doublon' },
        'pas un objet'
      ])
    ).toEqual([{ name: 'revue', description: 'x', prompt: 'p', scope: 'global' }])
    expect(parseUserCommands('nope')).toEqual([])
  })
})

describe('parseCommandFile', () => {
  it('reads the front matter and the prompt', () => {
    expect(
      parseCommandFile(
        '---\ndescription: "Revue du projet"\nhint: <fichier>\n---\n\nFais une revue de $ARGUMENTS.\n'
      )
    ).toEqual({
      description: 'Revue du projet',
      hint: '<fichier>',
      prompt: 'Fais une revue de $ARGUMENTS.'
    })
  })

  it('takes a leading title as description, else the first line', () => {
    expect(parseCommandFile('# Tests\n\nÉcris les tests.')).toEqual({
      description: 'Tests',
      prompt: 'Écris les tests.'
    })
    expect(parseCommandFile('Écris les tests.\nEn détail.')).toEqual({
      description: 'Écris les tests.',
      prompt: 'Écris les tests.\nEn détail.'
    })
  })
})

describe('expandCommand', () => {
  it('replaces $ARGUMENTS or appends the argument', () => {
    expect(expandCommand('Revue de $ARGUMENTS et $ARGUMENTS.', 'a.ts')).toBe(
      'Revue de a.ts et a.ts.'
    )
    expect(expandCommand('Dis bonjour', 'Jérôme')).toBe('Dis bonjour\n\nJérôme')
    expect(expandCommand('Dis bonjour', '  ')).toBe('Dis bonjour')
  })
})

describe('menu and precedence', () => {
  const agent = [{ name: 'revue', description: 'Celle de l’agent' }]

  it('lists project commands first, then global ones, with their origin', () => {
    expect(toAgentCommands([salut, revue, { ...salut, scope: 'project' }])).toEqual([
      { name: 'revue', description: 'Revue du projet', hint: '<fichier>', source: 'project' },
      { name: 'salut', description: 'Dire bonjour', source: 'project' }
    ])
  })

  it('agent beats user, user beats app', () => {
    const user = toAgentCommands([revue, { ...salut, name: 'review' }])
    const merged = mergeCommands(agent, user).map((c) => `${c.name}:${c.source ?? 'agent'}`)
    expect(merged).toContain('revue:agent')
    expect(merged).not.toContain('revue:project')
    expect(merged).toContain('review:user')
    expect(merged.filter((m) => m.startsWith('review:'))).toHaveLength(1)
    expect(appCommandOf('/review', [], user)).toBeUndefined()
    expect(userCommandOf('/revue src/a.ts', [revue], agent)).toBeUndefined()
    expect(userCommandOf('/Revue src/a.ts', [salut, revue], [])).toEqual({
      command: revue,
      args: 'src/a.ts'
    })
    expect(userCommandOf('bonjour', [salut], [])).toBeUndefined()
  })
})
