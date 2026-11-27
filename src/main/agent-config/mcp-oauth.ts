/**
 * Connexion OAuth d'un serveur MCP distant faite par l'agent (fiche 293, ADR-0075). Moteur
 * générique : il ne connaît ni l'agent ni le serveur. Le profil dit les arguments et lit les sorties
 * (`McpOAuthSource`) ; le préréglage dit l'hôte attendu de la page (`shared/mcp-presets.ts`).
 *
 * - **Une seule connexion à la fois** dans l'app (connexion ou déconnexion), refusée ici, pas
 *   seulement grisée.
 * - **La page n'est ouverte qu'après vérification** de son adresse (`checkPageUrl`), une fois ; la
 *   première adresse lue décide (une suivante est ignorée : la page a déjà été ouverte, ou la
 *   tentative refusée). Jamais l'adresse complète hors d'ici : seul l'hôte part au journal, à
 *   l'IPC et dans les états.
 * - **Chaque fin n'est traitée qu'une fois** (« Annuler », délai, adresse refusée, pas d'adresse,
 *   fin du processus, fermeture de l'app) ; l'arbre de processus est toujours arrêté (`killTree` :
 *   le serveur privé de l'agent est un enfant, relevé R6).
 * - **La fin se juge à la sortie et à l'état relu chez l'agent**, jamais au code de sortie
 *   (l'expiration d'OpenCode rend 0).
 *
 * N'importe pas `electron` : ouverture de la page et lancement sont injectés.
 */
import type { ChildProcess, ChildProcessWithoutNullStreams, SpawnOptions } from 'node:child_process'
import {
  MCP_NAME,
  type McpAuthReason,
  type McpAuthState,
  type McpAuthView,
  type McpConnectResult,
  type McpServerEntry
} from '@shared/mcp'
import { MCP_PRESETS, presetForUrl, type McpPreset } from '@shared/mcp-presets'
import { messageOf } from '@shared/errors'
import { isDirectory } from '../is-directory'
import { log } from '../log'
import { startProcess } from '../process-tree'
import { killTree } from '../agent/process-utils'
import type { McpAuthLine, McpAuthStored, McpOAuthSource } from '../agent/adapters'
import type { AgentProfile } from '../agent/profiles'
import { checkPageUrl, scrubUrls, TerminalLines } from './mcp-oauth-output'

export interface McpOAuthLimits {
  /** Durée maximale d'une tentative (proche de celle d'OpenCode, ≈ 10 min). */
  attemptMs: number
  /** Sans adresse lue dans ce délai : « pas de page de connexion ». */
  noPageMs: number
  /** Commandes courtes (état, déconnexion). */
  commandMs: number
  /** Attente de la fin du processus arrêté, avant de relire l'état. */
  exitWaitMs: number
}

export const MCP_OAUTH_LIMITS: McpOAuthLimits = {
  attemptMs: 10 * 60_000,
  noPageMs: 30_000,
  commandMs: 30_000,
  exitWaitMs: 5_000
}

/** Sortie d'une commande courte gardée au plus (au-delà : illisible). */
export const MAX_COMMAND_OUTPUT = 1024 * 1024

type Start = (command: string, args: readonly string[], options: SpawnOptions) => ChildProcess

export interface McpOAuthDeps {
  profiles: () => readonly AgentProfile[]
  /** Serveurs déclarés pour cet agent, vus du dossier (fichiers de l'agent, fiche 025). */
  servers: (profileId: string, workspace: string) => readonly McpServerEntry[]
  /** Dossier où lancer la commande sans dossier de conversation. */
  fallbackCwd: string
  /** Environnement de lancement de l'agent (clés, réseau d'entreprise), comme pour l'agent. */
  env: (profile: AgentProfile) => Promise<NodeJS.ProcessEnv>
  /** Commande de l'agent trouvée comme pour son lancement ; `undefined` : introuvable. */
  findCommand: (command: string, env: NodeJS.ProcessEnv) => string | undefined
  openExternal: (url: string) => Promise<void> | void
  onState: (state: McpAuthState) => void
  start?: Start
  stop?: (child: ChildProcess) => void
  limits?: Partial<McpOAuthLimits>
  presets?: readonly McpPreset[]
}

