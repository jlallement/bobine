/**
 * Relevé des échanges ACP pour `agents.log` (fiche 080) : chaque message JSON-RPC, dans les deux
 * sens, résumé sur une ligne (méthode ou type de mise à jour, identifiants, outil, statut, taille,
 * temps de réponse). Au niveau Trace, un extrait du contenu, masqué et tronqué. Les morceaux de
 * texte en flux sont regroupés par message. Chaque ligne entière part aussi, telle quelle, au
 * récepteur `lines` s'il y en a un (onglet « Échanges ACP », fiche 135), à tout niveau du journal.
 * Pur : pas d'Electron, pas de fichier.
 */
import { excerpt } from '../log-redact'
import type { LogScope } from '../log'

/** `out` : de l'app vers l'agent ; `in` : de l'agent vers l'app. */
export type Direction = 'out' | 'in'

export interface AcpLogSink {
  write: (text: string) => void
  /** Niveau Détaillé ou plus : sinon rien n'est relevé (et rien n'est analysé). */
  detailed: () => boolean
  /** Niveau Trace : extraits du contenu. */
  trace: () => boolean
  /** Chaque ligne entière, non analysée, quel que soit le niveau (fiche 135). */
  lines?: (direction: Direction, line: string) => void
}

const ARROW: Record<Direction, string> = { out: '→', in: '←' }
const CHUNKS = new Set(['agent_message_chunk', 'agent_thought_chunk', 'user_message_chunk'])

type Json = Record<string, unknown>
const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null
const str = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : typeof value === 'number' ? String(value) : undefined
const short = (id: unknown) => {
  const text = str(id) ?? '?'
  return text.length > 12 ? `…${text.slice(-8)}` : text
}

export function sizeText(bytes: number): string {
  return bytes < 1024 ? `${bytes} o` : `${(bytes / 1024).toFixed(1)} Ko`
}

interface Pending {
  method: string
  at: number
}

interface Chunks {
  key: string
  kind: string
  count: number
  chars: number
  text: string
}

export class AcpLog {
  private readonly sink: AcpLogSink
  private readonly now: () => number
  private readonly decoder: Record<Direction, TextDecoder> = {
    out: new TextDecoder(),
    in: new TextDecoder()
  }
  private readonly buffer: Record<Direction, string> = { out: '', in: '' }
  /** Requêtes en attente de réponse, par sens de la requête. */
  private readonly pending: Record<Direction, Map<string, Pending>> = {
    out: new Map(),
    in: new Map()
  }
  private chunks: Chunks | undefined

  constructor(sink: AcpLogSink, now: () => number = Date.now) {
    this.sink = sink
    this.now = now
  }

  /** Octets écrits vers l'agent (`out`) ou lus de lui (`in`). */
  bytes(direction: Direction, chunk: Uint8Array): void {
    const detailed = this.sink.detailed()
    const lines = this.sink.lines
    if (!detailed && !lines) {
      // Niveau Normal sans récepteur : rien d'analysé ; une ligne commencée est oubliée.
      this.buffer[direction] = ''
      return
    }
    // Le saut de ligne n'est cherché que dans la partie nouvelle : une longue ligne arrivée en
    // morceaux n'est pas relue à chaque morceau.
    let from = this.buffer[direction].length
    this.buffer[direction] += this.decoder[direction].decode(chunk, { stream: true })
    let end: number
    while ((end = this.buffer[direction].indexOf('\n', from)) >= 0) {
      const line = this.buffer[direction].slice(0, end)
      this.buffer[direction] = this.buffer[direction].slice(end + 1)
      from = 0
      if (!line.trim()) continue
      lines?.(direction, line)
      if (detailed) this.message(direction, line)
    }
  }

  /** Fin d'un tour ou de l'agent : les morceaux de texte en attente sont écrits. */
  flush(): void {
    const chunks = this.chunks
    this.chunks = undefined
    if (!chunks) return
    const tail = chunks.text && this.sink.trace() ? ` : ${excerpt(chunks.text)}` : ''
    this.sink.write(`← ${chunks.kind} ×${chunks.count} (${chunks.chars} car.)${tail}`)
  }

