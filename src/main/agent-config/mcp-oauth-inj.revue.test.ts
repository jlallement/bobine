/**
 * Essai Q4 du testeur (relecture adverse du lot 2), gardé comme essai permanent. Adapté au contrat
 * de `e3168542` : la commande n'est plus faite par `joinCommandLine` + `&&` mais par
 * `terminalCommand` (une ligne `cd`, puis la commande) ; dossier temporaire au lieu d'un chemin
 * fixe. Assertion intacte : coller la ligne `cd` n'exécute rien du nom du dossier.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { terminalCommand } from './mcp-oauth-command'

it.skipIf(process.platform === 'win32')(
  'Q4 commande copiée : un nom de dossier exécute du code au collage',
  () => {
    const base = mkdtempSync(join(tmpdir(), 'mcp-inj-'))
    try {
      rmSync(join(base, 'PWNED'), { force: true })
      const ws = join(base, 'proj$(touch${IFS}PWNED)')
      mkdirSync(ws, { recursive: true })
      const line = terminalCommand('linux', ['opencode', 'mcp', 'auth', 'figma'], ws) ?? ''
      // On n'exécute que la partie « cd », jamais opencode.
      const cdPart = line.split('\n')[0] ?? ''
      try {
        execFileSync('/bin/sh', ['-c', cdPart], { cwd: base, stdio: 'ignore' })
      } catch {}
      expect(existsSync(join(base, 'PWNED'))).toBe(false)
    } finally {
      rmSync(base, { recursive: true, force: true })
    }
  }
)
