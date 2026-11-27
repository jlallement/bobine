// Fausse commande de connexion d'un agent (fiche 293), pour les essais du moteur : jamais le vrai
// OpenCode, jamais Figma, aucun réseau. Comme OpenCode 2.3.0 (relevé R6), `mcp auth` lance un
// enfant (son « serveur privé ») puis écrit la sortie relevée jusqu'à « Waiting for
// authorization... », et attend d'être arrêté. `auth list` rend `[]` (relevé R5).
//   node fake-agent-mcp-auth.mjs mcp auth <nom> --standalone
//     FAKE_MCP_AUTH_BEAT : fichier où l'enfant écrit un battement (compteur) toutes les 100 ms ;
//     il s'arrête seul si `<battement>.stop` existe, ou au bout d'une minute (jamais d'orphelin).
//   node fake-agent-mcp-auth.mjs auth list --format json --standalone
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const [first, second] = process.argv.slice(2)
if (first === 'auth' && second === 'list') {
  process.stdout.write('[]\n')
} else if (first === 'mcp' && second === 'auth') {
  // Enfant du même arbre (le « serveur privé »), qui bat tant qu'il vit.
  const beat = process.env.FAKE_MCP_AUTH_BEAT
  const heart = `
    const fs = require('node:fs')
    const file = ${JSON.stringify(beat)}
    let n = 0
    const timer = setInterval(() => {
      if (fs.existsSync(file + '.stop')) process.exit(0)
      fs.writeFileSync(file, String(++n))
    }, 100)
    setTimeout(() => process.exit(0), 60000)
  `
  spawn(process.execPath, ['-e', heart], { stdio: 'ignore' })
  const here = dirname(fileURLToPath(import.meta.url))
  const output = readFileSync(join(here, 'opencode-2.3.0-mcp-auth', 'sortie-reussie.txt'))
  const waiting = output.indexOf(Buffer.from('Waiting for authorization...'))
  const shown = output.subarray(0, output.indexOf(0x0a, waiting) + 1)
  // En morceaux, comme un vrai flux.
  for (let i = 0; i < shown.length; i += 97) process.stdout.write(shown.subarray(i, i + 97))
  setTimeout(() => process.exit(3), 60000)
} else {
  process.stderr.write(`commande inconnue : ${process.argv.slice(2).join(' ')}\n`)
  process.exit(1)
}
