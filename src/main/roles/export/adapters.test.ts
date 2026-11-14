import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { BOB_CUSTOM_MODES, bobModeEntry } from './bob-custom-modes'
import { EXPORT_READ_ONLY_LINE, type ExportedRole } from './format'
import { OPENCODE_AGENTS, openCodeAgentFile } from './opencode-agents'

const role: ExportedRole = {
  id: 'code-reviewer',
  label: 'Code reviewer',
  description: 'Reviews a change before merge: correctness, tests, readability.',
  prompt: 'You are a strict code reviewer.\n\n- Cite files as path:line.',
  readOnly: true
}

/** Fichier de Bob écrit à la main : commentaires, autres modes, autres clés, styles variés. */
const HAND_WRITTEN = `# Mes modes à moi — ne pas toucher
customModes:
  # Le traducteur
  - slug: traducteur
    name: "🌍 Traducteur"
    roleDefinition: |
      Tu traduis.
      Fidèlement.
    groups: [read, edit] # pas de commandes
  - slug: docs-writer
    name: 📝 Documentation Writer
    roleDefinition: You are a technical writer specializing in clear documentation and very long lines that should never be folded by any tool whatsoever.
    groups:
      - read
      - - edit
        - fileRegex: ".*\\\\.md$"
          description: Markdown only
autreCle: 42 # gardée
`

describe('modes personnalisés de Bob', () => {
  it('ajoute notre mode sans toucher au reste du fichier ni à ses commentaires', () => {
    const put = BOB_CUSTOM_MODES.put(HAND_WRITTEN, role)
    if ('error' in put || put.text === null) throw new Error('refusé')
    expect(put.text.startsWith(HAND_WRITTEN.slice(0, HAND_WRITTEN.indexOf('autreCle')))).toBe(true)
    expect(put.text).toContain('# Mes modes à moi — ne pas toucher')
    expect(put.text).toContain('  # Le traducteur')
    expect(put.text).toContain('groups: [read, edit] # pas de commandes')
    expect(put.text).toContain('autreCle: 42 # gardée')
    expect(put.text).toContain(
      'very long lines that should never be folded by any tool whatsoever.'
    )
    const value = parse(put.text) as { customModes: { slug: string }[]; autreCle: number }
    expect(value.customModes.map((m) => m.slug)).toEqual([
      'traducteur',
      'docs-writer',
      'code-reviewer'
    ])
    expect(value.customModes[2]).toEqual(bobModeEntry(role))
    expect(put.fingerprint).toBe(BOB_CUSTOM_MODES.fingerprintOf(role))
  })

  it('remplace notre seul mode, puis le retire en rendant le fichier d’origine', () => {
    const first = BOB_CUSTOM_MODES.put(HAND_WRITTEN, role)
    if ('error' in first || first.text === null) throw new Error('refusé')
    const changed = { ...role, label: 'Relecteur', readOnly: false }
    const second = BOB_CUSTOM_MODES.put(first.text, changed)
    if ('error' in second || second.text === null) throw new Error('refusé')
    const value = parse(second.text) as { customModes: Record<string, unknown>[] }
    expect(value.customModes).toHaveLength(3)
    expect(value.customModes[2]).toMatchObject({
      name: 'Relecteur',
      groups: ['read', 'edit', 'execute', 'mcp']
    })
    const dropped = BOB_CUSTOM_MODES.drop(second.text, role.id)
    if ('error' in dropped) throw new Error('refusé')
    expect(dropped.text).toBe(HAND_WRITTEN)
  })

  it('lit notre mode et son empreinte ; un changement à la main se voit', () => {
    const put = BOB_CUSTOM_MODES.put(undefined, role)
    if ('error' in put || put.text === null) throw new Error('refusé')
    expect(BOB_CUSTOM_MODES.find(put.text, role.id)).toEqual({
      kind: 'present',
      fingerprint: put.fingerprint
    })
    const edited = put.text.replace('Code reviewer', 'Mon relecteur')
    const found = BOB_CUSTOM_MODES.find(edited, role.id)
    expect(found.kind).toBe('present')
    expect(found.kind === 'present' && found.fingerprint).not.toBe(put.fingerprint)
    expect(BOB_CUSTOM_MODES.find(HAND_WRITTEN, role.id)).toEqual({ kind: 'absent' })
    expect(BOB_CUSTOM_MODES.find(undefined, role.id)).toEqual({ kind: 'absent' })
  })

  it('crée le fichier : lecture seule = lire et outils MCP, consigne et lecture seule écrites', () => {
    const put = BOB_CUSTOM_MODES.put(undefined, role)
    if ('error' in put || put.text === null) throw new Error('refusé')
    expect(put.text).toBe(BOB_CUSTOM_MODES.entryText(role))
    const value = parse(put.text) as { customModes: Record<string, unknown>[] }
    expect(value.customModes[0]).toEqual({
      slug: 'code-reviewer',
      name: 'Code reviewer',
      description: role.description,
      roleDefinition: `${role.prompt}\n\n${EXPORT_READ_ONLY_LINE}`,
      whenToUse: role.description,
      groups: ['read', 'mcp']
    })
    // Fichier vide ou `customModes:` sans valeur : comme absent.
    for (const empty of ['', '# rien\n', 'customModes:\n']) {
      const again = BOB_CUSTOM_MODES.put(empty, role)
      expect('error' in again).toBe(false)
    }
  })

  it('refuse un fichier qu’il ne comprend pas, sans rien proposer d’écrire', () => {
    for (const bad of ['customModes: [', 'customModes: 3\n', '- a\n- b\n', 'a: 1\na: 2\n']) {
      expect(BOB_CUSTOM_MODES.put(bad, role)).toMatchObject({ error: { code: 'invalidFile' } })
      expect(BOB_CUSTOM_MODES.find(bad, role.id).kind).toBe('invalid')
    }
  })

  it('chemins : personnel sous ~/.bob/settings, projet sous .bob', () => {
    const loc = { home: '/h' }
    expect(BOB_CUSTOM_MODES.place('user', 'x', loc)).toEqual({
      file: '/h/.bob/settings/custom_modes.yaml',
      root: '/h',
      shown: '~/.bob/settings/custom_modes.yaml'
    })
    expect(BOB_CUSTOM_MODES.place('project', 'x', loc, '/p').shown).toBe('.bob/custom_modes.yaml')
  })
})