  private message(direction: Direction, line: string): void {
    let message: Json
    try {
      const parsed: unknown = JSON.parse(line)
      if (!isObject(parsed)) throw new Error('pas un objet')
      message = parsed
    } catch {
      this.flush()
      this.sink.write(`${ARROW[direction]} (ligne non JSON, ${sizeText(line.length)})`)
      return
    }
    const size = sizeText(Buffer.byteLength(line))
    const method = str(message['method'])
    const id = message['id']
    if (method === 'session/update' && id === undefined && isObject(message['params'])) {
      this.update(direction, message['params'], size)
      return
    }
    this.flush()
    const arrow = ARROW[direction]
    const trace = this.sink.trace()
    if (method !== undefined && id !== undefined) {
      this.pending[direction].set(String(id), { method, at: this.now() })
      const params = message['params']
      const tail = trace && params !== undefined ? ` : ${excerpt(params)}` : ''
      this.sink.write(
        `${arrow} ${method} #${str(id)} ${requestSummary(method, params)}(${size})${tail}`
      )
      return
    }
    if (method !== undefined) {
      const params = message['params']
      const tail = trace && params !== undefined ? ` : ${excerpt(params)}` : ''
      this.sink.write(`${arrow} ${method} (${size})${tail}`)
      return
    }
    // Réponse : la requête venait de l'autre sens.
    const asked = direction === 'in' ? 'out' : 'in'
    const pending = id !== undefined ? this.pending[asked].get(String(id)) : undefined
    if (id !== undefined) this.pending[asked].delete(String(id))
    const what = pending?.method ?? ''
    const took = pending ? `en ${formatDuration(this.now() - pending.at)}` : ''
    const error = message['error']
    if (isObject(error)) {
      const detail = `${str(error['code']) ?? ''} « ${excerpt(error['message'] ?? '', 200)} »`
      this.sink.write(spaced(arrow, `erreur #${str(id)}`, what, detail, took, `(${size})`))
      return
    }
    const result = message['result']
    const tail = trace && result !== undefined ? ` : ${excerpt(result)}` : ''
    const summary = resultSummary(pending?.method, result).trim()
    this.sink.write(spaced(arrow, `réponse #${str(id)}`, what, summary, took, `(${size})`) + tail)
  }

  private update(direction: Direction, params: Json, size: string): void {
    const update = isObject(params['update']) ? params['update'] : {}
    const kind = str(update['sessionUpdate']) ?? '?'
    const session = short(params['sessionId'])
    if (CHUNKS.has(kind)) {
      const content = isObject(update['content']) ? update['content'] : {}
      const text = str(content['text']) ?? ''
      const key = `${session}:${kind}:${str(update['messageId']) ?? ''}`
      if (this.chunks?.key !== key) {
        this.flush()
        this.chunks = { key, kind, count: 0, chars: 0, text: '' }
      }
      const chunks = this.chunks
      if (chunks) {
        chunks.count++
        chunks.chars += text.length
        if (chunks.text.length < 2000) chunks.text += text
      }
      return
    }
    this.flush()
    const meta = isObject(update['_meta']) ? ` meta:${Object.keys(update['_meta']).join(',')}` : ''
    const tail = this.sink.trace() ? updateExcerpt(update) : ''
    this.sink.write(
      `${ARROW[direction]} ${kind} ${updateSummary(kind, update)}[s ${session}]${meta} (${size})${tail}`
    )
  }
}

/** Morceaux non vides, séparés par une espace. */
const spaced = (...parts: string[]) => parts.filter((p) => p !== '').join(' ')

