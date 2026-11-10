/**
 * Ce qu'une ligne de shell écrit, et si elle demande les droits d'administrateur (fiche 211).
 * Lecture volontairement étroite, pour ne signaler que des écritures : cibles de redirection
 * (`>`, `>>`, `&>`, `2>`…, sauf `/dev/null` et ses pareils), opérandes de `tee`, destination de
 * `cp` / `mv` / `ln` / `install` / `rsync`, opérandes de `rm` / `rmdir` / `mkdir` / `touch` /
 * `chmod` / `chown` / `chgrp` / `truncate` / `unlink` / `shred`, `of=` de `dd`, fichiers de
 * `sed -i`. Une lecture (`ls`, `cat`, `grep`…) ne compte jamais.
 *
 * Au moindre doute — ce que `shellTokens` ne sait pas lire, `eval`, un shell lancé avec `-c`
 * (`bash -c`, `sh -lc`) — aucune écriture n'est rendue : pas de signalement plutôt qu'un faux. Les
 * droits d'administrateur (commande en tête d'un segment) sont dits quand même. Un chemin qui
 * dépend d'une variable inconnue est ignoré. `cd` déplace le dossier des chemins relatifs qui
 * suivent ; `(` … `)` le rétablit.
 */
import { PRIVILEGE_COMMANDS, type PrivilegeCommand } from '@shared/permissions'
import { normalizePath } from '@shared/command-view'
import { shellTokens, type ShellToken } from './shell-words'

export interface CommandWrites {
  /** Chemins absolus normalisés (`.` et `..` résolus lexicalement), dans l'ordre d'apparition. */
  writes: string[]
  privilege: PrivilegeCommand[]
}

/** Où une commande lit et écrit : le dossier de départ (absolu) et le dossier personnel. */
export interface CommandPlace {
  cwd: string | undefined
  home: string
}

/** Cibles qui ne sont pas des fichiers. */
const NOT_A_FILE = /^\/dev\/(null|stdout|stderr|stdin|tty|zero|fd\/\d+)$/

/** Redirections qui écrivent. `>&` n'en est une que vers un fichier (pas `>&2`). */
const WRITE_REDIRECTS = new Set(['>', '>>', '>|', '&>', '&>>', '<>', '>&'])

const SHELLS = new Set(['sh', 'bash', 'zsh', 'dash', 'ksh', 'fish', 'csh', 'tcsh'])

/** Mots qui précèdent la vraie commande sans la changer (options passées à part). */
const PASS_THROUGH: Record<string, ReadonlySet<string>> = {
  env: new Set(['-u', '--unset', '-C', '--chdir']),
  command: new Set(),
  builtin: new Set(),
  exec: new Set(['-a']),
  nohup: new Set(),
  time: new Set(),
  nice: new Set(['-n']),
  xargs: new Set(['-I', '-n', '-P', '-L', '-d', '-E', '-s', '-a']),
  sudo: new Set(['-u', '-g', '-p', '-C', '-D', '-h', '-r', '-t', '-U', '-T', '-R']),
  doas: new Set(['-u', '-C']),
  pkexec: new Set(['--user'])
}

/** Mots-clés du shell en tête de commande : la commande suit. */
const KEYWORDS = new Set(['!', '{', '}', 'if', 'then', 'else', 'elif', 'do', 'while', 'until'])

/** Commandes dont tous les opérandes sont modifiés ; valeur : options qui prennent un argument. */
const ALL_OPERANDS: Record<string, ReadonlySet<string>> = {
  rm: new Set(),
  rmdir: new Set(),
  unlink: new Set(),
  shred: new Set(['-n', '-s']),
  mkdir: new Set(['-m']),
  touch: new Set(['-d', '-r', '-t']),
  truncate: new Set(['-s', '-r']),
  tee: new Set()
}

/** Commandes dont le premier opérande n'est pas un fichier (mode, propriétaire). */
const AFTER_FIRST = new Set(['chmod', 'chown', 'chgrp'])

