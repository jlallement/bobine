/**
 * Lignes de l'onglet « Échanges ACP » (fiche 135), pures pour les tests : lecture d'un message
 * JSON-RPC, ce qu'en dit chaque ligne (méthode ou type de mise à jour, détail court, durée d'une
 * réponse depuis sa requête), regroupement des morceaux de texte, filtre, copie en NDJSON, jetons
 * du JSON coloré. C'est le protocole : rien de propre à un agent.
 */
import { t } from 'i18next'
import type { AcpExchange } from '@shared/acp-exchanges'
import { currentLocale, numberFormat } from '@shared/i18n/format'

type Json = Record<string, unknown>
const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const str = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : typeof value === 'number' ? String(value) : undefined

/** Morceaux de texte en flux : regroupés par message. */
export const CHUNK_UPDATES = new Set([
  'agent_message_chunk',
  'agent_thought_chunk',
  'user_message_chunk'
])

export type MessageKind = 'request' | 'notification' | 'response' | 'error' | 'invalid'

export interface ParsedExchange extends AcpExchange {
  kind: MessageKind
  /** Objet JSON-RPC lu ; absent si la ligne n'est pas du JSON (ou a été coupée). */
  json?: Json
  method?: string
  id?: string
  /** `sessionUpdate` d'un `session/update`. */
  update?: string
}

export function parseExchange(exchange: AcpExchange): ParsedExchange {
  let json: Json
  try {
    const parsed: unknown = JSON.parse(exchange.text)
    if (!isObject(parsed)) throw new Error('not an object')
    json = parsed
  } catch {
    return { ...exchange, kind: 'invalid' }
  }
  const method = str(json['method'])
  const id = json['id'] === undefined || json['id'] === null ? undefined : str(json['id'])
  const params = isObject(json['params']) ? json['params'] : {}
  const update = method === 'session/update' && isObject(params['update']) ? params['update'] : {}
  const kind: MessageKind = method
    ? id !== undefined
      ? 'request'
      : 'notification'
    : isObject(json['error'])
      ? 'error'
      : 'response'
  return {
    ...exchange,
    kind,
    json,
    ...(method ? { method } : {}),
    ...(id !== undefined ? { id } : {}),
    ...(str(update['sessionUpdate']) ? { update: str(update['sessionUpdate']) } : {})
  }
}

export interface AcpRow {
  /** Clé stable (numéro du premier message). */
  key: string
  at: number
  direction: AcpExchange['direction']
  /** Méthode, type de mise à jour, « réponse #7 »… */
  what: string
  detail: string
  bytes: number
  /** Messages de la ligne : un seul, ou les morceaux regroupés. */
  messages: ParsedExchange[]
  /** Morceaux regroupés (« ×31 »). */
  grouped: boolean
  error: boolean
}

export interface RowOptions {
  /** Regrouper les morceaux de texte consécutifs d'un même message. */
  group: boolean
}

/** Lignes affichées, dans l'ordre des messages. */
export function buildRows(messages: readonly ParsedExchange[], options: RowOptions): AcpRow[] {
  const rows: AcpRow[] = []
  /** Requêtes par sens et identifiant : durée de leur réponse. */
  const requests = new Map<string, ParsedExchange>()
  /** Premier `tool_call` de chaque outil : « 38,8 s après » sur ses mises à jour. */
  const tools = new Map<string, number>()
  let chunks: { key: string; row: AcpRow } | undefined
  for (const message of messages) {
    const chunkKey = options.group ? chunkKeyOf(message) : undefined
    if (chunkKey && chunks?.key === chunkKey) {
      const row = chunks.row
      row.messages.push(message)
      row.bytes += message.bytes
      row.grouped = true
      row.what = `${message.update} ×${row.messages.length}`
      continue
    }
    const row = rowOf(message, requests, tools)
    rows.push(row)
    chunks = chunkKey ? { key: chunkKey, row } : undefined
  }
  return rows
}

function chunkKeyOf(message: ParsedExchange): string | undefined {
  if (message.kind !== 'notification' || !message.update || !CHUNK_UPDATES.has(message.update)) {
    return undefined
  }
  const params = paramsOf(message)
  const update = isObject(params['update']) ? params['update'] : {}
  return [
    message.direction,
    str(params['sessionId']) ?? '',
    message.update,
    str(update['messageId']) ?? ''
  ].join(' ')
}

