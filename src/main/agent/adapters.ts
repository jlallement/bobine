/**
 * Points d'extension des profils d'agent (ADR-0015) : ce qu'un agent fait hors du protocole ACP,
 * fourni par son profil (`profiles.ts`) et appelé par l'hôte d'agent (ou les réglages) sans savoir
 * de quel agent il s'agit. Les implémentations restent à côté de leur agent (`bob-*.ts`,
 * `opencode-*.ts`, dans `agent/` et `agent-config/`).
 *
 * Types seuls : `opencode-contract.ts`, chargé sous Node par sa sonde, en importe sans bundler.
 */
import type { SessionUpdate } from '../../shared/acp-sdk.mts'
import type { McpServer } from '@shared/mcp'
import type { ModelProvider } from '@shared/providers'
import type { RuleFileView } from '@shared/rules'
import type { Subagent } from '@shared/subagent'
import type { AgentSpend } from '@shared/usage'
import type { McpLocations } from '../agent-config/mcp-files'
import type { ProvidersLocations, StoredProviders } from '../agent-config/provider-files'
import type { RulesContext } from '../agent-config/rules'
import type { SpawnPty } from '../terminal/terminal-manager'
import type { ToolCallSoFar } from './tool-call-memory'

/**
 * Coût lu hors protocole, pour un agent qui ne le transmet pas par ACP (fiches 019, 053). La
 * moindre surprise donne `undefined` : pas de coût plutôt qu'un coût faux.
 */
export interface CostSource {
  /** Repère de la fonction dans « Propre à <agent> » et `docs/agents.md` (`cost-<id>`). */
  id: 'bob-db'
  /** Devise des montants (`bobcoins`). */
  currency: string
  /** Coût cumulé de la session, sous-agents compris. */
  session(sessionId: string): number | undefined
  /** Sous-agents lancés par la session, avec leur coût, relus pendant qu'ils travaillent. */
  subagents?(sessionId: string): SubagentCost[] | undefined
  /** Dépense récente sur ce Mac (jour, 7 jours, mois), dans le détail de la consommation. */
  spend?(now: Date): AgentSpend | undefined
}

/** Sous-agent d'une session tel que l'agent l'enregistre (fiche 053). */
export interface SubagentCost {
  id: string
  /** Consigne du sous-agent, pour le rattacher à sa carte. */
  title: string
  /** Création chez l'agent (ms). */
  createdAt: number
  /** Coût cumulé ; absent tant que l'agent n'a rien dépensé. */
  cost?: number
}

/** Session d'un sous-agent dont le travail arrive dans le flux de la conversation (fiche 078). */
export interface ChildSession {
  /** Session du sous-agent, sûre à renvoyer telle quelle à l'agent (`session/load`). */
  id: string
  /** Session qui l'a lancé : la conversation, ou un autre sous-agent (profondeur > 1). */
  parentId: string
  depth: number
  /** Titre de la session : la description donnée au sous-agent. */
  title?: string
}

/**
 * Appel d'outil qui lance un sous-agent, tel que l'agent le fait (fiche 140) : aucun agent ne le
 * dit par ACP. Le main pose ce qu'il reconnaît en marque générique sur la mise à jour
 * (`_meta["bobine/subagent"]`, `shared/subagent.ts`) ; sans format, pas de carte de sous-agent.
 */
export interface SubagentFormat {
  /** L'outil reconnu, en clair, pour « Propre à <agent> » (Réglages › Agents). */
  summary(): string
  /**
   * Sous-agent lancé par cet appel, d'après son titre (le dernier annoncé) et son entrée brute ;
   * `undefined` si ce n'en est pas un, ou si cette mise à jour ne permet pas de le dire.
   */
  subagentOf(title: string | undefined, rawInput: unknown): Subagent | undefined
  /**
   * Session du sous-agent nommée par le résultat de l'appel (texte et sortie brute), pour la
   * rejouer (`subagentReplay`) ; elle doit avoir une forme sûre : elle est renvoyée à l'agent.
   */
  sessionId?(output: string, rawOutput: unknown): string | undefined
}

