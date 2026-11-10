/**
 * Installation de la commande `bobine` du terminal (fiche 158). Un petit script `sh` qui résout le
 * dossier demandé puis rouvre Bobine : par `open -n -a` quand l'app est un `.app` (la relance se
 * rattache à l'instance ouverte, `second-instance`), par le binaire sinon (Linux, sources).
 * Les entrées-sorties sont injectées : tout se teste sans toucher au disque.
 */
import {
  accessSync,
  chmodSync,
  constants,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { homedir } from 'node:os'
import { delimiter, dirname, join } from 'node:path'
import { t } from 'i18next'
import type { CommandLineStatus } from '@shared/command-line'

/** Reconnaît un script installé par Bobine (et pas un autre `bobine` du PATH). */
export const COMMAND_MARKER = '# bobine-command'

/** Ce que le script appelle : le `.app` (macOS) ou le binaire de l'app. */
export type CommandLauncher = { bundle: string } | { binary: string }

const quote = (value: string): string => `'${value.replace(/'/g, `'\\''`)}'`

/** Texte du script `bobine` ; `launcher` est écrit en dur (l'app peut être déplacée : réinstaller). */
export function commandScript(launcher: CommandLauncher): string {
  const [open, start] =
    'bundle' in launcher
      ? [`open -a ${quote(launcher.bundle)}`, `open -n -a ${quote(launcher.bundle)} --args "$dir"`]
      : [`${quote(launcher.binary)} >/dev/null 2>&1 &`, `${quote(launcher.binary)} "$dir"`]
  const background = 'bundle' in launcher ? '' : ' >/dev/null 2>&1 &'
  return `#!/bin/sh
${COMMAND_MARKER} — installé par Bobine (Réglages › Général). ${JSON.stringify(launcher)}
# Usage : bobine <dossier> ["premier message"]
# Ouvre une nouvelle conversation dans le dossier ; le message est posé dans la zone de saisie,
# jamais envoyé tout seul.
if [ "$#" -eq 0 ]; then
  ${open}
  exit 0
fi
if [ ! -d "$1" ]; then
  echo "bobine : « $1 » n'est pas un dossier." >&2
  exit 1
fi
dir=$(cd "$1" && pwd -P) || exit 1
shift
if [ "$#" -gt 0 ]; then
  # « -- » : un message qui commence par « - » reste un message, pas une option.
  ${start} -- "$*"${background}
else
  ${start}${background}
fi
`
}

export interface CommandLineIo {
  canWrite: (dir: string) => boolean
  ensureDir: (dir: string) => void
  read: (path: string) => string | undefined
  write: (path: string, content: string) => void
  remove: (path: string) => void
}

export function nodeCommandLineIo(): CommandLineIo {
  return {
    canWrite: (dir) => {
      try {
        accessSync(dir, constants.W_OK)
        return true
      } catch {
        return false
      }
    },
    ensureDir: (dir) => mkdirSync(dir, { recursive: true }),
    read: (path) => {
      try {
        return readFileSync(path, 'utf8')
      } catch {
        return undefined
      }
    },
    write: (path, content) => {
      writeFileSync(path, content)
      chmodSync(path, 0o755)
    },
    remove: (path) => rmSync(path, { force: true })
  }
}

export const SYSTEM_BIN = '/usr/local/bin'

export class CommandLine {
  private readonly io: CommandLineIo
  private readonly launcher: () => CommandLauncher
  private readonly home: string
  private readonly pathEnv: () => string
  private readonly systemBin: string

  constructor(options: {
    io?: CommandLineIo
    launcher: () => CommandLauncher
    home?: string
    pathEnv?: () => string
    /** Dossier système imposé (essais) à la place de `/usr/local/bin`. */
    systemBin?: string
  }) {
    this.io = options.io ?? nodeCommandLineIo()
    this.launcher = options.launcher
    this.home = options.home ?? homedir()
    this.pathEnv = options.pathEnv ?? (() => process.env['PATH'] ?? '')
    this.systemBin = options.systemBin ?? SYSTEM_BIN
  }

  private get userBin(): string {
    return join(this.home, '.local', 'bin')
  }

  /** Où le script s'écrit : `/usr/local/bin` si on peut y écrire, sinon `~/.local/bin`. */
  private target(): string {
    return this.io.canWrite(this.systemBin) ? this.systemBin : this.userBin
  }

  status(): CommandLineStatus {
    const expected = commandScript(this.launcher())
    for (const dir of [this.systemBin, this.userBin]) {
      const path = join(dir, 'bobine')
      const content = this.io.read(path)
      if (content?.includes(COMMAND_MARKER)) {
        return {
          path,
          current: content === expected,
          inPath: this.inPath(dir),
          target: this.target()
        }
      }
    }
    const target = this.target()
    return { current: false, inPath: this.inPath(target), target }
  }

  install(): CommandLineStatus {
    const dir = this.target()
    const path = join(dir, 'bobine')
    // Un `bobine` qui n'est pas le nôtre n'est jamais écrasé.
    const existing = this.io.read(path)
    if (existing !== undefined && !existing.includes(COMMAND_MARKER)) {
      throw new Error(t('ipc.unavailable.commandExists', { path }))
    }
    this.io.ensureDir(dirname(path))
    this.io.write(path, commandScript(this.launcher()))
    return this.status()
  }

  uninstall(): CommandLineStatus {
    for (const dir of [this.systemBin, this.userBin]) {
      const path = join(dir, 'bobine')
      if (this.io.read(path)?.includes(COMMAND_MARKER)) this.io.remove(path)
    }
    return this.status()
  }

  private inPath(dir: string): boolean {
    return this.pathEnv().split(delimiter).includes(dir)
  }
}
