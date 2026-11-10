import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { projectCommands } from './user-commands'

describe('projectCommands', () => {
  it('reads the Markdown files of .bobine/commands, skipping bad names and empty files', async () => {
    const workspace = mkdtempSync(join(tmpdir(), 'bob-commands-'))
    const dir = join(workspace, '.bobine', 'commands')
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      join(dir, 'Revue.md'),
      '---\ndescription: Revue du projet\nhint: <fichier>\n---\nFais une revue de $ARGUMENTS.\n'
    )
    writeFileSync(join(dir, 'tests.md'), '# Tests\n\nÉcris les tests.\n')
    writeFileSync(join(dir, 'pas un nom.md'), 'x')
    writeFileSync(join(dir, 'vide.md'), '\n')
    writeFileSync(join(dir, 'notes.txt'), 'ignoré')
    expect(await projectCommands(workspace)).toEqual([
      {
        name: 'revue',
        description: 'Revue du projet',
        hint: '<fichier>',
        prompt: 'Fais une revue de $ARGUMENTS.',
        scope: 'project',
        file: join(dir, 'Revue.md')
      },
      {
        name: 'tests',
        description: 'Tests',
        prompt: 'Écris les tests.',
        scope: 'project',
        file: join(dir, 'tests.md')
      }
    ])
    expect(await projectCommands(join(workspace, 'absent'))).toEqual([])
  })

  it('still reads the old .bob-desktop/commands folder; .bobine wins on the same name', async () => {
    const workspace = mkdtempSync(join(tmpdir(), 'bob-commands-'))
    const current = join(workspace, '.bobine', 'commands')
    const legacy = join(workspace, '.bob-desktop', 'commands')
    mkdirSync(current, { recursive: true })
    mkdirSync(legacy, { recursive: true })
    writeFileSync(join(current, 'revue.md'), 'Nouvelle revue.\n')
    writeFileSync(join(legacy, 'revue.md'), 'Ancienne revue.\n')
    writeFileSync(join(legacy, 'ancienne.md'), 'Toujours là.\n')
    const commands = await projectCommands(workspace)
    expect(commands.map((c) => [c.name, c.prompt])).toEqual([
      ['ancienne', 'Toujours là.'],
      ['revue', 'Nouvelle revue.']
    ])
    expect(commands[0]?.file).toBe(join(legacy, 'ancienne.md'))
  })
})
