/**
 * Comment lancer un programme (fiche 229, ADR-0050) : le seul endroit qui sait qu'un `.cmd` ne se
 * lance pas comme un `.exe`, que le PATH se coupe sur `;` et que la variable s'appelle `Path`.
 * Fonctions pures (le système, l'environnement et l'accès aux fichiers sont passés), essayées sur
 * le Mac comme dans la VM Windows. Le système des processus est celui de la vraie machine
 * (`configureProcessLaunch` depuis `index.ts`), jamais `BOBINE_PLATFORM`, qui ne simule que les
 * capacités de l'interface. Sur macOS et Linux, rien ne change : le programme est passé tel quel à
 * `spawn`, dans son propre groupe (`detached`, fiche 138). N'importe pas `electron`.
 *
 * **Règles de citation de `cmd.exe`** (un `.cmd` ou un `.bat`, dont les scripts npm de Bob et
 * d'OpenCode) — on compose la ligne nous-mêmes, jamais `shell: true` :
 * 1. chaque argument est cité pour le programme final, selon `CommandLineToArgvW` (entre
 *    guillemets, `\` doublés devant un `"` et en fin d'argument, `"` écrit `\"`) ;
 * 2. puis chaque caractère spécial de `cmd.exe` est précédé de `^`, deux fois : une passe pour la
 *    ligne `/c`, une pour la relecture de `%*` dans le script. Le `^` posé devant chaque `"`
 *    empêche `cmd.exe` d'ouvrir une zone entre guillemets : rien n'échappe à l'échappement ;
 * 3. `^%VAR^%` n'est pas développé (le nom lu devient `VAR^`) ; `/v:off` coupe l'expansion
 *    retardée (`!VAR!`), même activée par le registre ; `/d` ignore les commandes `AutoRun` ;
 *    `/s` retire seulement les guillemets qui entourent toute la ligne ;
 * 4. un retour à la ligne ou un caractère nul dans un argument est refusé : `cmd.exe` couperait la
 *    commande à cet endroit.
 */
import { spawn, type ChildProcess, type SpawnOptions } from 'node:child_process'
import { accessSync, constants, lstatSync, statSync } from 'node:fs'
import { posix, win32 } from 'node:path'

/** Famille du système pour les processus : groupes et signaux, ou objets de tâche et `.cmd`. */
export type ProcessSystem = 'posix' | 'windows'

/** Système des processus d'une plateforme Node (`process.platform`). */
export function processSystem(platform: string): ProcessSystem {
  return platform === 'win32' ? 'windows' : 'posix'
}

/** Ce que la recherche d'un programme lit de la machine (injecté en essai). */
export interface LaunchContext {
  system: ProcessSystem
  /** Environnement : `PATH` (`Path`), `PATHEXT`, `ComSpec`, `SystemRoot`. */
  env: NodeJS.ProcessEnv
  /** Fichier ordinaire, exécutable sous Unix. */
  isProgram: (file: string) => boolean
}

/** Commande prête pour `spawn`. */
export interface LaunchPlan {
  file: string
  args: string[]
  /** `windowsVerbatimArguments` : la ligne de `cmd.exe` est déjà composée. */
  verbatim: boolean
  /** Programme trouvé (Windows seulement ; sous Unix, `spawn` cherche lui-même). */
  resolved?: string
  /** Comment le programme est lancé. */
  kind: 'direct' | 'cmd' | 'powershell'
}

const DEFAULT_PATHEXT = '.COM;.EXE;.BAT;.CMD'

