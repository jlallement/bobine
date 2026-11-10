import { describe, expect, it, vi } from 'vitest'
import type { ToolContext } from '../mcp/tools'
import { TerminalManager, type Pty } from './terminal-manager'
import { terminalToolsModule } from './terminal-tools'

/** Faux pseudo-terminal : note ce qu'on y écrit, renvoie ce qu'on lui dit d'afficher. */
function fakePty() {
  const written: string[] = []
  let emit: (d: string) => void = () => {}
  const pty: Pty & { show: (d: string) => void; written: string[] } = {
    pid: 1,
    process: 'zsh',
    onData: (listener) => (emit = listener),
    onExit: () => {},
    write: (d) => written.push(d),
    resize: () => {},
    kill: () => {},
    show: (d) => emit(d),
    written
  }
  return pty
}

function setup(answer: string[] | null = ['Lancer']) {
  const ptys: ReturnType<typeof fakePty>[] = []
  const manager = new TerminalManager({
    spawn: () => {
      const pty = fakePty()
      ptys.push(pty)
      return pty
    },
    shell: '/bin/zsh',
    onData: () => {},
    onChange: () => {}
  })
  const context: ToolContext = {
    workspace: '/projet',
    conversationId: 'c1',
    ask: vi.fn(async () => answer),
    proposeChild: async () => ({ action: 'refuse' as const }),
    tellAgent: () => {}
  }
  const tools = terminalToolsModule(manager).tools(context)
  const call = async (name: string, args: unknown = {}) => {
    const result = await tools.find((t) => t.definition.name === name)?.call(args)
    const first = result?.content[0]
    return first?.type === 'text' ? first.text : ''
  }
  return { manager, ptys, context, call, tools }
}

describe('outils du terminal', () => {
  it('autorisés d’office (la commande est montrée à l’utilisateur), onglet « Terminal »', () => {
    expect(setup().tools.every((t) => t.autoAllow && t.panel === 'terminal')).toBe(true)
  })

  it('commande montrée une fois, lancée dans un onglet neuf, puis lue', async () => {
    const t = setup()
    expect(await t.call('terminal_list')).toBe('No terminal tab is open.')
    expect(await t.call('terminal_run', { command: 'npm test' })).toContain('terminal tab 1')
    expect(t.ptys[0]?.written).toEqual(['npm test\r'])
    t.ptys[0]?.show('$ npm test\r\n12 tests réussis\r\n')
    expect(await t.call('terminal_read', { tab_id: '1' })).toContain('12 tests réussis')
    await t.call('terminal_run', { command: 'npm test' })
    expect(t.context.ask).toHaveBeenCalledTimes(1)
  })

  it('commande refusée : rien ne part ; plusieurs lignes refusées', async () => {
    const t = setup(['Refuser'])
    expect(await t.call('terminal_run', { command: 'rm -rf build' })).toContain('refused')
    expect(t.ptys).toHaveLength(0)
    expect(await setup().call('terminal_run', { command: 'a\nb' })).toContain('one command line')
  })

  it('arrêt : Ctrl+C dans l’onglet', async () => {
    const t = setup()
    t.manager.create('c1', '/projet')
    await t.call('terminal_stop')
    expect(t.ptys[0]?.written).toEqual(['\x03'])
  })
})
