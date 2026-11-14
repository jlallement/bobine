import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import i18next from 'i18next'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { builtinRoles } from '../builtin'
import { BOB_CUSTOM_MODES } from './bob-custom-modes'
import { roleExportHandlers } from './ipc'
import { RoleExportRegistry } from './registry'
import { RoleExports } from './service'

/** Dossier jetable : jamais le vrai ~/.bob. */
let root: string
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'bobine-export-ipc-'))
})
afterEach(async () => {
  await i18next.changeLanguage('fr')
  rmSync(root, { recursive: true, force: true })
})

function handlers() {
  const exports = new RoleExports({
    profiles: () => [{ id: 'bob', label: 'IBM Bob', roleExport: BOB_CUSTOM_MODES }],
    locations: { home: join(root, 'home') },
    registry: new RoleExportRegistry(join(root, 'data', 'registry.json')),
    backupDir: join(root, 'data', 'backups')
  })
  return roleExportHandlers(() => ({
    exports,
    // Comme la bibliothèque : les rôles fournis relus dans la langue du moment.
    library: {
      definition: (_scope, name) => builtinRoles().find((r) => r.name === name),
      list: () => ({ roles: [], problems: [] })
    },
    folderOf: () => undefined
  }))
}

describe('installer un rôle fourni (ADR-0046, phase 4)', () => {
  it('ses textes sont ceux de la langue de l’interface au moment d’installer', async () => {
    for (const language of ['fr', 'en'] as const) {
      await i18next.changeLanguage(language)
      const preview = await handlers()['roles:exportPreview'](
        { scope: 'builtin', name: 'code-reviewer' },
        'bob'
      )
      const expected = builtinRoles(language).find((r) => r.name === 'code-reviewer')
      const entry = (parse(preview.text) as { customModes: Record<string, string>[] })
        .customModes[0]
      expect(preview.label).toBe(expected?.label)
      expect(entry?.['name']).toBe(expected?.label)
      expect(entry?.['description']).toBe(expected?.description)
      expect(entry?.['roleDefinition']?.startsWith(expected?.prompt.trimEnd() ?? '?')).toBe(true)
    }
    expect(builtinRoles('fr')[0]?.description).not.toBe(builtinRoles('en')[0]?.description)
  })
})
