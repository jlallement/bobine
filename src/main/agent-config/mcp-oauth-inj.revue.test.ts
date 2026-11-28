/**
 * Essai Q4 du testeur (relecture adverse du lot 2), gardé comme essai permanent. Adapté au contrat
 * de `e3168542` : la commande n'est plus faite par `joinCommandLine` + `&&` mais par
 * `terminalCommand` (`cd -- '…' && <commande>`, une seule ligne depuis la seconde relecture) ;
 * dossier temporaire au lieu d'un chemin fixe ; la commande copiée est `pwd` au lieu de celle
 * d'OpenCode (jamais lancé par les essais). Assertion intacte : coller la ligne n'exécute rien du
 * nom du dossier.
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
      const cdPart = terminalCommand('linux', ['pwd'], ws) ?? ''
      try {
        execFileSync('/bin/sh', ['-c', cdPart], { cwd: base, stdio: 'ignore' })
      } catch {}
      expect(existsSync(join(base, 'PWNED'))).toBe(false)
    } finally {
      rmSync(base, { recursive: true, force: true })
    }
  }
)
