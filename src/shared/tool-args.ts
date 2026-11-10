/**
 * Arguments d'un outil que l'app ne sait pas lire autrement (fiche 214) : un outil MCP, un skill, un
 * mode de Bob arrivent en `kind: "other"` avec leurs arguments dans `rawInput`. La carte
 * d'autorisation les montre (« Arguments envoyés à l'outil »), tels que reçus, pour qu'on sache ce
 * qu'on autorise. Fonction pure ; seules les valeurs simples sont gardées, bornées.
 */

export interface ToolArg {
  name: string
  value: string
}

/** Au plus ce nombre d'arguments, chaque valeur coupée à cette longueur. */
export const MAX_ARGS = 8
const MAX_VALUE = 200

/** Clés lues ailleurs (liste de tâches, plan) : pas des arguments à montrer. */
const READ_ELSEWHERE = new Set(['todos', 'plan'])

/** Les arguments de `rawInput` (texte, nombre, booléen) pour un outil `other`, sinon `undefined`. */
export function toolArgsOf(
  rawInput: unknown,
  kind: string | null | undefined
): ToolArg[] | undefined {
  if (kind !== 'other' || typeof rawInput !== 'object' || rawInput === null) return undefined
  const args: ToolArg[] = []
  for (const [name, raw] of Object.entries(rawInput as Record<string, unknown>)) {
    if (READ_ELSEWHERE.has(name)) return undefined
    if (typeof raw !== 'string' && typeof raw !== 'number' && typeof raw !== 'boolean') continue
    const text = String(raw)
    if (!text.trim()) continue
    const cut = text.length > MAX_VALUE ? `${text.slice(0, MAX_VALUE)}…` : text
    // Un texte est cité (`"Lyon"`), un nombre ou un booléen non : le type se lit.
    args.push({ name, value: typeof raw === 'string' ? JSON.stringify(cut) : cut })
    if (args.length >= MAX_ARGS) break
  }
  return args.length > 0 ? args : undefined
}
