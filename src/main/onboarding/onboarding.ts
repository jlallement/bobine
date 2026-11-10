/**
 * Accueil du premier lancement (fiche 188), côté main : faut-il le montrer, quels agents proposer,
 * l'essai « connecté ? » / « répond ? » (un seul à la fois : en lancer un annule le précédent), et
 * la marque de fin. N'importe pas `electron` : tout est injecté.
 *
 * Sécurité (relecture du tech lead, 2026-11-07) : l'agent est lancé dans le dossier réservé de
 * l'app et la session d'essai ouverte dans un dossier jetable vide, sous le dossier de données de
 * l'app — jamais dans un projet de l'utilisateur. Les sessions d'essai sont notées avant le
 * message, supprimées après, retentées au lancement suivant ; l'agent est arrêté sur-le-champ si
 * l'app se ferme ou si la fenêtre disparaît.
 */
import { existsSync, mkdirSync } from 'node:fs'
import { removeQuietly } from './scratch'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { ApiKeyInfo, ProfileSummary } from '@shared/agent'
import type {
  AgentReadiness,
  CheckRequest,
  FolderHints,
  OnboardingMark,
  OnboardingState
} from '@shared/onboarding'
import type { EnvChanges } from '../agent-config/api-keys'
import { log } from '../log'
import { findExecutable, type AgentProfile } from '../agent/profiles'
import { deleteEachSession, type DeleteOptions, type DeleteOutcome } from '../agent/session-list'
import type { Settings } from '../settings'
import { checkAgent, type ReadinessOptions, type TrialTurn } from './agent-readiness'
import type { TurnRow } from '../usage/usage-db'
import {
  closingMark,
  hasConversations,
  onboardingDecision,
  type OnboardingDecision
} from './onboarding-state'
import { createTrialFolder, displayPath, folderHints } from './trial-folder'
import { TrialSessions } from './trial-sessions'

export interface OnboardingDeps {
  /** Décision prise au démarrage, avant toute écriture des réglages. */
  decision: OnboardingDecision
  settings: {
    onboarding: () => OnboardingMark | undefined
    setOnboarding: (mark: OnboardingMark) => void
    credentials: (profile: AgentProfile) => Promise<EnvChanges>
    keyInfo: (profile: AgentProfile) => ApiKeyInfo[]
  }
  /** Profils lancés par l'app (codés et déclarés), et leur résumé (disponibilité, raison). */
  profiles: () => AgentProfile[]
  summaries: () => ProfileSummary[]
  /** Dossier réservé de l'app : l'agent y est lancé, la commande de connexion y tourne. */
  cwd: string
  /** Dossier de l'app où créer les dossiers jetables des sessions d'essai. */
  scratchParent: string
  /** Sessions d'essai à supprimer, masquées de « Reprendre une session ». */
  trialSessions: TrialSessions
  /** Dossier d'une conversation (pour ses suggestions) ; lève si aucun n'est choisi. */
  workspaceOf: (conversationId: string) => string
  /** Lance une commande dans le terminal de l'app de cette conversation ; rend l'onglet. */
  runInTerminal: (conversationId: string, cwd: string, command: string) => string
  /** Où créer le dossier d'essai (`~/Bobine`), et sous quoi il doit rester (le dossier personnel). */
  trialParent: string
  trialRoot: string
  pathEnv: () => string | undefined
  version: string
  now?: () => Date
  /** Essai et suppression de sessions (remplaçables par les tests). */
  check?: (options: ReadinessOptions) => Promise<AgentReadiness>
  deleteSessions?: (options: DeleteOptions) => Promise<Record<string, DeleteOutcome>>
  /**
   * Tour d'essai à garder dans le journal de consommation (« Mon activité »), comme un tour de
   * conversation : son coût n'est jamais perdu, même quand la session est ensuite supprimée.
   */
  recordUsage?: (row: TurnRow) => void
  /** Essai réussi : l'agent est prêt (connexion faite), son quota peut être relu (fiche 205). */
  onReady?: (profileId: string) => void
}

export class Onboarding {
  private running: AbortController | undefined
  /** Arrêt immédiat de l'agent de l'essai en cours. */
  private stopAgent: (() => void) | undefined
  /** Méthodes de connexion annoncées par chaque agent, d'après son dernier refus. */
  private readonly methods = new Map<string, Set<string>>()
  private readonly deps: OnboardingDeps

  constructor(deps: OnboardingDeps) {
    this.deps = deps
    if (deps.decision.write) deps.settings.setOnboarding(deps.decision.write)
  }

