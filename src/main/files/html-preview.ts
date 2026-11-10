/**
 * Aperçu des pages HTML (fiche 064) : petit serveur local qui sert la page et ses voisines (styles,
 * scripts, images, données) au navigateur intégré, comme un serveur de développement. En `file://`,
 * Chromium bloquerait `fetch()` et les modules JavaScript.
 *
 * Seulement sur `127.0.0.1`, derrière un jeton secret, `Host` vérifié (un nom de domaine rattaché à
 * 127.0.0.1 par un site ne passe pas) ; seuls les fichiers du dossier de la page et en dessous,
 * jamais un fichier ou dossier caché (`.env`, `.git`…), même derrière un lien symbolique, pas de
 * liste de dossier, lecture seule.
 *
 * Un serveur (port et jeton) par dossier prévisualisé (fiche 114) : pour le navigateur, l'origine
 * est `127.0.0.1:port`, donc une page d'un dossier ne peut pas lire les fichiers d'un autre. Les
 * serveurs vivent jusqu'à `stop()` (en quittant) : une socket locale inutilisée ne coûte rien.
 */
import { randomBytes } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { realpath, stat } from 'node:fs/promises'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { extname, relative, resolve, sep } from 'node:path'
import { t } from 'i18next'

const TYPES: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  htm: 'text/html; charset=utf-8',
  css: 'text/css; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  mjs: 'text/javascript; charset=utf-8',
  json: 'application/json; charset=utf-8',
  map: 'application/json; charset=utf-8',
  txt: 'text/plain; charset=utf-8',
  md: 'text/plain; charset=utf-8',
  csv: 'text/csv; charset=utf-8',
  xml: 'application/xml; charset=utf-8',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  ico: 'image/x-icon',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  otf: 'font/otf',
  wasm: 'application/wasm',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  mp4: 'video/mp4',
  webm: 'video/webm',
  pdf: 'application/pdf'
}

const inside = (root: string, target: string) => target === root || target.startsWith(root + sep)

/** Serveur d'un dossier : port et jeton connus une fois à l'écoute. */
interface Origin {
  port: number
  token: string
}

/** Chemin réel qui traverse un fichier ou dossier caché du dossier servi. */
const hidden = (root: string, real: string) =>
  relative(root, real)
    .split(sep)
    .some((s) => s.startsWith('.'))

export class HtmlPreviewServer {
  /** Serveurs par dossier réel servi (un par dossier de page ouvert). */
  private readonly servers = new Map<string, { server: Server; ready: Promise<Origin> }>()

  /** Adresse de `file` (dans `dir`), le serveur du dossier démarré si besoin. */
  async urlFor(dir: string, file: string): Promise<string> {
    const root = await realpath(dir)
    const target = await realpath(file)
    if (!inside(root, target)) throw new Error(t('htmlPreview.outside', { file }))
    const { port, token } = await this.start(root)
    const path = relative(root, target).split(sep).map(encodeURIComponent).join('/')
    return `http://127.0.0.1:${port}/${token}/${path}`
  }

  /** Ferme tous les serveurs (en quittant). */
  stop(): void {
    for (const { server } of this.servers.values()) server.close()
    this.servers.clear()
  }

  private start(root: string): Promise<Origin> {
    const known = this.servers.get(root)
    if (known) return known.ready
    const origin: Origin = { port: 0, token: randomBytes(18).toString('base64url') }
    const server = createServer((req, res) => {
      void this.handle(req, res, root, origin).catch(() => this.refuse(res, 500))
    })
    const ready = new Promise<Origin>((resolveOrigin, reject) => {
      server.once('error', (error) => {
        this.servers.delete(root)
        reject(error)
      })
      server.listen(0, '127.0.0.1', () => {
        origin.port = (server.address() as AddressInfo).port
        resolveOrigin(origin)
      })
    })
    this.servers.set(root, { server, ready })
    return ready
  }

  private refuse(res: ServerResponse, status: number): void {
    if (res.headersSent) {
      res.destroy()
      return
    }
    res.writeHead(status, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store'
    })
    res.end(status === 404 ? t('htmlPreview.notFound') : t('htmlPreview.forbidden'))
  }

  private async handle(
    req: IncomingMessage,
    res: ServerResponse,
    root: string,
    origin: Origin
  ): Promise<void> {
    if (req.method !== 'GET' && req.method !== 'HEAD') return this.refuse(res, 405)
    // Autre nom que 127.0.0.1:port : une page web qui aurait rattaché son domaine à la machine.
    if (req.headers.host !== `127.0.0.1:${origin.port}`) return this.refuse(res, 403)
    const url = new URL(req.url ?? '/', `http://127.0.0.1:${origin.port}`)
    const [, token, ...parts] = url.pathname.split('/')
    if (token !== origin.token) return this.refuse(res, 404)
    let segments: string[]
    try {
      segments = parts.map(decodeURIComponent)
    } catch {
      return this.refuse(res, 404)
    }
    // Ni fichier ni dossier caché, ni remontée (contrôle sur le chemin demandé : évite un `stat`).
    if (segments.some((s) => s.startsWith('.') || s.includes('/') || s.includes('\\'))) {
      return this.refuse(res, 404)
    }
    let target = resolve(root, ...segments)
    let info = await stat(target).catch(() => null)
    if (info?.isDirectory()) {
      target = resolve(target, 'index.html')
      info = await stat(target).catch(() => null)
    }
    if (!info?.isFile()) return this.refuse(res, 404)
    // Chemin réel : un lien symbolique ne mène ni hors du dossier, ni vers un fichier caché.
    const real = await realpath(target).catch(() => '')
    if (!real || !inside(root, real) || hidden(root, real)) return this.refuse(res, 404)
    res.writeHead(200, {
      'Content-Type': TYPES[extname(real).slice(1).toLowerCase()] ?? 'application/octet-stream',
      'Content-Length': info.size,
      // « Recharger » montre toujours la dernière version écrite par l'agent.
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer'
    })
    if (req.method === 'HEAD') {
      res.end()
      return
    }
    createReadStream(real).pipe(res)
  }
}
