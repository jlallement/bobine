import { afterEach, describe, expect, it, vi } from 'vitest'
import { askUserTool } from './ask-user-tool'
import { AppToolServer } from './tool-server'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { initLog, setVerbosity } from '../log'

interface RpcReply {
  result: {
    protocolVersion?: string
    serverInfo?: { name: string }
    tools?: { name: string }[]
    content?: { type: string; text: string }[]
    isError?: boolean
  }
}
const json = async (response: Response) => (await response.json()) as RpcReply

const servers: AppToolServer[] = []
afterEach(() => servers.splice(0).forEach((s) => s.stop()))

async function setup() {
  const server = new AppToolServer()
  servers.push(server)
  await server.start()
  const handler = vi.fn(async () => ({ text: 'The user chose: zsh.' }))
  const capture = {
    definition: { name: 'screenshot', description: 'Capture', inputSchema: { type: 'object' } },
    autoAllow: true,
    call: vi.fn(async () => ({
      content: [
        { type: 'text' as const, text: 'Capture' },
        { type: 'image' as const, data: 'AA==', mimeType: 'image/png' }
      ]
    }))
  }
  const failing = {
    definition: { name: 'boom', description: 'Échoue', inputSchema: { type: 'object' } },
    autoAllow: false,
    call: async () => {
      throw new Error('Panne simulée')
    }
  }
  const refusing = {
    definition: { name: 'refused', description: 'Refusé', inputSchema: { type: 'object' } },
    autoAllow: false,
    call: async () => ({
      content: [{ type: 'text' as const, text: 'The user refused.' }],
      isError: true,
      refused: true as const
    })
  }
  const endpoint = server.register([askUserTool(handler), capture, failing, refusing])
  if (!endpoint) throw new Error('point d’accès attendu')
  const post = (body: unknown, url = endpoint.url, headers: Record<string, string> = {}) =>
    fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body)
    })
  return { endpoint, handler, capture, post }
}

describe('serveur MCP des outils de l’app', () => {
  it('initialize, tools/list, tools/call → la question va à la session', async () => {
    const { handler, post } = await setup()
    const init = await json(
      await post({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { protocolVersion: '2025-11-25' }
      })
    )
    expect(init.result).toMatchObject({
      protocolVersion: '2025-11-25',
      serverInfo: { name: 'bobine' }
    })
    expect((await post({ jsonrpc: '2.0', method: 'notifications/initialized' })).status).toBe(202)
    const list = await json(await post({ jsonrpc: '2.0', id: 2, method: 'tools/list' }))
    expect(list.result.tools?.map((t) => t.name)).toEqual([
      'ask_user',
      'screenshot',
      'boom',
      'refused'
    ])
    const call = await json(
      await post({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'ask_user',
          arguments: { question: 'Quel shell ?', options: ['bash', 'zsh'] }
        }
      })
    )
    expect(call.result).toEqual({ content: [{ type: 'text', text: 'The user chose: zsh.' }] })
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ question: 'Quel shell ?' }))
  })

  it('outil d’un module : texte et image renvoyés ; erreur levée → résultat en erreur', async () => {
    const { capture, post } = await setup()
    const call = (name: string, id: number) =>
      post({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: {} } }).then(json)
    expect((await call('screenshot', 1)).result.content).toEqual([
      { type: 'text', text: 'Capture' },
      { type: 'image', data: 'AA==', mimeType: 'image/png' }
    ])
    expect(capture.call).toHaveBeenCalledWith({}, { signal: expect.any(AbortSignal) })
    expect((await call('boom', 2)).result).toEqual({
      content: [{ type: 'text', text: 'Panne simulée' }],
      isError: true
    })
    const unknown = (await (
      await post({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'inconnu' } })
    ).json()) as { error?: { code: number } }
    expect(unknown.error?.code).toBe(-32602)
    // Refus (fiche 122) : une erreur pour l'agent ; la marque de l'app ne part pas.
    expect((await call('refused', 4)).result).toEqual({
      content: [{ type: 'text', text: 'The user refused.' }],
      isError: true
    })
  })

  it('arguments invalides : résultat en erreur, sans déranger l’utilisateur', async () => {
    const { handler, post } = await setup()
    const call = await json(
      await post({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'ask_user', arguments: {} }
      })
    )
    expect(call.result.isError).toBe(true)
    expect(handler).not.toHaveBeenCalled()
  })

  it('refuse : jeton inconnu ou révoqué, requête d’une page web, autre méthode HTTP', async () => {
    const { endpoint, post } = await setup()
    const ping = { jsonrpc: '2.0', id: 1, method: 'ping' }
    expect((await post(ping)).status).toBe(200)
    expect((await post(ping, endpoint.url.replace(/[0-9a-f]{48}$/, 'a'.repeat(48)))).status).toBe(
      404
    )
    expect((await post(ping, endpoint.url, { origin: 'https://exemple.com' })).status).toBe(404)
    expect((await fetch(endpoint.url)).status).toBe(405)
    endpoint.dispose()
    expect((await post(ping)).status).toBe(404)
  })

  it('journal (fiche 080) : chaque appel, sa durée et son résultat ; arguments en Trace seulement', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mcp-log-'))
    initLog(dir)
    const { post } = await setup()
    const call = (name: string, id: number) =>
      post({
        jsonrpc: '2.0',
        id,
        method: 'tools/call',
        params: { name, arguments: { url: 'secret-free' } }
      }).then(json)
    try {
      setVerbosity('detailed')
      await call('screenshot', 1)
      await call('boom', 2)
      setVerbosity('trace')
      await call('screenshot', 3)
    } finally {
      setVerbosity('normal')
    }
    const lines = readFileSync(join(dir, 'agents.log'), 'utf8').trim().split('\n')
    expect(lines[0]).toMatch(/\[— \] MCP → screenshot$|\[—\] MCP → screenshot$/)
    expect(lines[1]).toMatch(/MCP ← screenshot en \d+ ms : 1 texte\(s\), 1 image\(s\)$/)
    expect(lines[3]).toMatch(/MCP ← boom en \d+ ms : erreur « Panne simulée »$/)
    expect(lines[4]).toMatch(/MCP → screenshot : \{"url":"secret-free"\}$/)
    expect(lines[5]).toMatch(/MCP ← screenshot en \d+ ms : 1 texte\(s\), 1 image\(s\) : Capture$/)
  })
})