  state(): OnboardingState {
    const mark = this.deps.settings.onboarding()
    const due = this.deps.decision.due && (!mark || mark.outcome === 'pending')
    return {
      due,
      agents: due ? this.deps.summaries() : [],
      trialFolder: displayPath(this.deps.trialParent, homedir())
    }
  }

  /** Essai d'un agent ; annule celui en cours. Toujours hors des projets de l'utilisateur. */
  async check(request: CheckRequest): Promise<AgentReadiness> {
    const profile = this.profile(request.profileId)
    if (request.authenticate && !this.methods.get(profile.id)?.has(request.authenticate)) {
      throw new Error(`Unknown sign-in method: ${request.authenticate}`)
    }
    this.cancel()
    const controller = new AbortController()
    this.running = controller
    const trial = this.deps.trialSessions
    try {
      mkdirSync(this.deps.scratchParent, { recursive: true })
      const result = await (this.deps.check ?? checkAgent)({
        profile,
        level: request.level,
        cwd: this.deps.cwd,
        scratchParent: this.deps.scratchParent,
        onSession: (sessionId) => trial.add({ profileId: profile.id, sessionId }),
        onSessionRemoved: (sessionId) => trial.remove({ profileId: profile.id, sessionId }),
        onTrialTurn: (turn) => this.record(request.conversationId, profile, turn),
        onStop: (stop) => {
          if (this.running === controller) this.stopAgent = stop
        },
        credentials: await this.deps.settings.credentials(profile),
        ...optional('apiKey', this.deps.settings.keyInfo(profile)[0]),
        ...optional('authenticate', request.authenticate),
        clientVersion: this.deps.version,
        pathEnv: this.deps.pathEnv(),
        signal: controller.signal
      })
      if (result.state === 'auth') {
        this.methods.set(profile.id, new Set(result.blocker.methods.map((m) => m.id)))
      }
      log.info(`Accueil : essai ${request.level} de ${profile.id} → ${result.state}`)
      if (result.state === 'ready') this.deps.onReady?.(profile.id)
      return result
    } finally {
      if (this.running === controller) {
        this.running = undefined
        this.stopAgent = undefined
      }
    }
  }

  /** Étape de connexion du profil (jamais une commande venue du renderer), dans le terminal. */
  runStep(conversationId: string, profileId: string, stepId: string): string {
    const step = this.profile(profileId).terminalSteps?.[stepId]
    if (!step) throw new Error(`Unknown step: ${stepId}`)
    return this.deps.runInTerminal(conversationId, this.deps.cwd, step.command)
  }

  /** Dossier d'essai vide, toujours neuf, sous le dossier personnel. */
  trialFolder(name: string): string {
    return createTrialFolder(this.deps.trialParent, name, this.deps.trialRoot)
  }

  /** Ce que la première conversation propose d'après son dossier. */
  hints(conversationId: string): FolderHints {
    let folder = ''
    try {
      folder = this.deps.workspaceOf(conversationId)
    } catch {
      return {} // Aucun dossier choisi.
    }
    return folder ? folderHints(folder) : {}
  }

  /** Sessions d'essai de cet agent pas encore supprimées : à masquer. */
  hiddenSessions(profileId: string): string[] {
    return this.deps.trialSessions.ids(profileId)
  }

  /** Annule l'essai en cours, s'il y en a un : `session/cancel`, suppression, arrêt. */
  cancel(): void {
    this.running?.abort()
    this.running = undefined
  }

  /**
   * Fermeture de l'app ou de la fenêtre : l'essai est annulé et son agent arrêté tout de suite
   * (pas le temps de supprimer la session : elle reste notée, retentée au lancement suivant).
   */
  stop(): void {
    const stop = this.stopAgent
    this.cancel()
    this.stopAgent = undefined
    stop?.()
  }

  /** Accueil fini ou passé : la marque est posée, jamais défaite. */
  finish(outcome: 'finished' | 'skipped'): void {
    this.cancel()
    const now = this.deps.now?.() ?? new Date()
    const current = this.deps.settings.onboarding()
    const next = closingMark(current, outcome, now, this.deps.version)
    if (next !== current) this.deps.settings.setOnboarding(next)
  }

