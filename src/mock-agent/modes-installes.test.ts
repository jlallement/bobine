import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { BOB_CUSTOM_MODES } from '../main/roles/export/bob-custom-modes'
import { openCodeAgentFile } from '../main/roles/export/opencode-agents'
import { installedModes } from './modes-installes.mts'

let root: string
const role = (id: string) => ({
  id,
  label: `R ${id}`,
  description: `d ${id}`,
  prompt: 'p',
  readOnly: true
})

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'mock-modes-'))
})
afterEach(() => rmSync(root, { recursive: true, force: true }))

describe('agent factice : modes installés comme Bob ou OpenCode (fiche 223)', () => {
  it('Bob : personnel puis projet, écrits comme Bobine', () => {
    const home = join(root, 'home')
    const cwd = join(root, 'projet')
    for (const [dir, id] of [
      [join(home, '.bob', 'settings'), 'perso'],
      [join(cwd, '.bob'), 'projet']
    ] as const) {
      mkdirSync(dir, { recursive: true })
      const put = BOB_CUSTOM_MODES.put(undefined, role(id))
      if ('error' in put || put.text === null) throw new Error('refusé')
      writeFileSync(join(dir, 'custom_modes.yaml'), put.text)
    }
    expect(installedModes({ kind: 'bob', home }, cwd)).toEqual([
      { id: 'perso', name: 'R perso', description: 'd perso' },
      { id: 'projet', name: 'R projet', description: 'd projet' }
    ])
    expect(installedModes({ kind: 'bob', home }, root)).toHaveLength(1)
  })

  it('OpenCode : agents principaux seulement', () => {
    const home = join(root, 'home')
    const dir = join(home, '.config', 'opencode', 'agents')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'relecteur.md'), openCodeAgentFile(role('relecteur')))
    writeFileSync(join(dir, 'aide.md'), '---\nmode: subagent\n---\nx\n')
    writeFileSync(join(dir, 'cache.md'), '---\nhidden: true\n---\nx\n')
    expect(installedModes({ kind: 'opencode', home }, root)).toEqual([
      { id: 'relecteur', name: 'relecteur', description: 'd relecteur' }
    ])
  })
})
