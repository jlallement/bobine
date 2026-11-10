/**
 * Règles d'OpenCode (fiches 056, 078), telles que son profil les déclare (`RulesSource`,
 * fiche 140), choisies d'après la version qu'il annonce à `initialize` (inconnue : la 2).
 *
 * - OpenCode 1.19 (essai réel) : tous les `AGENTS.md` du dossier jusqu'à la racine du dépôt git
 *   (jusqu'à `/` hors dépôt), sinon les `CLAUDE.md` ; `~/.config/opencode/AGENTS.md`, sinon
 *   `~/.claude/CLAUDE.md` ; et les fichiers (motifs compris) ou URL de la clé `instructions` des
 *   `opencode.json(c)` du projet et global.
 * - OpenCode 2.0.31 (code lu, essai réel — fiche 078) : `~/.config/opencode/AGENTS.md` ; tous les
 *   `AGENTS.md` du dossier jusqu'au dossier personnel s'il est dedans, sinon jusqu'à la racine du
 *   dépôt (le dossier seul hors dépôt) ; plus de `CLAUDE.md`. `instructions` de tous les
 *   `opencode.json(c)` (et `.opencode/opencode.json(c)`) des dossiers parents et du global ; un
 *   motif relatif est cherché à chaque niveau, du dossier à la racine du dépôt.
 *
 * Extensions explicites, sans alias : la sonde d'OpenCode charge ce module sous Node (fiche 078).
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, sep } from 'node:path'
import { parse } from 'jsonc-parser'
import type { RuleFileView } from '@shared/rules'
import { t } from 'i18next'
import { globFiles, isFile, upTo, view, type RulesContext } from './rules.ts'
import type { RulesSource } from '../agent/adapters.ts'

/** Version majeure (`1.19.0` → 1), `undefined` si on ne la sait pas. */
function majorVersion(version: string | undefined): number | undefined {
  const major = /^v?(\d+)\./.exec(version ?? '')?.[1]
  return major ? Number(major) : undefined
}

/** Racine du dépôt git qui contient `dir`, sinon `/` (comme le « worktree » d'OpenCode). */
function gitRoot(dir: string): string {
  for (let d = dir; ; d = dirname(d)) {
    if (existsSync(join(d, '.git'))) return d
    if (dirname(d) === d) return d
  }
}

