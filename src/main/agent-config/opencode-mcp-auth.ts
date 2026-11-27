/**
 * Connexion OAuth d'un serveur MCP distant par OpenCode (fiche 293, ADR-0077), relevée sur 2.3.0
 * (sorties brutes : `fixtures/opencode-2.3.0-mcp-auth/`) :
 * - `opencode mcp auth <nom> --standalone` écrit, avec les symboles de sa bibliothèque d'invite
 *   (`│`, `●`, `◇`, `◆`, `■`, `└`… ; ASCII sans terminal Unicode) : une consigne, l'adresse de la page **seule sur sa ligne**,
 *   « Waiting for authorization... », puis « Connected to <nom> » et « Done », ou
 *   « Authorization expired » et « Failed » (au bout d'environ 10 min, **code 0**), ou « Cancelled »
 *   à l'interruption (relevé R6) ;
 * - `opencode mcp logout <nom> --standalone` ;
 * - `opencode auth list --format json --standalone` : tableau d'intégrations
 *   `{ id: "mcp_<empreinte>", name, connections: [{ type, id, label, method: "oauth", status? }] }`
 *   ; un serveur déclaré sans connexion n'y est pas (relevé R5) ; seuls les serveurs déclarés pour
 *   le dossier courant y sont (relevé R4).
 * `--standalone` toujours : sans lui, OpenCode parle à son service de fond, peut-être lancé avec un
 * autre environnement. Refus sur la page de Figma : `TODO(R2)`, rien de reconnu tant qu'il n'est
 * pas relevé.
 */
import type { McpAuthLine, McpAuthStored, McpOAuthSource } from '../agent/adapters'

/**
 * Préfixe de tête sans importance : un symbole court suivi d'espaces. Sur un terminal Unicode,
 * OpenCode met `│`, `●`, `◇`, `◆`, `■`, `└` (relevé sur Mac) ; sans Unicode, sa bibliothèque
 * d'invite les remplace par de l'ASCII (`|`, `•`, `o`, `*`, `x`, `—` : hypothèse, non relevée sous
 * Windows, R9). La lecture ne dépend donc d'aucun symbole : au plus trois caractères, puis des espaces.
 */
const SHORT_PREFIX = /^\S{1,3}\s+/u

/** Une adresse, quel que soit son schéma : le moteur refuse ensuite tout ce qui n'est pas attendu. */
const URL_LINE = /^[a-z][a-z0-9+.-]*:\/\/\S+$/i

function readLine(raw: string): McpAuthLine | undefined {
  const trimmed = raw.trim()
  const line = trimmed.replace(SHORT_PREFIX, '')
  // L'adresse seule sur sa ligne, avec ou sans symbole devant.
  if (URL_LINE.test(line)) return { kind: 'url', url: line }
  if (URL_LINE.test(trimmed)) return { kind: 'url', url: trimmed }
  if (/^Connected to \S+$/.test(line)) return { kind: 'connected' }
  if (/^Authorization expired$/.test(line)) return { kind: 'expired' }
  if (/^Failed$/.test(line)) return { kind: 'failed' }
  if (/^Cancelled$/.test(line)) return { kind: 'cancelled' }
  // TODO(R2) : refus sur la page de Figma, à reconnaître ici quand sa sortie sera relevée.
  return undefined
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * État d'une connexion `oauth` : sans `status`, connectée ; `status.status === "needs_auth"`
 * (prévu par le type de l'API d'OpenCode, jamais relevé : R1), expirée ; autre `status`, inconnu.
 */
function connectionState(connection: Record<string, unknown>): McpAuthStored {
  const status = connection['status']
  if (status === undefined || status === null) return 'connected'
  return isObject(status) && status['status'] === 'needs_auth' ? 'expired' : 'unknown'
}

const RANK: Record<McpAuthStored, number> = { connected: 3, expired: 2, unknown: 1 }

function readStates(stdout: string): Map<string, McpAuthStored> | undefined {
  let data: unknown
  try {
    data = JSON.parse(stdout)
  } catch {
    return undefined
  }
  if (!Array.isArray(data)) return undefined
  const states = new Map<string, McpAuthStored>()
  for (const integration of data) {
    // Intégrations des serveurs MCP seulement (`mcp_…`, relevé) : un fournisseur de modèles de
    // même nom ne passe jamais pour une connexion de serveur.
    if (!isObject(integration)) continue
    const { id, name, connections } = integration
    if (typeof id !== 'string' || !id.startsWith('mcp_') || typeof name !== 'string') continue
    if (!Array.isArray(connections)) continue
    for (const connection of connections) {
      if (!isObject(connection) || connection['method'] !== 'oauth') continue
      const state = connectionState(connection)
      const before = states.get(name)
      if (!before || RANK[state] > RANK[before]) states.set(name, state)
    }
  }
  return states
}

export const OPENCODE_MCP_AUTH: McpOAuthSource = {
  id: 'opencode-mcp-auth',
  version: '2.3.0',
  connectArgs: (name) => ['mcp', 'auth', name, '--standalone'],
  disconnectArgs: (name) => ['mcp', 'logout', name, '--standalone'],
  statesArgs: () => ['auth', 'list', '--format', 'json', '--standalone'],
  // Dans un vrai terminal, OpenCode ouvre lui-même la page (relu : stdin et stdout terminaux).
  terminalArgs: (name) => ['mcp', 'auth', name],
  readLine,
  readStates
}