/** Commandes dont la DERNIÈRE opérande (ou `-t DOSSIER`) est écrite ; options à argument. */
const DESTINATION: Record<string, ReadonlySet<string>> = {
  cp: new Set(['-t', '-S']),
  mv: new Set(['-t', '-S']),
  ln: new Set(['-t', '-S']),
  install: new Set(['-t', '-m', '-o', '-g', '-S']),
  rsync: new Set(['-e', '-f', '--rsh', '--filter', '--exclude', '--include'])
}

const basename = (word: string) => word.slice(word.lastIndexOf('/') + 1)
const isAssignment = (word: string) => /^[A-Za-z_][A-Za-z0-9_]*=/.test(word)

type Word = Extract<ShellToken, { type: 'word' }>

/** Opérandes d'une commande : options ôtées (et leur argument), `--` respecté. */
function operands(words: Word[], withArg: ReadonlySet<string>): Word[] {
  const out: Word[] = []
  let options = true
  for (let i = 0; i < words.length; i++) {
    const word = words[i] as Word
    if (options && word.value === '--') {
      options = false
      continue
    }
    if (options && word.value.startsWith('-') && word.value !== '-') {
      if (withArg.has(word.value)) i++
      continue
    }
    out.push(word)
  }
  return out
}

/** Valeur de `-t DOSSIER`, `-tDOSSIER` ou `--target-directory=DOSSIER`. */
function targetDirectory(words: Word[]): Word | undefined {
  for (let i = 0; i < words.length; i++) {
    const value = (words[i] as Word).value
    if (value === '-t') return words[i + 1]
    if (value.startsWith('--target-directory='))
      return { ...(words[i] as Word), value: value.slice('--target-directory='.length) }
  }
  return undefined
}

/** Fichiers modifiés par `sed -i` (GNU `-i`, `-i.bak` ; macOS `-i ''`). */
function sedTargets(args: Word[]): Word[] {
  if (!args.some((w) => w.value.startsWith('-i') || w.value.startsWith('--in-place'))) return []
  const files: Word[] = []
  let script = false
  for (let i = 0; i < args.length; i++) {
    const value = (args[i] as Word).value
    if (value === '-i' && args[i + 1]?.value === '') i++
    else if (value === '-e' || value === '-f') {
      script = true
      i++
    } else if (!value.startsWith('-') || value === '-') files.push(args[i] as Word)
  }
  return script ? files : files.slice(1)
}

/** Opérandes écrites par la commande `name` (sans les options qui précèdent). */
function writtenOperands(name: string, args: Word[]): Word[] {
  const all = ALL_OPERANDS[name]
  if (all) return operands(args, all)
  if (AFTER_FIRST.has(name)) {
    const ops = operands(args, new Set())
    return args.some((w) => w.value.startsWith('--reference=')) ? ops : ops.slice(1)
  }
  const destination = DESTINATION[name]
  if (destination) {
    const target = targetDirectory(args)
    if (target) return [target]
    const ops = operands(args, destination)
    const last = ops.length >= 2 ? ops.at(-1) : undefined
    // rsync vers une autre machine (`hôte:chemin`) : pas un chemin d'ici.
    if (!last || (name === 'rsync' && /^[^/]*:/.test(last.value))) return []
    return [last]
  }
  if (name === 'dd')
    return args
      .filter((w) => w.value.startsWith('of='))
      .map((w) => ({ ...w, value: w.value.slice(3) }))
  if (name === 'sed' || name === 'gsed') return sedTargets(args)
  return []
}

class Analysis {
  readonly writes: string[] = []
  readonly privilege: PrivilegeCommand[] = []
  private cwd: string | undefined
  private readonly saved: (string | undefined)[] = []

  private readonly place: CommandPlace

  constructor(place: CommandPlace) {
    this.place = place
    this.cwd = place.cwd
  }

  open(): void {
    this.saved.push(this.cwd)
  }

  close(): void {
    if (this.saved.length > 0) this.cwd = this.saved.pop()
  }

