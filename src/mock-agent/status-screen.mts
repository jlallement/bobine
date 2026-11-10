/**
 * Faux `bob chat` pour la lecture du quota (fiche 091) : comme Bob Shell 2.0.6, il enregistre une
 * session vide à son lancement, puis affiche le panneau de `/status` (« Fetching budget... », puis
 * le plafond et la consommation) quand on tape la commande. Rien d'autre.
 *
 *   node src/mock-agent/status-screen.mts [--store <dossier>] [--plafond <n|illimite>] [--consomme <n>]
 *
 * Variables d'environnement équivalentes : MOCK_QUOTA_LIMIT, MOCK_QUOTA_USED.
 */
import { randomBytes } from 'node:crypto'
import { parseArgs } from 'node:util'
import { SessionStore } from './store.mts'

const { values } = parseArgs({
  options: {
    store: { type: 'string' },
    plafond: { type: 'string' },
    consomme: { type: 'string' }
  }
})

const limit = values.plafond ?? process.env['MOCK_QUOTA_LIMIT'] ?? '1000'
const used = Number(values.consomme ?? process.env['MOCK_QUOTA_USED'] ?? '812.5')
// Comme Bob : montants à décimales fixes.
const fixed = (n: number) => (n >= 1 ? n.toFixed(2) : n >= 0.01 ? n.toFixed(3) : n.toFixed(4))

// Démarrage lent (MOCK_QUOTA_SLOW_MS) : rien d'écrit ni d'affiché avant ce délai, comme un
// `bob chat` qui tarde à démarrer — l'app peut quitter pendant la lecture (fiche 207).
const slowMs = Number(process.env['MOCK_QUOTA_SLOW_MS'] ?? '0')
if (slowMs > 0) await new Promise((resolve) => setTimeout(resolve, slowMs))

// La tâche vide que `bob chat` crée à son lancement, dans le dossier où il tourne.
const taskId = randomBytes(16).toString('hex')
if (values.store) {
  new SessionStore(values.store).save({
    sessionId: taskId,
    cwd: process.cwd(),
    updatedAt: new Date().toISOString(),
    modeId: 'code',
    model: 'factice-rapide',
    verbose: false,
    history: []
  })
}

const out = (text: string) => process.stdout.write(text.replaceAll('\n', '\r\n'))
const panel = (budget: string, usage: string) =>
  out(
    [
      '',
      '  Task Overview',
      `  Task ID:          ${taskId}`,
      `  Workspace:        file:${process.cwd()}`,
      '',
      `  Monthly Budget:   ${budget}`,
      `  Monthly Usage:    ${usage}`,
      '',
      '  Version:          0.0.0 (factice)',
      '  Press Esc to close',
      ''
    ].join('\n')
  )

out('Bob Shell (agent factice)\n\n> ')
let typed = ''
process.stdin.setRawMode?.(true)
process.stdin.setEncoding('utf8')
process.stdin.on('data', (data: string) => {
  typed += data
  if (!typed.endsWith('/status\r')) return
  typed = ''
  panel('Fetching budget...', 'Fetching budget...')
  setTimeout(() => {
    const budget = limit === 'illimite' ? 'Unlimited' : `${fixed(Number(limit))} 🅞`
    panel(budget, `${fixed(used)} 🅞`)
  }, 300)
})
