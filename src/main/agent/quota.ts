/**
 * Quota des agents (fiche 091, ADR-0017) : lu en tâche de fond par l'adaptateur de leur profil
 * (`quotaSource`), dans un dossier réservé, puis nettoyé — les sessions que la lecture a créées chez
 * l'agent sont supprimées (`session/delete`), réussie ou non. Une lecture à la fois par agent ; un
 * échec garde la lecture précédente.
 *
 * Dossier réservé **unique et stable** (D6, recette 0.11) : un par agent et par machine, hors des
 * données de l'app. Bob retient chaque dossier où `bob chat --trust` a tourné
 * (`~/.bob/trustedFolders.json`, docs/acp.md) ; un dossier par profil de Bobine (temporaires
 * compris) y laissait une entrée de plus à chaque profil.
 *
 * Après un échec (agent pas connecté, interface jamais prête…), la lecture automatique du
 * lancement est suspendue quelques heures (D11) : pas une attente à chaque lancement. Mais l'agent
 * qui se montre prêt ensuite (session ouverte, essai de connexion réussi — après une connexion par
 * SSO, par exemple) fait relire un quota encore inconnu, sans tenir compte de cette pause : au plus
 * une fois par `RETRY_WHEN_READY_MS` (fiche 205).
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AgentQuota } from '@shared/usage'
import { withEnvChanges, type EnvChanges } from '../agent-config/api-keys'
import { log } from '../log'
import type { SpawnPty } from '../terminal/terminal-manager'
import type { QuotaReading, QuotaSource } from './adapters'
import { errorMessage } from './process-utils'
import type { AgentProfile } from './profiles'
import type { ConversationListeners } from '../conversations/manager'
import type { AgentCheck } from '../diagnostics'

/**
 * Au-delà, la lecture est abandonnée : `bob chat` démarre en quelques secondes (lecture complète en
 * 4,9 s le 2026-10-20, docs/acp.md). Un agent pas connecté n'arrive jamais aux chiffres.
 */
export const READ_TIMEOUT_MS = 20_000
/** Après un échec, pas de lecture automatique pendant ce temps (une relecture demandée passe). */
export const PAUSE_AFTER_FAILURE_MS = 12 * 3_600_000
/** Agent prêt et quota encore inconnu : nouvel essai, mais pas plus souvent que cela (fiche 205). */
export const RETRY_WHEN_READY_MS = 15 * 60_000

/**
 * Dossier stable des lectures de quota, propre à Bobine, sous le dossier personnel des agents
 * (`BOBINE_CONFIG_HOME` en essai) : `~/Library/Caches/Bobine/agent-status` sur macOS,
 * `$XDG_CACHE_HOME/bobine/agent-status` (sinon `~/.cache/…`) ailleurs.
 */
export function quotaStatusDir(home: string, env: NodeJS.ProcessEnv, platform = process.platform) {
  if (platform === 'darwin') return join(home, 'Library', 'Caches', 'Bobine', 'agent-status')
  const cache = env['XDG_CACHE_HOME'] || join(home, '.cache')
  return join(cache, 'bobine', 'agent-status')
}

export interface QuotaReaderOptions {
  profiles: readonly AgentProfile[]
  /** Dossier stable (voir `quotaStatusDir`) : `<agent>/` y est le dossier réservé de l'agent. */
  statusDir: string
  spawnPty: SpawnPty
  env: () => NodeJS.ProcessEnv
  isAvailable: (profile: AgentProfile) => boolean
  credentials: (profile: AgentProfile) => Promise<EnvChanges>
  /** Supprime ces sessions de l'historique de l'agent, lancé dans ce dossier. */
  deleteSessions: (profile: AgentProfile, cwd: string, sessionIds: string[]) => Promise<unknown>
  timeoutMs?: number
  pauseMs?: number
  retryWhenReadyMs?: number
  now?: () => number
}

type QuotaProfile = AgentProfile & { quotaSource: QuotaSource }

export class QuotaReader {
  private readonly quotas = new Map<string, AgentQuota>()
  private readonly running = new Map<string, Promise<void>>()
  private readonly listeners = new Set<(quotas: AgentQuota[]) => void>()
  /** Début de la dernière lecture de chaque agent, dans ce lancement. */
  private readonly lastTry = new Map<string, number>()
  /** L'app quitte : lectures en cours abandonnées, plus aucune ensuite (fiche 208). */
  private readonly stopped = new AbortController()

  private readonly options: QuotaReaderOptions

  constructor(options: QuotaReaderOptions) {
    this.options = options
  }

  /** Derniers quotas lus, un par agent. */
  list(): AgentQuota[] {
    return [...this.quotas.values()]
  }

