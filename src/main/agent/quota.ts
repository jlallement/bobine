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
 * Quand lire (fiche 242, ADR-0054) : seulement pour l'agent qui sert. Celui qui se montre prêt
 * (session ouverte dans une conversation, essai de connexion réussi — après une connexion par SSO,
 * par exemple) fait lire son quota encore inconnu, au plus une fois par `RETRY_WHEN_READY_MS`
 * (fiche 205) ; « Actualiser » le relit. Jamais au lancement pour un agent seulement installé : un
 * agent qu'on n'utilise pas n'est pas lancé, et un agent pas connecté ne se montre jamais prêt (ce
 * qui rend sans objet la pause de 12 h après un échec, D11).
 *
 * Dernier quota lu gardé (fiche 282) : la lecture prend quelques secondes après que l'agent est
 * prêt (`bob chat`, 4 à 5 s, jusqu'à 18 s relevées), et rien ne s'affichait avant. Le dernier lu
 * dans le mois en cours est donc gardé dans `userData` et montré dès le lancement, avec son heure
 * de lecture ; il ne remplace jamais la lecture de ce lancement, qui part toujours quand l'agent est
 * prêt. Rien de plus n'est lancé ni lu chez l'agent.
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join, posix, win32 } from 'node:path'
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
/** Agent prêt et quota encore inconnu : nouvel essai, mais pas plus souvent que cela (fiche 205). */
export const RETRY_WHEN_READY_MS = 15 * 60_000

/**
 * Dossier stable des lectures de quota, propre à Bobine, sous le dossier personnel des agents
 * (`BOBINE_CONFIG_HOME` en essai) : `~/Library/Caches/Bobine/agent-status` sur macOS,
 * `~\AppData\Local\Bobine\agent-status` sous Windows (fiche 229 : le cache local, jamais un
 * `.cache` dans le dossier personnel ; tiré du dossier personnel donné, pour qu'un essai reste dans
 * le sien), `$XDG_CACHE_HOME/bobine/agent-status` (sinon `~/.cache/…`) ailleurs. Chemins à la
 * façon du système `platform`.
 */
export function quotaStatusDir(home: string, env: NodeJS.ProcessEnv, platform = process.platform) {
  const { join } = platform === 'win32' ? win32 : posix
  if (platform === 'darwin') return join(home, 'Library', 'Caches', 'Bobine', 'agent-status')
  if (platform === 'win32') return join(home, 'AppData', 'Local', 'Bobine', 'agent-status')
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
  retryWhenReadyMs?: number
  now?: () => number
  /** Derniers quotas lus, gardés d'un lancement à l'autre (fiche 282) ; rien sans. */
  memory?: QuotaMemory
}

/** Où garder les derniers quotas lus (fiche 282). */
export interface QuotaMemory {
  load(): unknown
  save(quotas: AgentQuota[]): void
}

/**
 * Fichier des derniers quotas lus (`userData/agent-quotas.json`). Profil en lecture seule
 * (fiche 196) : lu, jamais écrit. Illisible ou absent : rien, sans erreur.
 */
export function quotaMemoryFile(file: string, readOnly: () => boolean = () => false): QuotaMemory {
  return {
    load: () => {
      try {
        return JSON.parse(readFileSync(file, 'utf8')) as unknown
      } catch {
        return undefined
      }
    },
    save: (quotas) => {
      if (readOnly()) return
      try {
        const temp = `${file}.tmp`
        writeFileSync(temp, `${JSON.stringify(quotas, null, 2)}\n`, 'utf8')
        renameSync(temp, file)
      } catch (error) {
        log.warn('Derniers quotas lus non enregistrés :', errorMessage(error))
      }
    }
  }
}

/**
 * Quotas gardés encore valables : bien formés, d'un agent qui sait lire le sien et qui est là, lus
 * dans le mois en cours (heure locale) — le budget de Bob est mensuel, un relevé du mois d'avant ne
 * dit plus rien.
 */
