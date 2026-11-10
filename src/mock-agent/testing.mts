/**
 * Utilitaires pour tester un client ACP contre l'agent factice, dans un vrai sous-processus.
 */
import { spawn } from 'node:child_process'
import { Readable, Writable } from 'node:stream'
import { fileURLToPath } from 'node:url'
import { client, methods, ndJsonStream } from '../shared/acp-sdk.mts'
import type {
  ActiveSession,
  ClientContext,
  ContentBlock,
  CreateElicitationRequest,
  CreateElicitationResponse,
  RequestPermissionRequest,
  RequestPermissionResponse,
  SessionNotification,
  SessionUpdate,
  StopReason
} from '../shared/acp-sdk.mts'

export const MOCK_AGENT_ENTRY = fileURLToPath(new URL('./main.mts', import.meta.url))

export interface MockAgentRun {
  scenario?: string
  delayMs?: number
  /** Arguments supplémentaires de l'agent factice (ex. `--sans-options`). */
  args?: string[]
  /** Dossier où l'agent est lancé (défaut : celui des tests). */
  cwd?: string
  /** Réponse aux demandes de permission (défaut : annulée). */
  onPermission?: (request: RequestPermissionRequest) => RequestPermissionResponse
  /** Réponse aux élicitations (défaut : refus). */
  onElicitation?: (request: CreateElicitationRequest) => CreateElicitationResponse
  /** Reçoit tous les `session/update`, y compris ceux des sessions enfants. */
  onUpdate?: (notification: SessionNotification) => void
}

/** Lance l'agent factice, s'y connecte, exécute `op`, puis arrête le processus. */
export async function withMockAgent<T>(
  run: MockAgentRun,
  op: (ctx: ClientContext) => Promise<T>
): Promise<T> {
  const child = spawn(
    process.execPath,
    [
      MOCK_AGENT_ENTRY,
      '--scenario',
      run.scenario ?? 'demo',
      '--delay',
      String(run.delayMs ?? 0),
      ...(run.args ?? [])
    ],
    { stdio: ['pipe', 'pipe', 'pipe'], ...(run.cwd ? { cwd: run.cwd } : {}) }
  )
  let stderr = ''
  child.stderr.on('data', (d: Buffer) => (stderr += d.toString()))
  const exited = new Promise<number | null>((resolve) => child.on('exit', resolve))

  const stream = ndJsonStream(
    Writable.toWeb(child.stdin) as WritableStream<Uint8Array>,
    Readable.toWeb(child.stdout) as ReadableStream<Uint8Array>
  )

  try {
    const app = client({ name: 'test-client' })
      .onRequest(methods.client.session.requestPermission, ({ params }) =>
        run.onPermission ? run.onPermission(params) : { outcome: { outcome: 'cancelled' } }
      )
      .onRequest(methods.client.elicitation.create, ({ params }) =>
        run.onElicitation ? run.onElicitation(params) : { action: 'decline' }
      )
    if (run.onUpdate) {
      const onUpdate = run.onUpdate
      app.onNotification(methods.client.session.update, ({ params }) => onUpdate(params))
    }
    return await app.connectWith(stream, op)
  } catch (error) {
    if (stderr) (error as Error).message += `\n[stderr agent]\n${stderr}`
    throw error
  } finally {
    child.kill()
    await exited
  }
}

export async function initialize(ctx: ClientContext) {
  return ctx.request(methods.agent.initialize, {
    protocolVersion: 1,
    clientCapabilities: { elicitation: { form: {} } }
  })
}

export interface Turn {
  updates: SessionUpdate[]
  stopReason: StopReason
}

/** Envoie un prompt et collecte les updates jusqu'à la fin du tour. */
export async function playTurn(
  session: ActiveSession,
  prompt: string | ContentBlock[],
  onUpdate?: (update: SessionUpdate) => void
): Promise<Turn> {
  const response = session.prompt(prompt)
  // Ne gagne la course que si le prompt échoue : en cas de succès, le `stop` arrive par nextUpdate().
  const failure = response.then(() => new Promise<never>(() => {}))
  const updates: SessionUpdate[] = []
  for (;;) {
    const message = await Promise.race([session.nextUpdate(), failure])
    if (message.kind === 'stop') return { updates, stopReason: message.stopReason }
    // Les commandes « / » sont annoncées à l'ouverture de session, pas pendant le tour.
    if (message.update.sessionUpdate === 'available_commands_update') continue
    updates.push(message.update)
    onUpdate?.(message.update)
  }
}

/** Concatène le texte des `agent_message_chunk`. */
export function agentText(updates: SessionUpdate[]): string {
  return updates
    .map((u) =>
      u.sessionUpdate === 'agent_message_chunk' && u.content.type === 'text' ? u.content.text : ''
    )
    .join('')
}
