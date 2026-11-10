/**
 * Serveurs de dev lancés par l'app pour l'agent (fiche 030). Un serveur par dossier et par nom de
 * configuration : deux conversations du même projet partagent « web ». Groupe de processus détaché
 * (arrêté en entier), journaux gardés en mémoire, tout s'arrête avec l'app.
 */
import { spawn, type ChildProcess } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { connect } from 'node:net'
import { join, resolve } from 'node:path'
import {
  commandLine,
  LAUNCH_FILES,
  launches,
  parseLaunchFile,
  urlOf,
  type DevServersChange,
  type DevServerStatus,
  type DevServerView,
  type LaunchConfig
} from '@shared/launch'
import { t } from 'i18next'
import { messageOf } from '@shared/errors'
import { delay } from '../delay'
import { stopGroup } from '../process-group'
import { trackChild } from '../process-registry'

const MAX_LINES = 1000
const PORT_POLL_MS = 250
const ERROR_LINE = /error|exception|failed|fatal|err!/i

interface Server {
  workspace: string
  config: LaunchConfig
  status: DevServerStatus
  child?: ChildProcess
  exitCode?: number | null
  lines: string[]
  /** Se résout quand le port répond (`true`) ou que le processus s'arrête (`false`). */
  ready: Promise<boolean>
  /** Démarrage et fin (ms) : durée dans l'onglet « Session » (fiche 166). */
  startedAt: number
  endedAt?: number
}

/** Résultat d'un démarrage : prêt, encore en cours après le délai, ou échec. */
export interface StartOutcome {
  state: 'ready' | 'starting' | 'failed'
  server: DevServerView
  /** Dernières lignes du journal (utile en cas d'échec). */
  tail: string[]
  reused: boolean
}

/** Fichier de lancement du dossier ; `undefined` s'il n'y en a pas. Lève si le fichier est invalide. */
export function readLaunchConfigs(
  workspace: string
): { file: string; configs: LaunchConfig[] } | undefined {
  for (const relative of LAUNCH_FILES) {
    let text: string
    try {
      text = readFileSync(join(workspace, relative), 'utf8')
    } catch {
      continue
    }
    try {
      return { file: relative, configs: parseLaunchFile(text) }
    } catch (error) {
      throw new Error(`${relative} : ${messageOf(error)}`)
    }
  }
  return undefined
}

export class DevServers {
  private readonly servers = new Map<string, Server>()
  private readonly onChange: (change: DevServersChange) => void

  constructor(onChange: (change: DevServersChange) => void = () => {}) {
    this.onChange = onChange
  }

  /**
   * Démarre (ou réutilise) un serveur et attend au plus `budgetMs` qu'il réponde : au-delà, le
   * démarrage continue et l'état vaut `starting`.
   */
  async start(workspace: string, config: LaunchConfig, budgetMs: number): Promise<StartOutcome> {
    const key = keyOf(workspace, config.name)
    const existing = this.servers.get(key)
    const alive =
      existing &&
      (existing.status === 'starting' ||
        existing.status === 'running' ||
        existing.status === 'attached')
    if (existing && alive && commandLine(existing.config) === commandLine(config)) {
      return this.outcome(existing, await waitAtMost(existing.ready, budgetMs), true)
    }
    if (existing && alive) this.stopServer(existing)

    const server: Server = {
      workspace,
      config,
      status: 'starting',
      lines: [],
      ready: Promise.resolve(false),
      startedAt: Date.now()
    }
    this.servers.set(key, server)
    if (!launches(config)) {
      // Serveur lancé ailleurs (par l'utilisateur) : on s'y rattache… s'il répond.
      const up = config.port !== undefined && (await portOpen(config.port))
      server.status = up ? 'attached' : 'failed'
      server.ready = Promise.resolve(up)
      if (!up) {
        this.log(
          server,
          `Rien ne répond sur le port ${config.port ?? '?'} et la configuration n’a pas de commande pour lancer le serveur (runtimeExecutable ou command).`
        )
      }
      this.changed(workspace)
      return this.outcome(server, up, false)
    }
    if (config.port !== undefined && (await portOpen(config.port))) {
      server.status = 'attached'
      server.ready = Promise.resolve(true)
      this.log(
        server,
        `Port ${config.port} déjà en écoute : serveur existant utilisé, rien n’a été lancé.`
      )
      this.changed(workspace)
      return this.outcome(server, true, false)
    }
    this.spawn(server)
    return this.outcome(server, await waitAtMost(server.ready, budgetMs), false)
  }

  list(workspace: string): DevServerView[] {
    return [...this.servers.values()].filter((s) => s.workspace === workspace).map(viewOf)
  }

  /** Journal d'un serveur : dernières lignes, éventuellement filtrées. */
  logs(
    workspace: string,
    name: string,
    filter: { errorsOnly?: boolean; search?: string; lines?: number } = {}
  ): string[] {
    const server = this.servers.get(keyOf(workspace, name))
    if (!server) throw new Error(t('devServers.unknown', { name }))
    const search = filter.search?.toLowerCase()
    return server.lines
      .filter((line) => !filter.errorsOnly || ERROR_LINE.test(line))
      .filter((line) => !search || line.toLowerCase().includes(search))
      .slice(-(filter.lines ?? 50))
  }