  /**
   * Sessions d'essai restées notées (app quittée pendant l'essai…) : suppression retentée, une à
   * une ; introuvables ou agent qui ne sait pas supprimer : oubliées ; ratées : retentées au
   * lancement suivant, `MAX_ATTEMPTS` fois au plus. Jamais pendant un essai.
   */
  async retryPendingDeletes(): Promise<void> {
    if (this.running) return
    const trial = this.deps.trialSessions
    for (const profileId of trial.profiles()) {
      const profile = this.deps.profiles().find((p) => p.id === profileId)
      if (!profile || !findExecutable(profile.command, this.deps.pathEnv())) continue
      const sessionIds = trial.ids(profileId)
      let outcomes: Record<string, DeleteOutcome> = {}
      try {
        outcomes = await (this.deps.deleteSessions ?? deleteEachSession)({
          profile,
          cwd: this.deps.cwd,
          sessionIds,
          credentials: await this.deps.settings.credentials(profile),
          clientVersion: this.deps.version
        })
      } catch (error) {
        log.warn(`Accueil : sessions d’essai de ${profileId} pas supprimées`, error)
      }
      for (const sessionId of sessionIds) {
        const outcome = outcomes[sessionId] ?? 'failed'
        if (outcome === 'failed') trial.failed({ profileId, sessionId })
        else trial.remove({ profileId, sessionId })
      }
    }
  }

  /** Le tour d'essai, une ligne du journal rattachée à la conversation de l'accueil. */
  private record(conversationId: string, profile: AgentProfile, turn: TrialTurn): void {
    try {
      this.deps.recordUsage?.({
        id: `${conversationId}:${turn.startedAt}`,
        conversationId,
        startedAt: turn.startedAt,
        endedAt: turn.endedAt,
        profileId: profile.id,
        profileLabel: profile.label,
        ...(turn.model ? { model: turn.model } : {}),
        stopReason: turn.stopReason,
        tokens: turn.tokens,
        ...(turn.cost ? { cost: turn.cost } : {}),
        tools: {},
        subagents: 0
      })
    } catch (error) {
      log.warn('Accueil : tour d’essai pas écrit au journal de consommation', error)
    }
  }

  private profile(profileId: string): AgentProfile {
    const profile = this.deps.profiles().find((p) => p.id === profileId)
    if (!profile) throw new Error(`Unknown agent profile: ${profileId}`)
    return profile
  }
}

const optional = <K extends string, V>(key: K, value: V | undefined) =>
  (value === undefined ? {} : { [key]: value }) as Partial<Record<K, V>>

/** Ce qui se relève avant toute écriture des réglages : seul `index.ts` sait quand c'est. */
export interface FirstLaunchFacts {
  settingsExisted: boolean
  hasConversations: boolean
  /** Profil d'une version plus récente, en lecture seule (fiche 196) : jamais d'accueil. */
  readOnly?: boolean
}

export function firstLaunchFacts(userData: string): FirstLaunchFacts {
  return {
    settingsExisted: existsSync(join(userData, 'settings.json')),
    hasConversations: hasConversations(join(userData, 'conversations'))
  }
}

/** Délai avant de retenter la suppression des sessions d'essai restées (après le démarrage). */
const RETRY_DELAY_MS = 8000

type Wiring = Omit<
  OnboardingDeps,
  'decision' | 'pathEnv' | 'scratchParent' | 'trialSessions' | 'trialParent' | 'trialRoot'
> & { userData: string } & Partial<Pick<OnboardingDeps, 'pathEnv' | 'trialParent' | 'trialRoot'>>

/**
 * L'accueil, décidé d'après le relevé du démarrage et les réglages lus alors. Dossier d'essai :
 * `~/Bobine` ; `BOBINE_TRIAL_DIR` pour les essais automatiques (jamais le vrai dossier personnel).
 */
export function createOnboarding(
  facts: FirstLaunchFacts,
  initial: Pick<Settings, 'onboarding' | 'recentWorkspaces' | 'profileId'>,
  testRun: boolean,
  wiring: Wiring,
  env: NodeJS.ProcessEnv = process.env
): Onboarding {
  const decision = onboardingDecision(
    {
      mark: initial.onboarding,
      ...facts,
      recentWorkspaces: initial.recentWorkspaces.length,
      profileChosen: initial.profileId !== undefined,
      testRun,
      env
    },
    wiring.now?.() ?? new Date(),
    wiring.version
  )
  const { userData, ...deps } = wiring
  const imposed = env['BOBINE_TRIAL_DIR']
  const onboarding = new Onboarding({
    pathEnv: () => env['PATH'],
    trialParent: imposed || join(homedir(), 'Bobine'),
    trialRoot: imposed || homedir(),
    ...deps,
    scratchParent: join(userData, 'onboarding-trials'),
    trialSessions: new TrialSessions(join(userData, 'onboarding-sessions.json')),
    decision
  })
  // Restes d'essais d'un lancement précédent (app arrêtée en plein essai) : jamais bloquant.
  removeQuietly(join(userData, 'onboarding-trials'))
  setTimeout(() => void onboarding.retryPendingDeletes(), RETRY_DELAY_MS).unref()
  return onboarding
}
