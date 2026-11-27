import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { resolveProfiles } from '../agent/profiles'
import { McpSettings } from './mcp-settings'

const profiles = resolveProfiles({
  appPath: '/app',
  execPath: '/electron',
  isPackaged: false,
  env: {}
})
const FIGMA = 'https://mcp.figma.com/mcp'
const nbsp = (text: string) => text.replace(/~/g, '\u00a0')

function setup(globalText?: string) {
  const home = mkdtempSync(join(tmpdir(), 'mcp-preset-home-'))
  const workspace = mkdtempSync(join(tmpdir(), 'mcp-preset-ws-'))
  const file = join(home, '.config', 'opencode', 'opencode.json')
  if (globalText !== undefined) {
    mkdirSync(join(home, '.config', 'opencode'), { recursive: true })
    writeFileSync(file, globalText)
  }
  const start = vi.fn()
  const openExternal = vi.fn()
  const settings = new McpSettings(
    profiles,
    { home },
    {
      fallbackCwd: home,
      env: async () => ({}),
      findCommand: () => undefined,
      openExternal,
      onState: vi.fn(),
      start
    }
  )
  const opencode = () => settings.list(workspace).find((v) => v.profileId === 'opencode')
  return {
    settings,
    workspace,
    file,
    start,
    openExternal,
    opencode,
    read: () => readFileSync(file, 'utf8')
  }
}

