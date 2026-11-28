import { t, type ParseKeysWithoutVariables } from 'i18next' /**
 * Serveurs MCP des agents (fiche 025). Ils restent déclarés dans les fichiers de chaque agent (Bob :
 * `~/.bob/settings/mcp.json`, OpenCode : `~/.config/opencode/opencode.json`…) : l'app les montre et
 * les modifie, dans un format commun, sans rien garder de son côté.
 */

/** Portée d'un serveur : tous les dossiers, ou le dossier de la conversation (son projet). */
export type McpScope = 'global' | 'project'

export interface McpServer {
  name: string
  /** `stdio` : commande lancée sur la machine ; `http` : serveur distant (URL). */
  transport: 'stdio' | 'http'
  command?: string
  args?: string[]
  /** Variables d'environnement de la commande (clés d'API…). */
  env?: Record<string, string>
  url?: string
  /** En-têtes HTTP (ex. `Authorization`). */
  headers?: Record<string, string>
  enabled: boolean
}

/** Serveur tel qu'il est déclaré chez un agent : où, et dans quel fichier. */
export interface McpServerEntry extends McpServer {
  scope: McpScope
  file: string
  /**
   * Serveur que l'agent connecte lui-même (fiche 293) : identifiant de son préréglage
   * (`shared/mcp-presets.ts`). Posé par le main seulement pour un agent qui a la capacité, et
   * seulement si toutes les déclarations de ce nom sont à l'adresse de ce préréglage. Pas de
   * « Tester » de Bobine pour lui (sans le jeton de l'agent, il répond toujours 401) : son état
   * vient de l'agent.
   */
  authPreset?: string
}

/** Configuration MCP d'un agent, pour les réglages. */
export interface McpAgentView {
  profileId: string
  label: string
  /** Fichiers lus : global, et celui du projet du dossier courant (s'il y en a un). */
  files: { global: string; project?: string }
  servers: McpServerEntry[]
  /** Fichier illisible (JSON invalide…) : affiché, et rien n'est écrit dedans. */
  error?: string
  /**
   * L'agent sait connecter lui-même un serveur distant par OAuth (fiche 293, ADR-0077) : posé par
   * le main d'après le profil (`mcpOAuth`), jamais d'après un identifiant.
   */
  oauth?: true
  /**
   * Dossier pour lequel la vue a été lue (posé par le main pour un agent `oauth`) : l'état d'une
   * connexion n'est montré que pour ce dossier (fiche 293).
   */
  workspace?: string
}

/**
 * État de la connexion d'un serveur MCP distant connecté par l'agent (fiche 293) :
 * - `unknown` : l'état n'a pas pu être relu chez l'agent ;
 * - `to-connect`, `connected`, `expired` : relus chez l'agent (`auth list`) ;
 * - `connecting` : tentative en cours dans le main ;
 * - `refused`, `error`, `no-page` : fin de la dernière tentative ;
 * - `agent-missing` : commande de l'agent introuvable, rien de lancé.
 */
export type McpAuthStatus =
  | 'unknown'
  | 'to-connect'
  | 'connecting'
  | 'connected'
  | 'expired'
  | 'refused'
  | 'error'
  | 'no-page'
  | 'agent-missing'

/**
 * Raison courte d'une `error` : délai dépassé, page refusée par la vérification d'hôte, agent
 * arrêté sans fin reconnue, fin d'échec dite par l'agent sans cause reconnue.
 */
export type McpAuthReason = 'timeout' | 'unexpected-page' | 'stopped' | 'failed'

/** Ce que le renderer reçoit d'une connexion : jamais l'adresse complète de la page (ADR-0077). */
export interface McpAuthState {
  profileId: string
  /** Nom du serveur dans le fichier de l'agent. */
  name: string
  status: McpAuthStatus
  /** Hôte de la page : attendu (`connecting`) ou refusé (`error` `unexpected-page`). */
  host?: string
  reason?: McpAuthReason
}

/** États des serveurs connectables d'un agent, pour le dossier courant (fiche 293). */
export interface McpAuthView {
  profileId: string
  /** Dossier pour lequel l'état a été relu (celui de la conversation affichée). */
  workspace: string
  /** Commande de l'agent trouvée, comme pour son lancement (sinon : « agent absent »). */
  agentFound: boolean
  /** Un état par serveur déclaré dont l'adresse est celle d'un préréglage. */
  servers: McpAuthState[]
  /**
   * Par nom de serveur, la commande à copier pour se connecter dans un terminal (« Dans un
   * terminal ») : celle de l'agent, sans `--standalone` ; précédée du `cd` du dossier si le serveur
   * n'est déclaré que pour ce dossier.
   */
  terminal: Record<string, string>
}

/** Durée maximale d'une tentative de connexion (proche de celle d'OpenCode, ≈ 10 min, fiche 293). */
export const MCP_AUTH_MINUTES = 10

/**
 * Réponse à « Se connecter » : lancé, ou pourquoi pas (refus côté main). `disabled` : le serveur
 * est déclaré mais désactivé, rien n'est lancé.
 */
export type McpConnectResult =
  | { started: true }
  | { started: false; reason: 'busy' | 'not-offered' | 'agent-missing' | 'disabled' }

/**
 * Réponse à « Se déconnecter », sans rien enjoliver : `done` seulement si l'état relu chez l'agent
 * ne montre plus de connexion. `timeout` : la commande n'a pas répondu ; `failed` : elle n'a pas pu
 * être lancée ; `still-connected` : l'état relu montre encore la connexion ; `unconfirmed` : l'état
 * n'a pas pu être relu.
 */
