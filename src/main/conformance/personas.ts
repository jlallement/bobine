/**
 * Personas de la grille de conformité (fiche 139) : trois formes d'agent ACP jouées par l'agent
 * factice. Les deux premières reprennent les **vrais profils** `bob` et `opencode` de l'app (leurs
 * adaptateurs : coût lu dans la base, sous-agents relayés, diffs refaits…), seule la commande
 * change ; la troisième est un agent ACP déclaré dans les réglages, par le vrai profil
 * personnalisé (fiche 141), sans aucun champ facultatif.
 *
 * Chaque persona dit aussi quel scénario de l'agent factice joue chaque parcours : la forme que
 * prend ce parcours chez l'agent qu'elle imite (`docs/acp.md`, `docs/agents.md`).
 */
import { join, resolve } from 'node:path'
import type { CustomAgent } from '@shared/custom-agents'
import { MOCK_AGENT_ENTRY } from '../../mock-agent/testing.mts'
import { customProfile } from '../agent/custom-profiles'
import { resolveProfiles, type AgentProfile } from '../agent/profiles'

export type JourneyId =
  | 'prompt'
  | 'permission'
  | 'plan'
  | 'tool'
  | 'cancel'
  | 'crash'
  | 'restart'
  | 'subagent'
  | 'compaction'
  | 'elicitation'
  | 'queue'
  | 'switch'
  | 'cost-cap'
  | 'auth-at-turn'

export type PersonaId = 'facon-bob' | 'facon-opencode' | 'acp-minimal'

/** Ce qu'il faut pour bâtir le profil d'une persona dans un environnement d'essai. */
export interface PersonaContext {
  /** Dossier où l'agent factice mémorise ses sessions (partagé par les personas). */
  store: string
  /** Dossier personnel d'essai (`BOBINE_CONFIG_HOME`) : la base de Bob y est, jamais la vraie. */
  configHome: string
  /** Délai de base de l'agent factice (ms). */
  delayMs: number
  /** Options de plus pour l'agent factice (ex. `--demarrage-lent`). */
  extraArgs?: string[]
}

export interface Persona {
  id: PersonaId
  label: string
  /** Ce qu'elle imite, en une ligne (titre des essais). */
  shape: string
  profile: (ctx: PersonaContext) => AgentProfile
  /**
   * Agent déclaré dans les réglages (fiche 141) : l'environnement d'essai l'écrit dans
   * `settings.json`, et c'est l'app qui en bâtit le profil, comme pour l'utilisateur.
   */
  declared?: (ctx: PersonaContext) => CustomAgent
  /** Scénario de l'agent factice joué par chaque parcours. */
  scenarios: Record<JourneyId, string>
  /** Message qui fait compacter la conversation chez elle. */
  compact: string
  /**
   * Temps à laisser après le dernier tour avant de comparer les fils : le coût de Bob est relu
   * dans sa base 1,5 s après la réponse (fiche 109).
   */
  settleMs: number
  /**
   * L'agent sait reprendre sa session après un redémarrage (`loadSession` ou `resume`) ; sinon,
   * la conversation continue dans une session neuve qui reçoit l'échange d'avant (ADR-0030).
   */
  resumes: boolean
  /**
   * Le refus de connexion de son agent au message (`connexion-expiree-bob-tour`, l'erreur de Bob 2.0.9)
   * donne la carte « Connexion expirée » ; sinon, une erreur de tour ordinaire (fiche 200).
   */
  authAtTurn?: boolean
  /** Persona vers qui le parcours « changement d'agent » continue la conversation. */
  next: PersonaId
  /**
   * Unité du coût qu'elle donne (fiche 157) : celle du plafond de coût ; absente, aucune
   * consommation, donc aucun plafond.
   */
  costUnit?: string
}

const APP_PATH = resolve(__dirname, '../../..')

/** Vrai profil de l'app, lancé sur l'agent factice ; sans quota (il lancerait `bob chat`). */
function realProfile(id: string, ctx: PersonaContext, args: string[]): AgentProfile {
  const real = resolveProfiles({
    appPath: APP_PATH,
    execPath: process.execPath,
    isPackaged: false,
    env: { BOBINE_CONFIG_HOME: ctx.configHome }
  }).find((p) => p.id === id)
  if (!real) throw new Error(`Profil introuvable : ${id}`)
  // Versions du vrai agent : l'agent factice n'en a pas (fiche 198), sans quoi chaque parcours
  // commencerait par un avis de version.
  const {
    quotaSource: _quota,
    installHint: _hint,
    testedVersions: _tested,
    minVersion: _floor,
    ...profile
  } = real
  return { ...profile, command: process.execPath, args: mockArgs(ctx, args), env: {} }
}

