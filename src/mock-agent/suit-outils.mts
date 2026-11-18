/**
 * Agent factice qui suit une liste d'outils qui change (fiche 241), comme OpenCode 2.3.0 (essai
 * réel du 2026-11-18) : à l'ouverture de la session, il se connecte au serveur MCP HTTP du client,
 * lit ses outils, ouvre le flux SSE (`GET`, `accept: text/event-stream`), et relit la liste
 * (`tools/list`) à chaque `notifications/tools/list_changed`. `--suit-outils` ou
 * `MOCK_AGENT_SUIT_OUTILS=1` ; sans lui, l'agent factice n'ouvre pas de flux (comme un agent qui ne
 * suit pas les changements).
 */
import type { McpServer } from '../shared/acp-sdk.mts'

const NOTIFICATION = 'notifications/tools/list_changed'

export function followToolList(servers: readonly McpServer[] | undefined): void {
  const server = servers?.find(
    (s): s is Extract<McpServer, { type: 'http' }> => 'type' in s && s.type === 'http'
  )
  if (server) void follow(server.url).catch(() => {})
}

async function follow(url: string): Promise<void> {
  const post = (body: object) =>
    fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream'
      },
      body: JSON.stringify({ jsonrpc: '2.0', ...body })
    })
  let id = 0
  const list = () => post({ id: ++id, method: 'tools/list', params: {} })
  await post({
    id: ++id,
    method: 'initialize',
    params: {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'mock-agent', version: '0' }
    }
  })
  await post({ method: 'notifications/initialized' })
  await list()
  const events = await fetch(url, { headers: { accept: 'text/event-stream' } })
  const reader = events.body?.getReader()
  if (!events.ok || !reader) return
  const decoder = new TextDecoder()
  let pending = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) return
    pending += decoder.decode(value, { stream: true })
    const blocks = pending.split('\n\n')
    pending = blocks.pop() ?? ''
    if (blocks.some((block) => block.includes(NOTIFICATION))) await list()
  }
}
