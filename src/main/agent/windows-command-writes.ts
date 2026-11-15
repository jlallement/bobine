/**
 * Ce qu'une ligne de commande Windows écrit (fiche 229, lot 3) : le pendant de `command-writes.ts`
 * (shell POSIX) pour PowerShell et `cmd`, que lance un agent sous Windows. Sous Windows, Bobine ne
 * sait pas d'avance quel shell l'agent emploie : la lecture vaut pour les deux, volontairement
 * étroite, et **échoue fermé** — ce qu'elle ne sait pas lire est dit « écritures inconnues »
 * (`unknown`), jamais « aucune écriture ».
 *
 * Lu : redirections (`>`, `>>`, `2>`, `*>`…, sauf `$null` et `NUL`), cmdlets et commandes qui
 * écrivent (`Set-Content`, `Out-File`, `New-Item`, `Remove-Item`, `Copy-Item`, `Move-Item`,
 * `Rename-Item`, `copy`, `move`, `del`, `rd`, `md`, `xcopy`, `robocopy`…), le registre (`reg add`,
 * `regedit`, `Set-ItemProperty HKCU:\…`), les droits d'administrateur (`sudo`, `runas`, `gsudo`,
 * `Start-Process -Verb RunAs`). Seules les commandes connues pour ne rien écrire (`dir`,
 * `Get-ChildItem`, `type`, `git status`…) passent sans réserve ; toute autre (`npm`, un script,
 * un shell imbriqué, un bloc `{ … }`, un échappement `` ` `` ou `^`) rend `unknown`.
 */

import type { WindowsPrivilegeCommand } from '@shared/permissions'

export interface WindowsCommandWrites {
  /** Chemins écrits, tels qu'écrits dans la commande (à résoudre par l'appelant). */
  writes: { path: string; cwd: string | undefined }[]
  /** Clés du registre modifiées (`HKCU\Software\…`), telles qu'écrites. */
  registry: string[]
  privilege: WindowsPrivilegeCommand[]
  /** Une partie de la commande n'a pas pu être lue : elle peut écrire n'importe où. */
  unknown: boolean
}

/** Commandes qui n'écrivent rien (sans redirection). Noms en minuscules, sans `.exe`. */
const READ_ONLY = new Set([
  'dir',
  'ls',
  'gci',
  'get-childitem',
  'type',
  'cat',
  'gc',
  'get-content',
  'echo',
  'write-output',
  'write-host',
  'where',
  'findstr',
  'select-string',
  'sls',
  'get-item',
  'gi',
  'get-itemproperty',
  'gp',
  'test-path',
  'resolve-path',
  'get-location',
  'gl',
  'pwd',
  'get-command',
  'gcm',
  'get-process',
  'gps',
  'whoami',
  'hostname',
  'ver',
  'tree',
  'more',
  'fc',
  'comp',
  'select-object',
  'select',
  'where-object',
  '?',
  'sort-object',
  'format-table',
  'ft',
  'format-list',
  'fl',
  'out-string',
  'out-host',
  'measure-object',
  'measure',
  'get-date',
  'get-filehash',
  'get-acl',
  'get-psdrive',
  'get-volume',
  'systeminfo',
  'tasklist',
  'ipconfig',
  'netstat',
  'get-help',
  'help',
  'get-member',
  'gm',
  'convertto-json',
  'convertfrom-json',
  'cls',
  'clear-host',
  'exit',
  'rem'
])

/** Changent le dossier des chemins relatifs qui suivent. */
const CHANGE_DIR = new Set(['cd', 'chdir', 'set-location', 'sl', 'push-location', 'pushd'])

/** `git` ne lit que pour ces sous-commandes. */
const GIT_READ_ONLY = new Set([
  'status',
  'diff',
  'log',
  'show',
  'rev-parse',
  'ls-files',
  'blame',
  'grep'
])

/** Écrivent tous leurs opérandes (et `-Path`, `-LiteralPath`, `-FilePath`). */
const ALL_OPERANDS = new Set([
  'del',
  'erase',
  'rd',
  'rmdir',
  'md',
  'mkdir',
  'remove-item',
  'ri',
  'rm',
  'new-item',
  'ni',
  'clear-content',
  'clc',
  'set-content',
  'add-content',
  'ac',
  'out-file',
  'export-csv',
  'epcsv',
  'tee-object',
  'tee',
  'set-item',
  'si',
  'rename-item',
  'rni',
  'ren',
  'rename'
])

/** Écrivent leur dernier opérande (ou `-Destination`) : copie, déplacement. */
const DESTINATION = new Set([
  'copy',
  'cp',
  'cpi',
  'copy-item',
  'move',
  'mv',
  'mi',
  'move-item',
  'xcopy'
])

/** Paramètres PowerShell qui prennent une valeur (qui n'est pas un chemin écrit). */
const VALUE_PARAMS = new Set([
  '-value',
  '-encoding',
  '-itemtype',
  '-type',
  '-name',
  '-filter',
  '-include',
  '-exclude',
  '-delimiter',
  '-inputobject',
  '-width',
  '-stream',
  '-credential',
  '-newname',
  '-propertytype',
  '-depth',
  '-verb',
  '-argumentlist',
  '-workingdirectory',
  '-pattern'
])
const PATH_PARAMS = new Set(['-path', '-literalpath', '-filepath', '-pspath', '-lp'])
const DESTINATION_PARAMS = new Set(['-destination'])

