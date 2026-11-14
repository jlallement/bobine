/**
 * Profils d'agent : comment lancer chaque agent ACP. Les différences entre agents restent ici
 * (voir ADR-0002). Cible : Bob. OpenCode (modèles gratuits) et l'agent factice servent aux essais ;
 * Claude Code et Codex ont leur propre application et ne sont plus proposés (2026-10-11).
 */
import { accessSync, constants, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, isAbsolute, join } from 'node:path'
import type { AlwaysScope, ControlValue, ProfileSummary } from '@shared/agent'
import type { CustomAgent } from '@shared/custom-agents'
import type { ApiKeySpec } from '../agent-config/api-keys'
import { BOB_MCP } from '../agent-config/bob-mcp'
import { BOB_RULES } from '../agent-config/bob-rules'
import { BOB_EXCLUSIONS } from '../agent-config/bob-exclusions'
import { BOB_APPROVAL_RULES } from '../agent-config/bob-approval-rules'
import type { ApprovalRulesSource } from '../agent-config/approval-rules'
import { OPENCODE_MCP } from '../agent-config/opencode-mcp'
import { OPENCODE_PROVIDERS } from '../agent-config/opencode-providers'
import { OPENCODE_RULES } from '../agent-config/opencode-rules'
import type {
  CostSource,
  DiffSource,
  ExclusionSource,
  McpConfigSource,
  ProvidersSource,
  QuotaSource,
  RulesSource,
  SubagentFormat,
  SubagentStream,
  ToolStatusSource
} from './adapters'
import {
  AUTH_REQUIRED_MESSAGE as BOB_AUTH_MESSAGE,
  EXPIRED_LOGIN_MESSAGE,
  INTERNAL_ERROR,
  LICENSE_REQUIRED,
  UNTRUSTED_WORKSPACE
} from './bob-contract'
import { bobDbCosts, bobDbIn } from './bob-costs'
import { bobStatusQuota } from './bob-status'
import { BOB_SUBAGENT_FORMAT } from './bob-subagents'
import {
  AUTH_REQUIRED_MESSAGE,
  EMPTY_SESSION_TITLE,
  LOGIN_METHOD,
  OPENCODE_SUBAGENT_STREAM,
  OPENCODE_TOOL_STATUS
} from './opencode-contract'
import { OPENCODE_DIFF_SOURCE } from './opencode-diffs'
import { OPENCODE_SUBAGENT_FORMAT } from './opencode-subagents'
import { describeCapabilities, type AgentAnnouncement } from './capabilities'
import { t } from 'i18next'
import type { RoleExportAdapter } from '../roles/export/format'
import { BOB_CUSTOM_MODES } from '../roles/export/bob-custom-modes'
import { OPENCODE_AGENTS } from '../roles/export/opencode-agents'

/** « Toujours » de Bob (relevé sur 2.0.9, fiche 213) : la conversation ; commande et parties, groupe des modifications. */
const BOB_ALWAYS_SCOPE: AlwaysScope = {
  lasts: 'conversation',
  covers: { execute: 'parts', edit: 'all-edits' }
}

