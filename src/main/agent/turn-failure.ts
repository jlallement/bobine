/**
 * Pannes passagères d'un tour (fiche 142) : l'agent n'a pas joint son modèle (réseau coupé, VPN
 * qui décroche, proxy, DNS) ou le modèle le fait patienter (limite de débit, 429). Ces erreurs
 * se règlent en réessayant ; toutes les autres restent des erreurs du tour.
 *
 * Rien de propre à un agent : les codes et messages sont ceux de Node (undici), de Bun (OpenCode),
 * du HTTP et des SDK de modèles, que l'agent relaie dans son erreur JSON-RPC (`message`, `data`)
 * ou sur sa sortie d'erreur. Un agent au format à lui le déclare dans son profil (`transientError`).
 */

export type TurnFailure = 'network' | 'rate-limit' | 'other'

/** Codes d'erreur réseau de Node, d'undici (fetch), de Bun et de Chromium. */
const NETWORK_CODES =
  /\b(?:ECONNRESET|ECONNREFUSED|ECONNABORTED|ETIMEDOUT|ESOCKETTIMEDOUT|ENOTFOUND|EAI_AGAIN|ENETUNREACH|ENETDOWN|EHOSTUNREACH|EHOSTDOWN|EPIPE|UND_ERR_CONNECT_TIMEOUT|UND_ERR_HEADERS_TIMEOUT|UND_ERR_BODY_TIMEOUT|UND_ERR_SOCKET|UND_ERR_CLOSED|ConnectionRefused|ConnectionClosed|FailedToOpenSocket|ERR_INTERNET_DISCONNECTED|ERR_NETWORK_CHANGED|ERR_NAME_NOT_RESOLVED|ERR_PROXY_CONNECTION_FAILED|ERR_TUNNEL_CONNECTION_FAILED)\b/

/** Messages : fetch de Node, SDK OpenAI / Anthropic, Bun, proxy d'entreprise. */
const NETWORK_MESSAGES =
  /fetch failed|socket hang up|other side closed|network (?:error|is unreachable)|connection error|connection (?:reset|refused|closed|timed out)|request timed out|getaddrinfo|tunneling socket|proxy (?:error|connection)|unable to connect|\b502 bad gateway|\b503 service unavailable|\b504 gateway time-?out/i

const RATE_LIMIT_MESSAGES = /\b429\b|too many requests|rate[ _-]?limit|RESOURCE_EXHAUSTED/i

/**
 * Ce qui ne se règle pas en attendant : budget de Bob épuisé (`BudgetExceededError`), quota ou
 * crédit du compte (`insufficient_quota` d'OpenAI, renvoyé en 429), facturation.
 */
const NOT_TRANSIENT =
  /budget|insufficient_quota|exceeded your current quota|billing|credit balance|payment required/i

/** Statuts HTTP lus dans `data` : la limite de débit, et ceux d'un proxy ou d'une passerelle. */
const RATE_LIMIT_STATUS = 429
const GATEWAY_STATUSES = new Set([502, 503, 504])

/** Code JSON-RPC « erreur interne » : l'agent n'en dit pas plus que son message. */
const INTERNAL_ERROR = -32603

/** Au-delà, `data` n'est plus lu (une réponse entière jointe à l'erreur). */
const MAX_TEXT = 8_000

/**
 * Classe l'erreur d'un tour. `stderr` : ce que l'agent a écrit sur sa sortie d'erreur pendant le
 * tour, lu seulement quand l'erreur est générique (erreur interne sans cause reconnue).
 */
export function classifyTurnFailure(error: unknown, stderr = ''): TurnFailure {
  const text = errorText(error)
  if (NOT_TRANSIENT.test(text)) return 'other'
  const own = fromStatus(error) ?? fromText(text)
  if (own !== 'other' || !generic(error) || !stderr.trim()) return own
  const tail = stderr.slice(-MAX_TEXT)
  return NOT_TRANSIENT.test(tail) ? 'other' : fromText(tail)
}

function fromText(text: string): TurnFailure {
  if (RATE_LIMIT_MESSAGES.test(text)) return 'rate-limit'
  if (NETWORK_CODES.test(text) || NETWORK_MESSAGES.test(text)) return 'network'
  return 'other'
}

/** Statut HTTP de l'erreur (code JSON-RPC, ou `status` / `statusCode` dans `data`). */
function fromStatus(error: unknown): TurnFailure | undefined {
  for (const status of statuses(error)) {
    if (status === RATE_LIMIT_STATUS) return 'rate-limit'
    if (GATEWAY_STATUSES.has(status)) return 'network'
  }
  return undefined
}

function statuses(error: unknown): number[] {
  if (typeof error !== 'object' || error === null) return []
  const { code, data } = error as { code?: unknown; data?: unknown }
  const found = typeof code === 'number' ? [code] : []
  let level: unknown[] = [data]
  // `data`, puis sa cause, sur trois niveaux au plus (`data.error.status`, `data.cause.status`).
  for (let depth = 0; depth < 3 && level.length > 0; depth++) {
    const next: unknown[] = []
    for (const value of level) {
      if (typeof value !== 'object' || value === null) continue
      for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
        if (/^(?:status|statusCode|httpStatus)$/.test(key) && typeof inner === 'number') {
          found.push(inner)
        } else if (typeof inner === 'object') next.push(inner)
      }
    }
    level = next
  }
  return found
}

/** L'agent ne dit rien de la cause : erreur interne, ou sans code. */
function generic(error: unknown): boolean {
  const code = typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : 0
  return code === undefined || code === INTERNAL_ERROR
}

/** Message, cause (`cause`) et `data` de l'erreur, en un texte. */
function errorText(error: unknown): string {
  if (typeof error !== 'object' || error === null) return String(error)
  const { message, data, cause, code } = error as Record<string, unknown>
  const parts = [message, typeof code === 'string' ? code : undefined, causeText(cause)]
  if (data !== undefined) parts.push(typeof data === 'string' ? data : json(data))
  return parts
    .filter((part): part is string => typeof part === 'string')
    .join('\n')
    .slice(0, MAX_TEXT)
}

function causeText(cause: unknown): string | undefined {
  if (cause instanceof Error) {
    const code = (cause as { code?: unknown }).code
    return `${cause.message}${typeof code === 'string' ? ` ${code}` : ''}`
  }
  return typeof cause === 'string' ? cause : undefined
}

function json(value: unknown): string {
  try {
    return JSON.stringify(value)
  } catch {
    return ''
  }
}