/** Ce que l'agent a dit de la fin. */
type Told = Partial<Record<Exclude<McpAuthLine['kind'], 'url'>, true>>

type Ending =
  | { kind: 'cancel' }
  | { kind: 'timeout' }
  | { kind: 'no-page' }
  | { kind: 'unexpected-page'; host?: string }
  | { kind: 'exit' }
  | { kind: 'spawn-failed'; missing: boolean }
  | { kind: 'quit' }

interface Attempt {
  profile: AgentProfile
  source: McpOAuthSource
  name: string
  host: string
  /** Dossier de la conversation au lancement : la commande et la relecture y tournent (R4). */
  workspace: string
  child?: ChildProcess
  /** Adresse vérifiée, gardée en mémoire du main seulement (« Rouvrir la page »). */
  url?: string
  urlSeen: boolean
  told: Told
  ending?: Ending
  timers: ReturnType<typeof setTimeout>[]
  readers: TerminalLines[]
  exited: Promise<void>
  markExited: () => void
}

/** Résultat d'une commande courte : sa sortie standard, si elle a pu être lue en entier. */
interface CommandOutput {
  stdout?: string
  missing?: boolean
}

type Stored = Map<string, McpAuthStored> | undefined

const key = (profileId: string, name: string) => `${profileId}\u0000${name}`

/**
 * Fin d'une tentative, d'après ce qu'elle a donné et l'état relu (`stored` : `undefined` si
 * l'état n'a pas pu être relu). L'état relu « connecté » l'emporte toujours ; le code de sortie
 * n'entre jamais en compte.
 */
export function attemptOutcome(
  ending: Exclude<Ending, { kind: 'quit' }>,
  told: Told,
  urlSeen: boolean,
  stored: McpAuthStored | 'none' | undefined
): Pick<McpAuthState, 'status' | 'reason' | 'host'> {
  if (stored === 'connected') return { status: 'connected' }
  const error = (reason: McpAuthReason) => ({ status: 'error' as const, reason })
  switch (ending.kind) {
    case 'spawn-failed':
      return ending.missing ? { status: 'agent-missing' } : error('stopped')
    case 'cancel':
      return storedState(stored)
    case 'timeout':
      return error('timeout')
    case 'unexpected-page':
      return { ...error('unexpected-page'), ...(ending.host ? { host: ending.host } : {}) }
    case 'no-page':
      return { status: 'no-page' }
    case 'exit':
      if (told.refused) return { status: 'refused' }
      if (told.expired) return error('timeout')
      if (!urlSeen) return { status: 'no-page' }
      return told.failed || told.connected || told.cancelled ? error('failed') : error('stopped')
  }
}

function storedState(
  stored: McpAuthStored | 'none' | undefined
): Pick<McpAuthState, 'status' | 'reason' | 'host'> {
  if (stored === undefined || stored === 'unknown') return { status: 'unknown' }
  return { status: stored === 'none' ? 'to-connect' : stored }
}

export class McpOAuth {
  private readonly deps: McpOAuthDeps
  private readonly limits: McpOAuthLimits
  private readonly start: Start
  private readonly stopTree: (child: ChildProcess) => void
  /** Tentative de connexion en cours (au plus une). */
  private current: Attempt | undefined
  /** Déconnexion en cours (compte aussi comme « une connexion à la fois »). */
  private logout = false
  /** Fin de la dernière tentative, montrée tant que l'état relu ne dit pas « connecté ». */
  private readonly outcomes = new Map<string, McpAuthState>()
  /** Tout processus lancé et pas encore fini, arrêté à la fermeture de l'app. */
  private readonly live = new Set<ChildProcess>()
  private quitting = false

  constructor(deps: McpOAuthDeps) {
    this.deps = deps
    this.limits = { ...MCP_OAUTH_LIMITS, ...deps.limits }
    this.start = deps.start ?? ((c, a, o) => startProcess(c, a, o).child)
    this.stopTree = deps.stop ?? ((child) => killTree(child as ChildProcessWithoutNullStreams))
  }