export type McpDisconnectResult =
  | { done: true }
  | {
      done: false
      reason:
        | 'busy'
        | 'not-offered'
        | 'agent-missing'
        | 'timeout'
        | 'failed'
        | 'still-connected'
        | 'unconfirmed'
    }

/** Résultat de « Tester » (fiche 060) : l'app s'est connectée au serveur, ou pourquoi pas. */
export type McpTestResult =
  | {
      ok: true
      /** `serverInfo` annoncé à `initialize`. */
      server?: { name: string; version?: string }
      tools: string[]
      /** Jetons estimés des définitions des outils (`estimateTokens`, fiche 166). */
      toolTokens?: number
      resources?: number
      prompts?: number
      /** Durée du test, en ms. */
      ms: number
    }
  | { ok: false; error: string; ms: number }

/** Nom du serveur MCP de l'app tel que l'agent le voit (Bob l'affiche : « Running Ask User (bobine) »). */
export const APP_TOOLS_SERVER_NAME = 'bobine'

/**
 * Famille d'outils de Bobine (fiche 099) : un module de son serveur MCP `bobine`, tel que Réglages ›
 * Serveurs MCP le montre. Les textes sont des clés de traduction (ADR-0014), traduites à l'affichage.
 */
export interface AppToolFamily {
  id: string
  title: ParseKeysWithoutVariables
  summary: ParseKeysWithoutVariables
  /** Quand la famille est proposée à une conversation. */
  condition: ParseKeysWithoutVariables
  /** Quand elle demande l'accord de l'utilisateur ; absent s'il n'est jamais demandé. */
  approval?: ParseKeysWithoutVariables
  /** Ses outils, avec la description que lit l'agent (en anglais). */
  tools: { name: string; description: string }[]
  /** Poids estimé de ses définitions dans le contexte, en jetons (fiche 109). */
  tokens: number
  /** Déclarée aux agents ; coupée dans les réglages sinon (fiche 109). */
  enabled: boolean
  /** Toujours déclarée : pas d'interrupteur (questions). */
  required?: boolean
  /**
   * Allumée et coupée par un réglage d'une autre section (Mémoire, fiche 182) : pas d'interrupteur
   * ici, son état et un lien vers ce réglage. Un seul interrupteur pour une seule chose.
   */
  setting?: 'memory'
}

/** Outils de Bobine d'une conversation (menu ⚙, fiches 099 et 109). */
export interface ConversationAppTools {
  /** Ceux de sa session ouverte, sinon ceux que son dossier recevrait. */
  names: string[]
  /** Leur poids estimé, en jetons. */
  tokens: number
  /** Nombre d'outils à la prochaine session, si les réglages ont changé depuis l'ouverture. */
  next?: number
}

export const MCP_NAME = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/

/**
 * Serveur saisi dans les réglages : vérifié et nettoyé, ou message d'erreur. Les champs qui ne
 * concernent pas le transport choisi sont retirés.
 */
export function parseMcpServer(raw: unknown): McpServer | string {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  const name = typeof r['name'] === 'string' ? r['name'].trim() : ''
  if (!MCP_NAME.test(name)) {
    return t('mcp.check.name')
  }
  const enabled = r['enabled'] !== false
  const pairs = (value: unknown): Record<string, string> | undefined => {
    if (typeof value !== 'object' || value === null) return undefined
    const entries = Object.entries(value).filter(
      (e): e is [string, string] => e[0].trim() !== '' && typeof e[1] === 'string'
    )
    return entries.length ? Object.fromEntries(entries.map(([k, v]) => [k.trim(), v])) : undefined
  }
  if (r['transport'] === 'http') {
    const url = typeof r['url'] === 'string' ? r['url'].trim() : ''
    if (!/^https?:\/\/\S+$/.test(url)) return t('mcp.check.url')
    const headers = pairs(r['headers'])
    return { name, transport: 'http', url, ...(headers ? { headers } : {}), enabled }
  }
  const command = typeof r['command'] === 'string' ? r['command'].trim() : ''
  if (!command) return t('mcp.check.command')
  const args = Array.isArray(r['args'])
    ? r['args'].filter((a): a is string => typeof a === 'string' && a !== '')
    : []
  const env = pairs(r['env'])
  return {
    name,
    transport: 'stdio',
    command,
    ...(args.length ? { args } : {}),
    ...(env ? { env } : {}),
    enabled
  }
}

/**
 * Découpe une ligne de commande en mots (guillemets simples ou doubles, sans interprétation du
 * shell) : « npx -y "@acme/serveur mcp" » → ["npx", "-y", "@acme/serveur mcp"].
 */
export function splitCommandLine(line: string): string[] {
  const words: string[] = []
  let current = ''
  let quote: '"' | "'" | null = null
  let started = false
  for (const char of line) {
    if (quote) {
      if (char === quote) quote = null
      else current += char
    } else if (char === '"' || char === "'") {
      quote = char
      started = true
    } else if (/\s/.test(char)) {
      if (started) words.push(current)
      current = ''
      started = false
    } else {
      current += char
      started = true
    }
  }
  if (started) words.push(current)
  return words
}

/** Ligne de commande affichée (mots avec espaces entre guillemets). */
export function joinCommandLine(words: readonly string[]): string {
  return words
    .map((w) => {
      if (w !== '' && !/[\s"']/.test(w)) return w
      return w.includes('"') ? `'${w}'` : `"${w}"`
    })
    .join(' ')
}