export interface AgentProfile {
  id: string
  label: string
  command: string
  args: string[]
  env: Record<string, string>
  /** Conseil affiché quand la commande est introuvable. */
  installHint?: string
  /**
   * Réglages de session appliqués à l'ouverture tant que l'utilisateur n'a rien choisi
   * (clé = identifiant du contrôle, ex. `mode`). Jamais de valeur supposée pour un agent inconnu.
   */
  defaultControls?: Record<string, ControlValue>
  /**
   * Refus de session pour un dossier non approuvé (Bob : `-32600` « Workspace … is not trusted »,
   * sans code dédié) : motif du message, et ce que l'app peut proposer.
   */
  trust?: {
    pattern: RegExp
    /**
     * Flag qui fait confiance au dossier (`--trust` pour Bob), proposé dans le panneau ; jamais
     * ajouté par défaut.
     */
    flag?: string
    /**
     * L'agent mémorise la confiance donnée par `flag` (vérifié sur Bob 2.0.6 : `--trust` ajoute le
     * dossier à `~/.bob/trustedFolders.json`). L'UI le dit au lieu de promettre « pour cette session ».
     */
    remembered?: boolean
    /** Commande à lancer dans le dossier pour l'approuver durablement (Bob : `bob`, interactif). */
    approveCommand?: string
  }
  /**
   * Coût lu hors protocole quand l'agent ne le transmet pas (Bob : sa base locale, ADR-0015) : celui
   * de la conversation, et celui de chaque sous-agent en direct s'il l'écrit (fiche 053).
   */
  costSource?: CostSource
  /**
   * Couleur de l'agent dans le graphique de « Mon activité » (fiches 137 et 144) : emplacement
   * fixe (`--chart-1…3` : orange, bleu, vert d'eau), pour qu'un agent garde sa couleur quels que
   * soient les autres ; sans emplacement, il va dans « Autres ».
   */
  chartSlot?: number
  /**
   * Quota de l'agent (plafond, consommation) lu hors ACP, au démarrage de l'app, s'il ne le
   * transmet pas (fiche 091, ADR-0017).
   */
  quotaSource?: QuotaSource
  /**
   * Appel d'outil qui lance un sous-agent, à la façon de l'agent (fiche 140) : sans format, ses
   * sous-agents restent de simples appels d'outil.
   */
  subagentFormat?: SubagentFormat
  /**
   * La session d'un sous-agent, nommée dans sa réponse, se rejoue par `session/load` (fiche 053) :
   * vérifié sur OpenCode 1.19 ; Bob 2.0.6 ne garde pas les messages de ses sous-agents.
   */
  subagentReplay?: boolean
  /**
   * Le travail des sous-agents arrive en direct dans le flux de la conversation, marqué à la façon
   * de l'agent (OpenCode 2 : `_meta["opencode/child-session"]`, fiche 078). L'app le range sous la
   * carte du sous-agent au lieu de le mêler au fil (ADR-0015).
   */
  subagentStream?: SubagentStream
  /**
   * Diffs que l'agent ne joint pas toujours à ses outils d'édition, retrouvés dans ce qu'il en dit
   * par ailleurs (OpenCode 2 au rejeu : `rawOutput.metadata.files[].patch`, fiche 096).
   */
  diffSource?: DiffSource
  /**
   * Échecs d'outils que l'agent dit à sa façon, la carte restant « completed » (OpenCode 2 : appels
   * de son outil `execute`, `rawOutput.metadata.toolCalls[]`, fiche 122).
   */
  toolStatus?: ToolStatusSource
  /**
   * Titre des sessions jamais écrites, masquées dans « Reprendre une session… » (fiche 055) :
   * OpenCode 1.19 garde les sessions ouvertes sans message sous « New session - <date ISO> ».
   */
  emptySessionTitle?: RegExp
  /**
   * Message qui fait compacter la conversation à l'agent, quand il ne l'annonce pas parmi ses
   * commandes (relevé : `/compress` pour Bob 2.0.6, `/compact` pour OpenCode 1.18 — fiche 039).
   */
  compactCommand?: string
  /**
   * Choix du modèle d'une conversation fille (fiche 160, ADR-0036) : `ask`, la mère peut suggérer
   * un modèle parmi ceux du réglage `model` de l'agent, que l'utilisateur confirme ou change sur la
   * carte ; absent, jamais de modèle choisi pour une fille (ni suggéré, ni présélectionné, ni
   * proposé dans « Lancer en parallèle… ») : l'agent prend le sien.
   */
  childModelChoice?: 'ask'
  /**
   * L'agent écrit dans le dossier sans demander d'autorisation, réglé par défaut (OpenCode : relevé
   * 2.2.5, `docs/agents.md`). Un rôle en lecture seule (fiche 223) n'y est alors que demandé, sauf
   * mode natif choisi par le rôle : Bobine ne peut refuser que ce qu'on lui demande.
   */
  writesWithoutAsking?: true
  /**
   * Fichiers où l'agent déclare ses serveurs MCP (fiche 025), modifiables dans l'app, et leur
   * format (fiche 140).
   */
  mcpConfig?: McpConfigSource
  /**
   * Format du fichier où l'agent déclare ses fournisseurs de modèles (fiche 104 : points d'accès
   * compatibles OpenAI), modifiables dans Réglages › Agents ; clé posée par `{env:VAR}`.
   */
  providers?: ProvidersSource
  /**
   * Ce que couvre le « Toujours » que l'agent retient (fiche 214) : dit sur la carte d'autorisation.
   * Sans déclaration, la carte garde « Toujours autoriser » et « C'est l'agent qui décide ce que
   * couvre « toujours » » : rien n'est supposé.
   */
  alwaysScope?: AlwaysScope
  /** Où l'agent lit ses règles (fiche 056) : montrées dans « Règles actives » (fiche 140). */
  rules?: RulesSource
  /**
   * Règles d'approbation globales de l'agent (fiche 215, ADR-0044 ; Bob : section `approval` de
   * `~/.bob/settings/settings.json`, partagée avec Bob IDE et Bob Shell), lues et écrites par
   * Bobine sur une action explicite de l'utilisateur.
   */
  approvalRules?: ApprovalRulesSource
  /**
   * Format où l'agent lit des modes ou agents écrits par l'utilisateur (fiche 223, phase 4,
   * ADR-0047) : « Installer dans… » y écrit un rôle (Bob : `custom_modes.yaml` ; OpenCode :
   * `agents/<id>.md`), sur un geste explicite, après une copie de sauvegarde.
   */
  roleExport?: RoleExportAdapter
  /**
   * Fichiers d'exclusion de l'agent (fiche 155 : `.bobignore`…) : Bobine ne propose pas ces
   * fichiers aux mentions `@`, `@git-changes` les saute, les joindre demande confirmation.
   */
  exclusions?: ExclusionSource
  /** Clés d'API acceptées à la place de la connexion (fiche 022), posées dans l'environnement. */
  apiKeys?: ApiKeySpec[]
  /**
   * Commandes proposées dans le terminal de l'app (fiche 022), par identifiant. Une méthode de
   * connexion de même identifiant se fait par sa commande, au lieu d'`authenticate`.
   */
  terminalSteps?: Record<string, { label: string; command: string }>
  /**
   * Libellés traduits des méthodes de connexion que l'agent annonce à `initialize` (fiche 205),
   * par identifiant : Bob annonce `sso` sous « Log in with SSO », en anglais quelle que soit la
   * langue de l'app. Méthode absente : le nom donné par l'agent, tel quel (ADR-0014).
   */
  authMethodLabels?: Record<string, { readonly label: string }>
  /**
   * Refus de session faute de licence acceptée (Bob : `-32600` « license agreement is required ») :
   * motif du message, et étapes proposées. L'app n'accepte jamais la licence elle-même.
   */
  license?: { pattern: RegExp; steps: string[] }
  /**
   * Connexion refusée pendant un tour (`authRequired` à `session/prompt`, recette 0.9 D10).
   * `pattern` : indice de connexion dans le message d'un `authRequired` (sans lui, erreur de tour
   * ordinaire) ; `otherCodes` : refus de connexion que l'agent envoie sous un autre code, reconnus
   * à ce code ET à ce motif ensemble (Bob 2.0.9 : `-32603` « Invalid or expired API key », fiche
   * 200) ; `apiKey` : la clé d'API du profil répond à ce refus (sinon proposée seulement si c'est le
   * seul moyen de se connecter). Absent : jamais de carte au tour.
   */
  authAtTurn?: {
    pattern?: RegExp
    otherCodes?: { code: number; pattern: RegExp }[]
    apiKey?: boolean
  }
  /**
   * Mode de départ passé dans `_meta` de `session/new` (fiche 163 ; Bob 2.0.6+ lit `bob/mode`), au
   * lieu d'un `session/set_mode` après l'ouverture. `ids` : identifiants de ses modes. Mode refusé
   * par l'agent (`invalidParams`) : session ouverte sans, puis mode appliqué comme pour les autres.
   */
  initialModeMeta?: { key: string; ids: { plan: string; execute: string } }
  /**
   * Variables posées quand le journal de l'app est sur Trace (fiche 165) : le journal de l'agent
   * passe aussi au plus détaillé (Bob : `BOB_LOG_LEVEL=debug`).
   */
  traceEnv?: Record<string, string>
  /** Où l'agent écrit son propre journal, quand ce n'est pas sur sa sortie d'erreur (Bob). */
  logFiles?: string
  /**
   * Versions de l'agent que l'app a vérifiées (sondes `pnpm bob-probe`, `pnpm opencode-probe`,
   * fiche 140) ; une entrée vaut pour ses sous-versions (`1.19` → `1.19.3`). Le Diagnostic prévient
   * quand la version annoncée n'en fait pas partie. Absent : rien à comparer.
   */
  testedVersions?: string[]
  /**
   * Plancher bloquant (fiche 198) : en dessous, l'app n'ouvre pas de session et dit pourquoi.
   * Seulement pour une incompatibilité **documentée** (`reason`, écrite pour le développeur, citée
   * dans le journal) ; une version simplement plus ancienne que `testedVersions` n'est qu'un
   * avertissement. Vide aujourd'hui pour Bob et OpenCode (aucune casse relevée).
   */
  minVersion?: { version: string; reason: string }
  /**
   * Panne passagère dite au format de l'agent, que la reconnaissance générique ne voit pas
   * (fiche 142) : `network` ou `rate-limit`, sinon `undefined`. Aucun profil n'en a besoin
   * aujourd'hui (le format de Bob n'est pas relevé).
   */
  transientError?: (error: unknown) => 'network' | 'rate-limit' | undefined
  /** Astuce de la page d'accueil, `code` entre accents graves (agent factice : `/scenario`). */
  welcomeHint?: string
  /**
   * Où partent les messages, en clair, quand aucun fournisseur de modèle ne le dit (fiche 108) :
   * Bob, son service en ligne. Absent : « le modèle par défaut de l'agent ».
   */
  destination?: string
  /** Agent déclaré par l'utilisateur dans Réglages › Agents (fiche 141) : sa déclaration. */
  custom?: CustomAgent
}

