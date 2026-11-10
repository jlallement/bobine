/**
 * Échanges ACP bruts de chaque conversation, en mémoire (fiche 135) : les lignes JSON-RPC que le
 * relevé (`acp-log.ts`) voit passer, dans un tampon circulaire par conversation, pour l'onglet
 * « Échanges ACP » du panneau. Rien n'est écrit sur le disque, à aucun niveau du journal.
 *
 * Gardé léger, parce que toutes les conversations dont l'agent tourne y passent : la ligne telle
 * quelle, sans l'analyser ; le masquage des secrets (`redact`) se fait quand le texte quitte le
 * main (instantané, lots envoyés à une conversation regardée). Pur : pas d'Electron.
 */
import {
  ACP_EXCHANGES_MAX,
  type AcpExchange,
  type AcpExchangesBatch,
  type AcpExchangesSnapshot
} from '@shared/acp-exchanges'
import { redact } from '../log-redact'
import type { Direction } from './acp-log'

/** Au-delà, seul le début d'une ligne est gardé (un fichier lu entier, une longue sortie). */
export const MESSAGE_MAX_CHARS = 256 * 1024
/** Texte gardé par conversation ; les messages les plus anciens partent d'abord. */
export const CONVERSATION_MAX_CHARS = 8 * 1024 * 1024
/** Conversations gardées : la moins récemment active part d'abord, jamais une regardée. */
export const MAX_CONVERSATIONS = 8
/** Délai de regroupement des messages envoyés au renderer. */
export const BATCH_MS = 100

interface Stored {
  seq: number
  at: number
  direction: Direction
  text: string
  bytes: number
  truncated: boolean
}

interface Log {
  /** Du plus ancien au plus récent. */
  messages: Stored[]
  chars: number
  nextSeq: number
  watchers: number
  /** Messages pas encore envoyés aux abonnés. */
  pending: Stored[]
  timer: ReturnType<typeof setTimeout> | undefined
}

export interface AcpExchangesOptions {
  now?: () => number
  max?: number
  conversationMaxChars?: number
  maxConversations?: number
  batchMs?: number
}

export class AcpExchanges {
  private readonly logs = new Map<string, Log>()
  private readonly now: () => number
  private readonly max: number
  private readonly conversationMaxChars: number
  private readonly maxConversations: number
  private readonly batchMs: number
  private listener: ((batch: AcpExchangesBatch) => void) | undefined

  constructor(options: AcpExchangesOptions = {}) {
    this.now = options.now ?? Date.now
    this.max = options.max ?? ACP_EXCHANGES_MAX
    this.conversationMaxChars = options.conversationMaxChars ?? CONVERSATION_MAX_CHARS
    this.maxConversations = options.maxConversations ?? MAX_CONVERSATIONS
    this.batchMs = options.batchMs ?? BATCH_MS
  }

  /** Reçoit les lots des conversations regardées (relayés au renderer). */
  onBatch(listener: (batch: AcpExchangesBatch) => void): void {
    this.listener = listener
  }

  /** Une ligne JSON-RPC entière, écrite vers l'agent (`out`) ou lue de lui (`in`). */
  line(conversationId: string, direction: Direction, line: string): void {
    const log = this.logOf(conversationId)
    const truncated = line.length > MESSAGE_MAX_CHARS
    const text = truncated ? line.slice(0, MESSAGE_MAX_CHARS) : line
    const message: Stored = {
      seq: log.nextSeq++,
      at: this.now(),
      direction,
      text,
      bytes: Buffer.byteLength(line),
      truncated
    }
    this.push(log, message)
    if (log.watchers > 0) {
      log.pending.push(message)
      log.timer ??= setTimeout(() => this.flush(conversationId), this.batchMs)
    }
  }

  /** Messages gardés de la conversation, masqués, du plus ancien au plus récent. */
  snapshot(conversationId: string): AcpExchangesSnapshot {
    const log = this.logs.get(conversationId)
    return { messages: log ? log.messages.map(toExchange) : [] }
  }

  /** L'onglet s'ouvre : instantané, puis les nouveaux messages par lots. */
  watch(conversationId: string): AcpExchangesSnapshot {
    const log = this.logOf(conversationId)
    log.watchers++
    return this.snapshot(conversationId)
  }

  unwatch(conversationId: string): void {
    const log = this.logs.get(conversationId)
    if (!log || log.watchers === 0) return
    log.watchers--
    if (log.watchers === 0) {
      if (log.timer) clearTimeout(log.timer)
      log.timer = undefined
      log.pending = []
    }
  }

  /** Envoie tout de suite les messages en attente d'une conversation. */
  flush(conversationId: string): void {
    const log = this.logs.get(conversationId)
    if (!log) return
    if (log.timer) clearTimeout(log.timer)
    log.timer = undefined
    const pending = log.pending
    log.pending = []
    if (pending.length && log.watchers > 0) {
      this.listener?.({ conversationId, messages: pending.map(toExchange) })
    }
  }

  /** Nombre de messages gardés (essais). */
  size(conversationId: string): number {
    return this.logs.get(conversationId)?.messages.length ?? 0
  }

  private logOf(conversationId: string): Log {
    let log = this.logs.get(conversationId)
    if (log) {
      // Conversation la plus récemment active : à la fin de la table.
      this.logs.delete(conversationId)
      this.logs.set(conversationId, log)
      return log
    }
    log = { messages: [], chars: 0, nextSeq: 1, watchers: 0, pending: [], timer: undefined }
    this.logs.set(conversationId, log)
    this.evictConversations()
    return log
  }

  private evictConversations(): void {
    for (const [id, log] of this.logs) {
      if (this.logs.size <= this.maxConversations) return
      if (log.watchers === 0) this.logs.delete(id)
    }
  }

  private push(log: Log, message: Stored): void {
    log.messages.push(message)
    log.chars += message.text.length
    // Tampon borné en nombre et en texte : les plus anciens partent, le dernier reste toujours.
    while (
      log.messages.length > this.max ||
      (log.chars > this.conversationMaxChars && log.messages.length > 1)
    ) {
      log.chars -= log.messages.shift()?.text.length ?? 0
    }
  }
}

function toExchange(message: Stored): AcpExchange {
  return {
    seq: message.seq,
    at: message.at,
    direction: message.direction,
    text: redact(message.text),
    bytes: message.bytes,
    ...(message.truncated ? { truncated: true } : {})
  }
}

/** Relevé partagé des échanges, comme `agentLog` : alimenté par `agent-process.ts`. */
export const acpExchanges = new AcpExchanges()