const paramsOf = (message: ParsedExchange): Json =>
  isObject(message.json?.['params']) ? message.json['params'] : {}

const other = (direction: AcpExchange['direction']) => (direction === 'in' ? 'out' : 'in')

function rowOf(
  message: ParsedExchange,
  requests: Map<string, ParsedExchange>,
  tools: Map<string, number>
): AcpRow {
  const base = {
    key: String(message.seq),
    at: message.at,
    direction: message.direction,
    bytes: message.bytes,
    messages: [message],
    grouped: false,
    error: false
  }
  if (message.kind === 'invalid') {
    return {
      ...base,
      what: t(message.truncated ? 'acpTab.truncatedLine' : 'acpTab.notJson'),
      detail: ''
    }
  }
  if (message.kind === 'request') {
    requests.set(`${message.direction} ${message.id}`, message)
    const summary = requestSummary(message.method ?? '', paramsOf(message))
    return { ...base, what: message.method ?? '', detail: joined(`#${message.id}`, summary) }
  }
  if (message.kind === 'notification') {
    if (message.method !== 'session/update')
      return { ...base, what: message.method ?? '', detail: '' }
    return { ...base, what: message.update ?? '?', detail: updateSummary(message, tools) }
  }
  // Réponse : la requête venait de l'autre sens.
  const request = requests.get(`${other(message.direction)} ${message.id}`)
  const took = request ? durationText(message.at - request.at) : ''
  if (message.kind === 'error') {
    const error = message.json?.['error']
    const detail = isObject(error)
      ? joined(str(error['code']) ?? '', str(error['message']) ?? '')
      : ''
    return {
      ...base,
      error: true,
      what: t('acpTab.error', { id: message.id ?? '?' }),
      detail: joined(detail, took)
    }
  }
  const summary = resultSummary(message.json?.['result']) || (request?.method ?? '')
  return {
    ...base,
    what: t('acpTab.response', { id: message.id ?? '?' }),
    detail: joined(summary, took)
  }
}

/** Morceaux non vides, séparés par « · ». */
const joined = (...parts: string[]) => parts.filter((p) => p !== '').join(' · ')

const clip = (text: string, max = 60) => (text.length > max ? `${text.slice(0, max)}…` : text)

function requestSummary(method: string, params: Json): string {
  if (method === 'session/prompt' && Array.isArray(params['prompt'])) {
    const types = (params['prompt'] as unknown[]).map((b) => (isObject(b) ? str(b['type']) : '?'))
    return [...new Set(types)].join(', ')
  }
  if (method === 'session/request_permission' && isObject(params['toolCall'])) {
    return clip(str(params['toolCall']['title']) ?? '')
  }
  if (method === 'session/set_config_option') {
    return `${str(params['configId']) ?? '?'}=${str(params['value']) ?? '?'}`
  }
  if (method === 'session/set_mode') return str(params['modeId']) ?? ''
  if (method.startsWith('fs/')) return clip(str(params['path']) ?? '')
  if (method === 'terminal/create') return clip(str(params['command']) ?? '')
  if (method === 'elicitation/create') return clip(str(params['message']) ?? '')
  return ''
}

function resultSummary(result: unknown): string {
  if (!isObject(result)) return ''
  if (result['stopReason'] !== undefined) return str(result['stopReason']) ?? ''
  if (isObject(result['outcome'])) {
    const outcome = result['outcome']
    return str(outcome['optionId']) ?? str(outcome['outcome']) ?? ''
  }
  if (isObject(result['agentInfo'])) {
    const info = result['agentInfo']
    return [str(info['name']), str(info['version'])].filter(Boolean).join(' ')
  }
  return ''
}

