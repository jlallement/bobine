/**
 * Rôles (fiche 223, ADR-0045) : des spécialistes écrits une fois (expert sécu, tech lead…) et
 * lancés en conversation fille, par l'utilisateur (`@rôle`) ou par l'agent (`start_child`).
 *
 * Un rôle est un fichier Markdown : un en-tête entre `---` (nom, libellé, icône, couleur, quand
 * l'utiliser, et facultatifs : agent, mode, modèle, lecture seule, outils de Bobine), puis la
 * consigne. Ce module lit et vérifie ces fichiers, les range par priorité (projet, puis personnel,
 * puis fournis) et écrit ce qui part à l'agent (en anglais, ADR-0014). Rien ici ne touche au disque.
 */
import { ACCENT_COLORS, type AccentColor } from './preferences'

/** D'où vient un rôle : fourni par Bobine, personnel (tous les projets), ou du projet. */
export type RoleScope = 'builtin' | 'user' | 'project'
/** Portées écrites sur le disque. */
export type RoleFileScope = Exclude<RoleScope, 'builtin'>

/** Dossier des rôles d'un projet, relatif au dossier de la conversation (mère). */
export const PROJECT_ROLES_DIR = '.bobine/roles'
export const ROLE_NAME = /^[a-z0-9][a-z0-9-]{0,39}$/
const ICON_NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/
export const ROLE_LIMITS = {
  label: 40,
  description: 300,
  value: 120,
  prompt: 20_000,
  fileBytes: 64 * 1024,
  files: 100
} as const

/**
 * Familles d'outils de Bobine qu'un rôle peut choisir (`mcp`) : sans `mcp`, la fille reçoit
 * toutes celles de la conversation ; avec, seulement celles-là. Les questions (`ask-user`) et le
 * lien avec la mère (`children`) restent toujours.
 */
export const ROLE_TOOL_FAMILIES = [
  'terminal',
  'browser',
  'preview',
  'ios-simulator',
  'android-emulator',
  'memory'
] as const
export const ROLE_KEPT_FAMILIES: readonly string[] = ['ask-user', 'children']

export interface RoleDefinition {
  /** Identifiant tapé après `@` : minuscules, chiffres, tirets. */
  name: string
  /** Nom affiché. */
  label: string
  /** Icône Lucide (`shield-check`) ; l'interface prend une icône par défaut si elle ne la connaît pas. */
  icon: string
  /** Une des couleurs d'accent de l'app (décision 8 de la fiche 223). */
  color: AccentColor
  /** Quand l'utiliser : lu par l'agent de la mère pour choisir. */
  description: string
  /** Agent de la fille (identifiant de profil) ; absent : celui de la mère. */
  agent?: string
  /** Mode natif de l'agent (valeur ou nom), utilisé s'il l'a. */
  mode?: string
  /** Modèle, pour un profil qui permet de le choisir (fiche 160). */
  model?: string
  /** Lecture seule : même dossier que la mère, sans worktree ; écritures refusées et surveillées. */
  readOnly: boolean
  /** Familles d'outils de Bobine données à la fille ; absent : toutes. */
  mcp?: string[]
  /** Consigne du rôle (corps du fichier). */
  prompt: string
}

export interface Role extends RoleDefinition {
  scope: RoleScope
  /** Fichier d'origine (rôle personnel ou du projet). */
  file?: string
}

/** Un rôle dans la liste des réglages : actif ou non, et les rôles de même nom qu'il cache. */
export interface RoleView extends Role {
  enabled: boolean
  /** Portées dont un rôle du même nom est caché par celui-ci (projet > personnel > fourni). */
  hides?: RoleScope[]
}

export type RoleErrorCode =
  | 'noHeader'
  | 'syntax'
  | 'unknownField'
  | 'duplicateField'
  | 'name'
  | 'label'
  | 'icon'
  | 'color'
  | 'description'
  | 'value'
  | 'readOnly'
  | 'mcp'
  | 'prompt'
  | 'tooLarge'
  | 'duplicateName'
  | 'unreadable'
  | 'link'
  | 'tooMany'

/** Pourquoi un fichier de rôle est écarté : la clé `roles.error.<code>` le dit à l'utilisateur. */
export interface RoleError {
  code: RoleErrorCode
  /** Champ ou ligne concernés, quand on les connaît. */
  field?: string
  line?: number
}

/** Fichier de rôle écarté (signalé, sans bloquer les autres). */
export interface RoleProblem {
  scope: RoleFileScope
  file: string
  error: RoleError
}

export interface RolesListing {
  roles: RoleView[]
  problems: RoleProblem[]
}

