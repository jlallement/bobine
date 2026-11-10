/**
 * Agent lancé pour l'occasion (fiches 055, 091, 188) : démarré, initialisé, utilisé, puis arrêté
 * quoi qu'il arrive — réponse, erreur, délai dépassé, annulation ou mort du processus. Sert à lire
 * ou supprimer des sessions sans en ouvrir (`session-list.ts`) et aux essais du premier lancement
 * (`onboarding/agent-readiness.ts`). Rien de propre à un agent : tout vient du profil.
 */
import { Readable, Writable } from 'node:stream'
import {
  client,
  methods,
  ndJsonStream,
  PROTOCOL_VERSION,
  type InitializeResponse
} from '../../shared/acp-sdk.mts'
import type { EnvChanges } from '../agent-config/api-keys'
import { spawnAgent } from './agent-process'
import { killTree, race, spawnError } from './process-utils'
import type { AgentProfile } from './profiles'
import { t } from 'i18next'

/** Fin de la sortie d'erreur gardée pour expliquer un plantage. */
const STDERR_TAIL = 2000

export type ClientBuilder = ReturnType<typeof client>

export interface ShortLivedOptions {
  profile: AgentProfile
  /** Dossier où lancer l'agent. */
  cwd: string
  credentials?: EnvChanges
  clientVersion?: string
  /** Délai d'`initialize` (30 s par défaut). */
  timeoutMs?: number
  /** Gestionnaires des demandes et notifications de l'agent (aucun par défaut). */
  setup?: (builder: ClientBuilder) => ClientBuilder
  /** Annulation : l'agent est arrêté, `failed` rejetée par une `AgentCancelled`. */
  signal?: AbortSignal
  /** Reçoit l'arrêt immédiat de l'agent (fermeture de l'app : pas le temps d'attendre `use`). */
  onStop?: (stop: () => void) => void
}

export interface Connected {
  connection: ReturnType<ClientBuilder['connect']>
  /** Rejetée si l'agent ne démarre pas, s'arrête (`AgentExited`) ou si l'essai est annulé. */
  failed: Promise<never>
  init: InitializeResponse
  /** Fin de ce que l'agent a écrit sur sa sortie d'erreur. */
  stderr: () => string
}

/** L'agent s'est arrêté de lui-même (code ou signal). */
export class AgentExited extends Error {
  readonly code: number | null
  readonly signalName: NodeJS.Signals | null
  constructor(code: number | null, signalName: NodeJS.Signals | null) {
    super(t('sessionList.exited', { status: signalName ?? `code ${String(code)}` }))
    this.name = 'AgentExited'
    this.code = code
    this.signalName = signalName
  }
}

/** L'essai a été annulé par l'utilisateur. */
export class AgentCancelled extends Error {
  constructor() {
    super('cancelled')
    this.name = 'AgentCancelled'
  }
}

/** Agent lancé pour l'occasion et initialisé ; arrêté après `use`, quoi qu'il arrive. */
export async function withAgent<T>(
  options: ShortLivedOptions,
  use: (connected: Connected) => Promise<T>
): Promise<T> {
  const { profile, timeoutMs = 30_000, signal } = options
  if (signal?.aborted) throw new AgentCancelled()
  const child = spawnAgent(profile, {
    cwd: options.cwd,
    ...(options.credentials ? { credentials: options.credentials } : {})
  })
  options.onStop?.(() => killTree(child))
  let stderr = ''
  child.stderr.on('data', (chunk: Buffer) => {
    stderr = (stderr + chunk.toString('utf8')).slice(-STDERR_TAIL)
  })
  let onAbort: (() => void) | undefined
  const failed = new Promise<never>((_, reject) => {
    child.once('error', (error) => reject(spawnError(error, profile.command)))
    child.once('exit', (code, exitSignal) => reject(new AgentExited(code, exitSignal)))
    onAbort = () => reject(new AgentCancelled())
    signal?.addEventListener('abort', onAbort, { once: true })
  })
  failed.catch(() => {})
  const builder = client({ name: 'bobine' })
  const connection = (options.setup ? options.setup(builder) : builder).connect(
    ndJsonStream(
      Writable.toWeb(child.stdin) as WritableStream<Uint8Array>,
      Readable.toWeb(child.stdout) as ReadableStream<Uint8Array>
    )
  )
  try {
    const init = await race(
      failed,
      timeoutMs,
      t('agentHost.timeout.initialize'),
      connection.agent.request(methods.agent.initialize, {
        protocolVersion: PROTOCOL_VERSION,
        clientCapabilities: {},
        clientInfo: { name: 'bobine', version: options.clientVersion ?? '0.0.0' }
      })
    )
    return await use({ connection, failed, init, stderr: () => stderr })
  } finally {
    if (onAbort) signal?.removeEventListener('abort', onAbort)
    connection.close()
    killTree(child)
  }
}
