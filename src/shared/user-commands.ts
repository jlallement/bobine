/**
 * Commandes « / » personnelles (fiche 045) : celles de l'utilisateur (réglages, tous les dossiers)
 * et celles du projet (`.bobine/commands/*.md`). Une commande est une consigne envoyée à
 * l'agent, où `$ARGUMENTS` est remplacé par ce qui suit le nom.
 */
import type { AgentCommand } from './agent'

export type UserCommandScope = 'global' | 'project'

export interface UserCommand {
  /** Nom tapé après « / » : lettres, chiffres, tirets. */
  name: string
  description: string
  /** Argument attendu, affiché dans le menu (ex. `<fichier>`). */
  hint?: string
  /** Consigne envoyée à l'agent ; `$ARGUMENTS` y est remplacé. */
  prompt: string
  scope: UserCommandScope
  /** Commande du projet : fichier d'origine. */
  file?: string
}

/** Dossier des commandes d'un projet, relatif au dossier de la conversation. */
export const PROJECT_COMMANDS_DIR = '.bobine/commands'
/** Dossier d'avant le nom « Bobine » (fiche 069), encore lu ; une commande de `.bobine` l'emporte. */
export const LEGACY_PROJECT_COMMANDS_DIR = '.bob-desktop/commands'
export const USER_COMMAND_NAME = /^[a-z0-9][a-z0-9_-]{0,39}$/
export const ARGUMENTS_PLACEHOLDER = '$ARGUMENTS'
const MAX_COMMANDS = 200
const MAX_PROMPT = 20_000

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

/** Commandes valides d'une liste venue du disque ou du renderer ; le reste est ignoré. */
export function parseUserCommands(raw: unknown, scope: UserCommandScope = 'global'): UserCommand[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const commands: UserCommand[] = []
  for (const item of raw.slice(0, MAX_COMMANDS)) {
    const obj = typeof item === 'object' && item !== null ? (item as Record<string, unknown>) : {}
    const name = str(obj['name'], 40).toLowerCase()
    const prompt = str(obj['prompt'], MAX_PROMPT)
    if (!USER_COMMAND_NAME.test(name) || !prompt || seen.has(name)) continue
    seen.add(name)
    const hint = str(obj['hint'], 80)
    commands.push({
      name,
      description: str(obj['description'], 200),
      ...(hint ? { hint } : {}),
      prompt,
      scope
    })
  }
  return commands
}

/**
 * Fichier d'une commande du projet : en-tête facultatif entre `---` (`description:`, `hint:`),
 * puis la consigne. Sans en-tête, une première ligne « # Titre » sert de description.
 */
export function parseCommandFile(text: string): {
  description: string
  hint?: string
  prompt: string
} {
  let body = text.replace(/\r\n/g, '\n')
  let description = ''
  let hint = ''
  const front = /^---\n([\s\S]*?)\n---\n?/.exec(body)
  if (front?.[1] !== undefined) {
    for (const line of front[1].split('\n')) {
      const match = /^(description|hint)\s*:\s*(.*)$/i.exec(line)
      if (!match) continue
      const value = (match[2] ?? '').trim().replace(/^["']|["']$/g, '')
      if (match[1]?.toLowerCase() === 'description') description = value
      else hint = value
    }
    body = body.slice(front[0].length)
  } else {
    const title = /^#\s+(.+)\n?/.exec(body)
    if (title?.[1]) {
      description = title[1].trim()
      body = body.slice(title[0].length)
    }
  }
  const prompt = body.trim()
  return {
    description: description.slice(0, 200) || prompt.split('\n')[0]?.slice(0, 80) || '',
    ...(hint ? { hint: hint.slice(0, 80) } : {}),
    prompt
  }
}

/** Consigne à envoyer : `$ARGUMENTS` remplacé, ou l'argument ajouté à la fin s'il n'y en a pas. */
export function expandCommand(prompt: string, args: string): string {
  const trimmed = args.trim()
  if (prompt.includes(ARGUMENTS_PLACEHOLDER))
    return prompt.split(ARGUMENTS_PLACEHOLDER).join(trimmed)
  return trimmed ? `${prompt}\n\n${trimmed}` : prompt
}

/** Commandes personnelles pour le menu : celles du projet d'abord, puis les autres non masquées. */
export function toAgentCommands(commands: readonly UserCommand[]): AgentCommand[] {
  const sorted = [...commands].sort((a, b) =>
    a.scope === b.scope ? a.name.localeCompare(b.name) : a.scope === 'project' ? -1 : 1
  )
  const names = new Set<string>()
  const result: AgentCommand[] = []
  for (const command of sorted) {
    if (names.has(command.name)) continue
    names.add(command.name)
    result.push({
      name: command.name,
      description: command.description || command.prompt.split('\n')[0]?.slice(0, 80) || '',
      ...(command.hint ? { hint: command.hint } : {}),
      source: command.scope === 'project' ? 'project' : 'user'
    })
  }
  return result
}

/**
 * Commande personnelle tapée dans la zone de saisie (`/nom arguments`), si l'agent n'a pas une
 * commande du même nom ; celle du projet l'emporte sur celle des réglages.
 */
export function userCommandOf(
  text: string,
  commands: readonly UserCommand[],
  agent: readonly AgentCommand[]
): { command: UserCommand; args: string } | undefined {
  const match = /^\/(\S+)(?:\s+([\s\S]*))?$/.exec(text.trim())
  if (!match) return undefined
  const name = (match[1] ?? '').toLowerCase()
  if (agent.some((c) => c.name === name)) return undefined
  const command =
    commands.find((c) => c.name === name && c.scope === 'project') ??
    commands.find((c) => c.name === name)
  return command ? { command, args: (match[2] ?? '').trim() } : undefined
}