/** Cmdlets qui modifient une clé du registre quand on leur donne un chemin `HKCU:\…`. */
const REGISTRY_WRITERS = new Set([
  'set-itemproperty',
  'sp',
  'new-itemproperty',
  'remove-itemproperty',
  'rp',
  'rename-itemproperty',
  'rnp',
  'clear-itemproperty',
  'clp',
  'copy-itemproperty',
  'cpp',
  'move-itemproperty',
  'mp',
  'new-item',
  'ni',
  'remove-item',
  'ri',
  'rm',
  'del',
  'set-item',
  'si',
  'rename-item',
  'rni',
  'copy-item',
  'cpi',
  'move-item',
  'mi',
  'clear-item',
  'cli'
])
const REGISTRY_PATH =
  /^(?:hk(?:lm|cu|cr|u|cc):|hkey_[a-z_]+|registry::|microsoft\.powershell\.core\\registry::)/i
const REG_WRITES = new Set(['add', 'delete', 'import', 'restore', 'load', 'unload', 'copy'])

/** Cibles de redirection qui ne sont pas des fichiers. */
const NOT_A_FILE = /^(?:\$null|nul|nul:|con|con:)$/i

/** Opérateurs qui séparent deux commandes, hors guillemets. */
const SEPARATORS = ['&&', '||', ';', '|', '&', '\n', '\r']

/** Mots d'une ligne : guillemets `"…"` et `'…'` ôtés ; `undefined` si illisible. */
interface Segment {
  words: string[]
  redirects: string[]
}

