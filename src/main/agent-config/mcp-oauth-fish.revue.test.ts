import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { terminalCommand } from './mcp-oauth-command'

/*
 * Essai R5 du testeur (second passage du lot 2, sur `4ca2e240`), gardé comme essai permanent.
 * Adapté à la décision du tech lead : sous POSIX, un mot qui contient un antislash est **refusé**
 * (pas de « Dans un terminal ») ; la ligne attendue est donc absente, ce que l'essai vérifie
 * d'abord. Assertions de fish et de « rien d'exécuté » intactes ; celle « sh va bien dans le
 * dossier » ne peut plus valoir (il n'y a plus de ligne) : remplacée par le refus.
 */

/**
 * Lecture d'une ligne par fish, d'après ses règles documentées : hors guillemets, `\x` échappe x et
 * `;` sépare ; entre apostrophes, seuls `\'` et `\\` sont des échappements. Rend les commandes.
 * Simulateur : fish n'est pas installé sur la machine de la revue.
 */
function fishCommands(line: string): string[][] {
  const cmds: string[][] = [[]]
  let tok = ''
  let has = false
  let q = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i] ?? ''
    if (q) {
      if (c === '\\' && (line[i + 1] === "'" || line[i + 1] === '\\')) {
        tok += line[++i]
        continue
      }
      if (c === "'") {
        q = false
        continue
      }
      tok += c
      continue
    }
    if (c === '\\') {
      tok += line[++i] ?? ''
      has = true
      continue
    }
    if (c === "'") {
      q = true
      has = true
      continue
    }
    if (c === ' ' || c === ';') {
      if (has || tok) cmds[cmds.length - 1]?.push(tok)
      tok = ''
      has = false
      if (c === ';') cmds.push([])
      continue
    }
    tok += c
    has = true
  }
  if (q) throw new Error('apostrophe ouverte')
  if (has || tok) cmds[cmds.length - 1]?.push(tok)
  return cmds.filter((c) => c.length)
}

it.skipIf(process.platform === 'win32')(
  'R5 fish : dossier contenant une barre oblique inverse puis une apostrophe',
  () => {
    const base = mkdtempSync(join(tmpdir(), 'mcp-fish-'))
    try {
      const ws = join(base, "a\\';touch PWNED;:\\'b")
      mkdirSync(ws, { recursive: true })
      const line = terminalCommand('darwin', ['opencode', 'mcp', 'auth', 'figma'], ws)
      expect(line).toBeUndefined()
      const cd = (line ?? '').split('\n')[0] ?? ''
      // sh, bash, zsh : rien d'exécuté (aucune ligne à coller).
      for (const shell of ['/bin/sh', '/bin/bash', '/bin/zsh'].filter((s) => existsSync(s))) {
        if (cd) execFileSync(shell, ['-c', cd], { cwd: base })
        expect(existsSync(join(base, 'PWNED'))).toBe(false)
      }
      // fish : `touch PWNED` devient une commande.
      expect(fishCommands(cd).some((c) => c[0] === 'touch')).toBe(false)
    } finally {
      rmSync(base, { recursive: true, force: true })
    }
  }
)
