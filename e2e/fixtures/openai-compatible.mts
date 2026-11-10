/**
 * Faux point d'accès compatible OpenAI (fiche 104), pour les essais : `GET /v1/models` liste des
 * modèles, `POST /v1/chat/completions` répond toujours le même texte (en flux SSE ou d'un bloc).
 * Avec `apiKey`, un `Authorization: Bearer` différent est refusé (401). Avec `tls`, le serveur
 * parle HTTPS (certificat fourni). Les requêtes reçues sont gardées, pour vérifier ce que le client
 * (OpenCode, ou le bouton « Tester » de l'app) a envoyé.
 *
 * Aussi : un faux proxy `CONNECT` (`startConnectProxy`), et un certificat auto-signé (`selfSigned`,
 * par `openssl`). Partagé par la sonde d'OpenCode, les tests unitaires et les essais de bout en bout.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createServer as createHttpServer, request as httpRequest, type Server } from 'node:http'
import { createServer as createHttpsServer } from 'node:https'
import { connect as netConnect } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export interface SeenRequest {
  method: string
  path: string
  authorization?: string
  /** Corps JSON d'un POST (`model`, `stream`…). */
  body?: Record<string, unknown>
}

export interface FakeOpenAi {
  /** Adresse de base, `/v1` compris. */
  url: string
  port: number
  requests: SeenRequest[]
  close(): Promise<void>
}

export interface FakeOpenAiOptions {
  models: string[]
  /** Clé attendue ; sans elle, tout est accepté. */
  apiKey?: string
  /** Texte de chaque réponse de modèle. */
  reply?: string
  tls?: { key: string; cert: string }
  /** Latence avant chaque réponse (essai du délai d'attente). */
  delayMs?: number
}

const json = (value: unknown) => JSON.stringify(value)

export async function startOpenAiCompatible(options: FakeOpenAiOptions): Promise<FakeOpenAi> {
  const requests: SeenRequest[] = []
  const reply = options.reply ?? 'OK'
  const handler = (
    req: import('node:http').IncomingMessage,
    res: import('node:http').ServerResponse
  ) => {
    let raw = ''
    req.on('data', (chunk: Buffer) => (raw += chunk.toString()))
    req.on('end', () => {
      let body: Record<string, unknown> | undefined
      try {
        body = raw ? (JSON.parse(raw) as Record<string, unknown>) : undefined
      } catch {
        body = undefined
      }
      const authorization = req.headers['authorization']
      const path = (req.url ?? '/').replace(/^\/v1(?=\/|$)/, '')
      requests.push({
        method: req.method ?? '',
        path: req.url ?? '',
        ...(authorization ? { authorization } : {}),
        ...(body ? { body } : {})
      })
      const respond = () => {
        if (options.apiKey && authorization !== `Bearer ${options.apiKey}`) {
          res.writeHead(401, { 'content-type': 'application/json' })
          res.end(
            json({
              error: { message: 'Incorrect API key provided', type: 'invalid_request_error' }
            })
          )
          return
        }
        if (req.method === 'GET' && path === '/models') {
          res.writeHead(200, { 'content-type': 'application/json' })
          res.end(
            json({
              object: 'list',
              data: options.models.map((id) => ({ id, object: 'model', owned_by: 'essai' }))
            })
          )
          return
        }
        if (req.method === 'POST' && path === '/chat/completions') {
          const model = typeof body?.['model'] === 'string' ? body['model'] : 'essai'
          if (body?.['stream'] === true) {
            res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' })
            const chunk = (delta: Record<string, unknown>, finish: string | null) =>
              `data: ${json({
                id: 'chatcmpl-essai',
                object: 'chat.completion.chunk',
                created: 0,
                model,
                choices: [{ index: 0, delta, finish_reason: finish }]
              })}\n\n`
            res.write(chunk({ role: 'assistant', content: reply }, null))
            res.write(chunk({}, 'stop'))
            res.write(
              `data: ${json({
                id: 'chatcmpl-essai',
                object: 'chat.completion.chunk',
                created: 0,
                model,
                choices: [],
                usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
              })}\n\n`
            )
            res.end('data: [DONE]\n\n')
            return
          }
          res.writeHead(200, { 'content-type': 'application/json' })
          res.end(
            json({
              id: 'chatcmpl-essai',
              object: 'chat.completion',
              created: 0,
              model,
              choices: [
                { index: 0, message: { role: 'assistant', content: reply }, finish_reason: 'stop' }
              ],
              usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
            })
          )
          return
        }
        res.writeHead(404, { 'content-type': 'application/json' })
        res.end(json({ error: { message: `Unknown route ${req.method} ${req.url}` } }))
      }
      if (options.delayMs) setTimeout(respond, options.delayMs)
      else respond()
    })
  }
  const server: Server = options.tls
    ? createHttpsServer({ key: options.tls.key, cert: options.tls.cert }, handler)
    : createHttpServer(handler)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 0
  return {
    url: `${options.tls ? 'https' : 'http'}://127.0.0.1:${port}/v1`,
    port,
    requests,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections()
        server.close(() => resolve())
      })
  }
}