function segments(text: string): Segment[] | undefined {
  // Échappements (`` ` `` de PowerShell, `^` de cmd), sous-expressions, blocs : illisibles.
  if (/[`^]|\$\(|@\(|[{}]/.test(text)) return undefined
  const out: Segment[] = []
  let words: string[] = []
  let redirects: string[] = []
  let word = ''
  let quoted = false
  let redirectNext = false
  const flush = () => {
    if (!word && !quoted) return
    if (redirectNext) redirects.push(word)
    else words.push(word)
    redirectNext = false
    word = ''
    quoted = false
  }
  for (let i = 0; i < text.length; i++) {
    const c = text[i] ?? ''
    if (c === '"' || c === "'") {
      const end = text.indexOf(c, i + 1)
      if (end < 0) return undefined
      word += text.slice(i + 1, end)
      quoted = true
      i = end
      continue
    }
    const sep = SEPARATORS.find((s) => text.startsWith(s, i))
    // `& "C:\outil.exe"` en tête : l'opérateur d'appel de PowerShell, pas un séparateur.
    const call = sep === '&' && !word && words.length === 0 && !quoted
    if (sep && !call) {
      flush()
      if (redirectNext) return undefined
      out.push({ words, redirects })
      words = []
      redirects = []
      i += sep.length - 1
      continue
    }
    if (c === ' ' || c === '\t') {
      flush()
      continue
    }
    if (c === '>' || (/[0-9*]/.test(c) && text[i + 1] === '>' && !word)) {
      const match = /^[0-9*]?>>?(&[0-9]?)?/.exec(text.slice(i))?.[0] ?? '>'
      flush()
      i += match.length - 1
      // `2>&1` : vers un autre flux, pas un fichier.
      if (!match.includes('&')) redirectNext = true
      continue
    }
    if (c === '<') return undefined
    word += c
  }
  flush()
  if (redirectNext) return undefined
  out.push({ words, redirects })
  return out.filter((s) => s.words.length > 0 || s.redirects.length > 0)
}

const commandName = (word: string) =>
  word
    .replace(/^.*[\\/]/, '')
    .replace(/\.(exe|com)$/i, '')
    .toLowerCase()

/** Mot d'option : `-Force`, `/s` (une barre et des lettres, pas un chemin `/c/Users`). */
const isOption = (word: string) => /^-/.test(word) || /^\/[a-z?]+(?::\S*)?$/i.test(word)

/** Opérandes et paramètres nommés d'une commande. */
function operands(words: readonly string[]) {
  const positional: string[] = []
  const named = new Map<string, string[]>()
  for (let i = 0; i < words.length; i++) {
    const word = words[i] ?? ''
    const lower = word.toLowerCase()
    const takes = PATH_PARAMS.has(lower) || DESTINATION_PARAMS.has(lower) || VALUE_PARAMS.has(lower)
    if (takes && i + 1 < words.length) {
      named.set(lower, [...(named.get(lower) ?? []), words[i + 1] ?? ''])
      i++
    } else if (!isOption(word)) positional.push(word)
  }
  const get = (keys: ReadonlySet<string>) => [...keys].flatMap((k) => named.get(k) ?? [])
  return { positional, paths: get(PATH_PARAMS), destination: get(DESTINATION_PARAMS), named }
}

/** Lecture d'une commande (un segment) ; `false` si elle n'est pas lue. */
function readSegment(
  segment: Segment,
  result: WindowsCommandWrites,
  cwd: { dir: string | undefined }
) {
  const at = (path: string) => ({ path, cwd: cwd.dir })
  for (const target of segment.redirects)
    if (!NOT_A_FILE.test(target)) result.writes.push(at(target))
  let words = segment.words
  if (words[0] === '&') words = words.slice(1)
  if (words.length === 0) return true
  const name = commandName(words[0] ?? '')
  const args = words.slice(1)
  if (name === 'sudo' || name === 'runas' || name === 'gsudo') {
    result.privilege.push(name as WindowsPrivilegeCommand)
    return false
  }
  if (name === 'start-process' || name === 'saps' || name === 'start') {
    const verb = operands(args).named.get('-verb')
    if (verb?.some((v) => v.toLowerCase() === 'runas'))
      result.privilege.push('Start-Process -Verb RunAs')
    return false
  }
  if (name === 'reg') return readReg(args, result, at)
  if (name === 'regedit' || name === 'regedt32') {
    result.registry.push('HKEY_* (regedit)')
    return true
  }
  if (name === 'git') return GIT_READ_ONLY.has((args.find((a) => !isOption(a)) ?? '').toLowerCase())
  const parsed = operands(args)
  const all = [...parsed.positional, ...parsed.paths, ...parsed.destination]
  if (REGISTRY_WRITERS.has(name) && all.some((a) => REGISTRY_PATH.test(a))) {
    result.registry.push(...all.filter((a) => REGISTRY_PATH.test(a)))
    return all.every((a) => REGISTRY_PATH.test(a))
  }
  if (CHANGE_DIR.has(name) || name === 'popd' || name === 'pop-location') {
    return changeDir(name, parsed.paths[0] ?? parsed.positional[0], cwd)
  }
  if (READ_ONLY.has(name)) return true
  if (ALL_OPERANDS.has(name)) {
    const targets = [...parsed.positional, ...parsed.paths]
    result.writes.push(...targets.map(at))
    return targets.length > 0
  }
  if (DESTINATION.has(name)) {
    const target =
      parsed.destination[0] ?? (parsed.positional.length > 1 ? parsed.positional.at(-1) : undefined)
    if (target === undefined) return false
    result.writes.push(at(target))
    return true
  }
  if (name === 'robocopy') {
    const target = parsed.positional[1]
    if (target === undefined) return false
    result.writes.push(at(target))
    return true
  }
  return false
}

/**
 * `cd C:\…` : les chemins relatifs qui suivent partent de là. Vers un dossier relatif, ou retour par
 * `popd` : le dossier n'est plus connu, ce qui suit en relatif sera dit inconnu.
 */
function changeDir(name: string, dir: string | undefined, cwd: { dir: string | undefined }) {
  if (name === 'popd' || name === 'pop-location') {
    cwd.dir = undefined
    return true
  }
  if (dir === undefined) return true
  cwd.dir = /^[a-z]:[\\/]/i.test(dir) ? dir : undefined
  return cwd.dir !== undefined
}

/** `reg add|delete|import…` : le registre ; `reg query` : rien ; `reg export clé fichier` : le fichier. */
function readReg(
  args: readonly string[],
  result: WindowsCommandWrites,
  at: (path: string) => { path: string; cwd: string | undefined }
) {
  const sub = (args[0] ?? '').toLowerCase()
  if (sub === 'query' || sub === 'compare') return true
  if (sub === 'export' || sub === 'save') {
    const file = args.filter((a) => !isOption(a))[2]
    if (file === undefined) return false
    result.writes.push(at(file))
    return true
  }
  if (!REG_WRITES.has(sub)) return false
  result.registry.push(args[1] ?? 'HKEY_*')
  return args[1] !== undefined
}

/** Ce qu'écrit une ligne de commande Windows, depuis le dossier `cwd`. */
export function windowsCommandWrites(text: string, cwd: string | undefined): WindowsCommandWrites {
  const result: WindowsCommandWrites = { writes: [], registry: [], privilege: [], unknown: false }
  // `-Verb RunAs` n'importe où (un `powershell -Command "Start-Process … -Verb RunAs"` imbriqué).
  if (/-verb\s+["']?runas\b/i.test(text)) result.privilege.push('Start-Process -Verb RunAs')
  const parsed = segments(text)
  if (!parsed) {
    result.unknown = true
    // Les droits d'administrateur restent dits quand le reste est illisible.
    if (/^\s*(sudo|runas|gsudo)(\.exe)?\s/i.test(text)) {
      const via = text
        .trim()
        .split(/\s/)[0]
        ?.replace(/\.exe$/i, '')
        .toLowerCase()
      if (via === 'sudo' || via === 'runas' || via === 'gsudo') result.privilege.push(via)
    }
  } else {
    const place = { dir: cwd }
    for (const segment of parsed) if (!readSegment(segment, result, place)) result.unknown = true
  }
  result.privilege = [...new Set(result.privilege)]
  return result
}
