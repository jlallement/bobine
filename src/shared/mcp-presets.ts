/**
 * Préréglages de serveurs MCP distants que l'agent sait connecter lui-même (fiche 293, ADR-0077) :
 * des données, jamais un `if` sur leur nom. Le moteur (`agent-config/mcp-oauth.ts`) n'ouvre la page
 * de connexion lue dans la sortie de l'agent que si son hôte est exactement `pageHost` et son
 * chemin exactement `pagePath` (ADR-0077).
 */

/** Identifiants des préréglages : leurs textes sont les clés `mcp.preset.<id>.*` (ADR-0014). */
export type McpPresetId = 'figma'

export interface McpPreset {
  /** Identifiant stable (textes : `mcp.preset.<id>.*`). */
  id: McpPresetId
  /** Nom proposé pour le serveur dans le fichier de l'agent. */
  name: string
  /** Adresse du serveur MCP. */
  url: string
  /** Hôte exact de la page de connexion (`https:`, sans port ni sous-domaine). */
  pageHost: string
  /**
   * Chemin exact de la page de connexion, tel que l'écrit l'agent (ni `..`, ni encodage) : celui de
   * l'`authorization_endpoint` publié par le serveur d'autorisation.
   */
  pagePath: string
  /**
   * La page doit porter un `redirect_uri` vers l'agent sur cette machine (`http`, `127.0.0.1` ou
   * `localhost`, port) : sans lui, ce pourrait être la page de consentement du client d'un tiers.
   */
  pageLoopbackRedirect: boolean
  /**
   * Logo du serveur montré par l'interface : chemin du fichier sous `renderer/src/assets/brands/`,
   * copié tel quel depuis les fichiers officiels du propriétaire de la marque (jamais modifié,
   * seulement mis à l'échelle ; empreinte vérifiée par un essai).
   */
  logo: string
  /**
   * Page publique où le propriétaire du serveur dit quelles applications il accepte : ouverte par
   * le main (`mcp:openPresetList`) depuis la ligne d'aide d'un agent qui n'a pas la capacité.
   */
  listUrl: string
}

export const MCP_PRESETS: readonly McpPreset[] = [
  {
    id: 'figma',
    name: 'figma',
    url: 'https://mcp.figma.com/mcp',
    // `authorization_endpoint` de Figma : `https://www.figma.com/oauth/mcp` (relevé 2026-11-27).
    pageHost: 'www.figma.com',
    pagePath: '/oauth/mcp',
    // Relevé : `redirect_uri=http://127.0.0.1:<port>/callback` (sortie réelle d'OpenCode 2.3.0).
    pageLoopbackRedirect: true,
    // Archive officielle « Download our logos » de la page de marque de Figma (fiche 293).
    logo: 'figma/Figma Icon (Full-color).svg',
    // Liste des clients acceptés par le serveur MCP distant de Figma (relue le 2026-11-27).
    listUrl: 'https://developers.figma.com/docs/figma-mcp-server/'
  }
]

/**
 * Adresse comparable : `https:` seulement, hôte en minuscules, sans port par défaut, sans `/`
 * final, sans requête ni fragment ; `undefined` si elle ne se lit pas ou porte des identifiants.
 */
export function normalizeMcpUrl(raw: string): string | undefined {
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    return undefined
  }
  if (url.protocol !== 'https:' || url.username || url.password) return undefined
  return `https://${url.host}${url.pathname.replace(/\/+$/, '')}`
}

/** Préréglage dont c'est l'adresse (même écrite autrement : `/` final, majuscules de l'hôte). */
export function presetForUrl(
  raw: string | undefined,
  presets: readonly McpPreset[] = MCP_PRESETS
): McpPreset | undefined {
  const url = raw === undefined ? undefined : normalizeMcpUrl(raw)
  return url ? presets.find((p) => normalizeMcpUrl(p.url) === url) : undefined
}

export function presetById(
  id: string,
  presets: readonly McpPreset[] = MCP_PRESETS
): McpPreset | undefined {
  return presets.find((p) => p.id === id)
}

/**
 * Préréglage du serveur de ce nom : toutes ses déclarations (tous les dossiers, ce dossier) sont
 * distantes et à l'adresse du même préréglage ; sinon, rien (pas de connexion devinée, R7).
 */
export function declaredPreset(
  servers: readonly { name: string; transport: string; url?: string | undefined }[],
  name: string,
  presets: readonly McpPreset[] = MCP_PRESETS
): McpPreset | undefined {
  const named = servers.filter((s) => s.name === name)
  const found = new Set(
    named.map((s) => (s.transport === 'http' ? presetForUrl(s.url, presets) : undefined))
  )
  const [preset] = [...found]
  return found.size === 1 ? preset : undefined
}
