/**
 * « Tester » un serveur MCP (fiche 060) : l'app s'y connecte comme un agent le ferait, demande
 * `initialize`, liste ses outils (et ses ressources et prompts s'il en annonce), puis ferme. Rien
 * n'est envoyé à un modèle. Client minimal, comme le serveur de l'app (ADR-0003) :
 * - commande locale (stdio) : un message JSON par ligne ;
 * - HTTP « Streamable » : POST JSON-RPC, réponse JSON ou flux SSE, session `Mcp-Session-Id`.
 * Les requêtes du serveur vers le client (racines, échantillonnage…) reçoivent « méthode inconnue ».
 */
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import type { McpServer, McpTestResult } from '@shared/mcp'
import { killTree, spawnError } from '../agent/process-utils'
import { trackChild } from '../process-registry'
import { t } from 'i18next'
import { messageOf } from '@shared/errors'
import { estimateTokens } from '@shared/usage'

const PROTOCOL_VERSION = '2025-06-18'
/** Premier lancement par `npx` : téléchargement du paquet compris. */
export const MCP_TEST_TIMEOUT_MS = 90_000
const STDERR_TAIL = 4000
const MAX_PAGES = 20

type Message = {
  jsonrpc: '2.0'
  id?: number | string
  method?: string
  params?: Record<string, unknown>
  result?: Record<string, unknown>
  error?: { code: number; message: string }
}

/** Canal JSON-RPC vers le serveur : une requête, sa réponse. */
interface Channel {
  request(method: string, params?: Record<string, unknown>): Promise<Record<string, unknown>>
  notify(method: string): Promise<void>
  close(): void
}

export interface ProbeOptions {
  /** Dossier où lancer une commande locale. */
  cwd: string
  env?: NodeJS.ProcessEnv
  timeoutMs?: number
  clientVersion?: string
}

export async function probeMcpServer(
  server: McpServer,
  options: ProbeOptions
): Promise<McpTestResult> {
  const started = Date.now()
  let channel: Channel | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(t('mcpProbe.timeout'))),
      options.timeoutMs ?? MCP_TEST_TIMEOUT_MS
    )
  })
  try {
    channel = server.transport === 'http' ? httpChannel(server) : stdioChannel(server, options)
    const result = await Promise.race([explore(channel, options.clientVersion), timeout])
    return { ...result, ms: Date.now() - started }
  } catch (error) {
    const stderr = channel && 'stderr' in channel ? (channel as { stderr(): string }).stderr() : ''
    const message = messageOf(error)
    return {
      ok: false,
      error: stderr.trim() ? `${message}\n${stderr.trim()}` : message,
      ms: Date.now() - started
    }
  } finally {
    clearTimeout(timer)
    channel?.close()
  }
}

/** `initialize`, puis la liste des outils (et des ressources et prompts annoncés). */
async function explore(
  channel: Channel,
  clientVersion = '0.0.0'
): Promise<Omit<Extract<McpTestResult, { ok: true }>, 'ms'>> {
  const init = await channel.request('initialize', {
    protocolVersion: PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: { name: 'bobine', version: clientVersion }
  })
  await channel.notify('notifications/initialized')
  const caps = (init['capabilities'] ?? {}) as Record<string, unknown>
  const info = init['serverInfo'] as { name?: unknown; version?: unknown } | undefined
  const listed = caps['tools'] ? await listItems(channel, 'tools/list', 'tools') : []
  const tools = namesOf(listed)
  const resources = caps['resources']
    ? (await listItems(channel, 'resources/list', 'resources')).length
    : undefined
  const prompts = caps['prompts']
    ? (await listItems(channel, 'prompts/list', 'prompts')).length
    : undefined
  return {
    ok: true,
    ...(typeof info?.name === 'string'
      ? {
          server: {
            name: info.name,
            ...(typeof info.version === 'string' ? { version: info.version } : {})
          }
        }
      : {}),
    tools,
    // Poids estimé des définitions dans le contexte de l'agent (onglet « Session », fiche 166).
    toolTokens: listed.reduce((sum, tool) => sum + estimateTokens(JSON.stringify(tool)), 0),
    ...(resources !== undefined ? { resources } : {}),
    ...(prompts !== undefined ? { prompts } : {})
  }
}

/** Éléments d'une liste paginée, tels que le serveur les décrit. */
async function listItems(
  channel: Channel,
  method: string,
  key: string
): Promise<Record<string, unknown>[]> {
  const all: Record<string, unknown>[] = []
  let cursor: string | undefined
  for (let page = 0; page < MAX_PAGES; page++) {
    const result = await channel.request(method, cursor ? { cursor } : {})
    const items = Array.isArray(result[key]) ? (result[key] as Record<string, unknown>[]) : []
    all.push(...items.filter((item) => typeof item === 'object' && item !== null))
    cursor = typeof result['nextCursor'] === 'string' ? result['nextCursor'] : undefined
    if (!cursor) break
  }
  return all
}

/** Noms (ou `uri`) des éléments. */
const namesOf = (items: readonly Record<string, unknown>[]): string[] =>
  items.flatMap((item) => {
    const name = item['name'] ?? item['uri']
    return typeof name === 'string' ? [name] : []
  })

