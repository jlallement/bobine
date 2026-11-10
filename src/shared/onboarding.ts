/**
 * Premier lancement (fiche 188) : ce que le main dit de l'état d'un agent, et la marque « accueil
 * fini ». Formes communes au main et (plus tard) à l'interface ; rien de propre à un agent.
 */
import type { AgentBlocker, ProfileSummary } from './agent'

/** Ce que l'interface demande au démarrage : montrer l'accueil, et avec quels agents. */
export interface OnboardingState {
  due: boolean
  /** Agents proposés (vide si l'accueil n'est pas à montrer). */
  agents: ProfileSummary[]
  /** Où le dossier d'essai serait créé, tel qu'à montrer (`~/Bobine`). */
  trialFolder: string
}

/**
 * Message d'essai : il va à l'agent, pas à l'interface, donc en anglais (ADR-0014) ; montré tel
 * quel avant l'envoi. Court, et sans outil, pour coûter le moins possible.
 */
export const PROBE_PROMPT =
  'Bobine is checking that you can reply. Answer with the single word OK. Do not use any tool.'

/** Durée maximale de la réponse à l'essai (s), montrée pendant l'attente. */
export const REPLY_TIMEOUT_SECONDS = 90

/** Jusqu'où va l'essai : `connect` n'appelle jamais le modèle, `reply` envoie un message court. */
export type ReadinessLevel = 'connect' | 'reply'

/** Essai demandé par l'interface (fiche 188). */
export interface CheckRequest {
  /** Conversation de l'accueil (son dossier, son terminal). */
  conversationId: string
  profileId: string
  level: ReadinessLevel
  /** Méthode de connexion à lancer d'abord (SSO : l'agent ouvre le navigateur). */
  authenticate?: string
}

/** Ce que la première conversation sait de son dossier, pour ses suggestions. */
export interface FolderHints {
  /** Commande des tests, d'après `package.json` et le fichier de verrouillage. */
  testCommand?: string
}

/** Coût annoncé par l'agent (`usage_update`), dans sa devise. */
export interface ReadinessCost {
  amount: number
  currency: string
}

/** État d'un agent au premier lancement. */
export type AgentReadiness =
  /** Connecté (`connect`), ou a répondu (`reply` : `reply`, coût et jetons s'il les donne). */
  | {
      state: 'ready'
      level: ReadinessLevel
      /** Durée de l'essai (ms), lancement compris. */
      ms: number
      /** Début de la réponse (`reply`), tronqué. */
      reply?: string
      cost?: ReadinessCost
      tokens?: { input: number; output: number }
      /** Modèle de la session d'essai, s'il est annoncé (réglage de catégorie `model`). */
      model?: string
      /** L'agent a demandé un outil pendant l'essai : refusé, tour annulé. */
      toolRefused?: true
      /** Nom et version annoncés par l'agent à `initialize`. */
      agentInfo?: { name: string; version?: string }
    }
  /** Commande introuvable ou non exécutable : `reason` dit quoi installer (profil). */
  | { state: 'missing'; reason: string }
  /** Connexion à faire ou à refaire (carte de la fiche 022 ; `atTurn` : expirée, D10). */
  | { state: 'auth'; blocker: Extract<AgentBlocker, { kind: 'auth' }> }
  | { state: 'license'; blocker: Extract<AgentBlocker, { kind: 'license' }> }
  | { state: 'trust'; blocker: Extract<AgentBlocker, { kind: 'trust' }> }
  /** Panne réseau ou limite de débit reconnue (fiche 142). */
  | { state: 'network'; cause: 'network' | 'rate-limit'; message: string }
  /** Une étape n'a pas répondu à temps. */
  | { state: 'timeout'; message: string }
  /** Le processus s'est arrêté seul : code ou signal, fin de sa sortie d'erreur. */
  | { state: 'crashed'; message: string; stderr?: string }
  /** Autre erreur de l'agent, telle quelle. */
  | { state: 'failed'; message: string }
  | { state: 'cancelled' }

/**
 * Marque de l'accueil dans `settings.json` : `pending` posée au tout premier lancement (l'accueil
 * reprend si l'app est quittée en cours de route), `finished` ou `skipped` ensuite — l'accueil ne
 * revient plus.
 */
export interface OnboardingMark {
  outcome: 'pending' | 'finished' | 'skipped'
  /** Date ISO. */
  at: string
  /** Version de l'app qui l'a posée. */
  version: string
}

/** Lit une marque enregistrée ; `undefined` si elle est absente ou mal formée. */
export function parseOnboardingMark(raw: unknown): OnboardingMark | undefined {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined
  const r = raw as Record<string, unknown>
  const outcome = r['outcome']
  if (outcome !== 'pending' && outcome !== 'finished' && outcome !== 'skipped') return undefined
  return {
    outcome,
    at: typeof r['at'] === 'string' ? r['at'] : '',
    version: typeof r['version'] === 'string' ? r['version'] : ''
  }
}
