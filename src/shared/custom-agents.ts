/**
 * Agents ACP déclarés par l'utilisateur (fiche 141) : nom, commande et arguments, variables
 * d'environnement, et deux champs facultatifs (variable de la clé d'API, commande de compaction).
 * Que des données : le profil bâti côté main n'a ni format ni source (fiche 140), tout le reste
 * vient d'ACP. Partagé par le formulaire (vérification en direct) et le main (vérification de ce
 * que le renderer envoie, lecture de `settings.json`).
 */

/** Un agent déclaré, tel qu'enregistré dans `settings.json` (`customAgents`). */
export interface CustomAgent {
  /** `custom-<nom>` : jamais `mock*` ni l'identifiant d'un autre profil ; stable si on renomme. */
  id: string
  label: string
  command: string
  args: string[]
  env: Record<string, string>
  /** Variable où l'app pose la clé d'API saisie sur la page de l'agent (trousseau, fiche 022). */
  apiKeyEnv?: string
  /** Message qui fait compacter la conversation, si l'agent ne l'annonce pas (fiche 039). */
  compactCommand?: string
}

/** Le formulaire, tel que tapé. */
export interface CustomAgentDraft {
  label: string
  /** Commande et arguments, comme dans un terminal. */
  commandLine: string
  /** Une variable par ligne, `NOM=valeur`. */
  envText: string
  apiKeyEnv: string
  compactCommand: string
}

/** Erreur d'un champ du formulaire : clé de traduction et paramètres. */
export interface CustomAgentProblem {
  field: keyof CustomAgentDraft
  key: `customAgents.problem.${
    | 'labelMissing'
    | 'labelLong'
    | 'commandMissing'
    | 'quote'
    | 'commandLong'
    | 'envLine'
    | 'envMany'
    | 'apiKeyName'
    | 'apiKeyInEnv'
    | 'compact'}`
  params?: Record<string, string | number>
}

export const CUSTOM_AGENT_PREFIX = 'custom-'
const CUSTOM_ID = /^custom-[a-z0-9-]{1,40}$/
export const ENV_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/
const COMPACT_COMMAND = /^\/\S{1,39}$/
const MAX_AGENTS = 20
const MAX_LABEL = 60
const MAX_COMMAND = 1024
const MAX_ARGS = 100
const MAX_ENV = 50

export const EMPTY_DRAFT: CustomAgentDraft = {
  label: '',
  commandLine: '',
  envText: '',
  apiKeyEnv: '',
  compactCommand: ''
}

/**
 * Découpe une ligne de commande comme un shell, sans rien évaluer : espaces entre les mots,
 * guillemets simples (texte tel quel), doubles (`\"` et `\\` échappés), `\` hors guillemets.
 * `undefined` si un guillemet n'est pas refermé.
 */
export function splitCommandLine(line: string): string[] | undefined {
  const words: string[] = []
  let word: string | undefined
  let quote: '"' | "'" | undefined
  for (let i = 0; i < line.length; i++) {
    const c = line.charAt(i)
    if (quote === "'") {
      if (c === "'") quote = undefined
      else word += c
    } else if (quote === '"') {
      if (c === '"') quote = undefined
      else if (c === '\\' && (line[i + 1] === '"' || line[i + 1] === '\\')) word += line.charAt(++i)
      else word += c
    } else if (/\s/.test(c)) {
      if (word !== undefined) words.push(word)
      word = undefined
    } else if (c === '"' || c === "'") {
      quote = c
      word ??= ''
    } else if (c === '\\' && i + 1 < line.length) {
      word = (word ?? '') + line.charAt(++i)
    } else {
      word = (word ?? '') + c
    }
  }
  if (quote) return undefined
  if (word !== undefined) words.push(word)
  return words
}

/** Ligne de commande qui redonne ces mots par `splitCommandLine` (guillemets doubles au besoin). */
export function joinCommandLine(words: readonly string[]): string {
  return words
    .map((w) => (/^[\w@%+=:,./~-]+$/.test(w) ? w : `"${w.replace(/(["\\])/g, '\\$1')}"`))
    .join(' ')
}

/**
 * Variables d'une zone de texte au format `.env` : `NOM=valeur` par ligne (`export ` toléré,
 * guillemets autour de la valeur retirés), lignes vides et `#` ignorées. Rend aussi la première
 * ligne mal formée (numéro à partir de 1).
 */