  /** États des serveurs connectables de l'agent, vus du dossier (relus chez l'agent). */
  async view(profileId: string, workspace: string): Promise<McpAuthView> {
    const { profile, source } = this.oauthProfile(profileId)
    const servers = this.connectable(profileId, workspace)
    const env = await this.deps.env(profile)
    const agentFound = !!this.deps.findCommand(profile.command, env)
    if (!agentFound) {
      return {
        profileId,
        agentFound,
        servers: servers.map((name) => this.missing(profileId, name))
      }
    }
    const stored = servers.length
      ? await this.readStored(profile, source, workspace, env)
      : undefined
    return {
      profileId,
      agentFound,
      servers: servers.map((name) => this.shown(profileId, name, stored))
    }
  }

  /** « Se connecter » : lance la commande de l'agent, ou dit pourquoi pas. */
  async connect(profileId: string, name: string, workspace: string): Promise<McpConnectResult> {
    const target = this.target(profileId, name, workspace)
    if (!target) return { started: false, reason: 'not-offered' }
    if (this.quitting || this.current || this.logout) return { started: false, reason: 'busy' }
    const attempt = this.newAttempt(target, name, workspace)
    // Réservée avant toute attente : un second clic pendant la lecture de l'environnement est refusé.
    this.current = attempt
    this.outcomes.delete(key(profileId, name))
    let env: NodeJS.ProcessEnv
    try {
      env = await this.deps.env(target.profile)
    } catch (error) {
      log.warn(
        `MCP : connexion de « ${name} » : environnement illisible (${scrubUrls(messageOf(error))})`
      )
      this.finish(attempt, { kind: 'spawn-failed', missing: false })
      return { started: true }
    }
    if (attempt.ending) return { started: true } // Annulée pendant l'attente.
    if (!this.deps.findCommand(target.profile.command, env)) {
      this.current = undefined
      this.remember(this.missing(profileId, name))
      return { started: false, reason: 'agent-missing' }
    }
    this.launch(attempt, env)
    return { started: true }
  }

  /** « Annuler » : arrête la tentative en cours de ce serveur. */
  cancel(profileId: string, name: string): boolean {
    const attempt = this.current
    if (!attempt || attempt.profile.id !== profileId || attempt.name !== name) return false
    this.finish(attempt, { kind: 'cancel' })
    return true
  }

  /** « Rouvrir la page » : la même adresse vérifiée, tant que la tentative dure. */
  reopen(profileId: string, name: string): boolean {
    const attempt = this.current
    if (!attempt?.url || attempt.ending) return false
    if (attempt.profile.id !== profileId || attempt.name !== name) return false
    log.info(`MCP : connexion de « ${name} » : page rouverte (${attempt.host})`)
    this.open(attempt.url)
    return true
  }

  /** « Se déconnecter » : commande de l'agent, puis état relu. */
  async disconnect(profileId: string, name: string, workspace: string): Promise<McpConnectResult> {
    const target = this.target(profileId, name, workspace)
    if (!target) return { started: false, reason: 'not-offered' }
    if (this.quitting || this.current || this.logout) return { started: false, reason: 'busy' }
    this.logout = true
    try {
      const env = await this.deps.env(target.profile)
      const cwd = this.cwd(workspace)
      const args = target.source.disconnectArgs(name)
      const result = await this.run(target.profile, args, cwd, env)
      if (result.missing) {
        this.remember(this.missing(profileId, name))
        return { started: false, reason: 'agent-missing' }
      }
      log.info(`MCP : déconnexion de « ${name} » par ${target.profile.label}`)
      this.outcomes.delete(key(profileId, name))
      const stored = await this.readStored(target.profile, target.source, workspace, env)
      if (!this.quitting) this.deps.onState(this.shown(profileId, name, stored))
      return { started: true }
    } finally {
      this.logout = false
    }
  }

