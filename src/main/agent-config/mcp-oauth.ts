/**
 * Connexion OAuth d'un serveur MCP distant faite par l'agent (fiche 293, ADR-0077). Moteur
 * générique : il ne connaît ni l'agent ni le serveur. Le profil dit les arguments et lit les sorties
 * (`McpOAuthSource`) ; le préréglage dit l'hôte et le chemin attendus de la page
 * (`shared/mcp-presets.ts`).
 *
 * - **Une seule connexion à la fois** dans l'app (connexion ou déconnexion), refusée ici, pas
 *   seulement grisée, tant que le processus de la précédente vit ou que sa déconnexion tourne.
 * - **Chaque opération porte un numéro** : une fin périmée (relue après qu'une autre opération est
 *   partie pour le même serveur, ou après la fermeture de l'app) n'émet rien et ne range rien.
 * - **La page n'est ouverte qu'après vérification** de son adresse (`checkPageUrl`), une fois ; la
 *   première adresse lue décide (une suivante est ignorée : la page a déjà été ouverte, ou la
 *   tentative refusée). Jamais d'adresse lue après la fin du processus, ni de dernière ligne sans
 *   retour à la ligne. Jamais l'adresse complète hors d'ici : seul l'hôte part au journal, à l'IPC et
 *   dans les états ; aucune ligne de sortie n'est journalisée, seulement ce qui a été reconnu.
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
  MCP_AUTH_MINUTES,
  MCP_NAME,
  type McpAuthReason,
  type McpAuthState,
  type McpAuthView,
  type McpConnectResult,
  type McpDisconnectResult,
  type McpServerEntry
} from '@shared/mcp'
import { declaredPreset, MCP_PRESETS, type McpPreset } from '@shared/mcp-presets'
import { messageOf } from '@shared/errors'
import { isDirectory } from '../is-directory'
import { log } from '../log'
import { startProcess } from '../process-tree'
import { killTree } from '../agent/process-utils'
import type { McpAuthLine, McpAuthStored, McpOAuthSource } from '../agent/adapters'
import type { AgentProfile } from '../agent/profiles'
import { checkPageUrl, scrubUrls, TerminalLines } from './mcp-oauth-output'
import { runCommand, terminalCommand, type CommandOutcome } from './mcp-oauth-command'

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
  attemptMs: MCP_AUTH_MINUTES * 60_000,
  noPageMs: 30_000,
  commandMs: 30_000,
  exitWaitMs: 5_000
}

export { MAX_COMMAND_OUTPUT } from './mcp-oauth-command'

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
  /** Système des commandes à copier (« Dans un terminal ») ; celui de l'app par défaut. */
  platform?: NodeJS.Platform
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
  /** Numéro de l'opération (`McpOAuth.latest`). */
  id: number
  profile: AgentProfile
  source: McpOAuthSource
  name: string
  host: string
  path: string
  /** Le préréglage exige un `redirect_uri` vers cette machine. */
  loopbackRedirect: boolean
  /** Dossier de la conversation au lancement : la commande et la relecture y tournent (R4). */
  workspace: string
  child?: ChildProcess
  /** Adresse vérifiée, gardée en mémoire du main seulement (« Rouvrir la page »). */
  url?: string
  urlSeen: boolean
  /** Le processus est sorti (`exit`) : plus aucune adresse n'est prise. */
  processEnded: boolean
  /** Lignes de sortie non reconnues (comptées, jamais journalisées). */
  unread: number
  told: Told
  ending?: Ending
  timers: ReturnType<typeof setTimeout>[]
  readers: TerminalLines[]
  exited: Promise<void>
  markExited: () => void
}

type Stored = Map<string, McpAuthStored> | undefined

type Target = { profile: AgentProfile; source: McpOAuthSource; preset: McpPreset; enabled: boolean }