export interface ProfileContext {
  /** Racine de l'app (`app.getAppPath()`), le dépôt en développement. */
  appPath: string
  /** Exécutable Electron, utilisable comme Node avec ELECTRON_RUN_AS_NODE=1. */
  execPath: string
  isPackaged: boolean
  env: NodeJS.ProcessEnv
  /** Dossier où l'agent factice mémorise ses sessions (pour tester la reprise). */
  mockStore?: string
}

/** Les scénarios de l'agent factice lancent des sous-agents des deux façons : OpenCode d'abord. */
/** Connexion par SSO (Bob, et l'agent factice qui l'imite) : libellé traduit (fiche 205). */
const SSO_METHOD = {
  get label() {
    return t('profiles.authMethod.sso')
  }
}

const MOCK_SUBAGENT_FORMAT: SubagentFormat = {
  summary: () => `${OPENCODE_SUBAGENT_FORMAT.summary()} ; ${BOB_SUBAGENT_FORMAT.summary()}`,
  subagentOf: (title, rawInput) =>
    OPENCODE_SUBAGENT_FORMAT.subagentOf(title, rawInput) ??
    BOB_SUBAGENT_FORMAT.subagentOf(title, rawInput),
  sessionId: OPENCODE_SUBAGENT_FORMAT.sessionId
}