/** Caractères que `cmd.exe` interprète (repris de cross-spawn, éprouvé avec les scripts npm). */
const CMD_META = /([()\][%!^"`<>&|;, *?])/g

/** Valeur d'une variable, sans casse sous Windows (une copie de `process.env` n'en ignore pas). */
export function envValue(
  env: NodeJS.ProcessEnv,
  name: string,
  system: ProcessSystem
): string | undefined {
  if (system === 'posix') return env[name]
  const key = Object.keys(env).find((k) => k.toUpperCase() === name.toUpperCase())
  return key === undefined ? undefined : env[key]
}

/** Nom de la clé du PATH : `PATH` sous Unix ; sous Windows, celle qui existe déjà (`Path`). */
export function pathKey(env: NodeJS.ProcessEnv, system: ProcessSystem): string {
  if (system === 'posix') return 'PATH'
  return Object.keys(env).find((k) => k.toUpperCase() === 'PATH') ?? 'Path'
}

/**
 * Environnement à une seule clé par nom sous Windows (`{ ...process.env, PATH }` en crée deux :
 * l'enfant recevrait l'une ou l'autre). La dernière valeur l'emporte, sous l'orthographe de la
 * première. Sous Unix, rendu tel quel.
 */
export function normalizeEnv(env: NodeJS.ProcessEnv, system: ProcessSystem): NodeJS.ProcessEnv {
  if (system === 'posix') return env
  const keys = new Map<string, string>()
  const out: NodeJS.ProcessEnv = {}
  for (const [key, value] of Object.entries(env)) {
    const upper = key.toUpperCase()
    const kept = keys.get(upper) ?? key
    keys.set(upper, kept)
    if (value === undefined) Reflect.deleteProperty(out, kept)
    else out[kept] = value
  }
  return out
}

/** Dossiers du PATH, dans l'ordre (guillemets d'un dossier Windows retirés). */
export function pathEntries(pathEnv: string | undefined, system: ProcessSystem): string[] {
  const delimiter = system === 'windows' ? ';' : ':'
  return (pathEnv ?? '')
    .split(delimiter)
    .map((dir) => (system === 'windows' ? dir.replace(/"/g, '').trim() : dir))
    .filter(Boolean)
}

/** Extensions exécutables de `PATHEXT`, en minuscules (`.exe`, `.cmd`…). */
function pathExtensions(env: NodeJS.ProcessEnv): string[] {
  return (envValue(env, 'PATHEXT', 'windows') || DEFAULT_PATHEXT)
    .split(';')
    .map((ext) => ext.trim().toLowerCase())
    .filter((ext) => ext.startsWith('.'))
}

/** Chemin (pas un simple nom) : cherché tel quel, jamais dans le PATH. */
function isPathLike(command: string, system: ProcessSystem): boolean {
  return system === 'windows' ? /[\\/]|^[a-zA-Z]:/.test(command) : command.includes('/')
}

/**
 * Programme désigné par `command` : le chemin donné, ou le premier trouvé dans le PATH. Sous
 * Windows, avec les extensions de `PATHEXT` (`bob` → `bob.cmd`), et un `.ps1` en dernier recours ;
 * jamais le dossier courant (un `bob.cmd` posé dans le dossier d'une conversation ne remplace pas
 * celui de l'utilisateur).
 */
export function findProgram(command: string, ctx: LaunchContext): string | undefined {
  if (!command) return undefined
  const { system, env } = ctx
  const path = system === 'windows' ? win32 : posix
  const dirs = isPathLike(command, system)
    ? ['']
    : pathEntries(envValue(env, 'PATH', system), system)
  const names = (dir: string, extensions: string[]): string[] => {
    const base = dir ? path.join(dir, command) : command
    if (system === 'posix') return [base]
    const ext = path.extname(command).toLowerCase()
    // `bob.cmd` donné en entier : tel quel ; `bob` : chaque extension de PATHEXT.
    return extensions.includes(ext) ? [base] : extensions.map((e) => base + e)
  }
  const search = (extensions: string[]) => {
    for (const dir of dirs) {
      const found = names(dir, extensions).find((file) => ctx.isProgram(file))
      if (found) return found
    }
    return undefined
  }
  return search(pathExtensions(env)) ?? (system === 'windows' ? search(['.ps1']) : undefined)
}

/**
 * Argument cité pour `CommandLineToArgvW` (la règle du CRT, qu'emploient node, git, les `.exe`) :
 * entre guillemets ; les `\` qui précèdent un `"` ou la fin sont doublés, le `"` devient `\"`.
 */
export function quoteWindowsArg(arg: string): string {
  let out = ''
  let backslashes = 0
  for (const char of arg) {
    if (char === '\\') {
      backslashes++
      continue
    }
    out += char === '"' ? '\\'.repeat(backslashes * 2 + 1) + '"' : '\\'.repeat(backslashes) + char
    backslashes = 0
  }
  return `"${out}${'\\'.repeat(backslashes * 2)}"`
}

/** Argument que `cmd.exe` ne sait pas transmettre (la commande serait coupée). */
export class UnsafeArgumentError extends Error {
  readonly argument: string
  constructor(argument: string) {
    super(
      `Argument refusé pour cmd.exe (retour à la ligne ou caractère nul) : ${JSON.stringify(argument.slice(0, 80))}`
    )
    this.name = 'UnsafeArgumentError'
    this.argument = argument
  }
}

/** `^` devant chaque caractère spécial de `cmd.exe`, `times` fois. */
function escapeCmdMeta(text: string, times: number): string {
  let out = text
  for (let i = 0; i < times; i++) out = out.replace(CMD_META, '^$1')
  return out
}

/**
 * Ligne passée à `cmd.exe /d /s /v:off /c "<ligne>"` pour lancer un `.cmd` ou un `.bat` avec ces
 * arguments (règles en tête du module). Le script est échappé une fois (lu par la ligne `/c`), les
 * arguments deux fois (relus par `%*` dans le script).
 */
export function cmdLine(script: string, args: readonly string[]): string {
  for (const part of [script, ...args]) {
    if (/[\r\n\0]/.test(part)) throw new UnsafeArgumentError(part)
  }
  return [escapeCmdMeta(script, 1), ...args.map((a) => escapeCmdMeta(quoteWindowsArg(a), 2))].join(
    ' '
  )
}

/** `cmd.exe` de la machine : `ComSpec`, sinon celui de `SystemRoot`. */
export function commandShell(env: NodeJS.ProcessEnv): string {
  const comspec = envValue(env, 'ComSpec', 'windows')
  if (comspec) return comspec
  const root = envValue(env, 'SystemRoot', 'windows')
  return root ? win32.join(root, 'System32', 'cmd.exe') : 'cmd.exe'
}

/** PowerShell 5.1 de Windows (toujours présent), par son chemin complet. */
export function windowsPowerShell(env: NodeJS.ProcessEnv): string {
  const root = envValue(env, 'SystemRoot', 'windows')
  return root
    ? win32.join(root, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
    : 'powershell.exe'
}

/**
 * Comment lancer `command args` (fonction pure). Unix : tel quel. Windows : `.exe` direct, `.cmd`
 * et `.bat` par `cmd.exe` avec la ligne citée, `.ps1` par PowerShell sans contourner la stratégie
 * d'exécution de l'utilisateur ; introuvable : tel quel (`spawn` dira `ENOENT`).
 */
export function planLaunch(
  command: string,
  args: readonly string[],
  ctx: LaunchContext
): LaunchPlan {
  const direct: LaunchPlan = { file: command, args: [...args], verbatim: false, kind: 'direct' }
  if (ctx.system === 'posix') return direct
  const resolved = findProgram(command, ctx)
  if (!resolved) return direct
  const ext = win32.extname(resolved).toLowerCase()
  if (ext === '.cmd' || ext === '.bat') {
    return {
      file: commandShell(ctx.env),
      args: ['/d', '/s', '/v:off', '/c', `"${cmdLine(resolved, args)}"`],
      verbatim: true,
      resolved,
      kind: 'cmd'
    }
  }
  if (ext === '.ps1') {
    return {
      file: windowsPowerShell(ctx.env),
      args: ['-NoLogo', '-NoProfile', '-NonInteractive', '-File', resolved, ...args],
      verbatim: false,
      resolved,
      kind: 'powershell'
    }
  }
  return { ...direct, file: resolved, resolved }
}

/**
 * Commande de shell écrite par l'utilisateur (serveur de développement, préparation d'un
 * worktree) : interprétée par le shell, c'est voulu. Unix : `/bin/sh -c` ; Windows : `cmd.exe`
 * (sans `AutoRun`, ligne passée telle quelle).
 */
export function planShellCommand(
  command: string,
  ctx: Pick<LaunchContext, 'system' | 'env'>
): LaunchPlan {
  if (ctx.system === 'posix') {
    return { file: '/bin/sh', args: ['-c', command], verbatim: false, kind: 'direct' }
  }
  return {
    file: commandShell(ctx.env),
    args: ['/d', '/s', '/c', `"${command}"`],
    verbatim: true,
    kind: 'cmd'
  }
}

/**
 * Options de `spawn` du système : Unix, propre groupe (`detached`) ; Windows, jamais `detached`
 * (il ouvre une console et sort l'enfant du job de libuv), pas de fenêtre de console.
 */
export function launchOptions(
  plan: Pick<LaunchPlan, 'verbatim'>,
  system: ProcessSystem,
  options: SpawnOptions
): SpawnOptions {
  if (system === 'posix') return { ...options, detached: true }
  return {
    ...options,
    ...(options.env ? { env: normalizeEnv(options.env, system) } : {}),
    detached: false,
    windowsHide: true,
    windowsVerbatimArguments: plan.verbatim
  }
}

/**
 * Fichier ordinaire (et exécutable sous Unix ; Windows n'a pas de bit d'exécution). Sous Windows,
 * un alias d'exécution d'app (`%LOCALAPPDATA%\Microsoft\WindowsApps\wt.exe`, `python.exe` du
 * Store, `winget.exe`) est un point d'analyse que `stat` refuse (`EACCES`, vérifié dans la VM) et
 * que `lstat` voit comme un lien : il compte, puisque Windows le lance (fiche 229).
 */
export function isProgramFile(system: ProcessSystem): (file: string) => boolean {
  return (file) => {
    try {
      if (system === 'posix') accessSync(file, constants.X_OK)
      return statSync(file).isFile()
    } catch (error) {
      return system === 'windows' && isAppExecutionAlias(file, error)
    }
  }
}

function isAppExecutionAlias(file: string, error: unknown): boolean {
  if ((error as NodeJS.ErrnoException | undefined)?.code !== 'EACCES') return false
  try {
    return lstatSync(file).isSymbolicLink()
  } catch {
    return false
  }
}

/**
 * Descripteurs hérités (fiche 145, `pannes-visibles`) : sous Linux, libuv lance les enfants par
 * `fork` puis `exec`, et tout descripteur du main sans `FD_CLOEXEC` passe à l'enfant ; Chromium en
 * laisse ainsi une quarantaine (socket d'écoute du port DevTools, tubes, fichiers `.pak`). Un agent
 * orphelin gardait le port, et toute commande lancée pouvait lire ou écrire ces tubes. Node n'a pas
 * d'option `close_fds` ; le `sh` d'Ubuntu (dash) ne sait pas fermer un descripteur à deux
 * chiffres. D'où ce relais, en `bash` : il ferme tout descripteur au-delà de 2 (liste lue dans
 * `/proc`), puis `exec` la commande, qui garde le même pid (groupe, registre, arrêt inchangés).
 * macOS n'en a pas besoin (libuv y lance par `posix_spawn` avec `POSIX_SPAWN_CLOEXEC_DEFAULT`) ;
 * Windows non plus (voir `WINDOWS_HANDLES` dans la fiche 229).
 */
export const CLOSE_FDS_SCRIPT =
  'for f in /proc/$$/fd/*; do n=${f##*/}; ' +
  'if [ "$n" -gt 2 ]; then { exec {n}>&-; } 2>/dev/null; fi; done; exec -- "$@"'

/** `bash` du relais, posé au démarrage sous Linux seulement ; absent : pas de relais. */
let closeFdsShell: string | undefined

/** Sous Linux, le `bash` du relais (`/bin/bash` ou `/usr/bin/bash`) ; ailleurs, rien. */
export function configureFdRelay(
  platform: string,
  isProgram: (file: string) => boolean = isProgramFile('posix')
): string | undefined {
  closeFdsShell =
    platform === 'linux' ? ['/bin/bash', '/usr/bin/bash'].find((f) => isProgram(f)) : undefined
  return closeFdsShell
}

/**
 * Le plan, lancé par le relais quand il est posé (Linux) : `bash -c CLOSE_FDS_SCRIPT bobine-fds
 * <programme> <arguments>`. Le programme est d'abord cherché dans le PATH : introuvable, le plan
 * reste tel quel, et `spawn` rend `ENOENT` comme avant (messages « commande introuvable », « git
 * est introuvable »).
 */
export function withClosedFds(
  plan: LaunchPlan,
  ctx: LaunchContext,
  shell: string | undefined = closeFdsShell
): LaunchPlan {
  if (!shell || ctx.system !== 'posix') return plan
  const program = findProgram(plan.file, ctx)
  if (!program) return plan
  return {
    ...plan,
    file: shell,
    args: ['-c', CLOSE_FDS_SCRIPT, 'bobine-fds', program, ...plan.args]
  }
}

/**
 * Programme et arguments d'un lancement direct (`spawn`, `execFile`, pty), par le relais qui ferme
 * les descripteurs hérités quand il est posé (Linux) ; ailleurs, tels quels.
 */
export function relayed(
  file: string,
  args: readonly string[],
  env: NodeJS.ProcessEnv = process.env
): [string, string[]] {
  const plan = withClosedFds(
    { file, args: [...args], verbatim: false, kind: 'direct' },
    launchContext(env)
  )
  return [plan.file, plan.args]
}

let currentSystem: ProcessSystem = 'posix'

/** Système des processus de cette machine, posé une fois par `index.ts` (et les sondes). */
export function configureProcessLaunch(system: ProcessSystem): void {
  currentSystem = system
}

export function launchSystem(): ProcessSystem {
  return currentSystem
}

/** Contexte de recherche de la machine, avec cet environnement. */
export function launchContext(env: NodeJS.ProcessEnv = process.env): LaunchContext {
  return { system: currentSystem, env, isProgram: isProgramFile(currentSystem) }
}

/**
 * Lance un programme selon le système (voir `planLaunch` et `launchOptions`) ; `shellCommand` :
 * `command` est une ligne de shell écrite par l'utilisateur. Rend aussi le plan (journal,
 * registre).
 */
export function launchProgram(
  command: string,
  args: readonly string[],
  options: SpawnOptions,
  shellCommand = false
): { child: ChildProcess; plan: LaunchPlan } {
  const ctx = launchContext(options.env ?? process.env)
  const plan = shellCommand ? planShellCommand(command, ctx) : planLaunch(command, args, ctx)
  // Linux : par le relais qui ferme les descripteurs hérités ; le plan rendu reste celui de la
  // commande (journal, registre).
  const launched = withClosedFds(plan, ctx)
  const child = spawn(launched.file, launched.args, launchOptions(plan, ctx.system, options))
  return { child, plan }
}
