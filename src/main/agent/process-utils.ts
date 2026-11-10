/** Petits outils du cycle de vie d'un agent : processus, délais, messages d'erreur. */
import type { ChildProcessWithoutNullStreams } from 'node:child_process'
import { t } from 'i18next'
import { messageOf } from '@shared/errors'
import { stopGroup } from '../process-group'

/**
 * Arrête l'agent et son groupe de processus (lancé avec `detached`) : SIGTERM, puis SIGKILL au bout
 * de 3 s s'il vit encore (fiche 138).
 */
export function killTree(child: ChildProcessWithoutNullStreams): void {
  stopGroup(child)
}

/** Délai laissé au processus pour sortir de lui-même après la fin de sa connexion. */
export const CONNECTION_GRACE_MS = 1000

/**
 * Connexion ACP coupée alors que le processus vit (fiche 195) : stdout fermé, ligne trop longue
 * pour le SDK. Passé `graceMs` (le temps qu'un plantage soit vu comme tel), le processus vit encore
 * et c'est toujours le processus courant (`current`) : `onLost`, puis arrêt du groupe.
 */
export function killIfConnectionLost(
  signal: AbortSignal,
  child: ChildProcessWithoutNullStreams,
  current: () => boolean,
  onLost: () => void,
  graceMs = CONNECTION_GRACE_MS
): void {
  signal.addEventListener(
    'abort',
    () => {
      setTimeout(() => {
        if (!current() || child.exitCode !== null || child.signalCode !== null) return
        onLost()
        killTree(child)
      }, graceMs).unref()
    },
    { once: true }
  )
}

/** Délai dépassé (`race`) : distinct d'une erreur de l'agent. */
export class AgentTimeout extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AgentTimeout'
  }
}

/** Attend `request`, sauf si le processus meurt (`failed`) ou si le délai est dépassé. */
export function race<T>(
  failed: Promise<never>,
  ms: number,
  what: string,
  request: Promise<T>
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () =>
        reject(new AgentTimeout(t('process.timeout', { what, seconds: Math.round(ms / 1000) }))),
      ms
    )
  })
  return Promise.race([request, failed, late]).finally(() => clearTimeout(timer))
}

/** Dossier existant (module à part, chargeable par les sondes sans bundler). */
export { isDirectory } from '../is-directory'

/** Échec du lancement : commande introuvable ou non exécutable, dit en clair. */
export function spawnError(error: Error & { code?: string }, command: string): Error {
  if (error.code === 'ENOENT') {
    return new Error(t('process.commandMissing', { command }))
  }
  if (error.code === 'EACCES') return new Error(t('process.notExecutable', { command }))
  return error
}

/** URL https valide, sinon `undefined` (on n'ouvre jamais `file:`, `javascript:`…). */
export function safeUrl(raw: string): string | undefined {
  try {
    const url = new URL(raw)
    return url.protocol === 'https:' ? url.toString() : undefined
  } catch {
    return undefined
  }
}

/**
 * Message d'une erreur, avec le détail qu'un agent joint à une erreur JSON-RPC (`data`). Bob 2.0.6
 * renvoie « Internal error » et met la vraie cause dans `data.details`, parfois sous la forme
 * `BudgetExceededError: {"title":…,"description":…}` : on en garde le titre et la description.
 */
export function errorMessage(error: unknown): string {
  const message = messageOf(error)
  const details = errorDetails(error)
  if (!details || message.includes(details)) return message
  const titled = titledError(details)
  if (titled) return titled
  return /^internal error$/i.test(message.trim()) ? details : `${message} (${details})`
}

function errorDetails(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined
  const data = (error as { data?: unknown }).data
  if (typeof data === 'string') return data.trim() || undefined
  if (typeof data !== 'object' || data === null) return undefined
  for (const key of ['details', 'message']) {
    const value = (data as Record<string, unknown>)[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return undefined
}

/** `NomError: {"title":…,"description":…}` → « titre — description ». */
function titledError(details: string): string | undefined {
  const match = /^\w*Error: (\{[\s\S]*\})$/.exec(details)
  if (!match?.[1]) return undefined
  try {
    const data = JSON.parse(match[1]) as Record<string, unknown>
    const title = typeof data['title'] === 'string' ? data['title'].trim() : ''
    const description = typeof data['description'] === 'string' ? data['description'].trim() : ''
    if (!title && !description) return undefined
    return title && description ? `${title} — ${description}` : title || description
  } catch {
    return undefined
  }
}

/** Laisse le SDK livrer les notifications déjà reçues (quelques tours de boucle d'évènements). */
export async function settleNotifications(): Promise<void> {
  for (let i = 0; i < 3; i++) await new Promise((resolve) => setImmediate(resolve))
}
