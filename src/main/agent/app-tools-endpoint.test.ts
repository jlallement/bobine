import { existsSync, mkdirSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { AgentEvent } from '@shared/agent'
import type { ToolKind } from '../../shared/acp-sdk.mts'
import { textResult, type AppTool, type AppToolModule, type ToolContext } from '../mcp/tools'
import type { ToolListUpdate } from '../mcp/tool-server'
import { AppToolsBridge } from './app-tools-bridge'
import { AppToolsEndpoint } from './app-tools-endpoint'
import type { PendingRequests } from './pending-requests'

const tool = (name: string): AppTool => ({
  definition: { name, description: name, inputSchema: {} },
  autoAllow: true,
  call: async () => textResult('ok')
})

/**
 * Serveur MCP simulé : `relist` dit ce que fait l'agent après la notification — il relit la liste
 * (`listed`, comme OpenCode 2.3.0), la laisse passer (`ignored`) ou n'a pas ouvert de flux.
 * Famille « iOS » qui suit le dossier : utile dès qu'il contient `App.xcodeproj` ; chaque recherche
 * du projet (`appears`) et chaque contexte donné aux outils (`contexts`) sont notés.
 */
function setup(relist: ToolListUpdate = 'no-stream', options: { readOnly?: boolean } = {}) {
  const workspace = mkdtempSync(join(tmpdir(), 'bobine-241-'))
  const project = join(workspace, 'App.xcodeproj')
  const appears = vi.fn(async () => existsSync(project))
  const contexts: ToolContext[] = []
  const ios: AppToolModule = {
    id: 'ios-simulator',
    about: {
      title: 'appToolFamilies.ios-simulator.title',
      summary: 'appToolFamilies.ios-simulator.summary',
      condition: 'appToolFamilies.ios-simulator.condition'
    },
    enabled: () => existsSync(project),
    followsWorkspace: appears,
    tools: (context) => {
      contexts.push(context)
      return [tool('ios_build'), tool('ios_screenshot')]
    }
  }
  const events: AgentEvent[] = []
  let onListed: ((names: string[]) => void) | undefined
  const update = vi.fn(async (tools: readonly AppTool[]) => {
    if (relist === 'listed') onListed?.(tools.map((t) => t.definition.name))
    return relist
  })
  const bridge = new AppToolsBridge({
    workspace,
    toolModules: [ios],
    emit: (event) => events.push(event),
    requests: {} as PendingRequests,
    connected: () => true,
    tellAgent: () => {},
    readOnly: options.readOnly
  })
  const endpoint = new AppToolsEndpoint({
    bridge,
    server: {
      register: (_tools, _scope, listed) => {
        onListed = listed
        return { url: 'http://127.0.0.1/mcp/x', dispose: () => {}, update }
      }
    },
    scope: () => ({}),
    emit: (event) => events.push(event)
  })
  /** Un tour : ses appels d'outils (genre ACP), puis sa fin. */
  const turn = async (...kinds: ToolKind[]) => {
    bridge.turnStarted()
    kinds.forEach((kind, i) =>
      bridge.noteUpdate({ sessionUpdate: 'tool_call', toolCallId: `c${i}`, title: kind, kind })
    )
    bridge.turnEnded()
    await endpoint.turnEnded()
  }
  return {
    endpoint,
    update,
    appears,
    contexts,
    turn,
    appTools: () => events.filter((e) => e.type === 'app-tools'),
    createProject: () => mkdirSync(project),
    relistByAgent: (names: string[]) => onListed?.(names)
  }
}

describe('outils apparus avec un projet en cours de session (fiche 241)', () => {
  it('rien de nouveau dans le dossier : aucun avis, aucune notification', async () => {
    const { endpoint, update, appTools, turn } = setup()
    endpoint.open(true)
    await turn('edit')
    expect(update).not.toHaveBeenCalled()
    expect(appTools()).toEqual([])
    expect(endpoint.names()).toEqual(['ask_user'])
  })

  it('le dossier n’est lu qu’après un tour qui a pu écrire, une fois par tour', async () => {
    const { endpoint, appears, turn, createProject, appTools } = setup()
    endpoint.open(true)
    createProject()
    await turn() // Réponse en texte seul.
    await turn('read', 'search', 'fetch', 'think')
    expect(appears).not.toHaveBeenCalled()
    expect(appTools()).toEqual([])
    await turn('read', 'execute', 'edit')
    expect(appears).toHaveBeenCalledTimes(1)
    expect(appTools()).toEqual([{ type: 'app-tools', family: 'ios-simulator', state: 'pending' }])
  })

  it('famille que l’agent a déjà : plus jamais recherchée', async () => {
    const { endpoint, appears, turn, createProject } = setup('listed')
    endpoint.open(true)
    createProject()
    await turn('edit')
    expect(appears).toHaveBeenCalledTimes(1)
    expect(endpoint.names()).toContain('ios_build')
    await turn('edit')
    await turn('execute')
    expect(appears).toHaveBeenCalledTimes(1)
  })

  it('agent qui relit la liste après la notification : famille ajoutée sans redémarrer', async () => {
    const { endpoint, update, appTools, createProject, turn } = setup('listed')
    endpoint.open(true)
    createProject()
    await turn('edit')
    expect(update).toHaveBeenCalledTimes(1)
    expect(update.mock.calls[0]?.[0].map((t) => t.definition.name)).toEqual([
      'ask_user',
      'ios_build',
      'ios_screenshot'
    ])
    expect(appTools()).toEqual([{ type: 'app-tools', family: 'ios-simulator', state: 'live' }])
    expect(endpoint.names()).toContain('ios_build')
    await turn('edit')
    expect(appTools()).toHaveLength(1)
  })

  it('agent sans flux (Bob : inconnu) : avis redonné sous chaque réponse sans relire le dossier, puis donnés s’il relit', async () => {
    const { endpoint, update, appears, appTools, createProject, relistByAgent, turn } =
      setup('no-stream')
    endpoint.open(true)
    createProject()
    await turn('edit')
    expect(appTools()).toEqual([{ type: 'app-tools', family: 'ios-simulator', state: 'pending' }])
    expect(endpoint.names()).not.toContain('ios_build')
    await turn() // L'agent répond qu'il n'a pas l'outil.
    expect(appears).toHaveBeenCalledTimes(1) // Projet déjà trouvé : rien relu.
    expect(update).toHaveBeenCalledTimes(1) // Déjà servie : rien à annoncer de plus.
    expect(appTools().map((e) => e.type === 'app-tools' && e.state)).toEqual(['pending', 'pending'])
    // L'agent relit la liste de lui-même (le serveur la sert déjà) : il a les outils.
    relistByAgent(['ask_user', 'ios_build', 'ios_screenshot'])
    expect(appTools().at(-1)).toEqual({ type: 'app-tools', family: 'ios-simulator', state: 'live' })
  })

  it('notification laissée passer : avis, et plus d’attente dans cette session', async () => {
    const { endpoint, update, appTools, createProject, turn } = setup('ignored')
    endpoint.open(true)
    createProject()
    await turn('edit')
    expect(update).toHaveBeenCalledTimes(1)
    expect(appTools()).toEqual([{ type: 'app-tools', family: 'ios-simulator', state: 'pending' }])
  })

  it('lecture seule (rôle d’avis) : les outils ajoutés en cours de route le sont aussi', async () => {
    // `readOnly` du contexte : chaque commande d'`ios_build` demandée, sans « toujours » (fiche 223).
    const { endpoint, contexts, createProject, turn } = setup('listed', { readOnly: true })
    endpoint.open(true)
    contexts.length = 0
    createProject()
    await turn('edit')
    expect(endpoint.names()).toContain('ios_build')
    expect(contexts.length).toBeGreaterThan(0)
    expect(contexts.every((c) => c.readOnly === true)).toBe(true)
  })

  it('session suivante (redémarrage) : elle a la famille, dite au fil ; sans HTTP, rien', async () => {
    const { endpoint, appTools, createProject, turn } = setup('no-stream')
    endpoint.open(true)
    createProject()
    await turn('edit')
    endpoint.open(true)
    endpoint.sessionOpened()
    expect(appTools().at(-1)).toEqual({
      type: 'app-tools',
      family: 'ios-simulator',
      state: 'session'
    })
    expect(endpoint.names()).toContain('ios_build')
    await turn('edit')
    expect(appTools()).toHaveLength(2)
    endpoint.open(false)
    endpoint.sessionOpened()
    await turn('edit')
    expect(appTools()).toHaveLength(2)
    expect(endpoint.names()).toEqual([])
  })
})
