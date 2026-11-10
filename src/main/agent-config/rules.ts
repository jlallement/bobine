/**
 * Règles actives d'une conversation (fiche 056) : les fichiers de consignes que l'agent charge,
 * listés par la source de son profil (`RulesSource`, fiche 140 : `bob-rules.ts`,
 * `opencode-rules.ts`). L'app ne fait que les lister : chaque agent les lit lui-même. Ici, ce qui
 * est commun : aperçu d'une règle, libellés, dédoublonnage, outils de chemins.
 */
import { statSync } from 'node:fs'
import { glob, open } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative } from 'node:path'
import type { MarkdownDocument } from '@shared/file-links'
import type { RuleFileView } from '@shared/rules'
import type { RulesSource } from '../agent/adapters.ts'
import { t } from 'i18next'
// Pas d'import de valeur par alias : la sonde d'OpenCode charge ce module sous Node, sans bundler
// (fiche 078).

/** Aperçu d'une règle : au-delà, seul le début est montré (comme un `.md`, fiche 052). */
const MAX_RULE_BYTES = 1_000_000

/** Règle active à montrer en aperçu (lecture seule) ; jamais une URL. */
export async function readRuleDocument(rule: RuleFileView): Promise<MarkdownDocument> {
  if (rule.url) throw new Error(t('rules.online', { path: rule.path }))
  const handle = await open(rule.path, 'r')
  try {
    const { size } = await handle.stat()
    const length = Math.min(size, MAX_RULE_BYTES)
    const buffer = Buffer.alloc(length)
    await handle.read(buffer, 0, length, 0)
    return {
      path: rule.path,
      relative: rule.label,
      dir: dirname(rule.path),
      text: buffer.toString('utf8'),
      ...(size > MAX_RULE_BYTES ? { truncated: true } : {})
    }
  } finally {
    await handle.close()
  }
}

export interface RulesContext {
  workspace: string
  /** Dossier personnel (remplaçable pour les essais). */
  home: string
  /** Mode actif de la conversation (certains agents ont des règles par mode). */
  mode?: string
  /** Environnement de l'agent (`XDG_CONFIG_HOME`…). */
  env?: NodeJS.ProcessEnv
  /** Version annoncée par l'agent (ses règles peuvent changer d'une version à l'autre). */
  version?: string
}

export const isFile = (path: string) => {
  try {
    return statSync(path).isFile()
  } catch {
    return false
  }
}

export async function activeRules(source: RulesSource, ctx: RulesContext): Promise<RuleFileView[]> {
  const files = await source.list(ctx)
  // Un même fichier atteint deux fois (lien, motif) n'est montré qu'une fois.
  return [...new Map(files.map((f) => [f.path, f])).values()]
}

function label(path: string, ctx: RulesContext): string {
  const fromWorkspace = relative(ctx.workspace, path)
  if (!fromWorkspace.startsWith('..') && !isAbsolute(fromWorkspace)) return fromWorkspace
  const fromHome = relative(ctx.home, path)
  if (!fromHome.startsWith('..') && !isAbsolute(fromHome)) return `~/${fromHome}`
  return path
}

export const view = (
  path: string,
  scope: RuleFileView['scope'],
  ctx: RulesContext,
  mode?: string
): RuleFileView => ({ path, label: label(path, ctx), scope, ...(mode ? { mode } : {}) })

/** Dossiers de `dir` jusqu'à `root` compris, du plus proche au plus lointain. */
export function upTo(dir: string, root: string): string[] {
  const dirs: string[] = []
  for (let d = dir; ; d = dirname(d)) {
    dirs.push(d)
    if (d === root || dirname(d) === d) return dirs
  }
}

/** Fichiers d'un motif, triés ; rien si le motif est invalide. */
export async function globFiles(pattern: string, cwd: string): Promise<string[]> {
  const found: string[] = []
  try {
    for await (const match of glob(pattern, { cwd })) {
      const path = isAbsolute(match) ? match : join(cwd, match)
      if (isFile(path)) found.push(path)
    }
  } catch {
    // Motif invalide : rien.
  }
  return found.sort()
}
