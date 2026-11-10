/**
 * « Tester » un fournisseur de modèles (fiche 104) : `GET <adresse>/models` avec la clé, sans
 * jeton de modèle, dans les conditions de l'agent (proxy `HTTPS_PROXY` par un tunnel `CONNECT`,
 * certificats du système plus le fichier de l'entreprise, `NO_PROXY`). Répond « N modèles », ou
 * l'erreur classée (connexion refusée, nom inconnu, proxy, certificat non reconnu, clé refusée…)
 * pour que l'interface dise la marche à suivre.
 */
import { readFileSync } from 'node:fs'
import { request as httpRequest, type IncomingMessage, type RequestOptions } from 'node:http'
import { request as httpsRequest } from 'node:https'
import type { Socket } from 'node:net'
import { connect as tlsConnect, rootCertificates } from 'node:tls'
import type { NetworkSettings, ProviderTestCause, ProviderTestResult } from '@shared/providers'
import { messageOf } from '@shared/errors'
import { t } from 'i18next'

export interface ProviderTarget {
  baseURL: string
  apiKey?: string
}

export const PROVIDER_TEST_TIMEOUT_MS = 10_000
/** `NO_PROXY` par défaut quand un proxy est posé : le trafic local reste direct. */
export const DEFAULT_NO_PROXY = 'localhost,127.0.0.1'

/** Codes d'erreur de Node, classés. */
const CAUSES: Record<string, ProviderTestCause> = {
  ECONNREFUSED: 'refused',
  ECONNRESET: 'refused',
  EHOSTUNREACH: 'refused',
  ENETUNREACH: 'refused',
  ENOTFOUND: 'dns',
  EAI_AGAIN: 'dns',
  ETIMEDOUT: 'timeout',
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: 'certificate',
  UNABLE_TO_GET_ISSUER_CERT_LOCALLY: 'certificate',
  UNABLE_TO_GET_ISSUER_CERT: 'certificate',
  SELF_SIGNED_CERT_IN_CHAIN: 'certificate',
  DEPTH_ZERO_SELF_SIGNED_CERT: 'certificate',
  CERT_HAS_EXPIRED: 'certificate',
  CERT_NOT_YET_VALID: 'certificate',
  ERR_TLS_CERT_ALTNAME_INVALID: 'certificate',
  CERT_UNTRUSTED: 'certificate'
}

class ProbeError extends Error {
  readonly reason: ProviderTestCause
  constructor(reason: ProviderTestCause, message: string) {
    super(message)
    this.reason = reason
  }
}

/** Textes des erreurs de Node, par cause ; les autres causes ont leur propre message. */
const DETAIL_KEYS = {
  refused: 'providerProbe.refused',
  dns: 'providerProbe.dns',
  certificate: 'providerProbe.certificate',
  proxy: 'providerProbe.proxy',
  timeout: 'providerProbe.other',
  unauthorized: 'providerProbe.other',
  'not-found': 'providerProbe.other',
  http: 'providerProbe.other',
  other: 'providerProbe.other'
} as const

/** L'hôte est-il dans `NO_PROXY` (`hôte`, `.domaine`, `domaine`, `*`) ? */
export function bypassesProxy(hostname: string, noProxy: string | undefined): boolean {
  const host = hostname.toLowerCase()
  return (noProxy ?? DEFAULT_NO_PROXY)
    .split(',')
    .map((entry) => entry.trim().toLowerCase().replace(/:\d+$/, ''))
    .filter(Boolean)
    .some(
      (entry) =>
        entry === '*' ||
        host === entry ||
        host.endsWith(entry.startsWith('.') ? entry : `.${entry}`)
    )
}

/** Certificats de confiance : ceux de Node, plus le fichier de l'entreprise s'il est donné. */
function trustedCertificates(caCerts: string | undefined): string[] {
  if (!caCerts) return [...rootCertificates]
  let extra: string
  try {
    extra = readFileSync(caCerts, 'utf8')
  } catch (error) {
    throw new ProbeError(
      'certificate',
      t('providerProbe.caCertsUnreadable', { file: caCerts, detail: messageOf(error) })
    )
  }
  return [...rootCertificates, extra]
}