/** Ce qu'une ligne reconnue dit, pour le journal (jamais la ligne elle-même). */
const TOLD_TEXT: Record<keyof Told, string> = {
  connected: 'connexion dite faite',
  expired: 'expiration dite',
  refused: 'refus dit',
  failed: 'échec dit',
  cancelled: 'annulation dite'
}

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
  /** Tentative de connexion dont le processus vit (ou va être lancé) : au plus une. */
  private current: Attempt | undefined
  /** Déconnexion en cours (compte aussi comme « une connexion à la fois »). */
  private logout = false
  /** Numéro de la dernière opération par serveur ; une fin d'un autre numéro est périmée. */
  private readonly latest = new Map<string, number>()
  private seq = 0
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
    const terminal = this.terminalCommands(profile, source, workspace, servers)
    if (!agentFound) {
      return {
        profileId,
        agentFound,
        servers: servers.map((name) => this.missing(profileId, name)),
        terminal
      }
    }
    const stored = servers.length
      ? await this.readStored(profile, source, workspace, env)
      : undefined
    return {
      profileId,
      agentFound,
      servers: servers.map((name) => this.shown(profileId, name, stored)),
      terminal
    }
  }

  /**
   * « Dans un terminal » : la commande de l'agent, à lancer par l'utilisateur (OpenCode y ouvre
   * lui-même la page). Un serveur déclaré pour ce dossier seulement n'est vu que de ce dossier
   * (relevé R4) : une première ligne y va (`terminalCommand`).
   */
  private terminalCommands(
    profile: AgentProfile,
    source: McpOAuthSource,
    workspace: string,
    names: readonly string[]
  ): Record<string, string> {
    const servers = this.deps.servers(profile.id, workspace)
    const commands: Record<string, string> = {}
    const platform = this.deps.platform ?? process.platform
    for (const name of names) {
      const words = [profile.command, ...source.terminalArgs(name)]
      const global = servers.some((s) => s.name === name && s.scope === 'global')
      commands[name] = terminalCommand(
        platform,
        words,
        global || !workspace ? undefined : workspace
      )
    }
    return commands
  }

  /** « Se connecter » : lance la commande de l'agent, ou dit pourquoi pas. */
  async connect(profileId: string, name: string, workspace: string): Promise<McpConnectResult> {
    const target = this.target(profileId, name, workspace)
    if (!target) return { started: false, reason: 'not-offered' }
    if (!target.enabled) return { started: false, reason: 'disabled' }
    if (this.busy()) return { started: false, reason: 'busy' }
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
    // Annulée (ou app fermée) pendant l'attente : rien n'est lancé.
    if (attempt.ending) return { started: true }
    if (!this.deps.findCommand(target.profile.command, env)) {
      this.current = undefined
      this.remember(attempt.id, this.missing(profileId, name))
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

  /**
   * « Se déconnecter » : commande de l'agent, puis état relu. Le résultat ne dit « fait » que si
   * l'état relu ne montre plus la connexion ; le journal de même.
   */
  async disconnect(
    profileId: string,
    name: string,
    workspace: string
  ): Promise<McpDisconnectResult> {
    const target = this.target(profileId, name, workspace)
    if (!target) return { done: false, reason: 'not-offered' }
    if (this.busy()) return { done: false, reason: 'busy' }
    this.logout = true
    try {
      // Environnement d'abord : s'il manque, rien n'est réservé et la fin d'une tentative précédente
      // garde le droit d'émettre son état.
      const env = await this.deps.env(target.profile)
      return await this.loggedOut(target, name, workspace, env)
    } finally {
      this.logout = false
    }
  }

  /**
   * Déconnexion, environnement lu. Elle réserve le numéro du serveur (toute fin précédente devient
   * périmée) : elle émet donc elle-même un état, quelle que soit sa façon de finir (`finally`).
   */
  private async loggedOut(
    target: Target,
    name: string,
    workspace: string,
    env: NodeJS.ProcessEnv
  ): Promise<McpDisconnectResult> {
    const profileId = target.profile.id
    const id = this.claim(profileId, name)
    let stored: Stored
    let emitted = false
    try {
      const args = target.source.disconnectArgs(name)
      const outcome = await this.command(target.profile, args, workspace, env)
      if (outcome.kind === 'missing') {
        this.remember(id, this.missing(profileId, name))
        emitted = true
        return { done: false, reason: 'agent-missing' }
      }
      this.outcomes.delete(key(profileId, name))
      stored = await this.readStored(target.profile, target.source, workspace, env)
      return this.disconnected(target.profile, name, outcome, stored)
    } finally {
      if (!emitted && !this.quitting && this.latest.get(key(profileId, name)) === id) {
        this.deps.onState(this.shown(profileId, name, stored))
      }
    }
  }

  /** Fermeture de l'app : tout s'arrête, plus rien n'est lancé ni émis. */
  stop(): void {
    this.quitting = true
    if (this.current) this.finish(this.current, { kind: 'quit' })
    this.current = undefined
    for (const child of this.live) this.stopTree(child)
    this.live.clear()
  }

  /* ---------- Cibles ---------- */

  private busy(): boolean {
    return this.quitting || !!this.current || this.logout
  }

  /** Nouvelle opération sur ce serveur : les fins des précédentes deviennent périmées. */
  private claim(profileId: string, name: string): number {
    const id = ++this.seq
    this.latest.set(key(profileId, name), id)
    return id
  }

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

  private presetOf(servers: readonly McpServerEntry[], name: string): McpPreset | undefined {
    return declaredPreset(servers, name, this.deps.presets ?? MCP_PRESETS)
  }

  private target(profileId: string, name: string, workspace: string): Target | undefined {
    const profile = this.deps.profiles().find((p) => p.id === profileId)
    if (!profile?.mcpOAuth || !MCP_NAME.test(name)) return undefined
    const servers = this.deps.servers(profileId, workspace)
    const preset = this.presetOf(servers, name)
    if (!preset) return undefined
    const enabled = servers.filter((s) => s.name === name).every((s) => s.enabled)
    return { profile, source: profile.mcpOAuth, preset, enabled }
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

  /** Range et émet un état, seulement s'il vient de la dernière opération et que l'app vit. */
  private remember(id: number, state: McpAuthState): void {
    if (this.quitting || this.latest.get(key(state.profileId, state.name)) !== id) return
    this.outcomes.set(key(state.profileId, state.name), state)
    this.deps.onState(state)
  }

  private async readStored(
    profile: AgentProfile,
    source: McpOAuthSource,
    workspace: string,
    env: NodeJS.ProcessEnv
  ): Promise<Stored> {
    if (this.quitting) return undefined
    const outcome = await this.command(profile, source.statesArgs(), workspace, env)
    const stored = outcome.kind === 'closed' ? source.readStates(outcome.stdout) : undefined
    if (!stored && !this.quitting)
      log.warn(`MCP : état des connexions de ${profile.label} illisible`)
    return stored
  }

  private disconnected(
    profile: AgentProfile,
    name: string,
    outcome: CommandOutcome,
    stored: Stored
  ): McpDisconnectResult {
    const subject = `MCP : « ${name} » : se déconnecter par ${profile.label}`
    if (outcome.kind === 'timeout') {
      log.warn(`${subject} : pas de réponse`)
      return { done: false, reason: 'timeout' }
    }
    if (outcome.kind !== 'closed') {
      log.warn(`${subject} : commande en échec (${outcome.kind})`)
      return { done: false, reason: 'failed' }
    }
    if (!stored) {
      log.warn(`${subject} : état non relu, rien de confirmé`)
      return { done: false, reason: 'unconfirmed' }
    }
    if (stored.has(name)) {
      log.warn(`${subject} : connexion toujours présente selon ${profile.label}`)
      return { done: false, reason: 'still-connected' }
    }
    log.info(`MCP : « ${name} » déconnecté par ${profile.label} (état relu)`)
    return { done: true }
  }

  private command(
    profile: AgentProfile,
    args: readonly string[],
    workspace: string,
    env: NodeJS.ProcessEnv
  ): Promise<CommandOutcome> {
    if (this.quitting) return Promise.resolve({ kind: 'failed' })
    return runCommand({
      start: this.start,
      stop: this.stopTree,
      track: (child) => {
        this.live.add(child)
        return () => this.live.delete(child)
      },
      command: profile.command,
      args,
      cwd: this.cwd(workspace),
      env,
      timeoutMs: this.limits.commandMs,
      label: profile.label
    })
  }

  /* ---------- Tentative ---------- */

  private newAttempt(target: Target, name: string, workspace: string): Attempt {
    let markExited = () => {}
    const exited = new Promise<void>((resolve) => (markExited = resolve))
    return {
      id: this.claim(target.profile.id, name),
      profile: target.profile,
      source: target.source,
      name,
      host: target.preset.pageHost,
      path: target.preset.pagePath,
      loopbackRedirect: target.preset.pageLoopbackRedirect,
      workspace,
      urlSeen: false,
      processEnded: false,
      unread: 0,
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
      const reader = new TerminalLines((line, complete) => this.onLine(attempt, line, complete))
      attempt.readers.push(reader)
      stream.on('data', (chunk: Buffer) => reader.push(chunk))
      stream.on('error', () => {})
    }
    child.stdin?.on('error', () => {})
    child.once('error', (error: Error & { code?: string }) => {
      attempt.processEnded = true
      attempt.markExited()
      this.finish(attempt, { kind: 'spawn-failed', missing: error.code === 'ENOENT' })
    })
    // Fin de la sortie (`close`) : toutes les lignes sont lues. Le processus est déjà marqué
    // sorti (aucune adresse prise désormais) avant de vider les lecteurs.
    child.once('close', () => {
      attempt.processEnded = true
      for (const reader of attempt.readers) reader.end()
      attempt.markExited()
      this.finish(attempt, { kind: 'exit' })
    })
    // Un petit-enfant qui garderait la sortie ouverte ne retient pas la fin plus de `exitWaitMs`.
    child.once('exit', () => {
      attempt.processEnded = true
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

  private onLine(attempt: Attempt, line: string, complete: boolean): void {
    if (attempt.ending) return
    const read = attempt.source.readLine(line)
    if (!read) {
      if (line.trim()) attempt.unread++
      return
    }
    if (read.kind !== 'url') {
      attempt.told[read.kind] = true
      log.info(`MCP : connexion de « ${attempt.name} » : ${TOLD_TEXT[read.kind]}`)
      return
    }
    // Lue après la fin du processus, ou dernière ligne sans retour : peut-être coupée, jamais prise.
    if (attempt.processEnded || !complete) {
      log.warn(`MCP : connexion de « ${attempt.name} » : adresse lue après la fin, ignorée`)
      return
    }
    if (attempt.urlSeen) {
      log.info(`MCP : connexion de « ${attempt.name} » : adresse supplémentaire ignorée`)
      return
    }
    attempt.urlSeen = true
    const check = checkPageUrl(read.url, {
      host: attempt.host,
      path: attempt.path,
      loopbackRedirect: attempt.loopbackRedirect
    })
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
    const failed = (error: unknown) =>
      log.warn(`MCP : page non ouverte (${scrubUrls(messageOf(error))})`)
    try {
      void Promise.resolve(this.deps.openExternal(url)).catch(failed)
    } catch (error) {
      failed(error)
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

  /**
   * Après la fin : le processus attendu (borné), la place rendue (une autre tentative peut partir),
   * l'état relu (borné par le délai des commandes courtes), puis l'état final émis s'il n'est pas
   * périmé.
   */
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
    if (this.current === attempt) this.current = undefined
    if (this.quitting) return
    let stored: Stored
    if (!(ending.kind === 'spawn-failed' && ending.missing)) {
      try {
        const env = await this.deps.env(profile)
        stored = await this.readStored(profile, source, attempt.workspace, env)
      } catch (error) {
        log.warn(`MCP : état de « ${name} » non relu (${scrubUrls(messageOf(error))})`)
      }
    }
    const value = stored === undefined ? undefined : (stored.get(name) ?? 'none')
    const state: McpAuthState = {
      profileId: profile.id,
      name,
      ...attemptOutcome(ending, attempt.told, attempt.urlSeen, value)
    }
    if (this.quitting) return
    const unread = attempt.unread ? `, ${attempt.unread} ligne(s) non reconnue(s)` : ''
    const subject = `MCP : connexion de « ${name} » par ${profile.label}`
    if (this.latest.get(key(profile.id, name)) !== attempt.id) {
      log.info(`${subject} : fin périmée (${ending.kind}${unread}), ignorée`)
      return
    }
    log.info(`${subject} : fin (${ending.kind}${unread})`)
    if (value === 'connected' || ending.kind === 'cancel') {
      this.outcomes.delete(key(profile.id, name))
      this.deps.onState(state)
    } else this.remember(attempt.id, state)
  }
}
