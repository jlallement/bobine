/**
 * Modes installés comme Bob ou OpenCode (fiche 223, phase 4) : `--modes-installes bob|opencode`
 * et `--perso <dossier>` (le dossier personnel d'essai, jamais le vrai). À chaque ouverture de
 * session, l'agent factice relit, comme ces agents :
 *
 * - `bob` : `customModes:` de `<perso>/.bob/settings/custom_modes.yaml` puis de
 *   `<dossier>/.bob/custom_modes.yaml` (`id` = `slug`, `name`, `description`) ;
 * - `opencode` : `<perso>/.config/opencode/agents/*.md` puis `<dossier>/.opencode/agents/*.md`
 *   (`id` = nom du fichier ; ni `mode: subagent`, ni `hidden: true`).
 *
 * Les modes trouvés suivent les siens (`code`, `ask`, `plan`), comme chez Bob 2.1.0. Un fichier
 * illisible est ignoré.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { parse } from 'yaml'

export type InstalledKind = 'bob' | 'opencode'

export interface InstalledModesOptions {
  kind: InstalledKind
  /** Dossier personnel d'essai (`BOBINE_CONFIG_HOME`). */
  home: string
}

export interface MockMode {
  id: string
  name: string
  description?: string
}

const read = (file: string): string | undefined => {
  try {
    return existsSync(file) ? readFileSync(file, 'utf8') : undefined
  } catch {
    return undefined
  }
}

function bobModes(file: string): MockMode[] {
  const text = read(file)
  if (text === undefined) return []
  try {
    const list = (parse(text) as { customModes?: unknown } | null)?.customModes
    if (!Array.isArray(list)) return []
    return list.flatMap((item: unknown) => {
      const mode = item as { slug?: unknown; name?: unknown; description?: unknown }
      if (typeof mode?.slug !== 'string') return []
      return [
        {
          id: mode.slug,
          name: typeof mode.name === 'string' ? mode.name : mode.slug,
          ...(typeof mode.description === 'string' ? { description: mode.description } : {})
        }
      ]
    })
  } catch {
    return []
  }
}

function openCodeAgents(dir: string): MockMode[] {
  let files: string[]
  try {
    files = readdirSync(dir)
      .filter((f) => f.endsWith('.md'))
      .sort()
  } catch {
    return []
  }
  return files.flatMap((f) => {
    const text = read(join(dir, f)) ?? ''
    const header = /^---\n([\s\S]*?)\n---\n/.exec(text)?.[1]
    let front: { mode?: unknown; hidden?: unknown; description?: unknown } = {}
    try {
      front = (header ? parse(header) : {}) ?? {}
    } catch {
      return []
    }
    if (front.mode === 'subagent' || front.hidden === true) return []
    const id = basename(f, '.md')
    return [
      {
        id,
        name: id,
        ...(typeof front.description === 'string' ? { description: front.description } : {})
      }
    ]
  })
}

/** Modes installés vus depuis ce dossier de travail ; le projet après le personnel. */
export function installedModes(options: InstalledModesOptions, cwd: string): MockMode[] {
  const found =
    options.kind === 'bob'
      ? [
          ...bobModes(join(options.home, '.bob', 'settings', 'custom_modes.yaml')),
          ...bobModes(join(cwd, '.bob', 'custom_modes.yaml'))
        ]
      : [
          ...openCodeAgents(join(options.home, '.config', 'opencode', 'agents')),
          ...openCodeAgents(join(cwd, '.opencode', 'agents'))
        ]
  // Même identifiant aux deux endroits : le premier trouvé, comme Bob Shell.
  return found.filter((mode, i) => found.findIndex((m) => m.id === mode.id) === i)
}
