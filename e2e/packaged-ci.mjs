/**
 * Essai du paquet sans agent réel : un HOME jetable expose un exécutable OpenCode factice,
 * extérieur à l’app, qui lance l’agent ACP factice du dépôt. L’essai packagé conserve ses
 * assertions (dont l’absence du profil factice dans l’app) et n’envoie aucun prompt.
 *
 *   BOBINE_PACKAGED_APP=/volume/Bobine.app node e2e/packaged-ci.mjs
 */
import { chmodSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const home = mkdtempSync(join(tmpdir(), 'bob-packaged-ci-'))
const bin = join(home, 'bin')
const quote = (value) => "'" + value.replaceAll("'", "'\\''") + "'"

try {
  mkdirSync(bin)
  symlinkSync(process.execPath, join(bin, 'node'))
  const args = [
    join(root, 'src', 'mock-agent', 'main.mts'),
    '--scenario',
    'demo',
    '--store',
    join(home, 'mock-sessions')
  ]
  const fixture = join(bin, 'opencode')
  // JSON.stringify écrit des littéraux JavaScript, jamais une commande shell.
  writeFileSync(
    fixture,
    '#!/usr/bin/env node\n' +
      "const { spawnSync } = require('node:child_process')\n" +
      "if (process.argv.includes('--version')) console.log('0.0.0-packaged-fixture')\n" +
      'else {\n' +
      `  const result = spawnSync(${JSON.stringify(process.execPath)}, ${JSON.stringify(args)}, { stdio: 'inherit' })\n` +
      '  process.exitCode = result.status ?? 1\n' +
      '}\n'
  )
  chmodSync(fixture, 0o755)
  // Le pilote existant simule le Finder avec un PATH minimal : le shell de connexion doit
  // retrouver notre fixture, comme il retrouve l’agent de l’utilisateur en usage réel.
  for (const profile of ['.profile', '.bash_profile', '.bashrc', '.zprofile', '.zshrc']) {
    writeFileSync(join(home, profile), `export PATH=${quote(bin)}:"$PATH"\n`)
  }
  const result = spawnSync(process.execPath, [join(root, 'e2e', 'packaged.mjs')], {
    cwd: root,
    env: { ...process.env, HOME: home, ZDOTDIR: home },
    stdio: 'inherit'
  })
  if (result.error) throw result.error
  process.exitCode = result.status ?? 1
} finally {
  rmSync(home, { recursive: true, force: true })
}