export function parseEnvLines(text: string): {
  env: Record<string, string>
  bad?: { line: number; text: string }
} {
  const env: Record<string, string> = {}
  const lines = text.split(/\r?\n/)
  for (const [index, raw] of lines.entries()) {
    const line = raw.trim().replace(/^export\s+/, '')
    if (!line || line.startsWith('#')) continue
    const at = line.indexOf('=')
    const name = at > 0 ? line.slice(0, at).trim() : ''
    if (!ENV_NAME.test(name)) return { env, bad: { line: index + 1, text: raw.trim() } }
    const value = line.slice(at + 1).trim()
    const quoted = /^(["'])(.*)\1$/.exec(value)
    env[name] = quoted ? (quoted[2] ?? '') : value
  }
  return { env }
}

export function formatEnvLines(env: Record<string, string>): string {
  return Object.entries(env)
    .map(([name, value]) => `${name}=${value}`)
    .join('\n')
}

/** Formulaire venu du renderer : chaque champ en texte (absent ou mal formé : vide). */
export function draftFrom(raw: unknown): CustomAgentDraft {
  const obj = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
  const field = (key: keyof CustomAgentDraft) =>
    typeof obj[key] === 'string' ? (obj[key] as string).slice(0, 20_000) : ''
  return {
    label: field('label'),
    commandLine: field('commandLine'),
    envText: field('envText'),
    apiKeyEnv: field('apiKeyEnv'),
    compactCommand: field('compactCommand')
  }
}

/** Erreurs du formulaire, champ par champ ; vide : il peut être enregistré. */
export function draftProblems(draft: CustomAgentDraft): CustomAgentProblem[] {
  const problems: CustomAgentProblem[] = []
  const label = draft.label.trim()
  if (!label) problems.push({ field: 'label', key: 'customAgents.problem.labelMissing' })
  else if (label.length > MAX_LABEL)
    problems.push({
      field: 'label',
      key: 'customAgents.problem.labelLong',
      params: { max: MAX_LABEL }
    })
  const words = splitCommandLine(draft.commandLine)
  if (!words) problems.push({ field: 'commandLine', key: 'customAgents.problem.quote' })
  else if (!words[0])
    problems.push({ field: 'commandLine', key: 'customAgents.problem.commandMissing' })
  else if (draft.commandLine.length > MAX_COMMAND || words.length > MAX_ARGS + 1)
    problems.push({ field: 'commandLine', key: 'customAgents.problem.commandLong' })
  const { env, bad } = parseEnvLines(draft.envText)
  if (bad) problems.push({ field: 'envText', key: 'customAgents.problem.envLine', params: bad })
  else if (Object.keys(env).length > MAX_ENV)
    problems.push({
      field: 'envText',
      key: 'customAgents.problem.envMany',
      params: { max: MAX_ENV }
    })
  const apiKeyEnv = draft.apiKeyEnv.trim()
  if (apiKeyEnv && !ENV_NAME.test(apiKeyEnv))
    problems.push({ field: 'apiKeyEnv', key: 'customAgents.problem.apiKeyName' })
  else if (apiKeyEnv && apiKeyEnv in env)
    problems.push({
      field: 'apiKeyEnv',
      key: 'customAgents.problem.apiKeyInEnv',
      params: { name: apiKeyEnv }
    })
  const compact = draft.compactCommand.trim()
  if (compact && !COMPACT_COMMAND.test(compact))
    problems.push({ field: 'compactCommand', key: 'customAgents.problem.compact' })
  return problems
}

/** L'agent d'un formulaire sans erreur (`draftProblems` vide). */
export function agentFromDraft(draft: CustomAgentDraft, id: string): CustomAgent {
  const [command = '', ...args] = splitCommandLine(draft.commandLine) ?? []
  const apiKeyEnv = draft.apiKeyEnv.trim()
  const compactCommand = draft.compactCommand.trim()
  return {
    id,
    label: draft.label.trim(),
    command,
    args,
    env: parseEnvLines(draft.envText).env,
    ...(apiKeyEnv ? { apiKeyEnv } : {}),
    ...(compactCommand ? { compactCommand } : {})
  }
}

/** Le formulaire d'un agent déclaré, pour le modifier. */
export function draftOf(agent: CustomAgent): CustomAgentDraft {
  return {
    label: agent.label,
    commandLine: joinCommandLine([agent.command, ...agent.args]),
    envText: formatEnvLines(agent.env),
    apiKeyEnv: agent.apiKeyEnv ?? '',
    compactCommand: agent.compactCommand ?? ''
  }
}

/** `custom-<nom>` (lettres sans accents, chiffres, tirets), suffixé s'il est déjà pris. */
export function newCustomAgentId(label: string, taken: readonly string[]): string {
  const slug =
    label
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 30)
      .replace(/-+$/, '') || 'agent'
  const base = `${CUSTOM_AGENT_PREFIX}${slug}`
  let id = base
  for (let n = 2; taken.includes(id); n++) id = `${base}-${n}`
  return id
}

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

/** Agents valides d'une liste venue de `settings.json` ; le reste est ignoré. */
export function parseCustomAgents(raw: unknown): CustomAgent[] {
  if (!Array.isArray(raw)) return []
  const agents: CustomAgent[] = []
  for (const item of raw.slice(0, MAX_AGENTS)) {
    const obj = typeof item === 'object' && item !== null ? (item as Record<string, unknown>) : {}
    const id = text(obj['id'], 60)
    const label = text(obj['label'], MAX_LABEL)
    const command = text(obj['command'], MAX_COMMAND)
    if (!CUSTOM_ID.test(id) || !label || !command || agents.some((a) => a.id === id)) continue
    const args = Array.isArray(obj['args'])
      ? obj['args'].filter((a): a is string => typeof a === 'string').slice(0, MAX_ARGS)
      : []
    const rawEnv = typeof obj['env'] === 'object' && obj['env'] !== null ? obj['env'] : {}
    const env = Object.fromEntries(
      Object.entries(rawEnv)
        .filter((e): e is [string, string] => ENV_NAME.test(e[0]) && typeof e[1] === 'string')
        .slice(0, MAX_ENV)
    )
    const apiKeyEnv = text(obj['apiKeyEnv'], 100)
    const compactCommand = text(obj['compactCommand'], 40)
    agents.push({
      id,
      label,
      command,
      args,
      env,
      ...(ENV_NAME.test(apiKeyEnv) ? { apiKeyEnv } : {}),
      ...(COMPACT_COMMAND.test(compactCommand) ? { compactCommand } : {})
    })
  }
  return agents
}
