/**
 * Sortie des commandes lancées par l'agent, d'après l'extension d'affichage de terminal qu'utilisent
 * Codex (codex-acp) et Claude Code (claude-agent-acp) quand le client annonce
 * `clientCapabilities._meta.terminal_output` / `terminal_output_delta` :
 * - contenu `{ type: 'terminal', terminalId }` dans l'appel d'outil ;
 * - `_meta.terminal_info { terminal_id, cwd? }` ;
 * - `_meta.terminal_output_delta { terminal_id, data }` (morceau à ajouter) ou
 *   `_meta.terminal_output { terminal_id, data }` (sortie complète) ;
 * - `_meta.terminal_exit { terminal_id, exit_code, signal }`.
 * Ces champs `_meta` ne sont lus qu'ici.
 */

/** Ce que le client annonce pour recevoir cette extension. */
export const TERMINAL_OUTPUT_CAPABILITY = { terminal_output: true, terminal_output_delta: true }

/** Sortie conservée par terminal (les derniers octets) : le fil reste léger. */
export const MAX_TERMINAL_OUTPUT = 200_000

export interface TerminalState {
  output: string
  /** Début de la sortie coupé pour rester sous la limite. */
  truncated?: boolean
  exitCode?: number | null
  signal?: string | null
  /** Commande terminée (code de sortie reçu). */
  exited?: boolean
}

export interface TerminalPatch {
  terminalId: string
  /** Morceau à ajouter. */
  append?: string
  /** Sortie complète (remplace). */
  replace?: string
  exit?: { exitCode: number | null; signal: string | null }
}

type Json = Record<string, unknown>
const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v)
const idOf = (v: unknown): string | undefined =>
  isObject(v) && typeof v['terminal_id'] === 'string' && v['terminal_id']
    ? v['terminal_id']
    : undefined

/** Modifications de terminal portées par le `_meta` d'un appel d'outil. */
export function terminalPatchOf(meta: unknown): TerminalPatch | undefined {
  if (!isObject(meta)) return undefined
  const delta = meta['terminal_output_delta']
  const full = meta['terminal_output']
  const exit = meta['terminal_exit']
  const terminalId = idOf(delta) ?? idOf(full) ?? idOf(exit) ?? idOf(meta['terminal_info'])
  if (!terminalId) return undefined
  const patch: TerminalPatch = { terminalId }
  if (isObject(delta) && typeof delta['data'] === 'string') patch.append = delta['data']
  if (isObject(full) && typeof full['data'] === 'string') patch.replace = full['data']
  if (isObject(exit)) {
    const code = exit['exit_code']
    const signal = exit['signal']
    patch.exit = {
      exitCode: typeof code === 'number' ? code : null,
      signal: typeof signal === 'string' ? signal : null
    }
  }
  return patch
}

/** Applique une modification à l'état d'un terminal. */
export function applyTerminalPatch(
  state: TerminalState | undefined,
  patch: TerminalPatch
): TerminalState {
  let output = patch.replace ?? state?.output ?? ''
  if (patch.append) output += patch.append
  let truncated = state?.truncated
  if (output.length > MAX_TERMINAL_OUTPUT) {
    output = output.slice(output.length - MAX_TERMINAL_OUTPUT)
    truncated = true
  }
  return {
    ...state,
    output,
    ...(truncated ? { truncated } : {}),
    ...(patch.exit ? { ...patch.exit, exited: true } : {})
  }
}

/** Segment de texte avec ses attributs ANSI (couleurs SGR). */
export interface AnsiSegment {
  text: string
  color?: string
  bold?: boolean
  dim?: boolean
}

const COLORS = ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white']

/** Séquences d'échappement d'un terminal : SGR et contrôles CSI, titres OSC, retour chariot seul. */
export const ANSI_PATTERN = /\x1b\[([0-9;?]*)([A-Za-z])|\x1b\][^\x07]*(?:\x07|\x1b\\)|\r(?!\n)/g

type AnsiStyle = Omit<AnsiSegment, 'text'>

/** Style après une séquence SGR (`codes` : ses paramètres). */
function applySgr(style: AnsiStyle, parameters: string): AnsiStyle {
  let next = style
  for (const code of (parameters || '0').split(';').map(Number)) {
    if (code === 0) next = {}
    else if (code === 1) next = { ...next, bold: true }
    else if (code === 2) next = { ...next, dim: true }
    else if (code === 22) next = { ...next, bold: false, dim: false }
    else if (code === 39) next = { ...next, color: undefined }
    else if (code >= 30 && code <= 37) next = { ...next, color: COLORS[code - 30] }
    else if (code >= 90 && code <= 97) next = { ...next, color: `bright-${COLORS[code - 90]}` }
  }
  return next
}

/**
 * Style en vigueur à la position `end` d'une sortie (fiche 192) : une sortie affichée par morceaux
 * (plafond, « Afficher tout ») garde la couleur ouverte avant le début de chaque morceau.
 */
export function ansiStyleAt(text: string, end: number): AnsiStyle {
  let style: AnsiStyle = {}
  for (const match of text.slice(0, end).matchAll(ANSI_PATTERN)) {
    if (match[2] === 'm') style = applySgr(style, match[1] ?? '')
  }
  return style
}

/**
 * Découpe une sortie de terminal en segments colorés : couleurs SGR de base et vives, gras, atténué ;
 * les autres séquences d'échappement (curseur, effacement…) sont retirées. `initial` : style en
 * vigueur au début de `input` (morceau d'une sortie plus longue).
 */
export function parseAnsi(input: string, initial: AnsiStyle = {}): AnsiSegment[] {
  const segments: AnsiSegment[] = []
  let style: AnsiStyle = initial
  let last = 0
  for (const match of input.matchAll(ANSI_PATTERN)) {
    if (match.index > last) segments.push({ text: input.slice(last, match.index), ...style })
    last = match.index + match[0].length
    if (match[2] === 'm') style = applySgr(style, match[1] ?? '')
  }
  if (last < input.length) segments.push({ text: input.slice(last), ...style })
  // Fusionne les segments voisins de même style et retire les attributs vides.
  const merged: AnsiSegment[] = []
  for (const segment of segments) {
    const clean: AnsiSegment = { text: segment.text }
    if (segment.color) clean.color = segment.color
    if (segment.bold) clean.bold = true
    if (segment.dim) clean.dim = true
    const prev = merged.at(-1)
    if (prev && prev.color === clean.color && prev.bold === clean.bold && prev.dim === clean.dim) {
      prev.text += clean.text
    } else if (clean.text) merged.push(clean)
  }
  return merged
}