describe('préréglages de serveurs MCP (fiche 293)', () => {
  it('vue : `oauth` posé d’après le profil (OpenCode oui, IBM Bob non)', () => {
    const { settings, workspace } = setup()
    const views = settings.list(workspace)
    expect(views.find((v) => v.profileId === 'opencode')?.oauth).toBe(true)
    expect(views.find((v) => v.profileId === 'bob')?.oauth).toBeUndefined()
  })

  it('« Connecter Figma » : ajouté pour tous les dossiers, au format 1 si le fichier n’a rien', () => {
    const { settings, workspace, file, opencode } = setup()
    const result = settings.addPreset('opencode', 'figma', workspace)
    expect(result).toMatchObject({ name: 'figma', added: true })
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({
      mcp: { figma: { type: 'remote', url: FIGMA } }
    })
    expect(opencode()?.servers).toMatchObject([{ name: 'figma', scope: 'global', url: FIGMA }])
  })

  it('format 2 (`mcp.servers`) gardé, commentaires et réglages inconnus gardés', () => {
    const text = `{
  // réglage de l'utilisateur
  "model": "x/y",
  "mcp": { "servers": { "autre": { "type": "local", "command": ["a"] } }, "timeout": 5 }
}
`
    const { settings, workspace, read } = setup(text)
    settings.addPreset('opencode', 'figma', workspace)
    const after = read()
    expect(after).toContain("// réglage de l'utilisateur")
    expect(after).toContain('"timeout": 5')
    expect(after).toMatch(
      /"servers":\s*\{[\s\S]*"figma":\s*\{[\s\S]*"url": "https:\/\/mcp\.figma\.com\/mcp"/
    )
  })

  it('adresse déjà déclarée, sous un autre nom ou écrite autrement : rien d’écrit, son nom rendu', () => {
    const text =
      '{ "mcp": { "maquettes": { "type": "remote", "url": "https://MCP.figma.com/mcp/" } } }\n'
    const { settings, workspace, read } = setup(text)
    expect(settings.addPreset('opencode', 'figma', workspace)).toMatchObject({
      name: 'maquettes',
      added: false
    })
    expect(read()).toBe(text)
  })

  it('nom pris par un autre serveur : `figma-2`, sans rien écraser (connexion à part, relevé R4)', () => {
    const text = '{ "mcp": { "figma": { "type": "local", "command": ["mon-figma"] } } }\n'
    const { settings, workspace, read } = setup(text)
    expect(settings.addPreset('opencode', 'figma', workspace)).toMatchObject({
      name: 'figma-2',
      added: true
    })
    const data = JSON.parse(read()) as { mcp: Record<string, unknown> }
    expect(data.mcp['figma']).toEqual({ type: 'local', command: ['mon-figma'] })
    expect(data.mcp['figma-2']).toEqual({ type: 'remote', url: FIGMA })
  })

  it('fichier illisible : jamais réécrit, erreur rendue', () => {
    const text = '{ "mcp": { cassé '
    const { settings, workspace, read } = setup(text)
    expect(() => settings.addPreset('opencode', 'figma', workspace)).toThrow()
    expect(read()).toBe(text)
  })

  it('fichier du dossier illisible (global lisible) : rien d’écrit dans le global non plus', () => {
    const { settings, workspace, file } = setup()
    writeFileSync(join(workspace, 'opencode.json'), '{ cassé ')
    expect(() => settings.addPreset('opencode', 'figma', workspace)).toThrow()
    expect(() => readFileSync(file, 'utf8')).toThrow() // jamais créé
  })

  it('déjà déclaré pour ce dossier seulement : gardé tel quel, pas de second serveur', () => {
    const { settings, workspace, file } = setup()
    const project = join(workspace, 'opencode.json')
    const text =
      '{ "mcp": { "figma": { "type": "remote", "url": "https://mcp.figma.com/mcp" } } }\n'
    writeFileSync(project, text)
    expect(settings.addPreset('opencode', 'figma', workspace)).toMatchObject({
      name: 'figma',
      added: false
    })
    expect(readFileSync(project, 'utf8')).toBe(text)
    expect(() => readFileSync(file, 'utf8')).toThrow()
  })

  it('messages montrés à l’utilisateur : traduits (ADR-0014)', async () => {
    const { settings, workspace } = setup()
    expect(() => settings.addPreset('bob', 'figma', workspace)).toThrow(
      'IBM Bob ne sait pas connecter lui-même un serveur MCP distant.'
    )
    const names = ['figma', ...Array.from({ length: 8 }, (_, i) => `figma-${i + 2}`)]
    const taken = setup(
      JSON.stringify({
        mcp: Object.fromEntries(names.map((n) => [n, { type: 'local', command: ['x'] }]))
      })
    )
    expect(() => taken.settings.addPreset('opencode', 'figma', taken.workspace)).toThrow(
      // Typographie française de l'app : espaces insécables devant « : » et dans les guillemets.
      nbsp('Les noms «~figma~» à «~figma-9~» sont déjà pris~: renommez un serveur.')
    )
    const bare = new McpSettings(profiles, { home: workspace })
    expect(() => bare.cancelConnect('opencode', 'figma')).toThrow(
      'La connexion des serveurs MCP n’est pas disponible.'
    )
  })

  it('agent sans la capacité (IBM Bob), préréglage inconnu : refusé, rien d’écrit ni lancé', () => {
    const { settings, workspace, start } = setup()
    expect(() => settings.addPreset('bob', 'figma', workspace)).toThrow()
    expect(() => settings.addPreset('opencode', 'inconnu', workspace)).toThrow('presetId')
    expect(settings.list(workspace).every((v) => v.servers.length === 0)).toBe(true)
    expect(start).not.toHaveBeenCalled()
  })

  it('« Tester » (fiche 060) pas lancé pour un serveur connecté par l’agent', async () => {
    const { settings, workspace } = setup()
    settings.addPreset('opencode', 'figma', workspace)
    await expect(settings.test('opencode', 'global', workspace, 'figma')).rejects.toThrow(
      'pas de test par Bobine'
    )
  })

  it('serveurs connectés par l’agent marqués par leur préréglage, seulement chez l’agent qui sait', () => {
    const { settings, workspace, opencode } = setup()
    settings.addPreset('opencode', 'figma', workspace)
    settings.save('opencode', 'global', workspace, {
      name: 'local',
      transport: 'stdio',
      command: 'npx'
    })
    settings.save('bob', 'global', workspace, { name: 'figma', transport: 'http', url: FIGMA })
    const byName = Object.fromEntries((opencode()?.servers ?? []).map((s) => [s.name, s]))
    expect(byName['figma']?.authPreset).toBe('figma')
    expect(byName['local']?.authPreset).toBeUndefined()
    const bob = settings.list(workspace).find((v) => v.profileId === 'bob')
    expect(bob?.servers.find((s) => s.name === 'figma')?.authPreset).toBeUndefined()
    // Même nom déclaré ailleurs à une autre adresse (R7 non relevé) : rien de supposé.
    settings.save('opencode', 'project', workspace, {
      name: 'figma',
      transport: 'http',
      url: 'https://exemple.test/mcp'
    })
    expect(opencode()?.servers.filter((s) => s.authPreset)).toEqual([])
  })

  it('« Liste de Figma » : adresse du préréglage ouverte par le main ; préréglage inconnu refusé', async () => {
    const { settings, openExternal } = setup()
    await settings.openPresetList('figma')
    expect(openExternal).toHaveBeenCalledWith('https://developers.figma.com/docs/figma-mcp-server/')
    await expect(settings.openPresetList('inconnu')).rejects.toThrow('presetId')
    expect(openExternal).toHaveBeenCalledTimes(1)
  })
})
