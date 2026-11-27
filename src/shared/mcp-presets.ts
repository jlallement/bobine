/**
 * Préréglages de serveurs MCP distants que l'agent sait connecter lui-même (fiche 293, ADR-0075) :
 * des données, jamais un `if` sur leur nom. Le moteur (`agent-config/mcp-oauth.ts`) n'ouvre la page
 * de connexion lue dans la sortie de l'agent que si son hôte est exactement `pageHost`.
 */

export interface McpPreset {
  /** Identifiant stable (textes : `mcp.preset.<id>.*`, logo : lot 2). */
  id: string
  /** Nom proposé pour le serveur dans le fichier de l'agent. */
  name: string
  /** Adresse du serveur MCP. */
  url: string
  /** Hôte exact de la page de connexion (`https:`, sans port ni sous-domaine). */
  pageHost: string
}

export const MCP_PRESETS: readonly McpPreset[] = [
  {
    id: 'figma',
    name: 'figma',
    url: 'https://mcp.figma.com/mcp',
    // `authorization_endpoint` de Figma : `https://www.figma.com/oauth/mcp` (relevé 2026-11-27).
    pageHost: 'www.figma.com'
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
