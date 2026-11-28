/**
 * Commande à copier pour un terminal (fiche 293) : une ligne par commande, mots cités pour le
 * shell de chaque système (plateforme simulée), jamais `&&`, jamais rien d'exécuté qui vienne du
 * nom d'un dossier (relecture adverse du lot 2 : `proj$(touch${IFS}PWNED)` exécutait du code).
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { terminalCommand } from './mcp-oauth-command'

const AUTH = ['opencode', 'mcp', 'auth', 'figma']
const POSIX = process.platform !== 'win32'

/** Noms de dossier hostiles : chacun doit arriver tel quel, sans rien exécuter. */
const HOSTILE = [
  'proj$(touch${IFS}PWNED)',
  'proj`touch PWNED`',
  'a; touch PWNED',
  'a & touch PWNED',
  'a | touch PWNED',
  'a${IFS}b',
  "l'atelier",
  "déjà '\\'' cité",
  '-n',
  '--',
  'mes projets',
  '"cité" $HOME',
  'é à ç 日本 😀',
  'a\\b'
]

describe('« Dans un terminal » : commande à copier (fiche 293)', () => {
  it('sans dossier : la commande seule, sur une ligne, partout', () => {
    for (const platform of ['darwin', 'linux', 'win32'] as const) {
      expect(terminalCommand(platform, AUTH)).toBe('opencode mcp auth figma')
    }
  })

  it.each([
    ['darwin', '/Users/moi/Projets/maquettes', 'cd -- /Users/moi/Projets/maquettes'],
    ['linux', '/home/moi/mes projets', "cd -- '/home/moi/mes projets'"],
    ['darwin', "/Users/moi/l'atelier", "cd -- '/Users/moi/l'\\''atelier'"],
    ['linux', '/home/moi/"cité" $HOME `x`', 'cd -- \'/home/moi/"cité" $HOME `x`\''],
    ['linux', '-n', "cd -- '-n'"],
    ['win32', 'C:\\Users\\moi\\Projets', "Set-Location -LiteralPath 'C:\\Users\\moi\\Projets'"],
    [
      'win32',
      'C:\\Users\\moi\\mes projets',
      "Set-Location -LiteralPath 'C:\\Users\\moi\\mes projets'"
    ],
    [
      'win32',
      "C:\\Users\\moi\\l'atelier [v2] $x",
      "Set-Location -LiteralPath 'C:\\Users\\moi\\l''atelier [v2] $x'"
    ],
    // PowerShell lit aussi les apostrophes typographiques comme des `'` : doublées.
    [
      'win32',
      'C:\\x\u2019; Remove-Item C:\\y; \u2018',
      "Set-Location -LiteralPath 'C:\\x\u2019\u2019; Remove-Item C:\\y; \u2018\u2018'"
    ]
  ] as const)(
    '%s, dossier « %s » : `cd` d’abord, sur sa ligne, puis la commande',
    (platform, cwd, cd) => {
      const text = terminalCommand(platform, AUTH, cwd)
      expect(text?.split('\n')).toEqual([cd, 'opencode mcp auth figma'])
      expect(text).not.toContain('&&')
    }
  )

  it.each([
    ['linux', 'a\nb'],
    ['darwin', 'a\rb'],
    ['linux', 'a\u0000b'],
    ['linux', ''],
    ['win32', 'C:\\a\nb'],
    ['win32', 'C:\\a"b'],
    ['win32', '']
  ] as const)(
    '%s, dossier %j : refusée proprement (pas de « Dans un terminal »)',
    (platform, cwd) => {
      expect(terminalCommand(platform, AUTH, cwd)).toBeUndefined()
    }
  )

  it('un mot variable de la commande (nom du serveur) est cité, ou refusé s’il est illisible', () => {
    expect(terminalCommand('linux', ['opencode', 'mcp', 'auth', 'a;b'])).toBe(
      "opencode mcp auth 'a;b'"
    )
    expect(terminalCommand('linux', ['opencode', 'mcp', 'auth', 'a\nb'])).toBeUndefined()
    expect(terminalCommand('win32', ['opencode', 'mcp', 'auth', "a'b"])).toBe(
      "opencode mcp auth 'a''b'"
    )
  })

  it.skipIf(!POSIX)(
    'vrai `sh` : chaque dossier hostile est atteint tel quel, et rien n’est exécuté',
    () => {
      const base = realpathSync(mkdtempSync(join(tmpdir(), 'mcp-terminal-')))
      try {
        for (const name of HOSTILE) {
          const dir = join(base, name)
          mkdirSync(dir, { recursive: true })
          const [cd] = terminalCommand('linux', AUTH, dir)?.split('\n') ?? []
          // Seulement la ligne `cd` (jamais opencode), puis le dossier atteint.
          const pwd = execFileSync('sh', ['-c', `${cd ?? 'false'} && pwd -P`], {
            cwd: base,
            encoding: 'utf8'
          })
          expect(pwd.trimEnd(), name).toBe(realpathSync(dir))
          expect(existsSync(join(base, 'PWNED')), name).toBe(false)
          expect(existsSync(join(dir, 'PWNED')), name).toBe(false)
        }
      } finally {
        rmSync(base, { recursive: true, force: true })
      }
    }
  )

  it.skipIf(!POSIX)('vrai `sh` : mots de la commande arrivés tels quels', () => {
    for (const word of ["l'atelier", 'mes projets', '"cité"', '$HOME `x` \\n', 'é à ç', "a'b'c"]) {
      const line = terminalCommand('linux', ['printf', '%s', word]) ?? 'false'
      expect(execFileSync('sh', ['-c', line], { encoding: 'utf8' })).toBe(word)
    }
  })
})