/**
 * L'agent factice sert aux essais (ADR-0004) : proposé seulement si on le demande, jamais dans l'app
 * installée. `BOBINE_AGENT_PROFILE=mock` (essais de bout en bout, `BOBINE_AGENT_PROFILE=mock pnpm dev`)
 * ou `BOBINE_MOCK_AGENT=1` pour l'avoir dans la liste sans l'imposer.
 */
export function mockAgentWanted(ctx: Pick<ProfileContext, 'isPackaged' | 'env'>): boolean {
  return (
    !ctx.isPackaged &&
    (ctx.env['BOBINE_AGENT_PROFILE'] === 'mock' || ctx.env['BOBINE_MOCK_AGENT'] === '1')
  )
}

/**
 * Langue de l'agent factice (fiche 167) : celle des essais (`MOCK_AGENT_LANG`, posée par
 * `pnpm e2e --lang`), jamais celle de l'interface, qui n'a aucun effet sur les agents (ADR-0014).
 */
function mockLanguageArgs(env: ProfileContext['env']): string[] {
  const language = env['MOCK_AGENT_LANG']
  return language ? ['--langue', language] : []
}

/**
 * Rôles installés par l'agent factice comme Bob ou OpenCode (fiche 223, `MOCK_AGENT_ROLE_EXPORT`) :
 * seulement avec un dossier personnel d'essai (`BOBINE_CONFIG_HOME`), jamais les vrais fichiers.
 */
const MOCK_ROLE_EXPORT: Record<string, RoleExportAdapter> = {
  bob: BOB_CUSTOM_MODES,
  opencode: OPENCODE_AGENTS
}

function mockRoleExport(env: ProfileContext['env']): { roleExport?: RoleExportAdapter } {
  const format = MOCK_ROLE_EXPORT[env['MOCK_AGENT_ROLE_EXPORT'] ?? '']
  return format && env['BOBINE_CONFIG_HOME'] ? { roleExport: format } : {}
}

/** L'agent factice lit alors ces fichiers et liste leurs modes après les siens. */
function mockRoleExportArgs(env: ProfileContext['env']): string[] {
  const home = env['BOBINE_CONFIG_HOME']
  const kind = env['MOCK_AGENT_ROLE_EXPORT']
  return home && kind && MOCK_ROLE_EXPORT[kind] ? ['--modes-installes', kind, '--perso', home] : []
}