describe('serveur MCP : appels qui ne rendent pas la main (fiche 195)', () => {
  /** Outil qui ne finit jamais, sauf si son signal est levé ; `seen` reçoit ce signal. */
  function stuckTool(budgetMs?: number) {
    const seen: AbortSignal[] = []
    const tool = {
      definition: { name: 'stuck', description: 'Bloqué', inputSchema: { type: 'object' } },
      autoAllow: true,
      ...(budgetMs ? { budgetMs } : {}),
      call: (_: unknown, context?: { signal: AbortSignal }) =>
        new Promise<never>(() => {
          if (context) seen.push(context.signal)
        })
    }
    return { tool, seen }
  }

  async function serve(tools: Parameters<AppToolServer['register']>[0]) {
    const server = new AppToolServer()
    servers.push(server)
    await server.start()
    const endpoint = server.register(tools)
    if (!endpoint) throw new Error('point d’accès attendu')
    return endpoint.url
  }

  const call = (name: string) => ({
    jsonrpc: '2.0',
    id: 7,
    method: 'tools/call',
    params: { name, arguments: {} }
  })

  it('budget dépassé : l’outil est prévenu et l’agent reçoit une erreur', async () => {
    const { tool, seen } = stuckTool(50)
    const url = await serve([tool])
    const reply = await fetch(url, { method: 'POST', body: JSON.stringify(call('stuck')) }).then(
      json
    )
    expect(reply.result.isError).toBe(true)
    expect(reply.result.content?.[0]?.text).toMatch(/did not finish within .* and was stopped/)
    expect(seen[0]?.aborted).toBe(true)
  })

  it('le client raccroche : l’outil est prévenu', async () => {
    const { tool, seen } = stuckTool()
    const url = await serve([tool])
    const hangUp = new AbortController()
    const request = fetch(url, {
      method: 'POST',
      body: JSON.stringify(call('stuck')),
      signal: hangUp.signal
    }).catch(() => 'raccroché')
    await vi.waitFor(() => expect(seen).toHaveLength(1))
    hangUp.abort()
    expect(await request).toBe('raccroché')
    await vi.waitFor(() => expect(seen[0]?.aborted).toBe(true))
  })

  it('outil qui ignore le signal : son résultat tardif est abandonné, le serveur continue', async () => {
    let finish: (() => void) | undefined
    const late = {
      definition: { name: 'late', description: 'Tardif', inputSchema: { type: 'object' } },
      autoAllow: true,
      call: () =>
        new Promise<{ content: { type: 'text'; text: string }[] }>((resolve) => {
          finish = () => resolve({ content: [{ type: 'text', text: 'trop tard' }] })
        })
    }
    const url = await serve([late])
    const hangUp = new AbortController()
    const request = fetch(url, {
      method: 'POST',
      body: JSON.stringify(call('late')),
      signal: hangUp.signal
    }).catch(() => 'raccroché')
    await vi.waitFor(() => expect(finish).toBeDefined())
    hangUp.abort()
    expect(await request).toBe('raccroché')
    finish?.()
    await new Promise((resolve) => setTimeout(resolve, 50))
    const ping = await fetch(url, {
      method: 'POST',
      body: JSON.stringify({ jsonrpc: '2.0', id: 9, method: 'ping' })
    })
    expect(ping.status).toBe(200)
  })

  it('exception hors des `try` : réponse 500, pas de requête sans réponse', async () => {
    const broken = {
      definition: {
        get name(): string {
          throw new Error('définition cassée')
        },
        description: 'Cassé',
        inputSchema: { type: 'object' }
      },
      autoAllow: true,
      call: async () => ({ content: [] })
    }
    const url = await serve([broken])
    const response = await fetch(url, {
      method: 'POST',
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' })
    })
    expect(response.status).toBe(500)
  })
})