export interface FakeProxy {
  /** `http://127.0.0.1:<port>`, à mettre dans `HTTPS_PROXY`. */
  url: string
  /** Hôtes demandés par `CONNECT`, dans l'ordre. */
  connects: string[]
  close(): Promise<void>
}

/**
 * Faux proxy `CONNECT` : toute connexion est tunnelée vers `target`, quel que soit l'hôte demandé
 * (de quoi joindre un faux serveur sous un faux nom). Avec `auth` (`user:mot`), sans
 * `Proxy-Authorization` correct : 407.
 */
export async function startConnectProxy(
  target: { host: string; port: number },
  options: { auth?: string } = {}
): Promise<FakeProxy> {
  const connects: string[] = []
  const sockets = new Set<import('node:stream').Duplex>()
  const server = createHttpServer((_req, res) => {
    res.writeHead(405)
    res.end()
  })
  server.on('connect', (req, socket, head) => {
    connects.push(req.url ?? '')
    const expected = options.auth ? `Basic ${Buffer.from(options.auth).toString('base64')}` : ''
    if (expected && req.headers['proxy-authorization'] !== expected) {
      socket.write(
        'HTTP/1.1 407 Proxy Authentication Required\r\nProxy-Authenticate: Basic realm="essai"\r\nContent-Length: 0\r\n\r\n'
      )
      socket.end()
      return
    }
    sockets.add(socket)
    const upstream = netConnect(target.port, target.host, () => {
      sockets.add(upstream)
      socket.write('HTTP/1.1 200 Connection Established\r\n\r\n')
      if (head.length) upstream.write(head)
      upstream.pipe(socket)
      socket.pipe(upstream)
    })
    upstream.on('error', () => socket.destroy())
    socket.on('error', () => upstream.destroy())
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 0
  return {
    url: `http://127.0.0.1:${port}`,
    connects,
    close: () =>
      new Promise<void>((resolve) => {
        for (const s of sockets) s.destroy()
        server.closeAllConnections()
        server.close(() => resolve())
      })
  }
}

export interface SelfSigned {
  key: string
  cert: string
  /** Fichier PEM du certificat (pour `NODE_EXTRA_CA_CERTS`). */
  certFile: string
  remove(): void
}

/** `openssl` est-il là ? (macOS et Linux : oui.) */
export function hasOpenssl(): boolean {
  try {
    execFileSync('openssl', ['version'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

/** Certificat auto-signé pour ces noms (DNS ou IP), valable un jour, généré par `openssl`. */
export function selfSigned(names: string[]): SelfSigned {
  const dir = mkdtempSync(join(tmpdir(), 'bobine-tls-'))
  const keyFile = join(dir, 'key.pem')
  const certFile = join(dir, 'cert.pem')
  const alt = names.map((n) => (/^\d+(\.\d+){3}$/.test(n) ? `IP:${n}` : `DNS:${n}`)).join(',')
  execFileSync(
    'openssl',
    [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-days',
      '1',
      '-subj',
      `/CN=${names[0] ?? 'localhost'}`,
      '-addext',
      `subjectAltName=${alt}`,
      '-keyout',
      keyFile,
      '-out',
      certFile
    ],
    { stdio: 'ignore' }
  )
  return {
    key: readFileSync(keyFile, 'utf8'),
    cert: readFileSync(certFile, 'utf8'),
    certFile,
    remove: () => rmSync(dir, { recursive: true, force: true })
  }
}

/** Petite requête de contrôle vers le faux serveur (les essais vérifient qu'il tourne). */
export function ping(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(url, { method: 'GET' }, (res) => {
      res.resume()
      resolve(res.statusCode ?? 0)
    })
    req.on('error', reject)
    req.end()
  })
}
