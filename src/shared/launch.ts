/**
 * Fichier de lancement du projet (fiche 030) : comment démarrer l'app que l'agent développe. Même
 * format que `.claude/launch.json` de Claude Code, pour qu'un projet serve aux deux.
 *
 * ```json
 * { "version": "0.0.1",
 *   "configurations": [{ "name": "web", "runtimeExecutable": "npm", "runtimeArgs": ["run", "dev"], "port": 5173 }] }
 * ```
 */

import { messageOf } from './errors'

/** Emplacements lus, dans l'ordre, depuis la racine du dossier de travail. */
export const LAUNCH_FILES = ['.bob/launch.json', '.claude/launch.json'] as const

export interface LaunchConfig {
  name: string
  /** Commande ; absente avec `url` : serveur déjà lancé ailleurs, on s'y rattache. */
  runtimeExecutable?: string
  /** Variante en une ligne, lancée par le shell (`"command": "npx serve . -l 3456"`). */
  command?: string
  runtimeArgs: string[]
  port?: number
  /** Adresse à ouvrir (défaut : `http://localhost:<port>`). */
  url?: string
  /** Dossier de lancement, relatif au dossier de travail. */
  cwd?: string
  env: Record<string, string>
}

export type DevServerStatus = 'starting' | 'running' | 'exited' | 'failed' | 'attached'

/** Serveur tel que l'UI l'affiche. */
export interface DevServerView {
  name: string
  status: DevServerStatus
  url: string
  command: string
  pid?: number
  exitCode?: number | null
  /** Démarrage et fin (ms), pour la durée de l'onglet « Session » (fiche 166). */
  startedAt?: number
  endedAt?: number
}

/** Serveurs d'un dossier, poussés à l'UI quand ils changent. */
export interface DevServersChange {
  workspace: string
  servers: DevServerView[]
}

const NAME = /^[\w.-]{1,40}$/

/** Lit et valide un fichier de lancement ; lève une erreur lisible par l'agent. */
export function parseLaunchFile(text: string): LaunchConfig[] {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch (error) {
    throw new Error(`JSON invalide : ${messageOf(error)}`)
  }
  const list = (raw as { configurations?: unknown } | null)?.configurations
  if (!Array.isArray(list)) throw new Error('`configurations` doit être une liste')
  const seen = new Set<string>()
  // eslint-disable-next-line complexity -- validation champ par champ d'un fichier écrit à la main (fiche 089)
  return list.map((item, index): LaunchConfig => {
    const c = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>
    const where = `configurations[${index}]`
    const name = c['name']
    if (typeof name !== 'string' || !NAME.test(name)) {
      throw new Error(`${where}.name : nom court attendu (lettres, chiffres, - _ .)`)
    }
    if (seen.has(name)) throw new Error(`Nom en double : ${name}`)
    seen.add(name)
    const exe = c['runtimeExecutable']
    if (exe !== undefined && (typeof exe !== 'string' || !exe.trim())) {
      throw new Error(`${where}.runtimeExecutable : commande attendue`)
    }
    // Forme en une ligne, que les agents écrivent volontiers (relevé sur Bob).
    const shell = c['command']
    if (shell !== undefined && (typeof shell !== 'string' || !shell.trim())) {
      throw new Error(`${where}.command : ligne de commande attendue`)
    }
    if (exe !== undefined && shell !== undefined) {
      throw new Error(`${where} : runtimeExecutable ou command, pas les deux`)
    }
    const args = c['runtimeArgs'] ?? []
    if (!Array.isArray(args) || !args.every((a) => typeof a === 'string')) {
      throw new Error(`${where}.runtimeArgs : liste de textes attendue`)
    }
    const port = c['port'] ?? portOfUrl(c['url'])
    if (
      port !== undefined &&
      (!Number.isInteger(port) || (port as number) < 1 || (port as number) > 65535)
    ) {
      throw new Error(`${where}.port : numéro de port attendu`)
    }
    const url = c['url']
    if (url !== undefined && (typeof url !== 'string' || !/^https?:\/\//.test(url))) {
      throw new Error(`${where}.url : adresse http(s) attendue`)
    }
    if (exe === undefined && shell === undefined && url === undefined) {
      throw new Error(
        `${where} : il faut runtimeExecutable (ou command) pour lancer, ou url (serveur existant)`
      )
    }
    if (port === undefined) {
      throw new Error(`${where}.port : obligatoire pour savoir quand le serveur est prêt`)
    }
    const cwd = c['cwd']
    if (
      cwd !== undefined &&
      (typeof cwd !== 'string' || cwd.startsWith('/') || cwd.split(/[\\/]/).includes('..'))
    ) {
      throw new Error(`${where}.cwd : chemin relatif au dossier de travail attendu`)
    }
    const env = c['env'] ?? {}
    if (
      typeof env !== 'object' ||
      env === null ||
      !Object.values(env).every((v) => typeof v === 'string')
    ) {
      throw new Error(`${where}.env : objet de textes attendu`)
    }
    return {
      name,
      ...(exe !== undefined ? { runtimeExecutable: exe as string } : {}),
      ...(shell !== undefined ? { command: shell as string } : {}),
      runtimeArgs: args as string[],
      ...(port !== undefined ? { port: port as number } : {}),
      ...(url !== undefined ? { url: url as string } : {}),
      ...(cwd !== undefined ? { cwd: cwd as string } : {}),
      env: env as Record<string, string>
    }
  })
}

export const commandLine = (c: LaunchConfig): string =>
  c.command ?? [c.runtimeExecutable ?? '', ...c.runtimeArgs].join(' ').trim()

/** Le serveur est-il lancé par l'app (sinon on se rattache à un serveur existant) ? */
export const launches = (c: LaunchConfig): boolean => !!(c.runtimeExecutable ?? c.command)

/** Port d'une adresse http(s) (`http://localhost:3456/x` → 3456, sinon 80 / 443). */
function portOfUrl(url: unknown): number | undefined {
  if (typeof url !== 'string') return undefined
  try {
    const { port, protocol } = new URL(url)
    if (port) return Number(port)
    return protocol === 'https:' ? 443 : protocol === 'http:' ? 80 : undefined
  } catch {
    return undefined
  }
}

export const urlOf = (c: LaunchConfig): string => c.url ?? `http://localhost:${c.port ?? 80}/`

/** Format expliqué à l'agent (description des outils, erreurs). */
export const LAUNCH_FORMAT_HELP =
  'Launch file format (.bob/launch.json): {"version":"0.0.1","configurations":[{"name":"web",' +
  '"runtimeExecutable":"npm","runtimeArgs":["run","dev"],"port":5173}]} — or "command":"npx serve . -l 3456" ' +
  'instead of runtimeExecutable/runtimeArgs; optional "url" (page to open), "cwd" (relative), "env". ' +
  'Never start dev servers yourself in the shell: use preview_start so the app manages and shows them.'
