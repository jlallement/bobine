/**
 * Sondes des contrats ACP des agents (fiches 048, 078) : ce qui se compare dans leurs réponses,
 * sans lancer de processus (testable). Partagé par `bob-probe.ts` et `opencode-probe.ts`.
 *
 * Sans import : les scripts des sondes le chargent sous Node, sans bundler.
 */

/** Ce que l'agent a répondu à un sondage, sous une forme stable (chemins jetables remplacés). */
export type Observation = Record<string, unknown>
export type Observations = Record<string, Observation>

/** Remplace les chemins jetables de la sonde par des noms stables (`<dossier>`, `<home>`). */
export function stablePaths(text: string, paths: Record<string, string>): string {
  let out = text
  // Les plus longs d'abord : un dossier dans le HOME jetable n'est pas réécrit à moitié.
  for (const [name, path] of Object.entries(paths).sort((a, b) => b[1].length - a[1].length)) {
    if (path) out = out.split(path).join(`<${name}>`)
  }
  return out
}

/** Valeurs à plat, par chemin (`initialize.mcp.http`), pour comparer et afficher les écarts. */
function flatten(value: unknown, prefix: string, out: Map<string, string>): void {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length === 0) out.set(prefix, '{}')
    for (const [key, child] of entries) flatten(child, prefix ? `${prefix}.${key}` : key, out)
    return
  }
  out.set(prefix, JSON.stringify(value))
}

/** Écarts entre attendu et obtenu, une ligne par valeur : « chemin : attendu → obtenu ». */
export function diffObservations(expected: Observations, actual: Observations): string[] {
  const before = new Map<string, string>()
  const after = new Map<string, string>()
  flatten(expected, '', before)
  flatten(actual, '', after)
  const keys = [...new Set([...before.keys(), ...after.keys()])].sort()
  return keys.flatMap((key) => {
    const a = before.get(key)
    const b = after.get(key)
    if (a === b) return []
    if (a === undefined) return [`${key} : nouveau → ${b}`]
    if (b === undefined) return [`${key} : ${a} → disparu`]
    return [`${key} : ${a} → ${b}`]
  })
}

export interface ContractCheck {
  label: string
  ok: boolean
  /**
   * Pas vérifiable cette fois (le modèle n'a pas fait ce qu'on lui demandait) : à relancer, sans
   * conclure que le contrat est rompu.
   */
  unverified?: boolean
}