export function rememberedQuotas(
  saved: unknown,
  profiles: readonly AgentProfile[],
  isAvailable: (profile: AgentProfile) => boolean,
  now: number
): AgentQuota[] {
  if (!Array.isArray(saved)) return []
  const today = new Date(now)
  return saved.flatMap((item: unknown): AgentQuota[] => {
    if (!item || typeof item !== 'object') return []
    const { profileId, limit, used, readAt } = item as Record<string, unknown>
    const profile = profiles.find((p) => p.id === profileId)
    if (!profile?.quotaSource || !isAvailable(profile)) return []
    if (typeof used !== 'number' || !Number.isFinite(used) || used < 0) return []
    if (limit !== null && (typeof limit !== 'number' || !Number.isFinite(limit) || limit < 0)) {
      return []
    }
    if (typeof readAt !== 'number' || !Number.isFinite(readAt) || readAt > now) return []
    const read = new Date(readAt)
    if (read.getFullYear() !== today.getFullYear() || read.getMonth() !== today.getMonth()) {
      return []
    }
    return [
      {
        profileId: profile.id,
        profileLabel: profile.label,
        currency: profile.quotaSource.currency,
        limit,
        used,
        readAt
      }
    ]
  })
}

type QuotaProfile = AgentProfile & { quotaSource: QuotaSource }

export class QuotaReader {
  private readonly quotas = new Map<string, AgentQuota>()
  private readonly running = new Map<string, Promise<void>>()
  private readonly listeners = new Set<(quotas: AgentQuota[]) => void>()
  /** Début de la dernière lecture de chaque agent, dans ce lancement. */
  private readonly lastTry = new Map<string, number>()
  /** Agents dont le quota a été lu dans ce lancement (pas seulement retrouvé, fiche 282). */
  private readonly readNow = new Set<string>()
  /** L'app quitte : lectures en cours abandonnées, plus aucune ensuite (fiche 208). */
  private readonly stopped = new AbortController()

  private readonly options: QuotaReaderOptions

  constructor(options: QuotaReaderOptions) {
    this.options = options
    const saved = options.memory?.load()
    const now = (options.now ?? Date.now)()
    for (const quota of rememberedQuotas(saved, options.profiles, options.isAvailable, now)) {
      this.quotas.set(quota.profileId, quota)
    }
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
   * n'est plus écrit ni lancé après (ni suppression de sessions), plus de lecture ensuite.
   */
  stop(): void {
    this.stopped.abort()
  }

  /** Relit, sur demande, le quota des agents installés qui savent le lire (ou de celui-là). */
  async refresh(profileId?: string): Promise<void> {
    if (this.stopped.signal.aborted) return
    const profiles = this.options.profiles.filter(
      (p): p is QuotaProfile =>
        !!p.quotaSource && (!profileId || p.id === profileId) && this.options.isAvailable(p)
    )
    await Promise.all(profiles.map((profile) => this.readOnce(profile)))
  }

  /**
   * L'agent vient de se montrer prêt (session ouverte, essai de connexion réussi) : son quota, s'il
   * n'a pas encore été lu dans ce lancement (un quota gardé du lancement d'avant ne compte pas,
   * fiche 282), est lu (fiche 205) — seule lecture qui ne soit pas
   * demandée (fiche 242). Au plus une lecture par `RETRY_WHEN_READY_MS`.
   */
  async agentReady(profileId: string): Promise<void> {
    const profile = this.options.profiles.find((p) => p.id === profileId)
    if (this.stopped.signal.aborted) return
    if (!profile?.quotaSource || this.readNow.has(profile.id)) return
    if (!this.options.isAvailable(profile)) return
    const last = this.lastTry.get(profile.id)
    const now = (this.options.now ?? Date.now)()
    if (last !== undefined && now - last < (this.options.retryWhenReadyMs ?? RETRY_WHEN_READY_MS)) {
      return
    }
    log.info(`Quota de ${profile.label} : agent prêt, quota encore inconnu, nouvelle lecture`)
    await this.readOnce(profile as QuotaProfile)
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
    // L'app quitte : plus rien (sessions laissées) — ni agent lancé, ni écriture.
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
      return
    }
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
    this.readNow.add(profile.id)
    const quotas = this.list()
    options.memory?.save(quotas)
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