export function resolveProfiles(ctx: ProfileContext): AgentProfile[] {
  const profiles: AgentProfile[] = []
  // Dossier personnel des agents : un autre pour les essais, jamais les vrais fichiers de Bob.
  const home = ctx.env['BOBINE_CONFIG_HOME'] ?? homedir()
  if (mockAgentWanted(ctx)) {
    profiles.push({
      id: 'mock',
      get label() {
        return t('profiles.mock.label')
      },
      // Orange (fiche 144) : le bleu et le vert d'eau vont à IBM Bob et OpenCode.
      chartSlot: 0,
      // Modèle de fille suggéré puis confirmé, comme OpenCode ; `MOCK_CHILD_MODEL=none` : comme Bob.
      ...(ctx.env['MOCK_CHILD_MODEL'] === 'none' ? {} : { childModelChoice: 'ask' as const }),
      // Écrit sans demander, comme OpenCode (`MOCK_AGENT_WRITES=silent`, e2e `roles-travail`, fiche 223).
      ...(ctx.env['MOCK_AGENT_WRITES'] === 'silent' ? { writesWithoutAsking: true as const } : {}),
      command: ctx.execPath,
      args: [
        join(ctx.appPath, 'src/mock-agent/main.mts'),
        '--scenario',
        ctx.env['MOCK_AGENT_SCENARIO'] ?? 'demo',
        ...(ctx.mockStore ? ['--store', ctx.mockStore] : []),
        // Devise du coût annoncé (« bobcoins » : se comporte comme Bob dans l'interface).
        ...(ctx.env['MOCK_AGENT_CURRENCY'] ? ['--devise', ctx.env['MOCK_AGENT_CURRENCY']] : []),
        // Sous-agents écrits dans la base de Bob d'un dossier personnel d'essai, jamais dans la
        // vraie (fiche 053).
        ...(ctx.env['MOCK_AGENT_COST_SOURCE'] === 'bob-db' && ctx.env['BOBINE_CONFIG_HOME']
          ? ['--bob-db', join(ctx.env['BOBINE_CONFIG_HOME'], '.bob', 'db', 'bob.db')]
          : []),
        // Consommation comme Bob : rien par ACP, coût écrit dans cette base (fiche 109).
        ...(ctx.env['MOCK_AGENT_USAGE'] === 'bob' ? ['--cout-bob'] : []),
        // Jetons sans coût, comme Codex (plafond en jetons, fiche 157).
        ...(ctx.env['MOCK_AGENT_USAGE'] === 'tokens' ? ['--sans-cout'] : []),
        // Aucune consommation par ACP, ni `usage_update` ni `usage` (onglet « Session », fiche 166).
        ...(ctx.env['MOCK_AGENT_USAGE'] === 'none' ? ['--sans-usage'] : []),
        // Titre de session = début du texte envoyé, comme Bob (fiche 125).
        ...(ctx.env['MOCK_AGENT_TITLES'] === 'prompt' ? ['--titres-invite'] : []),
        // Rejeu après la réponse à `session/load`, comme Bob 2.0.6 et suivants (0.11, M4).
        ...(ctx.env['MOCK_AGENT_REPLAY'] === 'late' ? ['--rejeu-tardif-ms', '50'] : []),
        // Nom annoncé à `initialize` autre que celui du profil, comme Bob (« Bob » pour « IBM Bob »).
        ...(ctx.env['MOCK_AGENT_NOM'] ? ['--nom', ctx.env['MOCK_AGENT_NOM']] : []),
        // Annonce `additionalDirectories`, comme OpenCode (fiche 179).
        ...(ctx.env['MOCK_AGENT_DIRECTORIES'] === '1' ? ['--dossiers-en-plus'] : []),
        // Sans réglages de session (ni modèle), comme Bob (fiche 210 : carte sans modèle).
        ...(ctx.env['MOCK_AGENT_OPTIONS'] === 'none' ? ['--sans-options'] : []),
        ...mockRoleExportArgs(ctx.env),
        ...mockLanguageArgs(ctx.env)
      ],
      env: { ELECTRON_RUN_AS_NODE: '1' },
      trust: { pattern: UNTRUSTED_WORKSPACE, flag: '--trust' },
      // L'agent factice annonce 0.1.0 ; ses scénarios `version-*` en annoncent d'autres (fiche 198).
      testedVersions: ['0.1.0'],
      minVersion: {
        version: '0.0.5',
        reason:
          'agent factice : plancher fictif, pour essayer le refus (scénario version-trop-ancienne)'
      },
      compactCommand: '/compact',
      // Règles et serveurs MCP lus comme Bob (fiches 056, 060).
      rules: BOB_RULES,
      mcpConfig: BOB_MCP,
      // Fichiers d'exclusion lus comme Bob (fiche 155).
      exclusions: BOB_EXCLUSIONS,
      // Règles d'approbation écrites comme Bob (fiche 215), SEULEMENT dans un dossier personnel
      // d'essai : sans `BOBINE_CONFIG_HOME` (`pnpm dev`), un clic écrirait le vrai `~/.bob`.
      ...(ctx.env['BOBINE_CONFIG_HOME'] ? { approvalRules: BOB_APPROVAL_RULES } : {}),
      // Rôles installés comme Bob ou OpenCode (`MOCK_AGENT_ROLE_EXPORT`, fiche 223), aussi
      // seulement dans un dossier personnel d'essai.
      ...mockRoleExport(ctx.env),
      // Fournisseurs de modèles comme OpenCode (fiche 104), pour les essais des réglages.
      providers: OPENCODE_PROVIDERS,
      // Comme Bob : clé d'API, connexion dans un terminal, licence à lire (fiche 022).
      apiKeys: [
        {
          env: 'MOCK_AGENT_API_KEY',
          get label() {
            return t('profiles.mock.apiKey')
          }
        }
      ],
      terminalSteps: {
        'mock-login': {
          get label() {
            return t('profiles.step.login')
          },
          command: 'touch .mock-agent-logged-in'
        },
        'show-license': {
          get label() {
            return t('profiles.step.license')
          },
          command: 'echo licence-factice'
        }
      },
      license: { pattern: LICENSE_REQUIRED, steps: ['show-license'] },
      // Comme le profil Bob : la méthode SSO simulée, annoncée en anglais (fiche 205).
      authMethodLabels: { 'mock-sso': SSO_METHOD },
      // Comme OpenCode 2.2.5 (scénarios `connexion-expiree*`) : clé d'API pas proposée au tour ;
      // et le refus de Bob 2.0.9 (scénario `connexion-expiree-bob`, fiche 200).
      authAtTurn: {
        pattern: AUTH_REQUIRED_MESSAGE,
        otherCodes: [{ code: INTERNAL_ERROR, pattern: EXPIRED_LOGIN_MESSAGE }]
      },
      // Essais : coûts lus dans une base de Bob, comme le profil Bob.
      ...(ctx.env['MOCK_AGENT_COST_SOURCE'] === 'bob-db'
        ? { costSource: bobDbCosts(bobDbIn(home)) }
        : {}),
      // Essais : quota lu comme celui de Bob, sur un faux `/status` (fiche 091).
      ...(ctx.env['MOCK_AGENT_QUOTA'] === '1'
        ? {
            quotaSource: bobStatusQuota({
              command: ctx.execPath,
              args: [
                join(ctx.appPath, 'src/mock-agent/status-screen.mts'),
                ...(ctx.mockStore ? ['--store', ctx.mockStore] : [])
              ],
              dbPath: bobDbIn(home)
            })
          }
        : {}),
      // Essais : « Toujours » retenu par l'agent pour la conversation, déclaré comme Bob (fiche 214).
      ...(ctx.env['MOCK_AGENT_ALWAYS_SCOPE'] === 'bob' ? { alwaysScope: BOB_ALWAYS_SCOPE } : {}),
      // Sous-agents lancés à la façon d'OpenCode ou de Bob, selon le scénario (fiche 140).
      subagentFormat: MOCK_SUBAGENT_FORMAT,
      // Comme OpenCode : la session d'un sous-agent se rejoue (fiche 053), et son travail arrive
      // en direct au format d'OpenCode 2 (fiche 078).
      subagentReplay: true,
      subagentStream: OPENCODE_SUBAGENT_STREAM,
      // Comme OpenCode 2 : diffs d'un « patch » rejoué retrouvés dans sa sortie (fiche 096).
      diffSource: OPENCODE_DIFF_SOURCE,
      toolStatus: OPENCODE_TOOL_STATUS,
      get welcomeHint() {
        return t('profiles.mock.welcomeHint')
      },
      get destination() {
        return t('profiles.mock.destination')
      }
    })
    // Second agent factice (fiche 108) : continuer une conversation avec un autre agent. Ses
    // fournisseurs de modèles se lisent comme ceux d'OpenCode ; pas de destination propre.
    if (ctx.env['BOBINE_MOCK_PEER'] === '1') {
      profiles.push({
        id: 'mock-peer',
        get label() {
          return t('profiles.mockPeer.label')
        },
        command: ctx.execPath,
        args: [
          join(ctx.appPath, 'src/mock-agent/main.mts'),
          '--scenario',
          ctx.env['MOCK_AGENT_SCENARIO'] ?? 'demo',
          // Son propre nom : l'interface montre celui que l'agent annonce.
          '--nom',
          t('profiles.mockPeer.label'),
          ...(ctx.mockStore ? ['--store', ctx.mockStore] : []),
          ...(ctx.env['MOCK_AGENT_TITLES'] === 'prompt' ? ['--titres-invite'] : []),
          ...mockLanguageArgs(ctx.env)
        ],
        env: { ELECTRON_RUN_AS_NODE: '1' },
        trust: { pattern: UNTRUSTED_WORKSPACE, flag: '--trust' },
        compactCommand: '/compact',
        providers: OPENCODE_PROVIDERS,
        subagentFormat: MOCK_SUBAGENT_FORMAT
      })
    }
  }
  profiles.push(
    {
      id: 'bob',
      label: 'IBM Bob',
      chartSlot: 1,
      command: 'bob',
      // Connexion : SSO (fiche 011) ou clé d'API (fiche 022) — celle de l'app, sinon celle de
      // l'environnement.
      args: ['acp'],
      env: {},
      trust: {
        pattern: UNTRUSTED_WORKSPACE,
        flag: '--trust',
        remembered: true,
        // `bob` lancé dans le dossier demande un niveau de confiance (message de Bob 2.0.6).
        approveCommand: 'bob'
      },
      // `scripts/bob-probe.expected.json` (vérifié par un test). Pas de `minVersion` : aucune
      // casse relevée sous 2.0.6, version plus ancienne = avertissement seulement (fiche 198).
      testedVersions: ['2.0.6', '2.0.9', '2.1.0'],
      costSource: bobDbCosts(bobDbIn(home)),
      subagentFormat: BOB_SUBAGENT_FORMAT,
      // Quota de bobcoins : commande `/status` de `bob chat` (fiche 091, ADR-0017).
      quotaSource: bobStatusQuota({ dbPath: bobDbIn(home) }),
      // Nom principal depuis Bob 2.0.3 (`compress` n'en est plus qu'un alias ; vérifié sur 2.0.9).
      compactCommand: '/compact',
      // Mode de départ à l'ouverture (`_meta["bob/mode"]`, Bob 2.0.6+ ; vérifié sur 2.0.9).
      initialModeMeta: { key: 'bob/mode', ids: { plan: 'plan', execute: 'agent' } },
      // Son journal (un fichier par lancement, rien sur la sortie d'erreur en ACP), détaillé en
      // Trace (fiche 165).
      traceEnv: { BOB_LOG_LEVEL: 'debug' },
      // « Toujours » de Bob (relevé sur 2.0.9, fiche 213) : la tâche (conversation) ; une commande
      // et chacune de ses parties, tout le groupe pour les modifications. Rien dans son fichier.
      alwaysScope: BOB_ALWAYS_SCOPE,
      logFiles: '~/.bob/logs/shell/',
      mcpConfig: BOB_MCP,
      rules: BOB_RULES,
      exclusions: BOB_EXCLUSIONS,
      // Règles d'approbation globales, comme Bob IDE (fiche 215, ADR-0044).
      approvalRules: BOB_APPROVAL_RULES,
      // Rôles installés comme modes personnalisés (fiche 223, ADR-0047 ; 2.1.0, `pnpm bob-probe`).
      roleExport: BOB_CUSTOM_MODES,
      // Bob 2.0.6 lit BOB_API_KEY ; BOBSHELL_API_KEY (ancien nom) est retiré quand l'app pose la
      // sienne, Bob refusant deux valeurs différentes. Clé personnelle : une clé « générale » exige
      // `--team-id`, que `bob acp` n'accepte pas.
      apiKeys: [
        {
          env: 'BOB_API_KEY',
          get label() {
            return t('profiles.bob.apiKey')
          },
          get help() {
            return t('profiles.bob.apiKeyHelp')
          },
          aliases: ['BOBSHELL_API_KEY']
        }
      ],
      terminalSteps: {
        'show-license': {
          get label() {
            return t('profiles.step.license')
          },
          command: 'bob --show-license'
        }
      },
      // `authMethods` de Bob 2.0.9 : `{ id: "sso", name: "Log in with SSO" }` (traces, fiche 205).
      authMethodLabels: { sso: SSO_METHOD },
      license: { pattern: LICENSE_REQUIRED, steps: ['show-license'] },
      // Refus au message (fiche 200, sonde sur 2.0.9) : connexion SSO expirée ou clé refusée,
      // `-32603` « Invalid or expired API key ». `authRequired` gardé au cas où (vu à `session/new`
      // seulement). Clé d'API proposée : Bob la préfère au SSO, et une clé refusée se remplace là.
      authAtTurn: {
        pattern: BOB_AUTH_MESSAGE,
        otherCodes: [{ code: INTERNAL_ERROR, pattern: EXPIRED_LOGIN_MESSAGE }],
        apiKey: true
      },
      get installHint() {
        return t('profiles.bob.installHint')
      },
      get destination() {
        return t('profiles.bob.destination')
      }
    },
    {
      id: 'opencode',
      label: 'OpenCode',
      chartSlot: 2,
      // Réglage « Model » par ACP : la mère peut suggérer un modèle, l'utilisateur le confirme.
      childModelChoice: 'ask',
      // Aucune demande d'autorisation par défaut (2.2.5) : lecture seule d'un rôle seulement demandée.
      writesWithoutAsking: true,
      command: 'opencode',
      // ACP natif. Clés des fournisseurs : `opencode auth login` ou variables d'environnement.
      args: ['acp'],
      env: {},
      compactCommand: '/compact',
      mcpConfig: OPENCODE_MCP,
      // Points d'accès compatibles OpenAI (modèles internes) dans `opencode.json` (fiche 104).
      providers: OPENCODE_PROVIDERS,
      rules: OPENCODE_RULES,
      // Rôles installés comme agents (fiche 223, ADR-0047 ; 2.2.5, `pnpm opencode-probe --offline`).
      roleExport: OPENCODE_AGENTS,
      // 1.19 et 2.0.31 : essais réels (fiches 056, 078) ; 2.0.32 : `scripts/opencode-probe.expected.json`.
      // 2.2.5 : `pnpm opencode-probe --offline` (fiche 198) ; pas de `minVersion` : aucune casse
      // relevée avec une version plus ancienne (seulement un avertissement).
      testedVersions: ['1.19', '2.0.31', '2.0.32', '2.2.5'],
      subagentFormat: OPENCODE_SUBAGENT_FORMAT,
      subagentReplay: true,
      subagentStream: OPENCODE_SUBAGENT_STREAM,
      diffSource: OPENCODE_DIFF_SOURCE,
      toolStatus: OPENCODE_TOOL_STATUS,
      emptySessionTitle: EMPTY_SESSION_TITLE,
      // Connexion expirée au tour (2.2.5 : « Authentication required: provider authentication
      // required », recette 0.9 D10). Pas de clé d'API dans ce profil : `OPENCODE_API_KEY` (Zen) ne
      // renouvellerait pas la connexion d'un autre fournisseur.
      authAtTurn: { pattern: AUTH_REQUIRED_MESSAGE },
      // `opencode-login` : `authenticate` ne fait rien (1.19, 2.0.31), la connexion se fait dans un
      // terminal.
      terminalSteps: {
        [LOGIN_METHOD]: {
          get label() {
            return t('profiles.step.login')
          },
          command: 'opencode auth login'
        }
      },
      get installHint() {
        return t('profiles.opencode.installHint')
      }
    }
  )
  // Les vrais agents d'abord : sans choix, l'app part sur Bob, jamais sur l'agent factice.
  const mock = (p: AgentProfile) => p.id.startsWith('mock')
  return [...profiles.filter((p) => !mock(p)), ...profiles.filter(mock)]
}

