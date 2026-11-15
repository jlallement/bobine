/**
 * Ce qu'une ligne de commande Windows écrit (fiche 229, lots 3 et 3b) : le pendant de
 * `command-writes.ts` (shell POSIX) pour PowerShell et `cmd`, que lance un agent sous Windows.
 * Bobine ne sait pas d'avance quel shell l'agent emploie : la lecture vaut pour les deux. Elle
 * **échoue fermé** — ce qu'elle ne sait pas lire est dit « écritures inconnues » (`unknown`),
 * jamais « aucune écriture ». Décision de Jérôme (2026-11-15) : « apprendre les courantes ».
 *
 * Lu (liste bornée, documentée dans la fiche 229) :
 * - cmdlets qui lisent (`Get-ChildItem`, `Get-Content`, `Select-String`…) et qui écrivent
 *   (`Set-Content`, `Out-File`, `New-Item`, `Copy-Item`, `Move-Item`, `Remove-Item`,
 *   `Rename-Item`, `Expand-Archive`, `Compress-Archive`…), avec leurs alias, paramètres et
 *   positions (`windows-cmdlets.ts`) ;
 * - commandes de `cmd` : `dir`, `type`, `echo`, `copy`, `xcopy`, `robocopy`, `move`, `del`,
 *   `erase`, `rd`, `rmdir`, `md`, `mkdir`, `ren`, `rename` ; un nom commun aux deux shells (`del`,
 *   `copy`…) sans option `/x` est lu des deux façons, qui doivent réussir toutes les deux ;
 * - redirections (`>`, `>>`, `2>`, `*>`…, sauf `$null` et `NUL`) et tuyaux (`| Out-File x`) ;
 * - programmes courants lus comme sous Unix (rien d'écrit, sauf redirection) : `git`, `npm`, `npx`,
 *   `pnpm`, `node`, `python`, `python3`, `py`, `cargo`, `dotnet` ;
 * - `cd`/`Set-Location`/`pushd` ; le registre (`reg`, `regedit`, `*-ItemProperty HKCU:\…`) ;
 *   les droits (`sudo`, `runas`, `gsudo`, `Start-Process -Verb RunAs`).
 *
 * Tout le reste — commande inconnue, script, shell imbriqué, `iex`, `-EncodedCommand`, `&`,
 * bloc `{}`, `$(…)`, échappement, paramètre inconnu ou abrégé de façon ambiguë, autre
 * fournisseur que le système de fichiers ou le registre — rend `unknown`.
 */
import { win32 } from 'node:path'
import type { WindowsPrivilegeCommand } from '@shared/permissions'
import { POWERSHELL_READERS, readCmdlet, type WordInput } from './windows-cmdlets'
import { windowsCommands, type ShellCommand } from './windows-shell-words'

export interface WindowsCommandWrites {
  /** Chemins écrits, tels qu'écrits dans la commande, et le dossier d'où les lire. */
  writes: { path: string; cwd: string | undefined }[]
  /** Clés du registre modifiées (`HKCU\Software\…`), telles qu'écrites. */
  registry: string[]
  privilege: WindowsPrivilegeCommand[]
  /** Une partie de la commande n'a pas pu être lue : elle peut écrire n'importe où. */
  unknown: boolean
}

/** Programmes lus comme sous Unix : ils n'écrivent rien que Bobine signale (fiche 211). */
export const COMMON_PROGRAMS = new Set([
  'git',
  'npm',
  'npx',
  'pnpm',
  'node',
  'python',
  'python3',
  'py',
  'cargo',
  'dotnet'
])

/** Commandes de `cmd` (ou programmes de Windows) qui ne font que lire. */
const CMD_READERS = new Set([
  'dir',
  'type',
  'echo',
  'where',
  'findstr',
  'tree',
  'more',
  'fc',
  'comp',
  'whoami',
  'hostname',
  'ver',
  'tasklist',
  'ipconfig',
  'systeminfo'
])

/** Commandes de `cmd` qui écrivent, et ce qu'elles écrivent. */
const CMD_WRITERS: Record<string, 'all' | 'copy' | 'robocopy' | 'move' | 'rename'> = {
  del: 'all',
  erase: 'all',
  rd: 'all',
  rmdir: 'all',
  md: 'all',
  mkdir: 'all',
  copy: 'copy',
  xcopy: 'copy',
  robocopy: 'robocopy',
  move: 'move',
  ren: 'rename',
  rename: 'rename'
}