/**
 * Travail des sous-agents relayé dans le flux de la conversation (même `sessionId`), marqué à la
 * façon de l'agent : l'hôte le range sous la carte du sous-agent au lieu de le mêler au fil.
 */
export interface SubagentStream {
  /** Sous-agent dont vient cette mise à jour, ou `undefined` si elle vient de la conversation. */
  childOf(update: SessionUpdate): ChildSession | undefined
  /** La mise à jour telle qu'on l'affiche sous la carte du sous-agent (sans la marque). */
  forCard(update: SessionUpdate, child: ChildSession): SessionUpdate
  /**
   * L'outil du sous-agent rend la main alors qu'il travaille encore, en arrière-plan (OpenCode 2 :
   * `rawOutput.metadata.status: "running"`, fiche 122) : l'app le suit jusqu'à sa vraie fin.
   */
  background?(update: SessionUpdate): boolean
}

/**
 * Diffs qu'un agent ne joint pas toujours à ses outils d'édition, mais qu'il décrit à sa façon
 * ailleurs dans la mise à jour (OpenCode au rejeu : `rawOutput.metadata.files[].patch`, fiche 096).
 */
export interface DiffSource {
  /**
   * La mise à jour, avec les diffs qui lui manquent ; telle quelle s'il n'en manque pas. `soFar` :
   * ce que les mises à jour précédentes du même outil ont dit (titre, genre, entrée ; fiche 202).
   */
  complete(update: SessionUpdate, cwd: string, soFar?: ToolCallSoFar): SessionUpdate
}

/**
 * Échec d'un outil que l'agent ne dit qu'à sa façon (OpenCode 2 : l'erreur d'un appel fait par son
 * outil `execute` est dans `rawOutput.metadata.toolCalls[]`, la carte est « completed », fiche 122).
 */
export interface ToolStatusSource {
  /** Repère de la fonction dans « Propre à <agent> » et `docs/agents.md`. */
  id: 'opencode-tool-calls'
  /** La mise à jour, en échec si l'agent y décrit une erreur ; telle quelle sinon. */
  correct(update: SessionUpdate): SessionUpdate
}

/** Ce dont une lecture de quota a besoin, fourni par l'app (fiche 091, ADR-0017). */
export interface QuotaContext {
  /** Dossier vide réservé à ces lectures : tout ce que l'agent y crée est à supprimer. */
  cwd: string
  env: NodeJS.ProcessEnv
  spawnPty: SpawnPty
  /** Au-delà, la lecture est abandonnée (quota inconnu). */
  timeoutMs: number
  /** L'app quitte : la lecture s'arrête tout de suite, son processus avec (fiche 208). */
  signal?: AbortSignal
}

/** Ce qu'une lecture a donné : le quota s'il a été lu, et les sessions qu'elle a laissées. */
export interface QuotaReading {
  quota?: { limit: number | null; used: number }
  /** Sessions créées chez l'agent par la lecture, à supprimer (`session/delete`). */
  leftovers: string[]
  /** Pourquoi le quota n'a pas été lu, pour le journal. */
  problem?: string
}

/**
 * Quota lu hors protocole (plafond et consommation selon le serveur de l'agent), pour un agent qui
 * ne le transmet pas par ACP (fiche 091). La moindre surprise : pas de quota plutôt qu'un faux.
 */
export interface QuotaSource {
  /** Repère de la fonction dans « Propre à <agent> » et `docs/agents.md` (`quota-<id>`). */
  id: 'bob-status'
  /** Devise des montants (`bobcoins`). */
  currency: string
  read(context: QuotaContext): Promise<QuotaReading>
}

/** Où un agent lit ses règles (fiche 056), tel que son profil le déclare (fiche 140). */
export interface RulesSource {
  /** Fichiers lus, en clair, pour « Propre à <agent> » (Réglages › Agents). */
  summary(): string
  /** Fichiers de règles que l'agent charge pour cette conversation. */
  list(ctx: RulesContext): Promise<RuleFileView[]>
}