function updateSummary(message: ParsedExchange, tools: Map<string, number>): string {
  const params = paramsOf(message)
  const update = isObject(params['update']) ? params['update'] : {}
  const kind = message.update
  if (kind === 'tool_call' || kind === 'tool_call_update') {
    const id = str(update['toolCallId']) ?? ''
    const started = tools.get(id)
    if (kind === 'tool_call' && started === undefined) tools.set(id, message.at)
    const after =
      kind === 'tool_call_update' && started !== undefined
        ? t('acpTab.after', { time: durationText(message.at - started) })
        : ''
    return joined(clip(str(update['title']) ?? ''), str(update['status']) ?? '', after)
  }
  if (kind === 'plan' && Array.isArray(update['entries'])) {
    const entries = update['entries'] as unknown[]
    const done = entries.filter((e) => isObject(e) && e['status'] === 'completed').length
    return `${done}/${entries.length}`
  }
  if (kind === 'usage_update') return `${str(update['used']) ?? '?'}/${str(update['size']) ?? '?'}`
  if (kind === 'current_mode_update') return str(update['currentModeId']) ?? ''
  if (kind === 'available_commands_update' && Array.isArray(update['availableCommands'])) {
    return String(update['availableCommands'].length)
  }
  return ''
}

/** Filtre de la barre : méthode, outil, détail ou texte brut, sans tenir compte de la casse. */
export function filterRows(rows: readonly AcpRow[], query: string): AcpRow[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return [...rows]
  return rows.filter(
    (row) =>
      row.what.toLowerCase().includes(needle) ||
      row.detail.toLowerCase().includes(needle) ||
      row.messages.some((m) => m.text.toLowerCase().includes(needle))
  )
}

/** Une ligne JSON par message, comme échangée (secrets déjà masqués par le main). */
export function toNdjson(rows: readonly AcpRow[]): string {
  return rows.flatMap((row) => row.messages.map((m) => m.text)).join('\n') + '\n'
}

/** « 14:02:11.204 ». */
export function timeText(at: number): string {
  const date = new Date(at)
  const pad = (n: number, size = 2) => String(n).padStart(size, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`
}

/** « 512 o », « 2,1 ko », « 1,3 Mo » dans la langue de l'interface. */
export function sizeText(bytes: number): string {
  const [unit, value] =
    bytes >= 1024 * 1024
      ? (['megabyte', bytes / (1024 * 1024)] as const)
      : bytes >= 1024
        ? (['kilobyte', bytes / 1024] as const)
        : (['byte', bytes] as const)
  return numberFormat({
    style: 'unit',
    unit,
    maximumFractionDigits: unit === 'byte' ? 0 : 1
  }).format(value)
}

/** « 120 ms », « 1,2 s », « 2 min 5 s ». */
export function durationText(ms: number): string {
  const value = Math.max(0, ms)
  if (value < 1000) return numberFormat({ style: 'unit', unit: 'millisecond' }).format(value)
  if (value < 60_000) {
    return numberFormat({ style: 'unit', unit: 'second', maximumFractionDigits: 1 }).format(
      value / 1000
    )
  }
  const minutes = Math.floor(value / 60_000)
  const seconds = Math.round((value % 60_000) / 1000)
  const format = (unit: string, n: number) => numberFormat({ style: 'unit', unit }).format(n)
  return `${format('minute', minutes)} ${format('second', seconds)}`
}

/** Nombre dans la langue de l'interface (« 2 000 »). */
export const countText = (n: number) => n.toLocaleString(currentLocale())

export type JsonToken = { text: string; type?: 'key' | 'string' | 'literal' }

const TOKEN = /("(?:\\.|[^"\\])*")(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g

/** JSON indenté découpé en jetons colorés ; une ligne non JSON reste telle quelle. */
export function jsonTokens(message: ParsedExchange): JsonToken[] {
  if (!message.json) return [{ text: message.text }]
  const text = JSON.stringify(message.json, null, 2)
  const tokens: JsonToken[] = []
  let last = 0
  for (const match of text.matchAll(TOKEN)) {
    const index = match.index
    if (index > last) tokens.push({ text: text.slice(last, index) })
    if (match[1] !== undefined) {
      tokens.push({ text: match[1], type: match[2] !== undefined ? 'key' : 'string' })
      if (match[2]) tokens.push({ text: match[2] })
    } else tokens.push({ text: match[0], type: 'literal' })
    last = index + match[0].length
  }
  if (last < text.length) tokens.push({ text: text.slice(last) })
  return tokens
}