/** Noms communs à `cmd` et à PowerShell (alias) : lus des deux façons. */
const SHARED = new Set([
  'dir',
  'type',
  'echo',
  'where',
  'del',
  'erase',
  'rd',
  'rmdir',
  'md',
  'mkdir',
  'copy',
  'move',
  'ren'
])

const CHANGE_DIR = new Set(['cd', 'chdir', 'set-location', 'sl', 'push-location', 'pushd'])
const BACK_DIR = new Set(['popd', 'pop-location'])

const REGISTRY_PATH =
  /^(?:hk(?:lm|cu|cr|u|cc):|hkey_[a-z_]+|(?:microsoft\.powershell\.core\\)?registry::)/i
const REG_WRITES = new Set(['add', 'delete', 'import', 'restore', 'load', 'unload', 'copy'])

/** Cibles de redirection qui ne sont pas des fichiers. */
const NOT_A_FILE = /^(?:\$null|nul|nul:|con|con:)$/i

/** Option de `cmd` (`/q`, `/s`, `/y:x`), pas un chemin Git Bash (`/c/Users`). */
const isCmdSwitch = (word: string) => /^\/[a-z?][a-z0-9:+-]{0,10}$/i.test(word)

const commandName = (word: string) =>
  word
    .replace(/^.*[\\/]/, '')
    .replace(/\.(exe|com|cmd|bat)$/i, '')
    .toLowerCase()