/** Tunnel `CONNECT` ouvert chez le proxy vers `host:port` ; 407 et refus du proxy classés `proxy`. */
function tunnel(proxy: URL, host: string, port: number): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const auth =
      proxy.username || proxy.password
        ? {
            'Proxy-Authorization': `Basic ${Buffer.from(
              `${decodeURIComponent(proxy.username)}:${decodeURIComponent(proxy.password)}`
            ).toString('base64')}`
          }
        : {}
    const req = httpRequest({
      host: proxy.hostname,
      port: Number(proxy.port) || (proxy.protocol === 'https:' ? 443 : 80),
      method: 'CONNECT',
      path: `${host}:${port}`,
      headers: { Host: `${host}:${port}`, ...auth }
    })
    req.once('connect', (res, socket) => {
      if (res.statusCode === 200) return resolve(socket)
      socket.destroy()
      reject(
        new ProbeError(
          'proxy',
          res.statusCode === 407
            ? t('providerProbe.proxyAuth', { proxy: proxy.host })
            : t('providerProbe.proxyRefused', {
                proxy: proxy.host,
                status: `${res.statusCode ?? '?'} ${res.statusMessage ?? ''}`.trim()
              })
        )
      )
    })
    req.once('error', (error) =>
      reject(
        new ProbeError(
          'proxy',
          t('providerProbe.proxyUnreachable', { proxy: proxy.host, detail: messageOf(error) })
        )
      )
    )
    req.end()
  })
}

/** Réponse lue en entier (bornée) : statut et corps. */
function readBody(res: IncomingMessage, max = 1_000_000): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = ''
    res.on('data', (chunk: Buffer) => {
      if (body.length < max) body += chunk.toString()
    })
    res.once('end', () => resolve(body))
    res.once('error', reject)
  })
}

function causeOf(error: unknown): ProviderTestCause {
  const code = (error as { code?: unknown }).code
  return (typeof code === 'string' && CAUSES[code]) || 'other'
}

async function fetchModels(
  target: ProviderTarget,
  network: NetworkSettings,
  signal: AbortSignal
): Promise<number> {
  let url: URL
  try {
    url = new URL(`${target.baseURL.replace(/\/+$/, '')}/models`)
  } catch {
    throw new ProbeError('other', t('providerProbe.badUrl', { url: target.baseURL }))
  }
  const secure = url.protocol === 'https:'
  const port = Number(url.port) || (secure ? 443 : 80)
  const ca = secure ? trustedCertificates(network.caCerts) : undefined
  const viaProxy = network.proxy && !bypassesProxy(url.hostname, network.noProxy)
  let socket: Socket | undefined
  if (viaProxy) {
    let proxy: URL
    try {
      proxy = new URL(network.proxy ?? '')
    } catch {
      throw new ProbeError('proxy', t('providerProbe.badProxy', { proxy: network.proxy ?? '' }))
    }
    socket = await tunnel(proxy, url.hostname, port)
    if (secure) {
      socket = tlsConnect({ socket, servername: url.hostname, ca })
    }
  }
  const options: RequestOptions = {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      ...(target.apiKey ? { Authorization: `Bearer ${target.apiKey}` } : {})
    },
    signal,
    ...(ca ? { ca } : {}),
    ...(socket ? { agent: false, createConnection: () => socket } : {})
  }
  const res = await new Promise<IncomingMessage>((resolve, reject) => {
    const req = (secure ? httpsRequest : httpRequest)(url, options, resolve)
    req.once('error', reject)
    req.end()
  })
  const body = await readBody(res)
  const status = res.statusCode ?? 0
  if (status === 401 || status === 403) {
    throw new ProbeError('unauthorized', t('providerProbe.unauthorized', { status }))
  }
  if (status === 404)
    throw new ProbeError('not-found', t('providerProbe.notFound', { url: url.toString() }))
  if (status === 407) throw new ProbeError('proxy', t('providerProbe.proxyAuth', { proxy: '' }))
  if (status < 200 || status >= 300) {
    throw new ProbeError(
      'http',
      t('providerProbe.http', { status: `${status} ${res.statusMessage ?? ''}`.trim() })
    )
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    throw new ProbeError('http', t('providerProbe.notJson'))
  }
  const data = (parsed as { data?: unknown } | null)?.data
  if (!Array.isArray(data)) throw new ProbeError('http', t('providerProbe.notModels'))
  return data.length
}

export async function probeProvider(
  target: ProviderTarget,
  network: NetworkSettings = {},
  options: { timeoutMs?: number } = {}
): Promise<ProviderTestResult> {
  const started = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? PROVIDER_TEST_TIMEOUT_MS)
  try {
    const models = await Promise.race([
      fetchModels(target, network, controller.signal),
      new Promise<never>((_, reject) =>
        controller.signal.addEventListener('abort', () =>
          reject(new ProbeError('timeout', t('providerProbe.timeout')))
        )
      )
    ])
    return { ok: true, models, ms: Date.now() - started }
  } catch (error) {
    const cause = error instanceof ProbeError ? error.reason : causeOf(error)
    const message =
      error instanceof ProbeError
        ? error.message
        : t(DETAIL_KEYS[cause], { detail: messageOf(error) })
    return { ok: false, cause, error: message, ms: Date.now() - started }
  } finally {
    clearTimeout(timer)
  }
}
