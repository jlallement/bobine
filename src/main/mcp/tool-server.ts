/**
 * Serveur MCP hébergé dans le main (ADR-0003) : fournit les outils de l'app aux agents (questions,
 * fiche 028 ; socle générique, fiche 029).
 *
 * Transport « Streamable HTTP » réduit au nécessaire : POST JSON-RPC, réponse JSON. Écoute sur
 * 127.0.0.1 seulement ; chaque session d'agent a son propre chemin secret (`/mcp/<jeton>`), qui
 * désigne la session d'agent et ses outils. Les requêtes venant d'une page web (en-tête
 * `Origin`) sont refusées.
 */
import { randomBytes } from 'node:crypto'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { APP_TOOLS_SERVER_NAME, type AppTool } from './tools'
import { withHints } from './tool-hints'
import { agentLog, logs, type LogScope } from '../log'
import { excerpt } from '../log-redact'
import { formatDuration } from '../agent/acp-log'
import { messageOf } from '@shared/errors'

/** Point d'accès d'une session : à transmettre à l'agent dans `mcpServers`. */
export interface ToolEndpoint {
  url: string
  dispose: () => void
}

const SUPPORTED_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05']
const MAX_BODY = 1024 * 1024
/**
 * Budget d'un appel d'outil sans budget propre (fiche 195) : au-delà, l'appel est interrompu et
 * l'agent reçoit une erreur, au lieu d'une requête qui ne rend jamais la main. Large : les outils
 * qui attendent (question, compilation) se bornent eux-mêmes bien avant.
 */
export const DEFAULT_TOOL_BUDGET_MS = 10 * 60_000

interface JsonRpcRequest {
  jsonrpc: '2.0'
  id?: string | number | null
  method: string
  params?: Record<string, unknown>
}

export class AppToolServer {
  private server: Server | undefined
  private port: number | undefined
  private readonly sessions = new Map<string, { tools: readonly AppTool[]; scope: LogScope }>()
  /** Version annoncée à l'agent (`serverInfo`) : celle de l'app. */
  private readonly version: string

  constructor(options: { version?: string } = {}) {
    this.version = options.version ?? '0.0.0'
  }

