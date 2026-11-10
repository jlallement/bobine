import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { AgentMcpConfig } from './mcp-files'
import { BOB_MCP } from './bob-mcp'
import { OPENCODE_MCP } from './opencode-mcp'

const setup = () => {
  const home = mkdtempSync(join(tmpdir(), 'mcp-home-'))
  const workspace = mkdtempSync(join(tmpdir(), 'mcp-ws-'))
  return { home, workspace }
}
const json = (file: string): unknown => JSON.parse(readFileSync(file, 'utf8'))

describe('serveurs MCP de Bob (fiche 025)', () => {
  it('ajout, désactivation, renommage, suppression ; champs inconnus gardés', () => {
    const { home, workspace } = setup()
    const bob = new AgentMcpConfig(BOB_MCP, { home })
    const file = join(home, '.bob', 'settings', 'mcp.json')
    bob.save('global', workspace, {
      name: 'recherche',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', 'serveur-recherche'],
      env: { API_KEY: 'secret' },
      enabled: true
    })
    expect(json(file)).toEqual({
      mcpServers: {
        recherche: { command: 'npx', args: ['-y', 'serveur-recherche'], env: { API_KEY: 'secret' } }
      }
    })
    // Réglage propre à Bob ajouté à la main : jamais perdu.
    const withAllow = json(file) as { mcpServers: { recherche: Record<string, unknown> } }
    withAllow.mcpServers.recherche['alwaysAllow'] = ['chercher']
    writeFileSync(file, JSON.stringify(withAllow, null, 2))

    bob.setEnabled('global', workspace, 'recherche', false)
    expect(json(file)).toMatchObject({ mcpServers: { recherche: { disabled: true } } })
    bob.setEnabled('global', workspace, 'recherche', true)
    expect(json(file)).not.toMatchObject({ mcpServers: { recherche: { disabled: true } } })

    bob.save(
      'global',
      workspace,
      {
        name: 'web',
        transport: 'http',
        url: 'https://mcp.example.test/mcp',
        headers: { Authorization: 'Bearer x' },
        enabled: false
      },
      'recherche'
    )
    expect(json(file)).toEqual({
      mcpServers: {
        web: {
          alwaysAllow: ['chercher'],
          url: 'https://mcp.example.test/mcp',
          headers: { Authorization: 'Bearer x' },
          disabled: true
        }
      }
    })
    const view = bob.view('bob', 'IBM Bob', workspace)
    expect(view.servers).toEqual([
      {
        name: 'web',
        transport: 'http',
        url: 'https://mcp.example.test/mcp',
        headers: { Authorization: 'Bearer x' },
        enabled: false,
        scope: 'global',
        file
      }
    ])
    bob.remove('global', workspace, 'web')
    // Plus rien d'autre dans le fichier : il est supprimé (fiche 126).
    expect(existsSync(file)).toBe(false)
  })

  it('dernier serveur retiré : conteneur vide retiré, fichier supprimé s’il n’a rien d’autre (fiche 126)', () => {
    const { home, workspace } = setup()
    const opencode = new AgentMcpConfig(OPENCODE_MCP, { home })
    const file = join(workspace, 'opencode.json')
    const server = { name: 'essai', transport: 'stdio' as const, command: 'x', enabled: true }
    opencode.save('project', workspace, server)
    opencode.remove('project', workspace, 'essai')
    expect(existsSync(file)).toBe(false)
    // D'autres réglages : le fichier reste, sans `"mcp": {}`.
    writeFileSync(file, '{\n  "model": "a/b"\n}\n')
    opencode.save('project', workspace, server)
    opencode.remove('project', workspace, 'essai')
    expect(json(file)).toEqual({ model: 'a/b' })
    // Un commentaire de l'utilisateur : le fichier reste.
    writeFileSync(file, '// mes serveurs\n{}\n')
    opencode.save('project', workspace, server)
    opencode.remove('project', workspace, 'essai')
    expect(readFileSync(file, 'utf8')).toContain('// mes serveurs')
  })

  it('serveur du projet : dans <dossier>/.bob/mcp.json, listé après les globaux', () => {
    const { home, workspace } = setup()
    const bob = new AgentMcpConfig(BOB_MCP, { home })
    bob.save('project', workspace, {
      name: 'local',
      transport: 'stdio',
      command: 'node',
      enabled: true
    })
    expect(json(join(workspace, '.bob', 'mcp.json'))).toEqual({
      mcpServers: { local: { command: 'node' } }
    })
    expect(bob.view('bob', 'Bob', workspace).servers.map((s) => [s.name, s.scope])).toEqual([
      ['local', 'project']
    ])
  })

  it('sans dossier choisi (fiche 093) : pas de fichier du projet, ni lu ni écrit', () => {
    const { home } = setup()
    const bob = new AgentMcpConfig(BOB_MCP, { home })
    const view = bob.view('bob', 'Bob', '')
    expect(view.files.project).toBeUndefined()
    expect(view.servers).toEqual([])
    const server = { name: 'x', transport: 'stdio', command: 'node', enabled: true } as const
    expect(() => bob.save('project', '', server)).toThrow('Choisissez d’abord un dossier')
  })

  it('fichier illisible : signalé, jamais réécrit', () => {
    const { home, workspace } = setup()
    const file = join(home, '.bob', 'settings', 'mcp.json')
    mkdirSync(join(home, '.bob', 'settings'), { recursive: true })
    writeFileSync(file, '{ "mcpServers": { oups ')
    const bob = new AgentMcpConfig(BOB_MCP, { home })
    expect(bob.view('bob', 'Bob', workspace).error).toContain('JSON invalide')
    expect(() =>
      bob.save('global', workspace, {
        name: 'x',
        transport: 'stdio',
        command: 'node',
        enabled: true
      })
    ).toThrow('JSON invalide')
    expect(readFileSync(file, 'utf8')).toBe('{ "mcpServers": { oups ')
  })
})

