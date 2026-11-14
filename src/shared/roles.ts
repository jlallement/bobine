/**
 * Rôles (fiche 223, ADR-0045) : des spécialistes écrits une fois (expert sécu, tech lead…) et
 * lancés en conversation fille, par l'utilisateur (`@rôle`) ou par l'agent (`start_child`).
 *
 * Un rôle est un fichier Markdown : un en-tête entre `---` (nom, libellé, icône, couleur, quand
 * l'utiliser, et facultatifs : agent, mode, modèle, lecture seule, outils de Bobine), puis la
 * consigne. Ce module lit et vérifie ces fichiers, les range par priorité (projet, puis personnel,
 * puis fournis) et écrit ce qui part à l'agent (en anglais, ADR-0014). Rien ici ne touche au disque.
 */
import type { Language } from './i18n'
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

/**
 * Rôle figé dans une proposition de `start_child` (relecture de la fiche 223) : sa définition au
 * moment de la carte, sa portée et les rôles qu'il remplace (un rôle de projet peut remplacer un
 * rôle fourni ou personnel du même nom : c'est dit).
 */
export interface RoleSnapshot extends RoleDefinition {
  scope: RoleScope
  hides?: RoleScope[]
}

export function roleSnapshot(role: RoleSnapshot): RoleSnapshot {
  const { name, label, icon, color, description, agent, mode, model, readOnly, mcp, prompt } = role
  return {
    name,
    label,
    icon,
    color,
    description,
    ...(agent ? { agent } : {}),
    ...(mode ? { mode } : {}),
    ...(model ? { model } : {}),
    readOnly,
    ...(mcp ? { mcp: [...mcp] } : {}),
    prompt,
    scope: role.scope,
    ...(role.hides?.length ? { hides: [...role.hides] } : {})
  }
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
    // Élément de liste, indenté ou non (`mcp:` puis `- terminal`).
    const item = /^\s*-\s*(.*)$/.exec(line)
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
  if (label.length > ROLE_LIMITS.label || /[\r\n]/.test(label)) return fail('label', 'label')
  const icon = typeof fields.icon === 'string' && fields.icon.trim() ? fields.icon.trim() : 'bot'
  if (!ICON_NAME.test(icon) || icon.length > ROLE_LIMITS.label) return fail('icon', 'icon')
  const color = fields.color === undefined || fields.color === '' ? 'graphite' : fields.color
  if (!ACCENT_COLORS.includes(color as AccentColor)) return fail('color', 'color')
  const description = typeof fields.description === 'string' ? fields.description.trim() : ''
  if (!description || description.length > ROLE_LIMITS.description || /[\r\n]/.test(description)) {
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
  const match = /^---[ \t]*\n([\s\S]*?)\n---[ \t]*(?:\n|$)([\s\S]*)$/.exec(normalized)
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

/**
 * Rôles donnés à l'agent de la mère (relecture de la fiche 223) : au plus `ROLES_FOR_AGENT`, les
 * fournis et personnels d'abord (un dépôt ne peut pas en pousser cent dans le contexte), puis
 * ceux du projet ; un rôle non cité reste utilisable par son nom.
 */
export const ROLES_FOR_AGENT = 20
const DESCRIPTION_FOR_AGENT = 200
const AGENT_ORDER: readonly RoleScope[] = ['builtin', 'user', 'project']

export function rolesForAgent<T extends RoleDefinition & { scope?: RoleScope }>(
  roles: readonly T[]
): { shown: T[]; more: number } {
  const rank = (role: T) => AGENT_ORDER.indexOf(role.scope ?? 'project')
  const sorted = [...roles].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
  return {
    shown: sorted.slice(0, ROLES_FOR_AGENT),
    more: Math.max(0, roles.length - ROLES_FOR_AGENT)
  }
}

const clipDescription = (text: string) =>
  text.length > DESCRIPTION_FOR_AGENT ? `${text.slice(0, DESCRIPTION_FOR_AGENT - 1)}…` : text

/** Une ligne par rôle, pour l'agent de la mère (description de `start_child`, contexte), bornée. */
export function roleLines(roles: readonly (RoleDefinition & { scope?: RoleScope })[]): string[] {
  const { shown, more } = rolesForAgent(roles)
  return [
    ...shown.map(
      (role) =>
        `- ${role.name}: ${clipDescription(role.description)}${role.readOnly ? ' (read-only)' : ''}`
    ),
    ...(more ? [`- and ${more} more role(s), usable by name.`] : [])
  ]
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

/** Dernière ligne de la consigne : la fille répond dans la langue de la demande (texte pour l'agent). */
export const ROLE_LANGUAGE_LINE = "Reply in the language of the user's request."

/** Nom anglais des langues de l'interface, pour la ligne envoyée à l'agent (ADR-0014). */
const LANGUAGE_NAMES: Record<Language, string> = { fr: 'French', en: 'English' }

/**
 * Langue de la réponse, nommée quand on connaît celle de l'interface : Bob 2.1.0 ignorait la ligne
 * générique et répondait en anglais à une demande en français (essai réel, fiche 223). Le texte
 * reste en anglais (ADR-0014), seule la langue y est nommée.
 */
export function roleLanguageLine(language?: Language): string {
  return language
    ? `Reply in ${LANGUAGE_NAMES[language]}, the language of the user's request.`
    : ROLE_LANGUAGE_LINE
}

/**
 * Premier message d'une fille lancée avec un rôle : la demande de l'utilisateur **en tête** (un
 * agent qui titre sa tâche d'après le début du message, Bob, garde la demande : fiche 125, D18),
 * puis le bloc `<bobine_role>` : la consigne du rôle, **toujours**, même quand l'agent a pris le mode
 * natif du rôle (un mode du même nom n'a pas forcément la même consigne ; le doublon avec un mode
 * personnel de Bob est accepté), la lecture seule dite, et la langue de la réponse.
 */
export function roleOpening(
  role: RoleDefinition,
  task: string,
  options: { readOnly?: ReadOnlyLevel; language?: Language } = {}
): string {
  return [
    task.trim(),
    '',
    `<bobine_role name="${role.name}">`,
    role.prompt.trim(),
    ...(options.readOnly ? [READ_ONLY_LINES[options.readOnly]] : []),
    roleLanguageLine(options.language),
    '</bobine_role>'
  ].join('\n')
}

/**
 * Premier message d'une fille vu dans son fil : la demande, et la consigne du rôle à part (repliée
 * à l'affichage). Le bloc peut être en tête (fils d'avant la relecture) ou après la demande.
 */
export function splitRoleBrief(text: string): { request: string; brief?: string } {
  const block = /<bobine_role(?: [^>]*)?>\n?([\s\S]*?)\n?<\/bobine_role>/.exec(text)
  if (!block) return { request: text }
  const request = (text.slice(0, block.index) + text.slice(block.index + block[0].length)).trim()
  return { request, brief: (block[1] ?? '').trim() }
}

/**
 * Rôle retenu relu sur le disque (index des conversations) ; `undefined` s'il est mal formé. Une
 * fille en lecture seule le reste même si son badge est abîmé (relecture de la fiche 223) : badge
 * de repli, et aucune famille d'outils si la liste est illisible.
 */
export function parseRoleStamp(raw: unknown): RoleStamp | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const { name, label, icon, color, readOnly, mcp } = raw as Record<string, unknown>
  const known = ROLE_TOOL_FAMILIES as readonly string[]
  const validName = typeof name === 'string' && ROLE_NAME.test(name) ? name : undefined
  const validLabel =
    typeof label === 'string' && label && label.length <= ROLE_LIMITS.label ? label : undefined
  const validIcon = typeof icon === 'string' && ICON_NAME.test(icon) ? icon : undefined
  const validColor = ACCENT_COLORS.includes(color as AccentColor)
    ? (color as AccentColor)
    : undefined
  const validMcp =
    mcp === undefined || (Array.isArray(mcp) && mcp.every((id) => known.includes(id as string)))
  if (readOnly === true) {
    const fallbackName = validName ?? 'role'
    return {
      name: fallbackName,
      label: validLabel ?? fallbackName,
      icon: validIcon ?? 'bot',
      color: validColor ?? 'graphite',
      readOnly: true,
      ...(validMcp ? (Array.isArray(mcp) ? { mcp: mcp as string[] } : {}) : { mcp: [] })
    }
  }
  if (!validName || !validLabel || !validIcon || !validColor || !validMcp) return undefined
  return {
    name: validName,
    label: validLabel,
    icon: validIcon,
    color: validColor,
    ...(Array.isArray(mcp) ? { mcp: mcp as string[] } : {})
  }
}
