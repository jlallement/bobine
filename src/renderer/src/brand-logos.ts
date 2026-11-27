/**
 * Logos de marque des préréglages de serveurs MCP (fiche 293) : fichiers officiels copiés tels
 * quels sous `assets/brands/`, nommés par le préréglage (`McpPreset.logo`), jamais importés par
 * leur nom dans un composant. Seulement mis à l'échelle par l'interface.
 */
// `?no-inline` : le fichier est livré tel quel à côté de l'app, jamais réécrit en adresse `data:`
// (Vite y changerait les guillemets et l'encodage).
const LOGOS = import.meta.glob<string>('./assets/brands/*/*.svg', {
  eager: true,
  query: '?no-inline',
  import: 'default'
})

/** Adresse du logo d'un préréglage ; `undefined` si le fichier n'existe pas. */
export function brandLogo(path: string): string | undefined {
  return LOGOS[`./assets/brands/${path}`]
}
