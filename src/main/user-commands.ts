/**
 * Commandes du projet (fiche 045) : un fichier Markdown par commande dans
 * `<dossier>/.bobine/commands/`, relu à la demande (changement de conversation, fin de tour).
 * L'ancien dossier `.bob-desktop/commands/` (fiche 069) est encore lu.
 */
import { readdir, readFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import {
  LEGACY_PROJECT_COMMANDS_DIR,
  parseCommandFile,
  PROJECT_COMMANDS_DIR,
  USER_COMMAND_NAME,
  type UserCommand
} from '@shared/user-commands'

const MAX_FILES = 100
const MAX_FILE_BYTES = 64 * 1024

/** Commandes du dossier, par nom ; dossier absent ou illisible : aucune. */
export async function projectCommands(workspace: string): Promise<UserCommand[]> {
  const current = await commandsIn(join(workspace, PROJECT_COMMANDS_DIR))
  const legacy = await commandsIn(join(workspace, LEGACY_PROJECT_COMMANDS_DIR))
  const names = new Set(current.map((c) => c.name))
  return [...current, ...legacy.filter((c) => !names.has(c.name))].sort((a, b) =>
    a.name.localeCompare(b.name)
  )
}

async function commandsIn(dir: string): Promise<UserCommand[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
  const files = entries
    .filter((e) => e.isFile() && e.name.endsWith('.md'))
    .map((e) => e.name)
    .sort()
    .slice(0, MAX_FILES)
  const commands: UserCommand[] = []
  for (const file of files) {
    const name = basename(file, '.md').toLowerCase()
    if (!USER_COMMAND_NAME.test(name)) continue
    const path = join(dir, file)
    const text = await readFile(path, 'utf8').catch(() => null)
    if (text === null || text.length > MAX_FILE_BYTES) continue
    const parsed = parseCommandFile(text)
    if (!parsed.prompt) continue
    commands.push({ name, ...parsed, scope: 'project', file: path })
  }
  return commands
}
