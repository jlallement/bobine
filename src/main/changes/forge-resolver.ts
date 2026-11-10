/**
 * Forge d'un dépôt distant et état de son outil (fiche 189, ADR-0041). Règles :
 *
 * - **GitHub par défaut, exactement comme avant** : tout ce que `glab` ne revendique pas
 *   (github.com, `ssh.github.com`, alias SSH, GitHub Enterprise, dépôt local, hôte inconnu) passe
 *   par `gh auth status` **sans** `--hostname`.
 * - **GitLab seulement sur preuve** : `gitlab.com` (et `altssh.gitlab.com`), ou un hôte déclaré
 *   dans la configuration de `glab` (lue sur le disque, rien n'est lancé ni envoyé). Un nom qui
 *   contient « gitlab » sans `glab` installé : GitLab, pour dire d'installer `glab`.
 * - **Aucune sonde d'un hôte inconnu** : sur « Actualiser » seulement, un hôte que ni `glab` ni
 *   `gh` ne déclarent (fichiers de configuration, `GH_HOST`) est dit « forge inconnue ».
 * - Les alias SSH (`git@github.com-work:…`) sont résolus par `ssh -G` (lecture de la
 *   configuration SSH, sans connexion, environnement sans jetons).
 * - Une vérification par outil et par hôte à la fois (promesse partagée) ; gardée 5 min si elle
 *   est bonne ou si l'hôte ne répond pas, 15 s sinon (0.9.1, D7) ; « Actualiser » l'oublie.
 */
import type { PrBlocker } from '@shared/worktree-cycle'
import type { Run } from '../simulator/run'
import {
  guessedForge,
  knownForge,
  projectRef,
  remoteHost,
  tokenlessEnv,
  toolHost,
  validHostname,
  type ForgeAdapter,
  type ToolStatus
} from './forge'
import { githubForge, readGhHosts } from './forge-github'
import { gitlabForge, glabHostFor, readGlabHosts, type GlabHost } from './forge-gitlab'

export interface ForgeResolverOptions {
  /** Chemin de `gh` s'il est installé (`findExecutable`), relu à chaque vérification. */
  gh?: () => string | undefined
  /** Chemin de `glab` s'il est installé, relu à chaque vérification. */
  glab?: () => string | undefined
  log?: (conversationId: string | undefined, line: string) => void
  /** Durée pendant laquelle un outil connecté (ou un hôte injoignable) est gardé. */
  ghCacheMs?: number
  /** Idem quand l'outil manque ou n'est pas connecté : court, l'utilisateur va y remédier (D7). */
  ghMissCacheMs?: number
  /** Hôtes déclarés à `glab` (sa configuration) ; par défaut, lus sur le disque. */
  glabHosts?: () => Promise<GlabHost[]>
  /** Hôtes connectés à `gh` (`hosts.yml`) ; par défaut, lus sur le disque. */
  ghHosts?: () => Promise<string[]>
  /** `HostName` d'un alias SSH (`ssh -G`) ; par défaut, `ssh` lancé sans jetons. */
  sshHostName?: (alias: string) => Promise<string | undefined>
}

/** Forge prête (outil connecté), ou pourquoi pas. */
export type ResolvedForge =
  | {
      ok: true
      adapter: ForgeAdapter
      path: string
      remote: string
      /** Hôte tel que l'outil le connaît, pour les messages (GitLab). */
      host?: string
      /** Projet pour `glab -R` (GitLab). */
      repo?: string
    }
  | { ok: false; reason: PrBlocker; noun?: 'mr'; host?: string }

/** Ce qu'il faut savoir du dépôt distant de la base. */
export interface RemoteInfo {
  name: string
  /** URL de `git remote get-url` (réécrite par `insteadOf`), si git l'a donnée. */
  url?: string
}

const TOOL_TTL_MS = 5 * 60_000
const MISS_TTL_MS = 15_000

export class ForgeResolver {
  private readonly run: Run
  private readonly options: ForgeResolverOptions
  private readonly tools = new Map<string, { at: number; status: ToolStatus }>()
  private readonly inflight = new Map<string, Promise<ToolStatus>>()
  private readonly aliases = new Map<string, Promise<string | undefined>>()
  /** Hôtes dits inconnus par le dernier « Actualiser » (ni `glab` ni `gh` ne les déclarent). */
  private readonly unknown = new Set<string>()

  constructor(run: Run, options: ForgeResolverOptions = {}) {
    this.run = run
    this.options = options
  }

  /** « Actualiser » : les outils sont vérifiés de nouveau, les alias relus. */
  forget(): void {
    this.tools.clear()
    this.aliases.clear()
  }