export function formatDuration(ms: number): string {
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`
}

/** Ce qui identifie une requête, sans son contenu. */
function requestSummary(method: string, params: unknown): string {
  if (!isObject(params)) return ''
  const parts: string[] = []
  if (params['sessionId'] !== undefined) parts.push(`s ${short(params['sessionId'])}`)
  if (method === 'session/prompt' && Array.isArray(params['prompt'])) {
    const blocks = params['prompt'] as unknown[]
    const types = blocks.map((b) => (isObject(b) ? (str(b['type']) ?? '?') : '?'))
    parts.push(`${blocks.length} bloc(s) ${[...new Set(types)].join('+')}`)
  }
  if (method === 'session/new' || method === 'session/load') {
    if (Array.isArray(params['mcpServers']))
      parts.push(`${params['mcpServers'].length} serveur(s) MCP`)
  }
  if (method === 'session/set_config_option') {
    parts.push(`${str(params['configId']) ?? '?'}=${str(params['value']) ?? '?'}`)
  }
  if (method === 'session/request_permission' && isObject(params['toolCall'])) {
    const tool = params['toolCall']
    parts.push(`outil ${short(tool['toolCallId'])} « ${excerpt(tool['title'] ?? '', 80)} »`)
    if (Array.isArray(params['options'])) {
      parts.push(
        (params['options'] as unknown[])
          .map((o) => (isObject(o) ? (str(o['kind']) ?? '?') : '?'))
          .join('/')
      )
    }
  }
  if (method.startsWith('fs/') && params['path'] !== undefined)
    parts.push(str(params['path']) ?? '')
  if (method === 'terminal/create' && params['command'] !== undefined) {
    parts.push(`« ${excerpt(params['command'], 80)} »`)
  }
  if (method === 'elicitation/create') parts.push(`« ${excerpt(params['message'] ?? '', 80)} »`)
  return parts.length ? `${parts.join(', ')} ` : ''
}

function resultSummary(method: string | undefined, result: unknown): string {
  if (!isObject(result)) return ''
  if (result['stopReason'] !== undefined) return `${str(result['stopReason'])} `
  if (method === 'session/new' && result['sessionId'] !== undefined) {
    return `s ${short(result['sessionId'])} `
  }
  if (isObject(result['outcome'])) {
    const outcome = result['outcome']
    return `${str(outcome['outcome']) ?? '?'}${outcome['optionId'] ? ` ${str(outcome['optionId'])}` : ''} `
  }
  if (method === 'initialize') {
    const info = isObject(result['agentInfo']) ? result['agentInfo'] : {}
    return `${str(info['name']) ?? ''} ${str(info['version']) ?? ''} `.replace(/^\s+/, '')
  }
  return ''
}

function contentSummary(content: unknown): string {
  if (!Array.isArray(content) || content.length === 0) return ''
  const counts = new Map<string, number>()
  for (const item of content as unknown[]) {
    if (!isObject(item)) continue
    const type = str(item['type']) ?? '?'
    const inner = isObject(item['content']) ? str(item['content']['type']) : undefined
    const label = type === 'content' && inner ? inner : type
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  return `contenu ${[...counts].map(([k, n]) => `${n} ${k}`).join(', ')} `
}

function updateSummary(kind: string, update: Json): string {
  const parts: string[] = []
  if (kind === 'tool_call' || kind === 'tool_call_update') {
    parts.push(short(update['toolCallId']))
    if (update['title'] !== undefined) parts.push(`« ${excerpt(update['title'], 80)} »`)
    if (update['kind'] !== undefined) parts.push(str(update['kind']) ?? '')
    if (update['status'] !== undefined) parts.push(str(update['status']) ?? '')
    const content = contentSummary(update['content'])
    if (content) parts.push(content.trim())
    if (update['rawInput'] !== undefined) parts.push('entrée')
    if (update['rawOutput'] !== undefined) parts.push('sortie')
  } else if (kind === 'plan' && Array.isArray(update['entries'])) {
    const entries = update['entries'] as unknown[]
    const done = entries.filter((e) => isObject(e) && e['status'] === 'completed').length
    parts.push(`${entries.length} tâche(s), ${done} faite(s)`)
  } else if (kind === 'usage_update') {
    parts.push(`${str(update['used']) ?? '?'}/${str(update['size']) ?? '?'}`)
  } else if (kind === 'available_commands_update' && Array.isArray(update['availableCommands'])) {
    parts.push(`${update['availableCommands'].length} commande(s)`)
  } else if (kind === 'current_mode_update') {
    parts.push(str(update['currentModeId']) ?? '')
  } else if (kind === 'config_option_update' && Array.isArray(update['configOptions'])) {
    parts.push(
      (update['configOptions'] as unknown[])
        .map((o) => (isObject(o) ? `${str(o['id'])}=${str(o['currentValue'])}` : '?'))
        .join(' ')
    )
  }
  const text = parts.filter(Boolean).join(' ')
  return text ? `${text} ` : ''
}

/** Au niveau Trace : entrée, sortie et texte du contenu d'un outil ; sinon la mise à jour entière. */
function updateExcerpt(update: Json): string {
  const kind = str(update['sessionUpdate'])
  if (kind === 'tool_call' || kind === 'tool_call_update') {
    const parts: string[] = []
    if (update['rawInput'] !== undefined) parts.push(`entrée ${excerpt(update['rawInput'])}`)
    if (update['rawOutput'] !== undefined) parts.push(`sortie ${excerpt(update['rawOutput'])}`)
    const texts = Array.isArray(update['content'])
      ? (update['content'] as unknown[]).flatMap((c) =>
          isObject(c) && isObject(c['content']) && typeof c['content']['text'] === 'string'
            ? [c['content']['text']]
            : []
        )
      : []
    if (texts.length) parts.push(`texte ${excerpt(texts.join('\n'))}`)
    return parts.length ? ` : ${parts.join(' ; ')}` : ''
  }
  return ` : ${excerpt(update)}`
}

/** D'où viennent les lignes du journal d'un hôte d'agent : la conversation et l'agent. */
export function hostScope(conversationId: string | undefined, agent: string): LogScope {
  return { ...(conversationId ? { conversation: conversationId } : {}), agent }
}

/** « (agent, 1a2b3c4d) » : la portée en tête d'une ligne du journal. */
export const scopeText = (scope: LogScope): string =>
  `(${scope.agent}${scope.conversation ? `, ${scope.conversation.slice(0, 8)}` : ''})`