/** Valeurs de `instructions` d'un `opencode.json(c)`. */
function instructionsOf(file: string): string[] {
  try {
    const raw = parse(readFileSync(file, 'utf8')) as Record<string, unknown> | undefined
    const list = raw?.['instructions']
    return Array.isArray(list) ? list.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

async function openCodeRules(ctx: RulesContext): Promise<RuleFileView[]> {
  const env = ctx.env ?? {}
  const noClaude = !!env['OPENCODE_DISABLE_CLAUDE_CODE']
  const root = gitRoot(ctx.workspace)
  const dirs = upTo(ctx.workspace, root)
  const rules: RuleFileView[] = []

  // Projet : tous les fichiers du premier nom trouvé, du dossier vers la racine.
  for (const name of noClaude ? ['AGENTS.md'] : ['AGENTS.md', 'CLAUDE.md']) {
    const found = dirs.map((d) => join(d, name)).filter(isFile)
    if (found.length) {
      // Du plus général au plus précis, comme on lit un projet.
      rules.push(...found.reverse().map((f) => view(f, 'project', ctx)))
      break
    }
  }

  // Personnel : le premier qui existe.
  const config = join(env['XDG_CONFIG_HOME'] || join(ctx.home, '.config'), 'opencode')
  const personal = [
    join(config, 'AGENTS.md'),
    ...(noClaude || env['OPENCODE_DISABLE_CLAUDE_CODE_PROMPT']
      ? []
      : [join(ctx.home, '.claude', 'CLAUDE.md')])
  ].find(isFile)
  if (personal) rules.push(view(personal, 'personal', ctx))

  // `instructions` : configuration du projet (du dossier vers la racine), puis globale.
  const configs: { file: string; scope: RuleFileView['scope'] }[] = [
    ...dirs.flatMap((d) =>
      ['opencode.jsonc', 'opencode.json']
        .map((f) => join(d, f))
        .filter(isFile)
        .map((file) => ({ file, scope: 'project' as const }))
    ),
    ...['opencode.jsonc', 'opencode.json']
      .map((f) => join(config, f))
      .filter(isFile)
      .map((file) => ({ file, scope: 'personal' as const }))
  ]
  for (const { file, scope } of configs) {
    for (const entry of instructionsOf(file)) {
      if (/^https?:\/\//.test(entry)) {
        rules.push({ path: entry, label: entry, scope, url: true })
        continue
      }
      const expanded = entry.startsWith('~/') ? join(ctx.home, entry.slice(2)) : entry
      // Chemin relatif : cherché du dossier jusqu'à la racine du dépôt, comme OpenCode.
      const bases = isAbsolute(expanded) ? [sep] : dirs
      for (const base of bases) {
        const matches = await globFiles(isAbsolute(expanded) ? expanded.slice(1) : expanded, base)
        rules.push(...matches.map((f) => view(f, scope, ctx)))
        if (matches.length) break
      }
    }
  }
  return rules
}

/** Racine du dépôt git qui contient `dir`, sinon `dir` lui-même (OpenCode 2). */
function projectRoot(dir: string): string {
  for (let d = dir; ; d = dirname(d)) {
    if (existsSync(join(d, '.git'))) return d
    if (dirname(d) === d) return dir
  }
}

/** `dir` est `parent` ou se trouve dessous. */
function within(parent: string, dir: string): boolean {
  const rel = relative(parent, dir)
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

async function openCode2Rules(ctx: RulesContext): Promise<RuleFileView[]> {
  const env = ctx.env ?? {}
  const config = join(env['XDG_CONFIG_HOME'] || join(ctx.home, '.config'), 'opencode')
  const root = projectRoot(ctx.workspace)
  const stop = within(ctx.home, ctx.workspace) ? ctx.home : root
  const dirs = upTo(ctx.workspace, stop)
  const global = join(config, 'AGENTS.md')
  const rules: RuleFileView[] = []

  // Projet : tous les `AGENTS.md` du chemin, du plus général au plus précis.
  const project = dirs
    .map((d) => join(d, 'AGENTS.md'))
    .filter((f) => f !== global && isFile(f))
    .reverse()
  rules.push(...project.map((f) => view(f, 'project', ctx)))
  if (isFile(global)) rules.push(view(global, 'personal', ctx))

  // `instructions` : configurations de tous les dossiers parents (projet), puis la globale.
  const configs: { file: string; scope: RuleFileView['scope'] }[] = [
    ...upTo(ctx.workspace, sep).flatMap((d) =>
      d === config
        ? []
        : [
            join(d, 'opencode.jsonc'),
            join(d, 'opencode.json'),
            join(d, '.opencode', 'opencode.jsonc'),
            join(d, '.opencode', 'opencode.json')
          ]
            .filter(isFile)
            .map((file) => ({ file, scope: 'project' as const }))
    ),
    ...['opencode.jsonc', 'opencode.json']
      .map((f) => join(config, f))
      .filter(isFile)
      .map((file) => ({ file, scope: 'personal' as const }))
  ]
  const levels = upTo(ctx.workspace, root)
  for (const { file, scope } of configs) {
    for (const entry of instructionsOf(file)) {
      if (/^https?:\/\//.test(entry)) {
        rules.push({ path: entry, label: entry, scope, url: true })
        continue
      }
      const expanded = entry.startsWith('~/') ? join(ctx.home, entry.slice(2)) : entry
      if (isAbsolute(expanded)) {
        const matches = await globFiles(expanded.slice(1), sep)
        rules.push(...matches.map((f) => view(f, scope, ctx)))
        continue
      }
      // Motif relatif : à chaque niveau, du dossier à la racine du dépôt (toutes les trouvailles).
      for (const base of levels) {
        rules.push(...(await globFiles(expanded, base)).map((f) => view(f, scope, ctx)))
      }
    }
  }
  return rules
}

export const OPENCODE_RULES: RulesSource = {
  summary: () => t('capabilities.rulesFiles.opencode'),
  list: (ctx) => (majorVersion(ctx.version) === 1 ? openCodeRules(ctx) : openCode2Rules(ctx))
}