function mockArgs(ctx: PersonaContext, args: string[]): string[] {
  return [
    MOCK_AGENT_ENTRY,
    '--scenario',
    'streaming-texte',
    '--delay',
    String(ctx.delayMs),
    '--store',
    ctx.store,
    ...args,
    ...(ctx.extraArgs ?? [])
  ]
}

/** Base de Bob de l'environnement d'essai (celle que lit `bobDbCosts`). */
export const bobDbOf = (ctx: PersonaContext) => join(ctx.configHome, '.bob', 'db', 'bob.db')

/** Ce que l'utilisateur déclarerait dans Réglages › Agents : nom, commande, arguments. */
function minimalAgent(ctx: PersonaContext): CustomAgent {
  return {
    id: 'custom-acp-minimal',
    label: 'ACP minimal',
    command: process.execPath,
    args: mockArgs(ctx, [
      '--sans-historique',
      '--sans-images',
      '--sans-plan',
      '--sans-usage',
      '--sans-options'
    ]),
    env: {}
  }
}

export const PERSONAS: Record<PersonaId, Persona> = {
  'facon-bob': {
    id: 'facon-bob',
    label: 'Façon Bob',
    shape: 'rejeu tardif, coût par la base, spawn_subagent, titres bruts, modes sans options',
    profile: (ctx) =>
      realProfile('bob', ctx, [
        '--sans-options',
        '--rejeu-tardif-ms',
        '50',
        '--titres-invite',
        '--cout-bob',
        // Bob annonce toujours sa méthode SSO (connexion expirée au message, fiche 200).
        '--sso',
        '--bob-db',
        bobDbOf(ctx)
      ]),
    scenarios: {
      prompt: 'streaming-texte',
      permission: 'titres-bob',
      plan: 'liste-taches',
      tool: 'modifications',
      cancel: 'attend-stop',
      crash: 'plantage',
      restart: 'streaming-texte',
      subagent: 'sous-agent-bob',
      compaction: 'compaction-texte',
      elicitation: 'bob-elicitation',
      queue: 'lent',
      switch: 'contexte-recu',
      'cost-cap': 'streaming-texte',
      'auth-at-turn': 'connexion-expiree-bob-tour'
    },
    compact: '/compress',
    settleMs: 1700,
    resumes: true,
    next: 'facon-opencode',
    costUnit: 'bobcoins',
    authAtTurn: true
  },
  'facon-opencode': {
    id: 'facon-opencode',
    label: 'Façon OpenCode',
    shape: 'patch en pending {}, execute, sous-agents en arrière-plan, usage_update',
    profile: (ctx) => realProfile('opencode', ctx, ['--arriere-plan-ms', '300']),
    scenarios: {
      prompt: 'streaming-texte',
      permission: 'permission',
      plan: 'plan',
      tool: 'outil-en-preparation',
      cancel: 'outil-en-preparation-interrompu',
      crash: 'plantage',
      restart: 'patch-opencode',
      subagent: 'sous-agent-arriere-plan',
      compaction: 'compaction',
      elicitation: 'question-opencode2',
      queue: 'lent',
      switch: 'contexte-recu',
      'cost-cap': 'streaming-texte',
      'auth-at-turn': 'connexion-expiree-bob-tour'
    },
    compact: '/compact',
    settleMs: 0,
    resumes: true,
    next: 'acp-minimal',
    costUnit: 'USD'
  },
  'acp-minimal': {
    id: 'acp-minimal',
    label: 'ACP minimal',
    shape: 'ni loadSession, ni images, ni plan, ni usage, ni options',
    declared: minimalAgent,
    profile: (ctx) => customProfile(minimalAgent(ctx)),
    scenarios: {
      prompt: 'streaming-texte',
      permission: 'permission',
      plan: 'plan',
      tool: 'appel-outil',
      cancel: 'attend-stop',
      crash: 'plantage',
      restart: 'streaming-texte',
      subagent: 'sous-agent',
      compaction: 'compaction',
      elicitation: 'bob-elicitation',
      queue: 'lent',
      switch: 'contexte-recu',
      'cost-cap': 'streaming-texte',
      'auth-at-turn': 'connexion-expiree-bob-tour'
    },
    compact: '/scenario compaction',
    settleMs: 0,
    resumes: false,
    next: 'facon-bob'
  }
}