  /** Fermeture de l'app : tout s'arrête, plus rien n'est lancé ni émis. */
  stop(): void {
    this.quitting = true
    if (this.current) this.finish(this.current, { kind: 'quit' })
    for (const child of this.live) this.stopTree(child)
    this.live.clear()
  }

  /* ---------- Cibles ---------- */

  private oauthProfile(profileId: string): { profile: AgentProfile; source: McpOAuthSource } {
    const profile = this.deps.profiles().find((p) => p.id === profileId)
    if (!profile?.mcpOAuth) throw new Error('Paramètre invalide : profileId')
    return { profile, source: profile.mcpOAuth }
  }

  /** Noms des serveurs déclarés dont l'adresse est celle d'un préréglage (un par nom). */
  private connectable(profileId: string, workspace: string): string[] {
    const servers = this.deps.servers(profileId, workspace)
    const names = new Set(servers.map((s) => s.name))
    return [...names].filter((name) => this.presetOf(servers, name))
  }

  /**
   * Préréglage du serveur de ce nom : toutes ses déclarations (tous les dossiers, ce dossier) sont
   * distantes et à l'adresse du même préréglage ; sinon, rien (pas de connexion devinée).
   */
  private presetOf(servers: readonly McpServerEntry[], name: string): McpPreset | undefined {
    const named = servers.filter((s) => s.name === name)
    const presets = new Set(
      named.map((s) =>
        s.transport === 'http' ? presetForUrl(s.url, this.deps.presets ?? MCP_PRESETS) : undefined
      )
    )
    const [preset] = [...presets]
    return presets.size === 1 ? preset : undefined
  }

  private target(profileId: string, name: string, workspace: string) {
    const profile = this.deps.profiles().find((p) => p.id === profileId)
    if (!profile?.mcpOAuth || !MCP_NAME.test(name)) return undefined
    const preset = this.presetOf(this.deps.servers(profileId, workspace), name)
    return preset ? { profile, source: profile.mcpOAuth, preset } : undefined
  }

  private cwd(workspace: string): string {
    return workspace && isDirectory(workspace) ? workspace : this.deps.fallbackCwd
  }

  /* ---------- États ---------- */

  private missing(profileId: string, name: string): McpAuthState {
    return { profileId, name, status: 'agent-missing' }
  }

  /** État montré : en cours, sinon connecté relu, sinon fin de la dernière tentative, sinon relu. */
  private shown(profileId: string, name: string, stored: Stored): McpAuthState {
    const attempt = this.current
    if (attempt && !attempt.ending && attempt.profile.id === profileId && attempt.name === name) {
      return { profileId, name, status: 'connecting', host: attempt.host }
    }
    const value = stored === undefined ? undefined : (stored.get(name) ?? 'none')
    // Agent trouvé (seul cas où l'on relit) : un « agent absent » d'avant ne vaut plus.
    if (
      value === 'connected' ||
      this.outcomes.get(key(profileId, name))?.status === 'agent-missing'
    ) {
      this.outcomes.delete(key(profileId, name))
    }
    const outcome = this.outcomes.get(key(profileId, name))
    return outcome ?? { profileId, name, ...storedState(value) }
  }

  private remember(state: McpAuthState): void {
    this.outcomes.set(key(state.profileId, state.name), state)
    if (!this.quitting) this.deps.onState(state)
  }

  private async readStored(
    profile: AgentProfile,
    source: McpOAuthSource,
    workspace: string,
    env: NodeJS.ProcessEnv
  ): Promise<Stored> {
    if (this.quitting) return undefined
    const result = await this.run(profile, source.statesArgs(), this.cwd(workspace), env)
    const stored = result.stdout === undefined ? undefined : source.readStates(result.stdout)
    if (!stored) log.warn(`MCP : état des connexions de ${profile.label} illisible`)
    return stored
  }

  /* ---------- Tentative ---------- */

  private newAttempt(
    target: { profile: AgentProfile; source: McpOAuthSource; preset: McpPreset },
    name: string,
    workspace: string
  ): Attempt {
    let markExited = () => {}
    const exited = new Promise<void>((resolve) => (markExited = resolve))
    return {
      profile: target.profile,
      source: target.source,
      name,
      host: target.preset.pageHost,
      workspace,
      urlSeen: false,
      told: {},
      timers: [],
      readers: [],
      exited,
      markExited
    }
  }