/**
 * Commande d'un profil telle qu'on la montre (fiche 136) : un chemin absolu réduit à son nom
 * (« Electron main.mts --scenario demo »), le reste tel quel.
 */
export function displayedCommand(profile: Pick<AgentProfile, 'command' | 'args'>): string {
  return [profile.command, ...profile.args]
    .map((part) => (isAbsolute(part) ? basename(part) : part))
    .join(' ')
}

/** Chemin de l'exécutable : tel quel s'il contient un `/`, sinon cherché dans le PATH. */
export function findExecutable(command: string, pathEnv: string | undefined): string | undefined {
  const candidates = command.includes('/')
    ? [command]
    : (pathEnv ?? '')
        .split(':')
        .filter(Boolean)
        .map((dir) => join(dir, command))
  return candidates.find((file) => {
    try {
      accessSync(file, constants.X_OK)
      return statSync(file).isFile()
    } catch {
      return false
    }
  })
}

export function summarizeProfiles(
  profiles: AgentProfile[],
  pathEnv: string | undefined,
  announcements: Record<string, AgentAnnouncement> = {}
): ProfileSummary[] {
  return profiles.map((profile) => {
    const base = {
      id: profile.id,
      label: profile.label,
      capabilities: describeCapabilities(profile, announcements[profile.id]),
      command: displayedCommand(profile),
      ...(profile.providers ? { providers: true } : {}),
      ...(profile.childModelChoice ? { childModel: true } : {}),
      ...(profile.writesWithoutAsking ? { writesWithoutAsking: true } : {}),
      ...(profile.approvalRules ? { approvalRules: true } : {}),
      ...(profile.roleExport ? { roleExport: profile.roleExport.format } : {}),
      ...(profile.destination ? { destination: profile.destination } : {}),
      ...(profile.custom ? { custom: profile.custom } : {})
    }
    if (findExecutable(profile.command, pathEnv)) return { ...base, available: true }
    const reason = t('profiles.commandMissing', { command: profile.command })
    return {
      ...base,
      available: false,
      reason: profile.installHint ? `${reason} ${profile.installHint}` : reason
    }
  })
}
