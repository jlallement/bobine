#!/usr/bin/env node
// Serveur MCP d'essai (stdio, fiche 060) : trois outils sur deux pages, un prompt, et une requête
// du serveur vers le client (racines) à laquelle le client doit répondre.
//   --muet    ne répond jamais        --plante  s'arrête avec un message d'erreur
import { appendFileSync } from 'node:fs'
import { createInterface } from 'node:readline'

// Chaque lancement noté dans ce fichier, s'il est donné : l'onglet « Session » n'en lance aucun
// de lui-même (fiche 166).
if (process.env.MCP_FIXTURE_MARK) appendFileSync(process.env.MCP_FIXTURE_MARK, 'lancé\n')

const mode = process.argv[2]
if (mode === '--plante') {
  process.stderr.write('Clé SERVICE_TOKEN manquante\n')
  process.exit(3)
}
process.stderr.write('serveur d’essai prêt\n')
const send = (message) =>
  process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', ...message })}\n`)
const tools = (names) => names.map((name) => ({ name, inputSchema: { type: 'object' } }))
createInterface({ input: process.stdin }).on('line', (line) => {
  if (mode === '--muet') return
  const m = JSON.parse(line)
  switch (m.method) {
    case 'initialize':
      return send({
        id: m.id,
        result: {
          protocolVersion: m.params.protocolVersion,
          capabilities: { tools: {}, prompts: {} },
          serverInfo: { name: 'essai-bobine', version: '1.2.3' }
        }
      })
    case 'notifications/initialized':
      // Le client doit répondre, même « méthode inconnue », sans rester bloqué.
      return send({ id: 'racines-1', method: 'roots/list' })
    case 'tools/list':
      return send(
        m.params?.cursor === 'page-2'
          ? { id: m.id, result: { tools: tools(['lire_note']) } }
          : { id: m.id, result: { tools: tools(['echo', 'additionner']), nextCursor: 'page-2' } }
      )
    case 'prompts/list':
      return send({ id: m.id, result: { prompts: [{ name: 'resumer' }] } })
    default:
      if (m.id !== undefined && m.method) {
        send({ id: m.id, error: { code: -32601, message: 'Method not found' } })
      }
  }
})
