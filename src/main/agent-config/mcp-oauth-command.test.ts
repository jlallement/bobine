/**
 * Commande à copier pour un terminal (fiche 293) : une ligne par commande, mots cités pour le
 * shell de chaque système (plateforme simulée), jamais `&&`.
 */
import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { terminalCommand } from './mcp-oauth-command'

const AUTH = ['opencode', 'mcp', 'auth', 'figma']

describe('« Dans un terminal » : commande à copier (fiche 293)', () => {
  it('sans dossier : la commande seule, sur une ligne, partout', () => {
    for (const platform of ['darwin', 'linux', 'win32'] as const) {
      expect(terminalCommand(platform, AUTH)).toBe('opencode mcp auth figma')
    }
  })

  it.each([
    ['darwin', '/Users/moi/Projets/maquettes', 'cd /Users/moi/Projets/maquettes'],
    ['linux', '/home/moi/mes projets', "cd '/home/moi/mes projets'"],
    ['darwin', "/Users/moi/l'atelier", "cd '/Users/moi/l'\\''atelier'"],
    ['linux', '/home/moi/"cité" $HOME `x`', 'cd \'/home/moi/"cité" $HOME `x`\''],
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
    ]
  ] as const)(
    '%s, dossier « %s » : `cd` d’abord, sur sa ligne, puis la commande',
    (platform, cwd, cd) => {
      const text = terminalCommand(platform, AUTH, cwd)
      expect(text.split('\n')).toEqual([cd, 'opencode mcp auth figma'])
      expect(text).not.toContain('&&')
    }
  )

  it.skipIf(process.platform === 'win32')(
    'citation POSIX vérifiée par un vrai `sh` : espaces, guillemets, apostrophes, `$`, accents',
    () => {
      for (const word of [
        "l'atelier",
        'mes projets',
        '"cité"',
        '$HOME `x` \\n',
        'é à ç',
        "a'b'c"
      ]) {
        const line = terminalCommand('linux', ['printf', '%s', word])
        expect(execFileSync('sh', ['-c', line], { encoding: 'utf8' })).toBe(word)
      }
    }
  )
})
