/**
 * Commande courte d'un agent (fiche 293) : état des connexions, déconnexion. Sortie standard bornée,
 * délai, arbre toujours arrêté à la fin ; chaque issue dite telle quelle, jamais au code de sortie.
 * N'importe pas `electron`.
 */
import type { ChildProcess, SpawnOptions } from 'node:child_process'
import { messageOf } from '@shared/errors'
import { log } from '../log'
import { scrubUrls } from './mcp-oauth-output'

/** Sortie d'une commande courte gardée au plus (au-delà : illisible). */
export const MAX_COMMAND_OUTPUT = 1024 * 1024

export type CommandOutcome =
  /** Sorties fermées : tout ce que la commande a écrit sur sa sortie standard. */
  | { kind: 'closed'; stdout: string }
  /** Sortie au-delà de `MAX_COMMAND_OUTPUT` : arrêtée, illisible. */
  | { kind: 'overflow' }
  | { kind: 'timeout' }
  /** Commande introuvable (`ENOENT`). */
  | { kind: 'missing' }
  /** Lancement impossible pour une autre raison. */
  | { kind: 'failed' }

export interface CommandRun {
  start: (command: string, args: readonly string[], options: SpawnOptions) => ChildProcess
  stop: (child: ChildProcess) => void
  /** Note le processus vivant (arrêté à la fermeture de l'app) ; rend de quoi l'oublier. */
  track: (child: ChildProcess) => () => void
  command: string
  args: readonly string[]
  cwd: string
  env: NodeJS.ProcessEnv
  timeoutMs: number
  /** Pour le journal : l'agent. */
  label: string
}

export function runCommand(run: CommandRun): Promise<CommandOutcome> {
  return new Promise((resolve) => {
    let child: ChildProcess
    try {
      child = run.start(run.command, run.args, {
        cwd: run.cwd,
        env: run.env,
        stdio: ['pipe', 'pipe', 'pipe']
      })
    } catch (error) {
      log.warn(`MCP : commande de ${run.label} impossible (${scrubUrls(messageOf(error))})`)
      resolve({ kind: 'failed' })
      return
    }
    const untrack = run.track(child)
    const chunks: Buffer[] = []
    let size = 0
    let done = false
    const end = (outcome: CommandOutcome) => {
      if (done) return
      done = true
      clearTimeout(timer)
      // Toujours : un petit-enfant resté après la fin est arrêté aussi.
      run.stop(child)
      untrack()
      resolve(outcome)
    }
    const timer = setTimeout(() => {
      log.warn(`MCP : commande de ${run.label} sans réponse en ${run.timeoutMs} ms`)
      end({ kind: 'timeout' })
    }, run.timeoutMs)
    child.stdout?.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_COMMAND_OUTPUT) end({ kind: 'overflow' })
      else chunks.push(chunk)
    })
    child.stdout?.on('error', () => {})
    child.stderr?.on('data', () => {})
    child.stderr?.on('error', () => {})
    child.stdin?.on('error', () => {})
    child.once('error', (error: Error & { code?: string }) =>
      end({ kind: error.code === 'ENOENT' ? 'missing' : 'failed' })
    )
    child.once('close', () =>
      end({ kind: 'closed', stdout: Buffer.concat(chunks).toString('utf8') })
    )
  })
}

/** Mot sûr tel quel dans un shell : rien à citer. */
const PLAIN = /^[A-Za-z0-9_@%+=:,./-]+$/

/**
 * Commande à copier pour un terminal (« Dans un terminal », fiche 293) : une ligne par commande,
 * jamais `&&` (refusé par Windows PowerShell 5), chaque mot cité pour le shell du système.
 * - macOS, Linux (sh, bash, zsh) : `cd '<dossier>'`, apostrophe écrite `'\''` ;
 * - Windows (PowerShell, le terminal par défaut) : `Set-Location -LiteralPath '<dossier>'`, apostrophe
 *   doublée ; `-LiteralPath` : ni `[`, ni `*`, ni `$` interprétés.
 */
export function terminalCommand(
  platform: NodeJS.Platform,
  words: readonly string[],
  cwd?: string
): string {
  const windows = platform === 'win32'
  const quote = (word: string) =>
    PLAIN.test(word)
      ? word
      : windows
        ? `'${word.replace(/'/g, "''")}'`
        : `'${word.replace(/'/g, "'\\''")}'`
  const line = words.map(quote).join(' ')
  if (cwd === undefined) return line
  const cd = windows ? `Set-Location -LiteralPath ${quote(cwd)}` : `cd ${quote(cwd)}`
  return `${cd}\n${line}`
}