  /**
   * Forge du dépôt distant. `fresh` (« Actualiser ») : un hôte que rien ne déclare est classé
   * « forge inconnue » ; sans lui, il reste à GitHub comme avant.
   */
  async resolve(remote: RemoteInfo | undefined, fresh = false): Promise<ResolvedForge> {
    if (!remote) {
      // Sans dépôt distant, l'outil de GitHub d'abord, comme avant (`no-gh`, `not-logged`).
      const gh = await this.toolStatus(githubForge)
      if (!gh.ok) return { ok: false, reason: gh.reason === 'no-tool' ? 'no-gh' : 'not-logged' }
      return { ok: false, reason: 'no-remote' }
    }
    const parsed = remote.url ? remoteHost(remote.url) : undefined
    if (!parsed) return this.github(remote.name)
    const written = parsed.hostname
    // Alias SSH : le nom écrit dans le remote d'abord (déclaré tel quel à glab), puis celui que
    // `ssh -G` donne (`Host gitlab.corp` → `HostName 10.1.2.3`).
    const resolved =
      parsed.ssh && !knownForge(written) ? ((await this.sshHostName(written)) ?? written) : written
    const hostname = knownForge(written) ? written : resolved
    const known = knownForge(hostname)
    if (known === 'github') return this.github(remote.name)
    if (known === 'gitlab') return this.gitlab(remote, 'gitlab.com')
    const glabHosts = await this.glabHosts()
    const declared = glabHostFor(glabHosts, written) ?? glabHostFor(glabHosts, resolved)
    if (declared) return this.gitlab(remote, declared)
    if (guessedForge(hostname) === 'gitlab' && !this.options.glab?.()) {
      return { ok: false, reason: 'no-tool', noun: 'mr' }
    }
    const name = parsed.ssh ? hostname : toolHost({ ...parsed, hostname })
    if (fresh) {
      // GitHub Enterprise connu de gh seulement par son environnement (jeton d'entreprise,
      // `GH_HOST`) : GitHub comme avant ; rien n'est lancé vers l'hôte pour le savoir.
      const github =
        (await this.ghHosts()).includes(name) ||
        process.env['GH_HOST'] === name ||
        !!process.env['GH_ENTERPRISE_TOKEN'] ||
        !!process.env['GITHUB_ENTERPRISE_TOKEN']
      if (github) this.unknown.delete(name)
      else this.unknown.add(name)
    }
    if (this.unknown.has(name)) {
      // Un alias SSH non résolu n'est pas un hôte à conseiller à `glab auth login`.
      return { ok: false, reason: 'unknown-forge', ...(name.includes('.') ? { host: name } : {}) }
    }
    return this.github(remote.name)
  }

  /** GitHub, exactement comme avant : `gh auth status` sans hôte. */
  private async github(remote: string): Promise<ResolvedForge> {
    const status = await this.toolStatus(githubForge)
    if (status.ok) return { ok: true, adapter: githubForge, path: status.path, remote }
    return { ok: false, reason: status.reason === 'no-tool' ? 'no-gh' : 'not-logged' }
  }

  /** GitLab déclaré : `glab auth status --hostname <hôte de glab>`. */
  private async gitlab(remote: RemoteInfo, host: string): Promise<ResolvedForge> {
    const status = await this.toolStatus(gitlabForge, host)
    if (status.ok) {
      const repo = remote.url ? projectRef(remote.url, host) : undefined
      return {
        ok: true,
        adapter: gitlabForge,
        path: status.path,
        remote: remote.name,
        host,
        ...(repo ? { repo } : {})
      }
    }
    const reason: PrBlocker =
      status.reason === 'no-tool'
        ? 'no-tool'
        : status.reason === 'unreachable' || status.reason === 'certificate'
          ? status.reason
          : status.reason === 'not-found'
            ? 'not-found'
            : status.reason === 'unexpected'
              ? 'unknown-forge'
              : 'not-logged'
    return { ok: false, reason, noun: 'mr', host }
  }

  /** État de l'outil pour cet hôte : une vérification à la fois, gardée selon son résultat. */
  toolStatus(adapter: ForgeAdapter, host?: string): Promise<ToolStatus> {
    const key = `${adapter.tool}|${host ?? ''}`
    const known = this.tools.get(key)
    if (known) {
      const lasting =
        known.status.ok ||
        known.status.reason === 'unreachable' ||
        known.status.reason === 'certificate'
      const ttl = lasting
        ? (this.options.ghCacheMs ?? TOOL_TTL_MS)
        : (this.options.ghMissCacheMs ?? MISS_TTL_MS)
      if (Date.now() - known.at < ttl) return Promise.resolve(known.status)
    }
    const running = this.inflight.get(key)
    if (running) return running
    const check = this.check(adapter, host).then(
      (status) => {
        this.tools.set(key, { at: Date.now(), status })
        return status
      },
      (): ToolStatus => ({ ok: false, reason: 'unexpected' })
    )
    const shared = check.finally(() => this.inflight.delete(key))
    this.inflight.set(key, shared)
    return shared
  }

  private async check(adapter: ForgeAdapter, host?: string): Promise<ToolStatus> {
    const path = (adapter.kind === 'github' ? this.options.gh : this.options.glab)?.()
    if (!path) return { ok: false, reason: 'no-tool' }
    const status = await adapter.auth(this.run, path, host)
    this.options.log?.(
      undefined,
      `${adapter.tool} auth status${host ? ` --hostname ${host}` : ''} → ${status.ok ? 0 : status.reason}`
    )
    return status
  }

  private glabHosts(): Promise<GlabHost[]> {
    return (this.options.glabHosts ?? (() => readGlabHosts()))().catch(() => [])
  }

  private ghHosts(): Promise<string[]> {
    return (this.options.ghHosts ?? (() => readGhHosts()))().catch(() => [])
  }

  /** `HostName` d'un alias SSH, lu une fois par alias (jusqu'à « Actualiser »). */
  private sshHostName(alias: string): Promise<string | undefined> {
    if (!validHostname(alias) || alias.startsWith('[')) return Promise.resolve(undefined)
    let found = this.aliases.get(alias)
    if (!found) {
      found = (this.options.sshHostName ?? ((a) => this.sshConfig(a)))(alias).then(
        (name) => (name && validHostname(name) ? name.toLowerCase() : undefined),
        () => undefined
      )
      this.aliases.set(alias, found)
    }
    return found
  }

  /** `ssh -G -- <alias>` : la configuration SSH, sans connexion, environnement sans jetons. */
  private async sshConfig(alias: string): Promise<string | undefined> {
    const result = await this.run('ssh', ['-G', '--', alias], {
      timeoutMs: 5_000,
      env: tokenlessEnv(process.env)
    })
    if (result.code !== 0) return undefined
    return /^hostname\s+(\S+)\s*$/m.exec(result.stdout.toString('utf8'))?.[1]
  }
}