  subscribe(listener: (quotas: AgentQuota[]) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /**
   * L'app quitte (fiche 208) : la lecture en cours s'arrête (son pseudo-terminal est fermé), rien
   * n'est plus écrit ni lancé après (ni suppression de sessions, ni pause), plus de lecture ensuite.
   */
  stop(): void {
    this.stopped.abort()
  }

  /**
   * Relit le quota des agents installés qui savent le lire (ou de celui-là seulement).
   * `automatic` (lecture du lancement) : sautée tant qu'un échec récent la suspend.
   */
  async refresh(profileId?: string, { automatic = false } = {}): Promise<void> {
    if (this.stopped.signal.aborted) return
    const profiles = this.options.profiles.filter(
      (p): p is QuotaProfile =>
        !!p.quotaSource &&
        (!profileId || p.id === profileId) &&
        this.options.isAvailable(p) &&
        !(automatic && this.paused(p))
    )
    await Promise.all(profiles.map((profile) => this.readOnce(profile)))
  }

  /**
   * L'agent vient de se montrer prêt (session ouverte, essai de connexion réussi) : son quota, s'il
   * est encore inconnu dans ce lancement, est relu malgré la pause d'un échec précédent — la
   * connexion a pu changer entre-temps (fiche 205). Au plus une lecture par `RETRY_WHEN_READY_MS`.
   */
  async agentReady(profileId: string): Promise<void> {
    const profile = this.options.profiles.find((p) => p.id === profileId)
    if (this.stopped.signal.aborted) return
    if (!profile?.quotaSource || this.quotas.has(profile.id)) return
    if (!this.options.isAvailable(profile)) return
    const last = this.lastTry.get(profile.id)
    const now = (this.options.now ?? Date.now)()
    if (last !== undefined && now - last < (this.options.retryWhenReadyMs ?? RETRY_WHEN_READY_MS)) {
      return
    }
    log.info(`Quota de ${profile.label} : agent prêt, quota encore inconnu, nouvelle lecture`)
    await this.readOnce(profile as QuotaProfile)
  }

  /** Fichier de suspension d'un agent : `{ "until": <ms> }`. */
  private pauseFile(profile: AgentProfile): string {
    return join(this.options.statusDir, `${profile.id}.pause.json`)
  }

  private paused(profile: AgentProfile): boolean {
    const now = (this.options.now ?? Date.now)()
    try {
      const raw = JSON.parse(readFileSync(this.pauseFile(profile), 'utf8')) as unknown
      const until = (raw as { until?: unknown } | null)?.until
      if (typeof until !== 'number' || !Number.isFinite(until) || until <= now) return false
      log.info(`Quota de ${profile.label} : lecture du lancement suspendue après un échec récent`)
      return true
    } catch {
      return false
    }
  }

  private setPause(profile: AgentProfile, until: number | undefined): void {
    try {
      if (until === undefined) rmSync(this.pauseFile(profile), { force: true })
      else writeFileSync(this.pauseFile(profile), JSON.stringify({ until }))
    } catch (error) {
      log.warn(`Quota de ${profile.label} : suspension non enregistrée :`, error)
    }
  }

  private readOnce(profile: QuotaProfile): Promise<void> {
    const pending = this.running.get(profile.id)
    if (pending) return pending
    const run = this.read(profile).finally(() => this.running.delete(profile.id))
    this.running.set(profile.id, run)
    return run
  }

  private async read(profile: QuotaProfile): Promise<void> {
    const { options } = this
    const now = options.now ?? Date.now
    const started = now()
    this.lastTry.set(profile.id, started)
    const cwd = join(options.statusDir, profile.id)
    let reading: QuotaReading
    try {
      mkdirSync(cwd, { recursive: true })
      reading = await profile.quotaSource.read({
        cwd,
        env: withEnvChanges(
          { ...options.env(), ...profile.env },
          await options.credentials(profile)
        ),
        spawnPty: options.spawnPty,
        timeoutMs: options.timeoutMs ?? READ_TIMEOUT_MS,
        signal: this.stopped.signal
      })
    } catch (error) {
      reading = { leftovers: [], problem: errorMessage(error) }
    }
    // L'app quitte : plus rien (sessions laissées, pause) — ni agent lancé, ni écriture.
    if (this.stopped.signal.aborted) {
      log.info(`Quota de ${profile.label} : lecture abandonnée, l'app quitte`)
      return
    }
    if (reading.leftovers.length > 0) {
      try {
        await options.deleteSessions(profile, cwd, reading.leftovers)
        log.info(
          `Quota de ${profile.label} : ${reading.leftovers.length} session(s) vide(s) supprimée(s)`
        )
      } catch (error) {
        log.warn(`Quota de ${profile.label} : sessions vides non supprimées :`, error)
      }
    }
    const ms = now() - started
    if (!reading.quota) {
      log.warn(
        `Quota de ${profile.label} non lu (${ms} ms) : ${reading.problem ?? 'raison inconnue'}`
      )
      this.setPause(profile, now() + (options.pauseMs ?? PAUSE_AFTER_FAILURE_MS))
      return
    }
    this.setPause(profile, undefined)
    const { limit, used } = reading.quota
    const currency = profile.quotaSource.currency
    log.info(`Quota de ${profile.label} : ${used} / ${limit ?? 'illimité'} ${currency} (${ms} ms)`)
    this.quotas.set(profile.id, {
      profileId: profile.id,
      profileLabel: profile.label,
      currency,
      limit,
      used,
      readAt: now()
    })
    const quotas = this.list()
    for (const listener of this.listeners) listener(quotas)
  }
}

/**
 * Conversation dont l'agent passe « prêt » (session ouverte, après une connexion par exemple) :
 * son quota, encore inconnu, est relu (fiche 205).
 */
export function quotaOnReady(
  quotas: { agentReady: (profileId: string) => unknown },
  profileOf: (conversationId: string) => AgentProfile | undefined
): ConversationListeners {
  return {
    event: ({ conversationId, event }) => {
      if (event.type !== 'status' || event.snapshot.status !== 'ready') return
      const profile = profileOf(conversationId)
      if (profile) quotas.agentReady(profile.id)
    }
  }
}

/** Diagnostic : une session d'essai ouverte prouve que l'agent est connecté (fiche 205). */
export function quotaAfterCheck(
  quotas: { agentReady: (profileId: string) => unknown },
  profileId: string,
  check: Pick<AgentCheck, 'snapshot' | 'session'>
): void {
  const opened = check.session !== undefined && check.session !== 'skipped'
  if (check.snapshot?.status === 'ready' && opened) quotas.agentReady(profileId)
}