/**
 * Fichiers d'exclusion de l'agent (fiche 155), tels que son profil les déclare : ce qu'il refuse
 * d'ouvrir lui-même. Bobine s'y plie pour ce qu'elle met elle-même dans le message (mentions `@`,
 * pièces jointes, `@git-changes`). Syntaxe gitignore, lue par `agent-config/exclusions.ts`.
 */
export interface ExclusionSource {
  /** Fichiers lus, en clair, pour « Propre à <agent> » (Réglages › Agents). */
  summary(): string
  /** Noms des fichiers lus dans chaque dossier, de la racine du dossier de travail au fichier. */
  files: readonly string[]
  /** Motifs toujours exclus, sans fichier (Bob : `.env`). */
  always?: readonly string[]
}

/** Serveur MCP trouvé dans un fichier de l'agent : où il est écrit, et sous quelle forme. */
export interface McpEntry {
  name: string
  raw: Record<string, unknown>
  /** Chemin JSON du serveur dans le fichier. */
  path: string[]
  /** Seconde forme du format, quand l'agent en lit deux (ex. format natif d'OpenCode 2). */
  native: boolean
}

/**
 * Fichiers où l'agent déclare ses serveurs MCP (fiche 025), et leur format, tel que son profil le
 * déclare (fiche 140). Lecture, écriture sûre et dossier « projet » restent à `AgentMcpConfig`.
 */
export interface McpConfigSource {
  /** Fichiers, en clair, pour « Propre à <agent> » (Réglages › Agents). */
  summary(): string
  globalFile(loc: McpLocations): string
  projectFile(workspace: string): string
  /** Serveurs déclarés dans le fichier. */
  entries(data: Record<string, unknown>): McpEntry[]
  /** Où écrire un serveur qui n'existe pas encore. */
  placeNew(data: Record<string, unknown>, name: string): { path: string[]; native: boolean }
  fromRaw(name: string, raw: Record<string, unknown>, native: boolean): McpServer
  /** Objet à écrire, à partir de l'ancien (champs inconnus gardés). */
  toRaw(
    server: McpServer,
    previous: Record<string, unknown> | undefined,
    native: boolean
  ): Record<string, unknown>
  /** Champ qui active / désactive, et sa valeur. */
  enabledEdit(enabled: boolean, native: boolean): { field: string; value: boolean | undefined }
}

/**
 * Fichier où l'agent déclare ses fournisseurs de modèles (fiche 104), et son format, tel que son
 * profil le déclare (fiche 140). Chaque modification rend le nouveau texte du fichier (commentaires
 * et réglages inconnus gardés) ; la lecture, la copie `.bak` et l'écriture restent à
 * `AgentProvidersConfig`.
 */
export interface ProvidersSource {
  file(loc: ProvidersLocations): string
  /** Fournisseurs déclarés dans le contenu du fichier. */
  parse(data: Record<string, unknown>): StoredProviders
  /** Ajoute ou remplace un fournisseur (`previousId` : renommage). */
  save(
    text: string,
    data: Record<string, unknown>,
    provider: ModelProvider,
    previousId?: string
  ): string
  /** Retire un fournisseur ; `removed` : chemin de l'entrée, ses conteneurs vidés partent aussi. */
  remove(
    text: string,
    data: Record<string, unknown>,
    id: string
  ): { text: string; removed: string[] }
  setEnabled(text: string, data: Record<string, unknown>, id: string, enabled: boolean): string
  /** « Seulement ces fournisseurs » : rien d'autre n'est proposé à l'agent. */
  setOnly(text: string, data: Record<string, unknown>, only: boolean): string
  /** La clé sera lue dans la variable `env` : remplace une clé en clair ou absente. */
  useKeyVariable(text: string, data: Record<string, unknown>, id: string, env: string): string
}
