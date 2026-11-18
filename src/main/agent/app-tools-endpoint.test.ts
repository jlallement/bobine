import { existsSync, mkdirSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { AgentEvent } from '@shared/agent'
import { textResult, type AppTool, type AppToolModule } from '../mcp/tools'
import type { ToolListUpdate } from '../mcp/tool-server'
import { AppToolsBridge } from './app-tools-bridge'
import { AppToolsEndpoint } from './app-tools-endpoint'
import type { PendingRequests } from './pending-requests'

const tool = (name: string): AppTool => ({
  definition: { name, description: name, inputSchema: {} },
  autoAllow: true,
  call: async () => textResult('ok')
})

/** Famille « iOS » qui suit le dossier : utile dès qu'il contient `App.xcodeproj`. */
const ios = (workspace: string): AppToolModule => ({
  id: 'ios-simulator',
  about: {
    title: 'appToolFamilies.ios-simulator.title',
    summary: 'appToolFamilies.ios-simulator.summary',
    condition: 'appToolFamilies.ios-simulator.condition'
  },
  enabled: () => existsSync(join(workspace, 'App.xcodeproj')),
  followsWorkspace: true,
  tools: () => [tool('ios_build'), tool('ios_screenshot')]
})

/**
 * Serveur MCP simulé : `relist` dit ce que fait l'agent après la notification — il relit la liste
 * (`listed`, comme OpenCode 2.3.0), la laisse passer (`ignored`) ou n'a pas ouvert de flux.
 */
function setup(relist: ToolListUpdate = 'no-stream') {
  const workspace = mkdtempSync(join(tmpdir(), 'bobine-241-'))
  const events: AgentEvent[] = []
  let onListed: ((names: string[]) => void) | undefined
  const update = vi.fn(async (tools: readonly AppTool[]) => {
    if (relist === 'listed') onListed?.(tools.map((t) => t.definition.name))
    return relist
  })
  const bridge = new AppToolsBridge({
    workspace,
    toolModules: [ios(workspace)],
    emit: (event) => events.push(event),
    requests: {} as PendingRequests,
    connected: () => true,
    tellAgent: () => {}
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
  const appTools = () => events.filter((e) => e.type === 'app-tools')
  const createProject = () => mkdirSync(join(workspace, 'App.xcodeproj'))
  return {
    endpoint,
    update,
    appTools,
    createProject,
    relistByAgent: (names: string[]) => onListed?.(names)
  }
}

describe('outils apparus avec un projet en cours de session (fiche 241)', () => {
  it('rien de nouveau dans le dossier : aucun avis, aucune notification', async () => {
    const { endpoint, update, appTools } = setup()
    endpoint.open(true)
    await endpoint.turnEnded()
    expect(update).not.toHaveBeenCalled()
    expect(appTools()).toEqual([])
    expect(endpoint.names()).toEqual(['ask_user'])
  })

  it('agent qui relit la liste après la notification : famille ajoutée sans redémarrer', async () => {
    const { endpoint, update, appTools, createProject } = setup('listed')
    endpoint.open(true)
    createProject()
    await endpoint.turnEnded()
    expect(update).toHaveBeenCalledTimes(1)
    expect(update.mock.calls[0]?.[0].map((t) => t.definition.name)).toEqual([
      'ask_user',
      'ios_build',
      'ios_screenshot'
    ])
    expect(appTools()).toEqual([{ type: 'app-tools', family: 'ios-simulator', state: 'live' }])
    expect(endpoint.names()).toContain('ios_build')
    // Tour suivant : il a tout, plus rien à dire.
    await endpoint.turnEnded()
    expect(appTools()).toHaveLength(1)
  })

  it('agent sans flux (Bob : inconnu) : « à redémarrer » à chaque fin de tour, puis donnés s’il relit', async () => {
    const { endpoint, update, appTools, createProject, relistByAgent } = setup('no-stream')
    endpoint.open(true)
    createProject()
    await endpoint.turnEnded()
    expect(appTools()).toEqual([{ type: 'app-tools', family: 'ios-simulator', state: 'pending' }])
    expect(endpoint.names()).not.toContain('ios_build')
    await endpoint.turnEnded()
    expect(update).toHaveBeenCalledTimes(1) // Déjà servie : rien à annoncer de plus.
    expect(appTools().map((e) => e.type === 'app-tools' && e.state)).toEqual(['pending', 'pending'])
    // L'agent relit la liste de lui-même (le serveur la sert déjà) : il a les outils.
    relistByAgent(['ask_user', 'ios_build', 'ios_screenshot'])
    expect(appTools().at(-1)).toEqual({ type: 'app-tools', family: 'ios-simulator', state: 'live' })
  })

  it('notification laissée passer : avis, et plus d’attente dans cette session', async () => {
    const { endpoint, update, appTools, createProject } = setup('ignored')
    endpoint.open(true)
    createProject()
    await endpoint.turnEnded()
    expect(update).toHaveBeenCalledTimes(1)
    expect(appTools()).toEqual([{ type: 'app-tools', family: 'ios-simulator', state: 'pending' }])
  })

  it('session suivante (redémarrage) : elle a la famille, dite au fil ; sans HTTP, rien', async () => {
    const { endpoint, appTools, createProject } = setup('no-stream')
    endpoint.open(true)
    createProject()
    await endpoint.turnEnded()
    endpoint.open(true)
    endpoint.sessionOpened()
    expect(appTools().at(-1)).toEqual({
      type: 'app-tools',
      family: 'ios-simulator',
      state: 'session'
    })
    expect(endpoint.names()).toContain('ios_build')
    await endpoint.turnEnded()
    expect(appTools()).toHaveLength(2)
    endpoint.open(false)
    endpoint.sessionOpened()
    await endpoint.turnEnded()
    expect(appTools()).toHaveLength(2)
    expect(endpoint.names()).toEqual([])
  })
})
