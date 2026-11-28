/**
 * Commande à copier pour un terminal (fiche 293) : mots cités pour le shell de chaque système
 * (plateforme simulée) ; macOS et Linux, une seule ligne `cd -- '…' && …` ; Windows (PowerShell),
 * deux lignes ; jamais rien d'exécuté qui vienne du nom d'un dossier (relectures adverses du lot 2 :
 * `proj$(touch${IFS}PWNED)` sous sh, `a\';touch PWNED;:\'b` sous fish).
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
  "déjà '' cité",
  '-n',
  '--',
  'mes projets',
  '"cité" $HOME',
  'é à ç 日本 😀',
  '=ls',
  '%self',
  '~root',
  '*',
  '!!',
  '{a,b}',
  '#x'
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
    // Lus autrement par zsh (`=cmd`) ou fish (`%self`) s'ils restaient nus : cités.
    ['linux', '=ls', "cd -- '=ls'"],
    ['darwin', '%self', "cd -- '%self'"]
  ] as const)(
    '%s, dossier « %s » : une seule ligne, `cd` puis `&&` puis la commande',
    (platform, cwd, cd) => {
      expect(terminalCommand(platform, AUTH, cwd)).toBe(`${cd} && opencode mcp auth figma`)
    }
  )

  it.each([
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
    '%s, dossier « %s » : PowerShell, deux lignes (`Set-Location`, puis la commande)',
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
    ['win32', ''],
    // Antislash : fish le lit comme un échappement entre apostrophes (R5), sh non. Refusé.
    ['darwin', "a\\';touch PWNED;:\\'b"],
    ['linux', 'a\\b'],
    ['linux', '\\'],
    ['darwin', "/Users/moi/l\\'atelier"]
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
    expect(terminalCommand('linux', ['opencode', 'mcp', 'auth', 'a\\b'])).toBeUndefined()
    expect(terminalCommand('win32', ['opencode', 'mcp', 'auth', 'a\\b'])).toBe(
      "opencode mcp auth 'a\\b'"
    )
    expect(terminalCommand('linux', ['A=b', 'x'])).toBe("'A=b' x")
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
          // La ligne entière, avec `pwd -P` à la place de la commande de l'agent (jamais opencode).
          const line = terminalCommand('linux', ['pwd', '-P'], dir)
          expect(line, name).toBeDefined()
          const pwd = execFileSync('sh', ['-c', line ?? 'false'], {
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
    for (const word of [
      "l'atelier",
      'mes projets',
      '"cité"',
      '$HOME `x`',
      'é à ç',
      "a'b'c",
      '=x'
    ]) {
      const line = terminalCommand('linux', ['printf', '%s', word]) ?? 'false'
      expect(execFileSync('sh', ['-c', line], { encoding: 'utf8' })).toBe(word)
    }
  })

  it.skipIf(!POSIX)(
    'dossier disparu : le `cd` échoue, la commande ne part pas (une seule ligne, `&&`)',
    () => {
      const base = realpathSync(mkdtempSync(join(tmpdir(), 'mcp-gone-')))
      try {
        const gone = join(base, 'parti')
        const line = terminalCommand('linux', ['touch', join(base, 'RAN')], gone) ?? 'false'
        for (const shell of SHELLS) {
          try {
            execFileSync(shell, ['-c', line], { cwd: base, stdio: 'ignore' })
          } catch {
            // `cd` en échec : code de sortie non nul, attendu.
          }
          expect(existsSync(join(base, 'RAN')), shell).toBe(false)
        }
      } finally {
        rmSync(base, { recursive: true, force: true })
      }
    }
  )

  it.skipIf(!POSIX)(
    'sh, bash, zsh (ceux présents) et fish (ses règles) lisent la même ligne, mot pour mot',
    () => {
      const base = realpathSync(mkdtempSync(join(tmpdir(), 'mcp-shells-')))
      try {
        // Sans antislash (refusé, essai à part) : chaque caractère de l'alphabet passe au moins une fois.
        const usable = ALPHABET.filter((c) => c !== '\\')
        const words = (seed: number) => WORDS.map((w, i) => w + usable[(seed + i) % usable.length])
        for (let seed = 0; seed < 40; seed++) {
          const [dirName = 'x', ...args] = words(seed)
          const dir = join(base, `d${seed}-${dirName.replace(/\//g, '_')}`)
          mkdirSync(dir, { recursive: true })
          const line = terminalCommand('linux', ['printf', '%s|', ...args], dir)
          expect(line, dirName).toBeDefined()
          const expected = args.map((a) => `${a}|`).join('')
          for (const shell of SHELLS) {
            const out = execFileSync(shell, ['-c', line ?? 'false'], {
              cwd: base,
              encoding: 'utf8'
            })
            expect(out, `${shell} ${line}`).toBe(expected)
          }
          expect(fishRead(line ?? '')).toEqual([
            ['cd', '--', dir],
            ['printf', '%s|', ...args]
          ])
          expect(existsSync(join(base, 'PWNED'))).toBe(false)
        }
      } finally {
        rmSync(base, { recursive: true, force: true })
      }
    }
  )

  it('fish (ses règles) : toute ligne produite se lit en mots exacts, sans autre syntaxe', () => {
    for (let seed = 0; seed < 300; seed++) {
      const word = Array.from(
        { length: 1 + (seed % 7) },
        (_, i) => ALPHABET[(seed * 7 + i * 13) % ALPHABET.length]
      ).join('')
      const line = terminalCommand('darwin', ['opencode', 'mcp', 'auth', word], `/p/${word}`)
      if (word.includes('\\')) {
        expect(line, word).toBeUndefined()
        continue
      }
      expect(fishRead(line ?? ''), word).toEqual([
        ['cd', '--', `/p/${word}`],
        ['opencode', 'mcp', 'auth', word]
      ])
    }
  })

  it('le lecteur fish de l’essai est fidèle à ses règles (sinon l’essai ne prouverait rien)', () => {
    // Entre apostrophes, `\'` et `\\` sont des échappements (documentation de fish, « Quotes »).
    // Ligne de l'ancienne citation pour le dossier `a\';touch PWNED;:\'b` (R5) : fish y voit `;`.
    expect(() => fishRead("cd -- 'a\\'\\'';touch PWNED;:\\'\\''b'")).toThrow(/fish/)
    expect(fishRead("echo 'a\\\\b'")).toEqual([['echo', 'a\\b']])
    expect(fishRead("echo 'l'\\''x'")).toEqual([['echo', "l'x"]])
    expect(() => fishRead('echo %self')).toThrow(/fish/)
    expect(() => fishRead('echo $HOME')).toThrow(/fish/)
    expect(fishRead('cd -- /a && b c')).toEqual([
      ['cd', '--', '/a'],
      ['b', 'c']
    ])
  })
})

/** Shells POSIX présents sur la machine (zsh et bash peuvent manquer sous Linux). */
const SHELLS = POSIX ? ['/bin/sh', '/bin/bash', '/bin/zsh'].filter((s) => existsSync(s)) : []