  stop(workspace: string, name: string): boolean {
    const server = this.servers.get(keyOf(workspace, name))
    if (!server) return false
    this.stopServer(server)
    return true
  }

  stopAll(): void {
    for (const server of this.servers.values()) this.stopServer(server)
  }

  private spawn(server: Server): void {
    const { config, workspace } = server
    const cwd = resolve(workspace, config.cwd ?? '.')
    const [file, args] = config.command
      ? ['/bin/sh', ['-c', config.command]]
      : [config.runtimeExecutable ?? '', config.runtimeArgs]
    let child: ChildProcess
    try {
      child = spawn(file, args, {
        cwd,
        env: {
          ...process.env,
          ...(config.port !== undefined ? { PORT: String(config.port) } : {}),
          ...config.env,
          // Journaux lisibles par l'agent, sans codes de couleur.
          FORCE_COLOR: '0',
          NO_COLOR: '1'
        },
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe']
      })
    } catch (error) {
      this.fail(server, error)
      return
    }
    server.child = child
    trackChild(child, [file, ...args])
    this.log(server, `$ ${commandLine(config)}  (dans ${cwd})`)
    const onData = (chunk: Buffer) => {
      for (const line of stripAnsi(chunk.toString('utf8')).split(/\r?\n/)) {
        if (line.trim()) this.log(server, line)
      }
    }
    child.stdout?.on('data', onData)
    child.stderr?.on('data', onData)
    let exited = false
    const exit = new Promise<false>((done) => {
      child.on('error', (error) => {
        exited = true
        this.fail(server, error)
        done(false)
      })
      child.on('exit', (code, signal) => {
        exited = true
        if (server.child !== child) return done(false)
        server.child = undefined
        server.exitCode = code
        if (server.status !== 'failed') server.status = 'exited'
        this.log(server, `[arrêté : ${signal ?? `code ${String(code)}`}]`)
        this.changed(workspace)
        done(false)
      })
    })
    const port = config.port
    const listening = (async () => {
      if (port === undefined) return true
      while (!exited) {
        if (await portOpen(port)) return true
        await delay(PORT_POLL_MS, { unref: true })
      }
      return false
    })()
    server.ready = Promise.race([listening, exit]).then((ok) => {
      if (ok && server.child === child) {
        server.status = 'running'
        this.changed(workspace)
      }
      return ok
    })
    this.changed(workspace)
  }

  private fail(server: Server, error: unknown): void {
    server.status = 'failed'
    this.log(server, `[échec du lancement : ${messageOf(error)}]`)
    this.changed(server.workspace)
  }

  private stopServer(server: Server): void {
    const { child } = server
    server.child = undefined
    if (
      server.status === 'starting' ||
      server.status === 'running' ||
      server.status === 'attached'
    ) {
      server.status = 'exited'
    }
    if (child) stopGroup(child)
    this.changed(server.workspace)
  }

  private log(server: Server, line: string): void {
    server.lines.push(line)
    if (server.lines.length > MAX_LINES) server.lines.splice(0, server.lines.length - MAX_LINES)
  }

  private outcome(server: Server, ready: boolean, reused: boolean): StartOutcome {
    const state = ready ? 'ready' : server.status === 'starting' ? 'starting' : 'failed'
    return { state, server: viewOf(server), tail: server.lines.slice(-30), reused }
  }

  private changed(workspace: string): void {
    // Fin vue ici, quel que soit le chemin (arrêt, sortie, échec) : une seule fois.
    for (const server of this.servers.values()) {
      const ended = server.status === 'exited' || server.status === 'failed'
      if (server.workspace === workspace && ended) server.endedAt ??= Date.now()
    }
    this.onChange({ workspace, servers: this.list(workspace) })
  }
}

const keyOf = (workspace: string, name: string) => `${workspace}\u0000${name}`

function viewOf(server: Server): DevServerView {
  return {
    name: server.config.name,
    status: server.status,
    url: urlOf(server.config),
    command: commandLine(server.config) || '(serveur existant)',
    startedAt: server.startedAt,
    ...(server.endedAt !== undefined ? { endedAt: server.endedAt } : {}),
    ...(server.child?.pid !== undefined ? { pid: server.child.pid } : {}),
    ...(server.exitCode !== undefined ? { exitCode: server.exitCode } : {})
  }
}

/** Le port répond-il en local (IPv4 ou IPv6 : Vite écoute parfois seulement sur ::1) ? */
export async function portOpen(port: number): Promise<boolean> {
  const tryHost = (host: string) =>
    new Promise<boolean>((done) => {
      const socket = connect({ port, host })
      const finish = (ok: boolean) => {
        socket.destroy()
        done(ok)
      }
      socket.setTimeout(500, () => finish(false))
      socket.once('connect', () => finish(true))
      socket.once('error', () => finish(false))
    })
  return (await tryHost('127.0.0.1')) || (await tryHost('::1'))
}

function waitAtMost(ready: Promise<boolean>, ms: number): Promise<boolean> {
  return Promise.race([ready, delay(ms, { unref: true }).then(() => false)])
}

const ANSI = /\u001b\[[0-9;?]*[ -/]*[@-~]|\u001b\][^\u0007]*\u0007/g
const stripAnsi = (text: string) => text.replace(ANSI, '')