  async start(): Promise<void> {
    if (this.server) return
    // Une exception hors des `try` (fiche 195) : réponse 500 au lieu d'une requête sans réponse.
    const server = createServer((req, res) => {
      this.handle(req, res).catch((error: unknown) => {
        agentLog.line({}, `MCP : requête en échec « ${excerpt(messageOf(error), 200)} »`)
        if (!res.headersSent) res.writeHead(500)
        res.end()
      })
    })
    // Une question peut attendre longtemps la réponse de l'utilisateur.
    server.requestTimeout = 0
    server.headersTimeout = 30_000
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', () => resolve())
    })
    const address = server.address()
    this.port = typeof address === 'object' && address ? address.port : undefined
    this.server = server
  }

  /**
   * Nouveau point d'accès pour une session et ses outils ; `dispose` le révoque. `scope` : la
   * conversation et l'agent, pour le journal (fiche 080).
   */
  register(tools: readonly AppTool[], scope: LogScope = {}): ToolEndpoint | undefined {
    if (this.port === undefined) return undefined
    const token = randomBytes(24).toString('hex')
    this.sessions.set(token, { tools, scope })
    return {
      url: `http://127.0.0.1:${this.port}/mcp/${token}`,
      dispose: () => this.sessions.delete(token)
    }
  }

  /** Le serveur écoute : sinon les agents n'ont pas les outils de l'app (avis au lancement). */
  get listening(): boolean {
    return this.port !== undefined
  }

  stop(): void {
    this.sessions.clear()
    this.server?.close()
    this.server?.closeAllConnections()
    this.server = undefined
    this.port = undefined
  }

  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const token = /^\/mcp\/([0-9a-f]{48})$/.exec(req.url ?? '')?.[1]
    const session = token ? this.sessions.get(token) : undefined
    if (!session || req.headers.origin) {
      res.writeHead(404).end()
      return
    }
    if (req.method !== 'POST') {
      // Pas de flux SSE côté serveur : autorisé par le transport Streamable HTTP.
      res.writeHead(405, { allow: 'POST' }).end()
      return
    }
    let body: unknown
    try {
      body = JSON.parse(await readBody(req))
    } catch {
      sendJson(res, 400, {
        jsonrpc: '2.0',
        id: null,
        error: { code: -32700, message: 'Parse error' }
      })
      return
    }
    const messages = (Array.isArray(body) ? body : [body]) as JsonRpcRequest[]
    // Client parti avant la réponse (fiche 195) : les outils en cours sont prévenus.
    const gone = new AbortController()
    res.on('close', () => {
      if (!res.writableFinished) gone.abort()
    })
    const replies = (
      await Promise.all(
        messages.map((m) => this.answer(m, session.tools, session.scope, gone.signal))
      )
    ).filter((r): r is object => r !== undefined)
    if (gone.signal.aborted) {
      agentLog.line(session.scope, 'MCP : l’agent a raccroché avant la réponse, réponse abandonnée')
      return
    }
    if (replies.length === 0) res.writeHead(202).end()
    else sendJson(res, 200, Array.isArray(body) ? replies : replies[0])
  }

  /** Réponse à un message JSON-RPC ; `undefined` pour une notification. */
  private async answer(
    message: JsonRpcRequest,
    tools: readonly AppTool[],
    scope: LogScope,
    gone: AbortSignal = new AbortController().signal
  ): Promise<object | undefined> {
    if (typeof message !== 'object' || message === null || message.id === undefined)
      return undefined
    const reply = (result: unknown) => ({ jsonrpc: '2.0', id: message.id, result })
    const fail = (code: number, text: string) => ({
      jsonrpc: '2.0',
      id: message.id,
      error: { code, message: text }
    })
    switch (message.method) {
      case 'initialize': {
        const asked = message.params?.['protocolVersion']
        return reply({
          protocolVersion:
            typeof asked === 'string' && SUPPORTED_VERSIONS.includes(asked)
              ? asked
              : SUPPORTED_VERSIONS[0],
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: APP_TOOLS_SERVER_NAME, title: 'Bobine', version: this.version }
        })
      }
      case 'ping':
        return reply({})
      case 'tools/list':
        agentLog.line(scope, `MCP tools/list : ${tools.length} outil(s)`)
        return reply({ tools: tools.map((t) => withHints(t.definition)) })
      case 'tools/call': {
        const name = message.params?.['name']
        const tool = tools.find((t) => t.definition.name === name)
        if (!tool) {
          agentLog.line(scope, `MCP → outil inconnu : ${excerpt(name ?? '', 80)}`)
          return fail(-32602, 'Outil inconnu')
        }
        const args = message.params?.['arguments'] ?? {}
        const started = Date.now()
        agentLog.line(
          scope,
          `MCP → ${tool.definition.name}${logs('trace') ? ` : ${excerpt(args)}` : ''}`
        )
        try {
          const { refused: _refused, ...result } = await callWithin(tool, args, gone)
          agentLog.line(
            scope,
            `MCP ← ${tool.definition.name} en ${formatDuration(Date.now() - started)} : ${resultText(result)}`
          )
          return reply(result)
        } catch (error) {
          const text = messageOf(error)
          agentLog.line(
            scope,
            `MCP ← ${tool.definition.name} en ${formatDuration(Date.now() - started)} : erreur « ${excerpt(text, 200)} »`
          )
          return reply({ content: [{ type: 'text', text }], isError: true })
        }
      }
      default:
        return fail(-32601, 'Méthode non prise en charge')
    }
  }
}

/**
 * Appel d'un outil borné (fiche 195) : `tool.budgetMs`, sinon `DEFAULT_TOOL_BUDGET_MS`. L'outil
 * reçoit un signal levé quand le budget est dépassé ou que le client est parti ; il peut s'en
 * servir pour s'arrêter. Le budget dépassé est rendu comme une erreur (texte pour l'agent).
 */
export async function callWithin(
  tool: Pick<AppTool, 'call' | 'budgetMs' | 'definition'>,
  args: unknown,
  gone: AbortSignal
): ReturnType<AppTool['call']> {
  const budget = tool.budgetMs ?? DEFAULT_TOOL_BUDGET_MS
  const stop = new AbortController()
  const abort = () => stop.abort()
  gone.addEventListener('abort', abort, { once: true })
  let timer: ReturnType<typeof setTimeout> | undefined
  const overBudget = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      stop.abort()
      reject(
        new Error(
          `The app tool ${tool.definition.name} did not finish within ${formatDuration(budget)} and was stopped.`
        )
      )
    }, budget)
    timer.unref?.()
  })
  try {
    return await Promise.race([tool.call(args, { signal: stop.signal }), overBudget])
  } finally {
    clearTimeout(timer)
    gone.removeEventListener('abort', abort)
  }
}

/** Résultat d'un outil, pour le journal : textes, images, erreur ; extrait du texte en Trace. */
function resultText(result: {
  content: readonly { type: string; text?: string }[]
  isError?: boolean
}): string {
  const texts = result.content.flatMap((c) => (c.type === 'text' && c.text ? [c.text] : []))
  const images = result.content.filter((c) => c.type === 'image').length
  const parts = [
    `${texts.length} texte(s)`,
    ...(images ? [`${images} image(s)`] : []),
    ...(result.isError ? ['erreur'] : [])
  ]
  const tail = logs('trace') && texts.length ? ` : ${excerpt(texts.join('\n'))}` : ''
  return `${parts.join(', ')}${tail}`
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY) {
        reject(new Error('Requête trop grande'))
        req.destroy()
      } else chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(payload))
}