describe('agents d’OpenCode', () => {
  it('écrit un agent principal ; lecture seule par permissions, outils MCP laissés', () => {
    const text = openCodeAgentFile(role)
    expect(text).toBe(
      [
        '---',
        `description: "${role.description}"`,
        'mode: primary',
        'permissions:',
        '  - action: edit',
        '    resource: "*"',
        '    effect: deny',
        '  - action: shell',
        '    resource: "*"',
        '    effect: deny',
        '  - action: subagent',
        '    resource: "*"',
        '    effect: deny',
        '---',
        role.prompt,
        '',
        EXPORT_READ_ONLY_LINE,
        ''
      ].join('\n')
    )
    const writer = openCodeAgentFile({ ...role, readOnly: false })
    expect(writer).not.toContain('permissions')
    expect(writer).not.toContain(EXPORT_READ_ONLY_LINE)
  })

  it('un fichier par agent : posé, retrouvé, retiré (fichier supprimé)', () => {
    const put = OPENCODE_AGENTS.put(undefined, role)
    if ('error' in put || put.text === null) throw new Error('refusé')
    expect(OPENCODE_AGENTS.find(put.text, role.id)).toEqual({
      kind: 'present',
      fingerprint: OPENCODE_AGENTS.fingerprintOf(role)
    })
    expect(OPENCODE_AGENTS.find(`${put.text}x`, role.id)).not.toEqual(
      OPENCODE_AGENTS.find(put.text, role.id)
    )
    expect(OPENCODE_AGENTS.drop(put.text, role.id)).toEqual({ text: null })
  })

  it('chemins : XDG_CONFIG_HOME suivi, projet sous .opencode/agents', () => {
    expect(OPENCODE_AGENTS.place('user', 'x', { home: '/h' }).shown).toBe(
      '~/.config/opencode/agents/x.md'
    )
    expect(OPENCODE_AGENTS.place('user', 'x', { home: '/h', xdgConfigHome: '/xdg' }).file).toBe(
      '/xdg/opencode/agents/x.md'
    )
    expect(OPENCODE_AGENTS.place('project', 'x', { home: '/h' }, '/p').shown).toBe(
      '.opencode/agents/x.md'
    )
  })
})
