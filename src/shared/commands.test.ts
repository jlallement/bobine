import { describe, expect, it } from 'vitest'
import { commandQuery, filterCommands } from './commands'

const commands = [
  { name: 'review', description: 'review changes' },
  { name: 'init', description: 'guided AGENTS.md setup' },
  { name: 'preview', description: 'Show a preview' },
  { name: 'mcp:deploy', description: 'Deploy via MCP', hint: 'env' }
]

describe('commandes « / »', () => {
  it('commandQuery : seulement pendant la saisie du nom', () => {
    expect(commandQuery('/')).toBe('')
    expect(commandQuery('/rev')).toBe('rev')
    expect(commandQuery('/review ')).toBeUndefined()
    expect(commandQuery('salut /rev')).toBeUndefined()
  })

  it('filterCommands : préfixe, puis contenu du nom, puis description', () => {
    expect(filterCommands(commands, 'rev').map((c) => c.name)).toEqual(['review', 'preview'])
    expect(filterCommands(commands, 'agents').map((c) => c.name)).toEqual(['init'])
    expect(filterCommands(commands, 'MCP').map((c) => c.name)).toEqual(['mcp:deploy'])
    expect(filterCommands(commands, '').map((c) => c.name)).toEqual([
      'init',
      'mcp:deploy',
      'preview',
      'review'
    ])
    expect(filterCommands(commands, 'zzz')).toEqual([])
  })
})
