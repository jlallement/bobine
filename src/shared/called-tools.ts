/**
 * Outils qu'un appel d'outil a appelés à son tour (fiche 293, lot 3) : du code qui appelle des
 * outils MCP (OpenCode 2 : son outil `execute`, « Code Mode », fiche 079) ne passe pas par Bobine,
 * mais l'agent les nomme à la fin de la carte. Le profil de l'agent sait les lire
 * (`CalledToolsSource`, `main/agent/adapters.ts`) ; le main pose alors sur la mise à jour une
 * marque générique, `_meta["bobine/calledTools"]`, la seule chose que le fil lit ensuite.
 *
 * Les noms viennent d'un agent et d'un serveur tiers : ce sont des **données**. Bornés en nombre et
 * en longueur, sans caractère de contrôle ni de mise en forme (retour à la ligne, sens d'écriture,
 * largeur nulle) ; relus et nettoyés de nouveau à la lecture de la marque (fil gardé sur le disque).
 *
 * Sans alias ni dépendance : le main, le renderer et les essais l'importent tels quels.
 */

/** Clé de la marque posée par le main sur une mise à jour (jamais envoyée par un agent). */
export const CALLED_TOOLS_META = 'bobine/calledTools'

/** Appels gardés au plus dans une marque (les suivants ne sont que comptés). */
export const MAX_CALLED_TOOLS = 50

/** Longueur maximale d'un nom de serveur ou d'outil gardé (au-delà : raccourci par « … »). */
export const MAX_CALLED_NAME = 64

/**
 * Un outil appelé : `tool` sur le serveur `server` (s'il est connu), ou une recherche parmi les
 * outils (du serveur `server` s'il est connu ; jamais deviné).
 */
export type CalledTool = { server?: string; tool: string } | { search: true; server?: string }

export interface CalledToolsMark {
  /** Les premiers appels, dans l'ordre (au plus `MAX_CALLED_TOOLS`). */
  tools: CalledTool[]
  /** Nombre d'appels annoncés par l'agent (au moins `tools.length`). */
  total: number
}

/**
 * Caractères jamais gardés dans un nom : contrôle (`\p{Cc}`, retours à la ligne compris), mise en
 * forme (`\p{Cf}` : sens d'écriture, largeur nulle), séparateurs de ligne et de paragraphe.
 */
const UNSAFE = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu

/** Nom lisible sur une ligne, borné ; `undefined` s'il n'en reste rien (ou si ce n'est pas un texte). */
export function cleanCalledName(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  // Borné avant tout traitement : un nom géant ne coûte rien de plus.
  const text = value
    .slice(0, MAX_CALLED_NAME * 4)
    .replace(UNSAFE, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!text) return undefined
  const chars = [...text]
  return chars.length > MAX_CALLED_NAME ? `${chars.slice(0, MAX_CALLED_NAME - 1).join('')}…` : text
}

/** Un appel relu (marque ou adaptateur) : nettoyé, ou `undefined` s'il n'est pas lisible. */
function cleanCalledTool(value: unknown): CalledTool | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const v = value as Record<string, unknown>
  const server = cleanCalledName(v['server'])
  const withServer = server ? { server } : {}
  if (v['search'] === true) return { search: true, ...withServer }
  const tool = cleanCalledName(v['tool'])
  return tool ? { ...withServer, tool } : undefined
}

/**
 * Marque d'une liste d'appels (de l'adaptateur de l'agent, ou relue) : nettoyée et bornée ;
 * `undefined` s'il ne reste aucun appel lisible. `total` : appels annoncés (sinon : la liste).
 */
export function calledToolsMark(tools: unknown, total?: unknown): CalledToolsMark | undefined {
  if (!Array.isArray(tools)) return undefined
  const kept: CalledTool[] = []
  for (const value of tools.slice(0, MAX_CALLED_TOOLS)) {
    const tool = cleanCalledTool(value)
    if (tool) kept.push(tool)
  }
  if (!kept.length) return undefined
  const announced =
    typeof total === 'number' && Number.isSafeInteger(total) && total > 0 ? total : tools.length
  return { tools: kept, total: Math.max(announced, kept.length) }
}

/** La même mise à jour, avec sa marque. */
export function withCalledTools<T extends { _meta?: Record<string, unknown> | null }>(
  update: T,
  mark: CalledToolsMark
): T {
  return { ...update, _meta: { ...update._meta, [CALLED_TOOLS_META]: mark } }
}

/**
 * La mise à jour sans marque : une marque venue de l'agent lui-même n'est jamais la nôtre (le main
 * la retire avant de poser la sienne).
 */
export function withoutCalledTools<T extends { _meta?: Record<string, unknown> | null }>(
  update: T
): T {
  if (!update._meta || !(CALLED_TOOLS_META in update._meta)) return update
  const { [CALLED_TOOLS_META]: _forged, ...rest } = update._meta
  return { ...update, _meta: rest }
}

/** Marque posée par le main sur cette mise à jour, relue et nettoyée ; `undefined` sinon. */
export function calledToolsOf(update: {
  _meta?: Record<string, unknown> | null
}): CalledToolsMark | undefined {
  const mark: unknown = update._meta?.[CALLED_TOOLS_META]
  if (typeof mark !== 'object' || mark === null) return undefined
  const m = mark as Record<string, unknown>
  return calledToolsMark(m['tools'], m['total'])
}

/** Champ `calledTools` d'une carte du fil, d'après la marque de la mise à jour (sinon rien). */
export function calledToolsField(update: { _meta?: Record<string, unknown> | null }): {
  calledTools?: CalledToolsMark
} {
  const calledTools = calledToolsOf(update)
  return calledTools ? { calledTools } : {}
}

/** Ce qu'un titre montre : appels distincts, dans l'ordre de leur premier appel. */
export interface CalledToolsTitle {
  /** Appels distincts montrés (au plus `shown`). */
  shown: CalledTool[]
  /**
   * Appels non représentés par ceux montrés (« +N ») : ceux d'autres outils, et ceux que la marque
   * ne garde pas (au-delà de `MAX_CALLED_TOOLS`, outils inconnus).
   */
  more: number
  /** Serveur commun à tous les appels montrés (aucune recherche) : dit une fois, en tête. */
  server?: string
}

const keyOf = (tool: CalledTool) =>
  'search' in tool ? `?\u0000${tool.server ?? ''}` : `${tool.server ?? ''}\u0000${tool.tool}`

/** Titre d'une carte d'après sa marque : au plus `shown` outils distincts, puis « +N » appels. */
export function calledToolsTitle(mark: CalledToolsMark, shown = 3): CalledToolsTitle {
  const seen = new Set<string>()
  const distinct: CalledTool[] = []
  for (const tool of mark.tools) {
    const key = keyOf(tool)
    if (seen.has(key)) continue
    seen.add(key)
    distinct.push(tool)
  }
  const head = distinct.slice(0, shown)
  const shownKeys = new Set(head.map(keyOf))
  const represented = mark.tools.filter((tool) => shownKeys.has(keyOf(tool))).length
  const servers = new Set(head.map((t) => ('search' in t ? undefined : t.server)))
  const [only] = [...servers]
  return {
    shown: head,
    more: Math.max(0, mark.total - represented),
    ...(servers.size === 1 && only !== undefined ? { server: only } : {})
  }
}