/** Morceaux hostiles (un par mot) et caractères ajoutés : de quoi croiser les règles des shells. */
const WORDS = ["l'a", 'x y', '$(touch PWNED)', '`touch PWNED`', 'a;touch PWNED', '=ls', '%self']
const ALPHABET = [...'\'"$`;&|<>(){}[]*?~!#^%=@+:,. -é😀', '\\']

/**
 * Lecture d'une ligne par fish ≥ 3, d'après ses règles documentées (fishshell.com, « The fish
 * language » : Quotes, Escaping characters, Combining pipes and blocks) — fish n'est pas installé
 * sur les machines d'essai. Entre apostrophes, seuls `\'` et `\\` sont des échappements, tout le
 * reste est littéral ; hors apostrophes, `\x` vaut x ; `&&` enchaîne deux commandes ; tout autre
 * caractère spécial hors apostrophes (`$ * ? ~ { } ( ) [ ] ; & | < > # % ^ " !`) fait **échouer**
 * la lecture : la ligne aurait une autre syntaxe que des mots. Rend les commandes, en mots.
 */
function fishRead(line: string): string[][] {
  const commands: string[][] = [[]]
  let word = ''
  let started = false
  let quoted = false
  const push = () => {
    if (started) commands[commands.length - 1]?.push(word)
    word = ''
    started = false
  }
  for (let i = 0; i < line.length; i++) {
    const c = line[i] ?? ''
    if (quoted) {
      if (c === '\\' && (line[i + 1] === "'" || line[i + 1] === '\\')) word += line[++i]
      else if (c === "'") quoted = false
      else word += c
      continue
    }
    if (c === "'") {
      quoted = started = true
    } else if (c === '\\') {
      word += line[++i] ?? ''
      started = true
    } else if (c === ' ') {
      push()
    } else if (c === '&' && line[i + 1] === '&' && !started) {
      i++
      commands.push([])
    } else if (/[$*?~{}()[\];&|<>#%^"!]/.test(c)) {
      throw new Error(`fish : « ${c} » hors apostrophes`)
    } else {
      word += c
      started = true
    }
  }
  if (quoted) throw new Error('fish : apostrophe ouverte')
  push()
  return commands.filter((c) => c.length)
}