describe('serveurs MCP d’OpenCode (fiche 025)', () => {
  it('opencode.jsonc existant : commentaires et autres réglages gardés', () => {
    const { home, workspace } = setup()
    const dir = join(home, '.config', 'opencode')
    mkdirSync(dir, { recursive: true })
    const file = join(dir, 'opencode.jsonc')
    writeFileSync(
      file,
      '{\n  // mon modèle préféré\n  "$schema": "https://opencode.ai/config.json",\n  "model": "zen/x",\n}\n'
    )
    const opencode = new AgentMcpConfig(OPENCODE_MCP, { home })
    opencode.save('global', workspace, {
      name: 'recherche',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', 'serveur'],
      env: { K: 'v' },
      enabled: true
    })
    const text = readFileSync(file, 'utf8')
    expect(text).toContain('// mon modèle préféré')
    expect(text).toContain('"model": "zen/x"')
    opencode.setEnabled('global', workspace, 'recherche', false)
    const view = opencode.view('opencode', 'OpenCode', workspace)
    expect(view.servers).toEqual([
      {
        name: 'recherche',
        transport: 'stdio',
        command: 'npx',
        args: ['-y', 'serveur'],
        env: { K: 'v' },
        enabled: false,
        scope: 'global',
        file
      }
    ])
    expect(readFileSync(file, 'utf8')).toContain('"enabled": false')
    opencode.save('global', workspace, {
      name: 'distant',
      transport: 'http',
      url: 'https://x.test/mcp',
      enabled: true
    })
    expect(readFileSync(file, 'utf8')).toMatch(
      /"distant": \{\s*"type": "remote",\s*"url": "https:\/\/x.test\/mcp"\s*\}/
    )
  })

  it('sans fichier : opencode.json créé ; projet cherché jusqu’à la racine git', () => {
    const { home, workspace } = setup()
    const opencode = new AgentMcpConfig(OPENCODE_MCP, { home })
    expect(opencode.file('global', workspace)).toBe(
      join(home, '.config', 'opencode', 'opencode.json')
    )
    mkdirSync(join(workspace, '.git'))
    mkdirSync(join(workspace, 'paquet', 'src'), { recursive: true })
    expect(opencode.file('project', join(workspace, 'paquet', 'src'))).toBe(
      join(workspace, 'opencode.json')
    )
    writeFileSync(join(workspace, 'paquet', 'opencode.jsonc'), '{}')
    expect(opencode.file('project', join(workspace, 'paquet', 'src'))).toBe(
      join(workspace, 'paquet', 'opencode.jsonc')
    )
    const xdg = mkdtempSync(join(tmpdir(), 'mcp-xdg-'))
    expect(
      new AgentMcpConfig(OPENCODE_MCP, { home, xdgConfigHome: xdg }).file('global', workspace)
    ).toBe(join(xdg, 'opencode', 'opencode.json'))
  })

  it('format d’OpenCode 2 (mcp.servers, disabled) : lu, modifié en place ; nouveaux serveurs avec', () => {
    const { home, workspace } = setup()
    const dir = join(home, '.config', 'opencode')
    mkdirSync(dir, { recursive: true })
    const file = join(dir, 'opencode.json')
    writeFileSync(
      file,
      JSON.stringify({
        mcp: {
          timeout: { catalog: 30000 },
          servers: {
            natif: {
              type: 'local',
              command: ['npx', 'natif'],
              disabled: true,
              timeout: { execution: 5 }
            }
          },
          ancien: { type: 'remote', url: 'https://ancien.test/mcp' }
        }
      })
    )
    const opencode = new AgentMcpConfig(OPENCODE_MCP, { home })
    const names = () =>
      opencode.view('opencode', 'OpenCode', workspace).servers.map((s) => [s.name, s.enabled])
    // `timeout` n'est pas un serveur.
    expect(names()).toEqual([
      ['natif', false],
      ['ancien', true]
    ])
    opencode.setEnabled('global', workspace, 'natif', true)
    opencode.setEnabled('global', workspace, 'ancien', false)
    opencode.save('global', workspace, {
      name: 'nouveau',
      transport: 'stdio',
      command: 'node',
      args: ['serveur.js'],
      enabled: false
    })
    expect(json(file)).toEqual({
      mcp: {
        timeout: { catalog: 30000 },
        servers: {
          natif: { type: 'local', command: ['npx', 'natif'], timeout: { execution: 5 } },
          nouveau: { type: 'local', command: ['node', 'serveur.js'], disabled: true }
        },
        ancien: { type: 'remote', url: 'https://ancien.test/mcp', enabled: false }
      }
    })
    // Renommé : reste dans la même table, sous la même forme.
    opencode.save(
      'global',
      workspace,
      { name: 'natif2', transport: 'stdio', command: 'npx', args: ['natif'], enabled: true },
      'natif'
    )
    opencode.remove('global', workspace, 'ancien')
    expect(json(file)).toMatchObject({
      mcp: { servers: { natif2: { type: 'local', timeout: { execution: 5 } } } }
    })
    expect(names()).toEqual([
      ['nouveau', false],
      ['natif2', true]
    ])
  })
})