  private launch(attempt: Attempt, env: NodeJS.ProcessEnv): void {
    const { profile, source, name } = attempt
    log.info(`MCP : connexion de « ${name} » par ${profile.label} : lancée (${attempt.host})`)
    let child: ChildProcess
    try {
      child = this.start(profile.command, source.connectArgs(name), {
        cwd: this.cwd(attempt.workspace),
        env,
        stdio: ['pipe', 'pipe', 'pipe']
      })
    } catch (error) {
      log.warn(
        `MCP : connexion de « ${name} » : lancement impossible (${scrubUrls(messageOf(error))})`
      )
      this.finish(attempt, { kind: 'spawn-failed', missing: false })
      return
    }
    attempt.child = child
    this.live.add(child)
    this.deps.onState({ profileId: profile.id, name, status: 'connecting', host: attempt.host })
    this.watch(attempt, child)
    attempt.timers.push(
      setTimeout(() => this.finish(attempt, { kind: 'timeout' }), this.limits.attemptMs),
      setTimeout(() => {
        if (!attempt.urlSeen) this.finish(attempt, { kind: 'no-page' })
      }, this.limits.noPageMs)
    )
  }

  private watch(attempt: Attempt, child: ChildProcess): void {
    for (const stream of [child.stdout, child.stderr]) {
      if (!stream) continue
      const reader = new TerminalLines((line) => this.onLine(attempt, line))
      attempt.readers.push(reader)
      stream.on('data', (chunk: Buffer) => reader.push(chunk))
      stream.on('error', () => {})
    }
    child.stdin?.on('error', () => {})
    child.once('error', (error: Error & { code?: string }) => {
      attempt.markExited()
      this.finish(attempt, { kind: 'spawn-failed', missing: error.code === 'ENOENT' })
    })
    // Fin de la sortie (`close`) : toutes les lignes sont lues. Un petit-enfant qui garderait la
    // sortie ouverte ne retient pas la fin plus de `exitWaitMs` après celle du processus.
    child.once('close', () => {
      for (const reader of attempt.readers) reader.end()
      attempt.markExited()
      this.finish(attempt, { kind: 'exit' })
    })
    child.once('exit', () => {
      if (attempt.ending) {
        attempt.markExited()
        return
      }
      const late = setTimeout(() => {
        attempt.markExited()
        this.finish(attempt, { kind: 'exit' })
      }, this.limits.exitWaitMs)
      attempt.timers.push(late)
    })
  }

  private onLine(attempt: Attempt, line: string): void {
    if (attempt.ending) return
    const text = line.trim()
    if (text) log.debug(`MCP : sortie de la connexion de « ${attempt.name} » : ${scrubUrls(text)}`)
    const read = attempt.source.readLine(line)
    if (!read) return
    if (read.kind !== 'url') {
      attempt.told[read.kind] = true
      return
    }
    if (attempt.urlSeen) {
      log.info(`MCP : connexion de « ${attempt.name} » : adresse supplémentaire ignorée`)
      return
    }
    attempt.urlSeen = true
    const check = checkPageUrl(read.url, attempt.host)
    if (!check.ok) {
      log.warn(
        `MCP : connexion de « ${attempt.name} » : page refusée (${check.host ?? 'adresse illisible'}, attendu ${attempt.host})`
      )
      this.finish(attempt, { kind: 'unexpected-page', ...(check.host ? { host: check.host } : {}) })
      return
    }
    attempt.url = check.url
    log.info(
      `MCP : connexion de « ${attempt.name} » par ${attempt.profile.label} : page ouverte (${check.host})`
    )
    this.open(check.url)
  }

  private open(url: string): void {
    try {
      void Promise.resolve(this.deps.openExternal(url)).catch((error: unknown) =>
        log.warn(`MCP : page non ouverte (${scrubUrls(messageOf(error))})`)
      )
    } catch (error) {
      log.warn(`MCP : page non ouverte (${scrubUrls(messageOf(error))})`)
    }
  }

