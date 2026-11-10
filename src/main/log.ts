/**
 * Journal de l'app (main process) : `main.log` dans le dossier des journaux d'Electron
 * (`~/Library/Logs/Bobine/`), recopié sur la console. Sans dépendance ; n'importe pas
 * `electron` (le dossier est donné par `initLog`).
 *
 * Deux fichiers (fiche 080) :
 * - `main.log` : démarrage, erreurs, agents lancés et arrêtés, tours — toujours écrit ;
 * - `agents.log` : le détail des échanges avec les agents (messages ACP, appels des outils de
 *   l'app, sortie d'erreur des agents), écrit seulement au niveau Détaillé ou Trace.
 *
 * Le journal ne doit jamais devenir un problème lui-même (fiche 041) :
 * - au-delà de sa taille (1 Mo, 10 Mo pour `agents.log`), un fichier devient `<nom>.old.log` (au
 *   démarrage comme en cours de route) : deux fichiers au plus chacun, quoi qu'il arrive ;
 * - une console fermée (sortie standard coupée, `EPIPE`) n'est plus utilisée, sans lever d'erreur ;
 * - une écriture impossible (disque plein) est ignorée.
 */
import { appendFileSync, existsSync, mkdirSync, renameSync, statSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

import type { Verbosity } from '@shared/log-level'
export type { Verbosity } from '@shared/log-level'

const MAX_BYTES = 1024 * 1024
const AGENTS_MAX_BYTES = 10 * 1024 * 1024

/** Un fichier de journal borné : rotation en `<nom>.old.log`, écriture qui n'échoue jamais. */
class LogFile {
  readonly path: string
  private readonly limit: number
  private size = 0

  constructor(dir: string, name: string, limit: number) {
    this.path = join(dir, `${name}.log`)
    this.limit = limit
    try {
      this.size = statSync(this.path).size
      if (this.size > limit) this.rotate()
    } catch {
      this.size = 0 // Pas encore de journal.
    }
  }

  append(line: string): void {
    try {
      if (this.size + line.length > this.limit) this.rotate()
      appendFileSync(this.path, line)
      this.size += Buffer.byteLength(line)
    } catch {
      // Disque plein, droits : le journal ne doit jamais faire tomber l'app.
    }
  }

  bytes(): number {
    try {
      return statSync(this.path).size
    } catch {
      return 0
    }
  }

  private rotate(): void {
    try {
      renameSync(this.path, join(dirname(this.path), `${basename(this.path, '.log')}.old.log`))
    } catch {
      // Impossible de renommer : on continue d'écrire dans le même fichier.
    }
    this.size = 0
  }
}

let main: LogFile | undefined
let agents: LogFile | undefined
let verbosity: Verbosity = 'normal'
/** La console ne marche plus (sortie fermée) : on n'écrit plus que dans le fichier. */
let consoleBroken = false

export function initLog(
  dir: string,
  maxBytes = MAX_BYTES,
  agentsMaxBytes = AGENTS_MAX_BYTES
): string {
  mkdirSync(dir, { recursive: true })
  main = new LogFile(dir, 'main', maxBytes)
  agents = new LogFile(dir, 'agents', agentsMaxBytes)
  return main.path
}

export function logFile(): string | undefined {
  return main?.path
}

export function agentsLogFile(): string | undefined {
  return agents?.path
}

/** Applique `action` au journal demandé, s'il existe sur le disque (Ouvrir, Afficher dans le Finder). */
export function withLogFile(which: 'main' | 'agents', action: (file: string) => void): void {
  const file = which === 'agents' ? agentsLogFile() : logFile()
  if (file && existsSync(file)) action(file)
}

/** Taille des journaux en cours (octets), pour Réglages › Diagnostic. */
export function logSizes(): { main: number; agents: number } {
  return { main: main?.bytes() ?? 0, agents: agents?.bytes() ?? 0 }
}

export function setVerbosity(next: Verbosity): void {
  verbosity = next
}

export function getVerbosity(): Verbosity {
  return verbosity
}

/** Le niveau courant écrit-il ce détail ? (`trace` : aussi les extraits de contenu.) */
export function logs(level: 'detailed' | 'trace'): boolean {
  return level === 'detailed' ? verbosity !== 'normal' : verbosity === 'trace'
}

/** Message et détails sur une ligne ; les erreurs gardent leur pile. */
export function formatLine(level: LogLevel, message: string, details: unknown[], now = new Date()) {
  const parts = details.map((d) =>
    d instanceof Error
      ? (d.stack ?? `${d.name}: ${d.message}`)
      : typeof d === 'string'
        ? d
        : safeJson(d)
  )
  return `${now.toISOString()} ${level.toUpperCase().padEnd(5)} ${[message, ...parts].join(' ')}\n`
}

/** Erreur d'écriture sur une sortie fermée : sans conséquence, à ne pas journaliser en boucle. */
export function isBrokenPipe(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code
  return code === 'EPIPE' || code === 'ERR_STREAM_DESTROYED'
}

/** La sortie standard a été fermée : plus de recopie sur la console. */
export function disableConsole(): void {
  consoleBroken = true
}

function write(level: LogLevel, message: string, details: unknown[]): void {
  const line = formatLine(level, message, details)
  if (!consoleBroken) {
    try {
      const consoleFn =
        level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
      consoleFn(line.trimEnd())
    } catch {
      consoleBroken = true
    }
  }
  main?.append(line)
}

export const log = {
  info: (message: string, ...details: unknown[]) => write('info', message, details),
  warn: (message: string, ...details: unknown[]) => write('warn', message, details),
  error: (message: string, ...details: unknown[]) => write('error', message, details)
}

/** D'où vient une ligne de `agents.log` : la conversation (8 premiers caractères) et l'agent. */
export interface LogScope {
  conversation?: string
  agent?: string
}

export function scopeText(scope: LogScope): string {
  const conversation = scope.conversation ? scope.conversation.slice(0, 8) : '—'
  return `[${conversation}${scope.agent ? ` · ${scope.agent}` : ''}]`
}

/**
 * Détail des échanges avec les agents (`agents.log`, fiche 080), seulement au niveau Détaillé ou
 * Trace ; pas de recopie sur la console (trop bavard). L'appelant vérifie `logs('trace')` avant de
 * calculer un extrait de contenu.
 */
export const agentLog = {
  line(scope: LogScope, message: string): void {
    if (verbosity === 'normal' || !agents) return
    agents.append(`${new Date().toISOString()} ${scopeText(scope)} ${message}\n`)
  }
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value)
  } catch {
    return String(value)
  }
}