/** Ce qu'il faut d'un rôle pour l'afficher (carte de la fille, « Sous-tâches », barre latérale). */
export interface RoleBadge {
  name: string
  label: string
  icon: string
  color: AccentColor
  readOnly?: true
}

/** Rôle retenu dans l'enregistrement d'une fille à son lancement (un fichier changé ensuite n'y touche pas). */
export interface RoleStamp extends RoleBadge {
  mcp?: string[]
}

export type RoleParse = { ok: true; role: RoleDefinition } | { ok: false; error: RoleError }

const FIELDS = [
  'name',
  'label',
  'icon',
  'color',
  'description',
  'agent',
  'mode',
  'model',
  'read-only',
  'mcp'
] as const
type Field = (typeof FIELDS)[number]
type Header = Partial<Record<Field, string | string[]>>

const isField = (key: string): key is Field => (FIELDS as readonly string[]).includes(key)

/** Valeur d'une ligne d'en-tête : guillemets retirés, commentaire de fin (` # …`) ôté hors guillemets. */
function scalar(raw: string): string {
  const value = raw.trim()
  const quoted = /^(["'])(.*)\1$/.exec(value)
  if (quoted?.[1] === '"') {
    try {
      return String(JSON.parse(value))
    } catch {
      return quoted[2] ?? ''
    }
  }
  if (quoted) return quoted[2] ?? ''
  return value.replace(/\s+#.*$/, '').trim()
}

/** Liste en ligne `[a, b]`. */
function inlineList(raw: string): string[] | undefined {
  const match = /^\[(.*)\]$/.exec(scalar(raw))
  if (!match) return undefined
  return (match[1] ?? '')
    .split(',')
    .map((item) => scalar(item))
    .filter(Boolean)
}

/**
 * En-tête : `clé: valeur`, listes en ligne (`[a, b]`) ou en tirets (`- a` sous la clé),
 * commentaires `#`. Sous-ensemble de YAML : assez pour ces fichiers, sans dépendance.
 */
function parseHeader(lines: string[], offset: number): Header | RoleError {
  const header: Header = {}
  let list: string[] | undefined
  for (const [i, line] of lines.entries()) {
    const at = i + offset
    if (!line.trim() || line.trimStart().startsWith('#')) continue
    const item = /^\s+-\s*(.*)$/.exec(line)
    if (item) {
      if (!list) return { code: 'syntax', line: at }
      const value = scalar(item[1] ?? '')
      if (value) list.push(value)
      continue
    }
    list = undefined
    const match = /^([A-Za-z][\w-]*)\s*:\s*(.*)$/.exec(line)
    if (!match) return { code: 'syntax', line: at }
    const key = (match[1] ?? '').toLowerCase()
    if (!isField(key)) return { code: 'unknownField', field: key, line: at }
    if (key in header) return { code: 'duplicateField', field: key, line: at }
    const raw = match[2] ?? ''
    if (!scalar(raw)) {
      list = []
      header[key] = list
      continue
    }
    header[key] = inlineList(raw) ?? scalar(raw)
  }
  return header
}

const text = (value: string | string[] | undefined): string | undefined =>
  typeof value === 'string' ? value.trim() || undefined : undefined

/** Rôle vérifié depuis des champs déjà lus (fichier ou formulaire des réglages). */
export function checkRole(fields: {
  name: unknown
  label?: unknown
  icon?: unknown
  color?: unknown
  description: unknown
  agent?: unknown
  mode?: unknown
  model?: unknown
  readOnly?: unknown
  mcp?: unknown
  prompt: unknown
}): RoleParse {
  const fail = (code: RoleErrorCode, field?: string): RoleParse => ({
    ok: false,
    error: { code, ...(field ? { field } : {}) }
  })
  const name = typeof fields.name === 'string' ? fields.name.trim() : ''
  if (!ROLE_NAME.test(name)) return fail('name', 'name')
  const label = typeof fields.label === 'string' && fields.label.trim() ? fields.label.trim() : name
  if (label.length > ROLE_LIMITS.label) return fail('label', 'label')
  const icon = typeof fields.icon === 'string' && fields.icon.trim() ? fields.icon.trim() : 'bot'
  if (!ICON_NAME.test(icon) || icon.length > ROLE_LIMITS.label) return fail('icon', 'icon')
  const color = fields.color === undefined || fields.color === '' ? 'graphite' : fields.color
  if (!ACCENT_COLORS.includes(color as AccentColor)) return fail('color', 'color')
  const description = typeof fields.description === 'string' ? fields.description.trim() : ''
  if (!description || description.length > ROLE_LIMITS.description) {
    return fail('description', 'description')
  }
  const optional: Partial<Pick<RoleDefinition, 'agent' | 'mode' | 'model'>> = {}
  for (const key of ['agent', 'mode', 'model'] as const) {
    const value = fields[key]
    if (value === undefined || value === '') continue
    if (typeof value !== 'string' || value.trim().length > ROLE_LIMITS.value || /\n/.test(value)) {
      return fail('value', key)
    }
    if (value.trim()) optional[key] = value.trim()
  }
  const readOnly = fields.readOnly ?? false
  if (typeof readOnly !== 'boolean') return fail('readOnly', 'read-only')
  let mcp: string[] | undefined
  if (fields.mcp !== undefined) {
    if (!Array.isArray(fields.mcp)) return fail('mcp', 'mcp')
    const known = ROLE_TOOL_FAMILIES as readonly string[]
    const ids = fields.mcp.map((id) => (typeof id === 'string' ? id.trim() : ''))
    const unknown = ids.find((id) => !known.includes(id))
    if (unknown !== undefined) return fail('mcp', unknown || 'mcp')
    mcp = [...new Set(ids)]
  }
  const prompt = typeof fields.prompt === 'string' ? fields.prompt.trim() : ''
  if (!prompt || prompt.length > ROLE_LIMITS.prompt) return fail('prompt')
  return {
    ok: true,
    role: {
      name,
      label,
      icon,
      color: color as AccentColor,
      description,
      ...optional,
      readOnly,
      ...(mcp ? { mcp } : {}),
      prompt
    }
  }
}

const BOOLEANS: Record<string, boolean> = { true: true, yes: true, false: false, no: false }

/**
 * Fichier d'un rôle. `fallbackName` : le nom du fichier sans `.md`, pris quand l'en-tête n'a pas
 * de `name`. Une erreur dit le champ et la ligne (comptée depuis 1).
 */
export function parseRoleFile(content: string, fallbackName: string): RoleParse {
  const normalized = content.replace(/^﻿/, '').replace(/\r\n?/g, '\n')
  const match = /^---\n([\s\S]*?)\n---(?:\n|$)([\s\S]*)$/.exec(normalized)
  if (!match) return { ok: false, error: { code: 'noHeader' } }
  const header = parseHeader((match[1] ?? '').split('\n'), 2)
  if ('code' in header) return { ok: false, error: header as RoleError }
  const flag = header['read-only']
  let readOnly: unknown = flag
  if (typeof flag === 'string') readOnly = BOOLEANS[flag.toLowerCase()] ?? flag
  const mcp = header.mcp
  return checkRole({
    name: text(header.name) ?? fallbackName,
    label: text(header.label),
    icon: text(header.icon),
    color: text(header.color),
    description: text(header.description) ?? '',
    agent: text(header.agent),
    mode: text(header.mode),
    model: text(header.model),
    readOnly,
    mcp: typeof mcp === 'string' ? [mcp] : mcp,
    prompt: match[2] ?? ''
  })
}

/** Valeur d'en-tête écrite entre guillemets si elle pourrait être mal relue. */
function headerValue(value: string): string {
  return /^[\p{L}\p{N}_ ./+()’',-]*$/u.test(value) &&
    !/^['"[]/.test(value) &&
    !/^\s|\s$/.test(value) &&
    value !== ''
    ? value
    : JSON.stringify(value)
}

/** Fichier Markdown d'un rôle : relu à l'identique par `parseRoleFile`. */
export function serializeRole(role: RoleDefinition): string {
  const lines = [
    `name: ${role.name}`,
    `label: ${headerValue(role.label)}`,
    `icon: ${role.icon}`,
    `color: ${role.color}`,
    `description: ${headerValue(role.description)}`,
    ...(role.agent ? [`agent: ${headerValue(role.agent)}`] : []),
    ...(role.mode ? [`mode: ${headerValue(role.mode)}`] : []),
    ...(role.model ? [`model: ${headerValue(role.model)}`] : []),
    `read-only: ${role.readOnly}`,
    ...(role.mcp ? [`mcp: [${role.mcp.join(', ')}]`] : [])
  ]
  return `---\n${lines.join('\n')}\n---\n\n${role.prompt.trim()}\n`
}

const PRIORITY: readonly RoleScope[] = ['project', 'user', 'builtin']

/**
 * Rôles de toutes les portées, par nom : à nom égal, le projet l'emporte sur le personnel, qui
 * l'emporte sur le fourni (décision 5). `off` : noms désactivés par l'utilisateur.
 */
export function mergeRoles(roles: readonly Role[], off: ReadonlySet<string>): RoleView[] {
  const byName = new Map<string, Role[]>()
  for (const role of roles) byName.set(role.name, [...(byName.get(role.name) ?? []), role])
  return [...byName.entries()]
    .map(([name, same]): RoleView => {
      const sorted = [...same].sort((a, b) => PRIORITY.indexOf(a.scope) - PRIORITY.indexOf(b.scope))
      const [winner, ...hidden] = sorted as [Role, ...Role[]]
      return {
        ...winner,
        enabled: !off.has(name),
        ...(hidden.length ? { hides: hidden.map((r) => r.scope) } : {})
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

export const roleBadge = (role: RoleDefinition): RoleBadge => ({
  name: role.name,
  label: role.label,
  icon: role.icon,
  color: role.color,
  ...(role.readOnly ? { readOnly: true as const } : {})
})

export const roleStamp = (role: RoleDefinition): RoleStamp => ({
  ...roleBadge(role),
  ...(role.mcp ? { mcp: role.mcp } : {})
})

/** Une ligne par rôle, pour l'agent de la mère (description de `start_child`, contexte). */
export function roleLines(roles: readonly RoleDefinition[]): string[] {
  return roles.map(
    (role) => `- ${role.name}: ${role.description}${role.readOnly ? ' (read-only)' : ''}`
  )
}

/** Paragraphe sur les rôles, joint au contexte de session et à la description de `start_child`. */
export function rolesParagraph(roles: readonly RoleDefinition[]): string[] {
  if (roles.length === 0) return []
  return [
    'Roles: specialists the user defined. To hand a piece of work to one, call start_child with',
    '`role` set to its name; its instructions, agent and tools come with it. A read-only role',
    'works in your folder without a worktree and changes nothing: cheap, propose it for reviews.',
    ...roleLines(roles)
  ]
}

/** Rôles nommés `@nom` dans un message de l'utilisateur. */
export function mentionedRoles<T extends RoleDefinition>(text: string, roles: readonly T[]): T[] {
  return roles.filter((role) => new RegExp(`(^|[\\s(])@${role.name}(?![\\w-])`).test(text))
}

/**
 * Lecture seule d'une fille (fiche 223) : `enforced`, l'agent demande avant d'écrire et Bobine
 * refuse ; `requested`, l'agent écrit sans demander (profil `writesWithoutAsking`) et sans mode
 * natif choisi : la lecture seule n'est que demandée, Bobine surveille le dossier et le dit.
 */
export type ReadOnlyLevel = 'enforced' | 'requested'

const READ_ONLY_LINES: Record<ReadOnlyLevel, string> = {
  enforced:
    'You are read-only: you work in the same folder as the conversation that started you, with ' +
    'no worktree. Do not create, edit, delete or move files, do not commit, and do not run ' +
    'commands that write. Bobine refuses your write requests.',
  requested:
    'You are read-only: you work in the same folder as the conversation that started you, with ' +
    'no worktree. Do not create, edit, delete or move files, do not commit, and do not run ' +
    'commands that write. Bobine checks the folder after each of your turns and tells the user ' +
    'about any change.'
}

/**
 * Premier message d'une fille lancée avec un rôle : la consigne du rôle en tête, sauf si l'agent
 * a pris le mode natif du rôle (`native`) ; la lecture seule toujours dite ; puis la tâche.
 */
export function roleOpening(
  role: RoleDefinition,
  task: string,
  options: { native: boolean; readOnly?: ReadOnlyLevel }
): string {
  const inside = [
    ...(options.native ? [] : [role.prompt.trim()]),
    ...(options.readOnly ? [READ_ONLY_LINES[options.readOnly]] : [])
  ]
  if (inside.length === 0) return task.trim()
  return [`<bobine_role name="${role.name}">`, ...inside, '</bobine_role>', '', task.trim()].join(
    '\n'
  )
}

/** Rôle retenu relu sur le disque (index des conversations) ; `undefined` s'il est mal formé. */
export function parseRoleStamp(raw: unknown): RoleStamp | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const r = raw as Record<string, unknown>
  const { name, label, icon, color, readOnly, mcp } = r
  if (typeof name !== 'string' || !ROLE_NAME.test(name)) return undefined
  if (typeof label !== 'string' || !label || label.length > ROLE_LIMITS.label) return undefined
  if (typeof icon !== 'string' || !ICON_NAME.test(icon)) return undefined
  if (!ACCENT_COLORS.includes(color as AccentColor)) return undefined
  const known = ROLE_TOOL_FAMILIES as readonly string[]
  if (mcp !== undefined && !(Array.isArray(mcp) && mcp.every((id) => known.includes(id as string))))
    return undefined
  return {
    name,
    label,
    icon,
    color: color as AccentColor,
    ...(readOnly === true ? { readOnly: true as const } : {}),
    ...(Array.isArray(mcp) ? { mcp: mcp as string[] } : {})
  }
}