  /** Une fin, traitée une seule fois : arrêt de l'arbre, attente de la fin, état relu. */
  private finish(attempt: Attempt, ending: Ending): void {
    if (attempt.ending) return
    attempt.ending = ending
    for (const timer of attempt.timers) clearTimeout(timer)
    const { child } = attempt
    if (child) this.stopTree(child)
    if (ending.kind === 'quit') {
      if (child) this.live.delete(child)
      if (this.current === attempt) this.current = undefined
      return
    }
    void this.settle(attempt, ending)
  }

  private async settle(attempt: Attempt, ending: Exclude<Ending, { kind: 'quit' }>): Promise<void> {
    const { profile, source, name } = attempt
    if (attempt.child) {
      let timer: ReturnType<typeof setTimeout> | undefined
      await Promise.race([
        attempt.exited,
        new Promise<void>((resolve) => (timer = setTimeout(resolve, this.limits.exitWaitMs)))
      ])
      clearTimeout(timer)
      this.live.delete(attempt.child)
    }
    for (const reader of attempt.readers) reader.end()
    if (this.current === attempt) this.current = undefined
    if (this.quitting) return
    log.info(`MCP : connexion de « ${name} » par ${profile.label} : fin (${ending.kind})`)
    const missing = ending.kind === 'spawn-failed' && ending.missing
    let stored: Stored
    if (!missing) {
      try {
        const env = await this.deps.env(profile)
        stored = await this.readStored(profile, source, attempt.workspace, env)
      } catch (error) {
        log.warn(`MCP : état de « ${name} » non relu (${scrubUrls(messageOf(error))})`)
      }
    }
    if (this.quitting) return
    const value = stored === undefined ? undefined : (stored.get(name) ?? 'none')
    const state: McpAuthState = {
      profileId: profile.id,
      name,
      ...attemptOutcome(ending, attempt.told, attempt.urlSeen, value)
    }
    const relu = value === 'connected' || ending.kind === 'cancel'
    if (relu) this.outcomes.delete(key(profile.id, name))
    else this.outcomes.set(key(profile.id, name), state)
    this.deps.onState(state)
  }

  /* ---------- Commandes courtes ---------- */

  /** Lance une commande courte de l'agent ; sortie standard bornée, délai, arbre arrêté. */
  private run(
    profile: AgentProfile,
    args: readonly string[],
    cwd: string,
    env: NodeJS.ProcessEnv
  ): Promise<CommandOutput> {
    if (this.quitting) return Promise.resolve({})
    return new Promise((resolve) => {
      let child: ChildProcess
      try {
        child = this.start(profile.command, args, { cwd, env, stdio: ['pipe', 'pipe', 'pipe'] })
      } catch (error) {
        log.warn(`MCP : commande de ${profile.label} impossible (${scrubUrls(messageOf(error))})`)
        resolve({})
        return
      }
      this.live.add(child)
      const chunks: Buffer[] = []
      let size = 0
      let done = false
      const end = (result: CommandOutput) => {
        if (done) return
        done = true
        clearTimeout(timer)
        this.stopTree(child)
        this.live.delete(child)
        resolve(result)
      }
      const timer = setTimeout(() => {
        log.warn(`MCP : commande de ${profile.label} sans réponse en ${this.limits.commandMs} ms`)
        end({})
      }, this.limits.commandMs)
      child.stdout?.on('data', (chunk: Buffer) => {
        size += chunk.length
        if (size > MAX_COMMAND_OUTPUT) end({})
        else chunks.push(chunk)
      })
      child.stdout?.on('error', () => {})
      child.stderr?.on('data', () => {})
      child.stderr?.on('error', () => {})
      child.stdin?.on('error', () => {})
      child.once('error', (error: Error & { code?: string }) =>
        end(error.code === 'ENOENT' ? { missing: true } : {})
      )
      child.once('close', () => end({ stdout: Buffer.concat(chunks).toString('utf8') }))
    })
  }
}
