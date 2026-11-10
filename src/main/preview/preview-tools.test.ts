import { describe, expect, it, vi } from 'vitest'
import type { LaunchConfig } from '@shared/launch'
import type { ToolContext } from '../mcp/tools'
import type { DevServers, StartOutcome } from './dev-servers'
import { previewToolsModule } from './preview-tools'

const WEB: LaunchConfig = {
  name: 'web',
  runtimeExecutable: 'npm',
  runtimeArgs: ['run', 'dev'],
  port: 5173,
  env: {}
}

function setup(
  answer: string[] | null | 'late' = ['Lancer'],
  configs: LaunchConfig[] | null = [WEB],
  state: StartOutcome['state'] = 'ready'
) {
  const start = vi.fn(async (): Promise<StartOutcome> => ({
    state,
    reused: false,
    tail: ['> vite', 'Error: port pris'],
    server: {
      name: 'web',
      status: state === 'ready' ? 'running' : state === 'starting' ? 'starting' : 'exited',
      url: 'http://localhost:5173/',
      command: 'npm run dev',
      pid: 42
    }
  }))
  const servers = {
    start,
    list: vi.fn(() => []),
    logs: vi.fn(() => ['ligne 1', 'Error: boum']),
    stop: vi.fn(() => true)
  } as unknown as DevServers
  const openInBrowser = vi.fn(async () => {})
  const module = previewToolsModule({
    servers,
    openInBrowser,
    readConfigs: () => (configs ? { file: '.bob/launch.json', configs } : undefined)
  })
  const late: ((choices: string[] | null) => void)[] = []
  const told: string[] = []
  const context: ToolContext = {
    workspace: '/projets/demo',
    conversationId: 'c1',
    ask: vi.fn(async (_args, onLate) => {
      if (onLate) late.push(onLate)
      return answer
    }),
    proposeChild: async () => ({ action: 'refuse' as const }),
    tellAgent: (t) => told.push(t)
  }
  const tools = module.tools(context)
  const call = async (name: string, args: unknown = {}) => {
    const result = await tools.find((t) => t.definition.name === name)?.call(args)
    const first = result?.content[0]
    return { text: first?.type === 'text' ? first.text : '', isError: result?.isError ?? false }
  }
  return { call, context, start, openInBrowser, late, told, servers }
}

describe('outils « lancer l’app »', () => {
  it('commande montrée une fois, serveur démarré puis ouvert dans le navigateur', async () => {
    const t = setup()
    const first = await t.call('preview_start')
    expect(first.text).toContain('started: http://localhost:5173/')
    expect(t.context.ask).toHaveBeenCalledWith(
      expect.objectContaining({ question: expect.stringContaining('npm run dev') }),
      expect.any(Function)
    )
    expect(t.openInBrowser).toHaveBeenCalledWith('c1', 'http://localhost:5173/')
    await t.call('preview_start', { name: 'web' })
    expect(t.context.ask).toHaveBeenCalledTimes(1)
  })

  it('commande refusée : rien n’est lancé', async () => {
    const t = setup(['Refuser'])
    expect((await t.call('preview_start')).text).toContain('refused')
    expect(t.start).not.toHaveBeenCalled()
  })

  it('réponse tardive : l’agent finit son tour, l’accord arrive ensuite', async () => {
    const t = setup('late')
    expect((await t.call('preview_start')).text).toContain('End your turn')
    t.late[0]?.(['Lancer'])
    expect(t.told[0]).toContain('relance preview_start')
  })

  it('pas de fichier de lancement : l’agent reçoit le format à créer', async () => {
    const t = setup(['Lancer'], null)
    const result = await t.call('preview_start')
    expect(result.isError).toBe(true)
    expect(result.text).toContain('.bob/launch.json')
    expect(result.text).toContain('runtimeExecutable')
  })

  it('plusieurs configurations : le nom est demandé', async () => {
    const t = setup(['Lancer'], [WEB, { ...WEB, name: 'api', port: 8080 }])
    expect((await t.call('preview_start')).text).toContain('web, api')
    expect((await t.call('preview_start', { name: 'docs' })).isError).toBe(true)
  })

  it('encore en cours ou échec : l’agent sait quoi faire', async () => {
    expect((await setup(['Lancer'], [WEB], 'starting').call('preview_start')).text).toContain(
      'still starting'
    )
    const failed = await setup(['Lancer'], [WEB], 'failed').call('preview_start')
    expect(failed).toMatchObject({
      isError: true,
      text: expect.stringContaining('Error: port pris')
    })
  })

  it('journaux et arrêt', async () => {
    const t = setup()
    expect((await t.call('preview_logs', { name: 'web', level: 'error' })).text).toContain('boum')
    expect(t.servers.logs).toHaveBeenCalledWith('/projets/demo', 'web', {
      errorsOnly: true,
      lines: 50
    })
    expect((await t.call('preview_stop', { name: 'web' })).text).toContain('stopped')
  })
})