/** Un segment générique (`*`, `?`, `[`) suivi de `..` : la cible ne se lit pas. */
const wildcardEscape = (path: string) => {
  const parts = path.split(/[\\/]/)
  const wild = parts.findIndex((p) => /[*?[]/.test(p))
  return wild >= 0 && parts.slice(wild + 1).includes('..')
}

interface Line {
  result: WindowsCommandWrites
  dir: string | undefined
  /** La ligne contient `'` : `cmd` ne le lit pas comme un guillemet. */
  singleQuote: boolean
}

/** Note une écriture ; `false` si sa cible ne se lit pas. */
function write(line: Line, path: string): boolean {
  if (wildcardEscape(path)) return false
  line.result.writes.push({ path, cwd: line.dir })
  return true
}

/**
 * `cd C:\…` : les chemins relatifs qui suivent partent de là ; `cd src` depuis un dossier connu :
 * joint. Variable, `~`, `popd` : le dossier n'est plus connu, ce qui suit en relatif sera inconnu.
 */
function changeDir(name: string, args: readonly WordInput[], line: Line): boolean {
  if (BACK_DIR.has(name)) {
    line.dir = undefined
    return true
  }
  if (args.length === 0) return true
  const first = args[0]
  const named = !first?.quoted && /^-(path|literalpath|lp|pa|pat|li)/i.test(first?.values[0] ?? '')
  const dir = named ? args[1] : first
  if (!dir || dir.values.length !== 1 || args.length !== (named ? 2 : 1)) return false
  const target = dir.values[0] ?? ''
  if (/^[a-z]:[\\/]/i.test(target)) line.dir = target
  else if (line.dir && !/[$%~:*?]/.test(target) && !/^[\\/-]/.test(target)) {
    line.dir = win32.join(line.dir, target)
  } else line.dir = undefined
  return line.dir !== undefined
}

/** `reg add|delete|import…` : le registre ; `reg query` : rien ; `reg export clé fichier` : le fichier. */
function readReg(args: readonly string[], line: Line): boolean {
  const sub = (args[0] ?? '').toLowerCase()
  if (sub === 'query' || sub === 'compare') return true
  if (sub === 'export' || sub === 'save') {
    const file = args.filter((a) => !isCmdSwitch(a))[2]
    return file !== undefined && write(line, file)
  }
  if (!REG_WRITES.has(sub) || args[1] === undefined) return false
  line.result.registry.push(args[1])
  return true
}

/** Lecture à la façon de `cmd` ; `undefined` si elle ne s'applique pas ou échoue. */
function cmdTargets(name: string, args: readonly WordInput[], line: Line): string[] | undefined {
  if (CMD_READERS.has(name)) return []
  const effect = CMD_WRITERS[name]
  if (!effect || line.singleQuote) return undefined
  // Dans `cmd`, la virgule sépare les opérandes comme un espace ; `-Force` y est un nom de fichier.
  const operands = args.flatMap((a) => a.values).filter((v) => !isCmdSwitch(v))
  if (operands.length === 0) return undefined
  switch (effect) {
    case 'all':
      return operands
    case 'copy':
      // Sans destination, le dossier courant.
      return [operands.length > 1 ? (operands.at(-1) ?? '.') : '.']
    case 'robocopy':
      return operands[1] === undefined ? undefined : [operands[1]]
    case 'move':
      return operands.length > 1 ? operands : [...operands, '.']
    case 'rename': {
      const [from, to] = operands
      if (operands.length !== 2 || !from || !to || /[\\/]/.test(to)) return undefined
      return [from, win32.join(win32.dirname(from), to)]
    }
  }
}

/** Lecture à la façon de PowerShell ; `undefined` si elle ne s'applique pas ou échoue. */
function powershellTargets(
  name: string,
  args: readonly WordInput[],
  command: ShellCommand,
  line: Line
): string[] | undefined {
  if (POWERSHELL_READERS.has(name)) return []
  const reading = readCmdlet(name, args, command.piped)
  if (!reading || reading.unknown) return undefined
  for (const provider of reading.providers) {
    if (!REGISTRY_PATH.test(provider)) return undefined
    line.result.registry.push(provider)
  }
  return reading.writes
}

/** Cibles d'une commande lue par `cmd`, par PowerShell ou par les deux ; `undefined` si non lue. */
function targetsOf(
  name: string,
  args: readonly WordInput[],
  command: ShellCommand,
  line: Line
): string[] | undefined {
  const flat = args.flatMap((a) => a.values)
  // `sort /o fichier` (cmd) écrit ; `sort` de PowerShell (Sort-Object) non.
  if (name === 'sort') return flat.length === 0 ? [] : undefined
  if (!SHARED.has(name)) {
    return name in CMD_WRITERS || CMD_READERS.has(name)
      ? cmdTargets(name, args, line)
      : powershellTargets(name, args, command, line)
  }
  // Une option `/x` : c'est `cmd` (PowerShell y verrait un chemin et échouerait).
  if (flat.some(isCmdSwitch)) return cmdTargets(name, args, line)
  const asCmd = cmdTargets(name, args, line)
  const asPowershell = powershellTargets(name, args, command, line)
  if (asCmd === undefined || asPowershell === undefined) return undefined
  return [...asCmd, ...asPowershell]
}

/** Une commande d'un tuyau ; `false` si elle n'est pas lue. */
function readCommand(command: ShellCommand, line: Line): boolean {
  const redirected = command.redirects.every((t) => NOT_A_FILE.test(t) || write(line, t))
  if (!redirected) return false
  const [head, ...args] = command.words
  if (!head) return true
  if (head.quoted || head.values.length !== 1) return false
  const name = commandName(head.values[0] ?? '')
  if (name === 'sudo' || name === 'runas' || name === 'gsudo') {
    line.result.privilege.push(name)
    return false
  }
  if (name === 'reg')
    return readReg(
      args.flatMap((a) => a.values),
      line
    )
  if (name === 'regedit' || name === 'regedt32') {
    line.result.registry.push('HKEY_* (regedit)')
    return true
  }
  if (COMMON_PROGRAMS.has(name)) return true
  if (CHANGE_DIR.has(name) || BACK_DIR.has(name)) return changeDir(name, args, line)
  const targets = targetsOf(name, args, command, line)
  return targets !== undefined && targets.every((path) => write(line, path))
}

/** Ce qu'écrit une ligne de commande Windows, depuis le dossier `cwd`. */
export function windowsCommandWrites(text: string, cwd: string | undefined): WindowsCommandWrites {
  const result: WindowsCommandWrites = { writes: [], registry: [], privilege: [], unknown: false }
  // `-Verb RunAs` n'importe où (un `powershell -Command "Start-Process … -Verb RunAs"` imbriqué).
  if (/-verb\s*:?\s*["']?runas\b/i.test(text)) result.privilege.push('Start-Process -Verb RunAs')
  const commands = windowsCommands(text)
  if (!commands) {
    result.unknown = true
    // Les droits d'administrateur restent dits quand le reste est illisible.
    const via = /^\s*(sudo|runas|gsudo)(?:\.exe)?\s/i.exec(text)?.[1]?.toLowerCase()
    if (via === 'sudo' || via === 'runas' || via === 'gsudo') result.privilege.push(via)
  } else {
    const line: Line = { result, dir: cwd, singleQuote: text.includes("'") }
    for (const command of commands) if (!readCommand(command, line)) result.unknown = true
  }
  result.privilege = [...new Set(result.privilege)]
  result.registry = [...new Set(result.registry)]
  return result
}