function replyError(m: Message): Message {
  return { jsonrpc: '2.0', id: m.id, error: { code: -32601, message: 'Method not found' } }
}

function stdioChannel(server: McpServer, options: ProbeOptions): Channel & { stderr(): string } {
  if (!server.command) throw new Error(t('mcpProbe.noCommand'))
  const child: ChildProcessWithoutNullStreams = spawn(server.command, server.args ?? [], {
    cwd: options.cwd,
    env: { ...(options.env ?? process.env), ...(server.env ?? {}) },
    stdio: ['pipe', 'pipe', 'pipe'],
    detached: true
  })
  trackChild(child, [server.command, ...(server.args ?? [])])
  let stderr = ''
  child.stderr.on('data', (d: Buffer) => {
    stderr = (stderr + d.toString()).slice(-STDERR_TAIL)
  })
  const pending = new Map<number, { resolve: (m: Message) => void; reject: (e: Error) => void }>()
  const failAll = (error: Error) => {
    for (const p of pending.values()) p.reject(error)
    pending.clear()
  }
  child.once('error', (error) => failAll(spawnError(error, server.command ?? '')))
  child.once('exit', (code, signal) =>
    failAll(new Error(t('mcpProbe.exited', { status: signal ?? `code ${String(code)}` })))
  )
  child.stdin.on('error', () => {})
  let buffer = ''
  child.stdout.on('data', (d: Buffer) => {
    buffer += d.toString()
    let index
    while ((index = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, index).trim()
      buffer = buffer.slice(index + 1)
      if (!line) continue
      let message: Message
      try {
        message = JSON.parse(line) as Message
      } catch {
        continue // Une ligne de journal égarée sur stdout.
      }
      if (message.method && message.id !== undefined) {
        child.stdin.write(`${JSON.stringify(replyError(message))}\n`)
      } else if (typeof message.id === 'number' && pending.has(message.id)) {
        pending.get(message.id)?.resolve(message)
        pending.delete(message.id)
      }
    }
  })
  let nextId = 1
  const send = (message: Message) => child.stdin.write(`${JSON.stringify(message)}\n`)
  return {
    stderr: () => stderr,
    request: (method, params = {}) =>
      new Promise((resolve, reject) => {
        const id = nextId++
        pending.set(id, {
          resolve: (m) =>
            m.error ? reject(new Error(`${method} : ${m.error.message}`)) : resolve(m.result ?? {}),
          reject
        })
        send({ jsonrpc: '2.0', id, method, params })
      }),
    notify: async (method) => {
      send({ jsonrpc: '2.0', method })
    },
    close: () => {
      failAll(new Error(t('mcpProbe.closed')))
      child.stdin.end()
      killTree(child)
    }
  }
}

/** Réponse d'un POST : JSON, ou flux SSE dont un `data:` porte la réponse attendue. */
async function readReply(response: Response, id: number): Promise<Message | undefined> {
  const type = response.headers.get('content-type') ?? ''
  if (type.includes('text/event-stream')) {
    const text = await response.text()
    for (const line of text.split('\n')) {
      if (!line.startsWith('data:')) continue
      try {
        const message = JSON.parse(line.slice(5).trim()) as Message
        if (message.id === id) return message
      } catch {
        // Événement non JSON : ignoré.
      }
    }
    return undefined
  }
  const body = (await response.json()) as Message | Message[]
  return (Array.isArray(body) ? body : [body]).find((m) => m.id === id)
}

function httpChannel(server: McpServer): Channel {
  if (!server.url) throw new Error('Aucune adresse.')
  const url = server.url
  let session: string | undefined
  let version: string | undefined
  let nextId = 1
  const headers = () => ({
    ...(server.headers ?? {}),
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    ...(session ? { 'Mcp-Session-Id': session } : {}),
    ...(version ? { 'MCP-Protocol-Version': version } : {})
  })
  const controller = new AbortController()
  return {
    request: async (method, params = {}) => {
      const id = nextId++
      const response = await fetch(url, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
        signal: controller.signal
      })
      if (!response.ok)
        throw new Error(`${method} : HTTP ${response.status} ${response.statusText}`)
      session = response.headers.get('mcp-session-id') ?? session
      const reply = await readReply(response, id)
      if (!reply) throw new Error(t('mcpProbe.noAnswer', { step: method }))
      if (reply.error) throw new Error(`${method} : ${reply.error.message}`)
      if (method === 'initialize' && typeof reply.result?.['protocolVersion'] === 'string') {
        version = reply.result['protocolVersion']
      }
      return reply.result ?? {}
    },
    notify: async (method) => {
      await fetch(url, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ jsonrpc: '2.0', method }),
        signal: controller.signal
      }).catch(() => undefined)
    },
    close: () => {
      // Fin de session, si le serveur en a ouvert une ; puis plus rien en vol.
      if (session) {
        void fetch(url, { method: 'DELETE', headers: headers() }).catch(() => undefined)
      }
      controller.abort()
    }
  }
}