  private resolve(word: Word): string | undefined {
    if (!word.known || word.value === '') return undefined
    const path = word.value.startsWith('/')
      ? word.value
      : this.cwd
        ? `${this.cwd}/${word.value}`
        : undefined
    return path === undefined ? undefined : normalizePath(path)
  }

  private write(word: Word | undefined): void {
    if (!word) return
    const path = this.resolve(word)
    if (path && !NOT_A_FILE.test(path) && !this.writes.includes(path)) this.writes.push(path)
  }

  private elevate(via: PrivilegeCommand): void {
    if (!this.privilege.includes(via)) this.privilege.push(via)
  }

  /** Une commande simple : ses redirections, puis son nom après les préfixes ; `false` = doute. */
  simple(tokens: ShellToken[]): boolean {
    const words: Word[] = []
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i] as ShellToken
      if (token.type === 'word') words.push(token)
      else if (token.type === 'redirect') {
        const target = tokens[i + 1]
        if (target?.type !== 'word') continue
        i++
        if (!WRITE_REDIRECTS.has(token.op)) continue
        if (token.op === '>&' && /^(\d+|-)$/.test(target.value)) continue
        this.write(target)
      }
    }
    return this.command(words)
  }

  private command(all: Word[]): boolean {
    let words = all
    while (words.length > 0) {
      const head = words[0] as Word
      const name = basename(head.value)
      if (isAssignment(head.value) || KEYWORDS.has(head.value)) {
        words = words.slice(1)
        continue
      }
      if (name === 'eval') return false
      if (SHELLS.has(name) && words.slice(1).some((w) => /^-[a-z]*c[a-z]*$/i.test(w.value)))
        return false
      if ((PRIVILEGE_COMMANDS as readonly string[]).includes(name))
        this.elevate(name as PrivilegeCommand)
      // `su` : la suite est une ligne à part (`su -c '…'`), non lue.
      if (name === 'su') return true
      const pass = PASS_THROUGH[name]
      if (!pass) break
      words = this.skipOptions(words.slice(1), pass)
    }
    const [head, ...args] = words
    if (!head) return true
    const name = basename(head.value)
    if (name === 'cd') {
      this.cd(args)
      return true
    }
    for (const target of writtenOperands(name, args)) this.write(target)
    return true
  }

  /** Options d'un préfixe (`sudo -u x`, `env -i A=1`), jusqu'à la commande. */
  private skipOptions(words: Word[], withArg: ReadonlySet<string>): Word[] {
    let i = 0
    while (i < words.length) {
      const value = (words[i] as Word).value
      if (value === '--') return words.slice(i + 1)
      if (!value.startsWith('-') || value === '-') break
      i += withArg.has(value) ? 2 : 1
    }
    return words.slice(i)
  }

  private cd(args: Word[]): void {
    const [target] = operands(args, new Set())
    if (!target) {
      this.cwd = this.place.home
      return
    }
    this.cwd = target.value === '-' ? undefined : this.resolve(target)
  }
}

/**
 * Ce que la ligne écrit et les droits qu'elle demande. Au moindre doute, aucune écriture n'est
 * rendue ; les droits d'administrateur, eux, restent dits (`sudo bash -c "…"`, `sudo $(…)` : la
 * commande lancée en tête de segment est lisible même si le reste ne l'est pas).
 */
export function commandWrites(command: string, place: CommandPlace): CommandWrites {
  const { tokens, doubt } = shellTokens(command, { home: place.home })
  const analysis = new Analysis(place)
  let readable = !doubt
  let current: ShellToken[] = []
  const flush = () => {
    if (!analysis.simple(current)) readable = false
    current = []
  }
  for (const token of tokens) {
    if (token.type !== 'op') {
      current.push(token)
      continue
    }
    flush()
    if (token.value === '(') analysis.open()
    if (token.value === ')') analysis.close()
  }
  flush()
  return { writes: readable ? analysis.writes : [], privilege: analysis.privilege }
}
