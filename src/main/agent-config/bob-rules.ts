/**
 * Règles de Bob (fiche 056), telles que son profil les déclare (`RulesSource`, fiche 140). Bob
 * 2.0.6 (relevé, voir docs/acp.md) : dans le dossier de la session, sans remonter : `AGENTS.md`, `.bob/rules/**`,
 * `.bob/rules-<mode>/**`, et les mêmes dans `.bob/plugins/<greffon>/` ; puis `~/.bob/rules/**`,
 * `~/.bob/rules-<mode>/**` et leurs greffons. Profondeur 5 au plus ; fichiers système ignorés.
 * Rien si le dossier n'est pas approuvé (Bob refuse alors la session).
 */
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { RuleFileView } from '@shared/rules'
import { t } from 'i18next'
import { isDirectory } from '../is-directory'
import type { RulesSource } from '../agent/adapters'
import { isFile, view, type RulesContext } from './rules'

/** Fichiers que Bob 2.0.6 ne lit pas comme règles. */
const BOB_IGNORED = new Set(['.DS_Store', 'Thumbs.db', '.gitkeep', '.gitignore', '.bobignore'])
const BOB_MAX_DEPTH = 5

/** Fichiers d'un dossier de règles, triés, récursivement (comme `TAt` de Bob). */
async function bobRuleFiles(dir: string, depth = 0): Promise<string[]> {
  if (depth > BOB_MAX_DEPTH) return []
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return []
  }
  const files: string[] = []
  for (const entry of entries
    .filter((e) => !BOB_IGNORED.has(e.name))
    .sort((a, b) => a.name.localeCompare(b.name))) {
    const path = join(dir, entry.name)
    const isDir = entry.isDirectory() || (entry.isSymbolicLink() && isDirectory(path))
    if (isDir) files.push(...(await bobRuleFiles(path, depth + 1)))
    else if (entry.isFile() || isFile(path)) files.push(path)
  }
  return files
}

/** `.bob` et ses greffons (`.bob/plugins/<nom>`), comme `api` de Bob. */
async function bobRoots(bob: string): Promise<string[]> {
  try {
    const plugins = (await readdir(join(bob, 'plugins'), { withFileTypes: true }))
      .filter((e) => e.isDirectory() || e.isSymbolicLink())
      .map((e) => e.name)
      .sort((a, b) => a.localeCompare(b))
    return [bob, ...plugins.map((name) => join(bob, 'plugins', name))]
  } catch {
    return [bob]
  }
}

async function bobScope(
  bob: string,
  scope: RuleFileView['scope'],
  ctx: RulesContext
): Promise<RuleFileView[]> {
  const roots = await bobRoots(bob)
  const rules: RuleFileView[] = []
  for (const root of roots) {
    if (ctx.mode) {
      for (const f of await bobRuleFiles(join(root, `rules-${ctx.mode}`))) {
        rules.push(view(f, scope, ctx, ctx.mode))
      }
    }
    for (const f of await bobRuleFiles(join(root, 'rules'))) rules.push(view(f, scope, ctx))
  }
  return rules
}

async function bobRules(ctx: RulesContext): Promise<RuleFileView[]> {
  const agents = join(ctx.workspace, 'AGENTS.md')
  return [
    ...(isFile(agents) ? [view(agents, 'project', ctx)] : []),
    ...(await bobScope(join(ctx.workspace, '.bob'), 'project', ctx)),
    ...(await bobScope(join(ctx.home, '.bob'), 'personal', ctx))
  ]
}

export const BOB_RULES: RulesSource = {
  summary: () => t('capabilities.rulesFiles.bob'),
  list: bobRules
}
