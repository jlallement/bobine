/**
 * Point d'entrée de l'agent ACP factice (stdio).
 *
 *   node src/mock-agent/main.mts [--scenario <nom>] [--delay <ms>] [--pas-morceaux <ms>]
 *
 * Variables d'environnement équivalentes : MOCK_AGENT_SCENARIO, MOCK_AGENT_DELAY_MS, MOCK_AGENT_LANG,
 * MOCK_AGENT_PANNE (`--panne`, fiche 195), MOCK_AGENT_MAX_ETAPES (`--max-etapes`, fiche 209), MOCK_AGENT_SLOW_START_MS (`--demarrage-lent`), `--verrou-fin-de-tour <fichier>` (aucun tour ne finit tant que le fichier existe), MOCK_AGENT_TENACE=1 (ignore SIGTERM et la fin de la connexion, fiche 195), MOCK_AGENT_COMMIT (scénario d'une demande de message de commit, fiche 246), MOCK_AGENT_PID_FILE (pid inscrit au lancement, essais), MOCK_AGENT_SLOW_CANCEL_MS (un tour annulé répond après ce délai)
 * (`--langue en` : l'agent parle anglais, fiche 167). `--modes-installes bob|opencode --perso <dossier>` :
 * modes installés comme Bob ou OpenCode, listés après les siens (fiche 223).
 * stdout est réservé au protocole : les journaux vont sur stderr.
 */
import { appendFileSync } from 'node:fs'
import { Readable, Writable } from 'node:stream'
import { parseArgs } from 'node:util'
import { ndJsonStream } from '../shared/acp-sdk.mts'
import { connectMockAgent, MOCK_FAILURES, type MockFailure } from './agent.mts'
import { mockLanguage } from './langue.mts'
import { DEFAULT_SCENARIO, scenarios } from './scenarios.mts'

const { values } = parseArgs({
  options: {
    scenario: { type: 'string' },
    delay: { type: 'string' },
    'pas-morceaux': { type: 'string' },
    list: { type: 'boolean' },
    'sans-options': { type: 'boolean' },
    'sans-historique': { type: 'boolean' },
    'sans-rejeu': { type: 'boolean' },
    titres: { type: 'boolean' },
    'titres-invite': { type: 'boolean' },
    'mode-depart': { type: 'string' },
    trust: { type: 'boolean' },
    store: { type: 'string' },
    'sans-usage': { type: 'boolean' },
    devise: { type: 'string' },
    'rejeu-tardif': { type: 'boolean' },
    'rejeu-tardif-ms': { type: 'string' },
    'sans-images': { type: 'boolean' },
    sso: { type: 'boolean' },
    'demarrage-bloque': { type: 'boolean' },
    panne: { type: 'string' },
    'demarrage-lent': { type: 'string' },
    'verrou-demarrage': { type: 'string' },
    'verrou-fin-de-tour': { type: 'string' },
    'sans-plan': { type: 'boolean' },
    'suit-outils': { type: 'boolean' },
    'arriere-plan-ms': { type: 'string' },
    'sans-reprise': { type: 'boolean' },
    'reglages-oublies': { type: 'boolean' },
    'bob-db': { type: 'string' },
    'journal-messages': { type: 'string' },
    'cout-bob': { type: 'boolean' },
    'sans-cout': { type: 'boolean' },
    'cout-nul': { type: 'boolean' },
    'dossiers-en-plus': { type: 'boolean' },
    nom: { type: 'string' },
    vitrine: { type: 'boolean' },
    'max-etapes': { type: 'string' },
    langue: { type: 'string' },
    'modes-installes': { type: 'string' },
    perso: { type: 'string' },
    'scenario-par-modele': { type: 'string' },
    'refuser-modele': { type: 'string' },
    'modele-retombe': { type: 'string' }
  }
})

if (values.list) {
  for (const [name, s] of Object.entries(scenarios)) console.error(`${name}\t${s.description}`)
  process.exit(0)
}

const scenario = values.scenario ?? process.env['MOCK_AGENT_SCENARIO'] ?? DEFAULT_SCENARIO
const delayMs = Number(values.delay ?? process.env['MOCK_AGENT_DELAY_MS'] ?? 40)
// Pas des morceaux de texte seulement (fiche 279) : `delayMs` à défaut.
const chunkText = values['pas-morceaux'] ?? process.env['MOCK_AGENT_CHUNK_MS']
const chunkDelayMs = chunkText === undefined || chunkText === '' ? undefined : Number(chunkText)

// Demande de message de commit (fiche 246) : `MOCK_AGENT_COMMIT` choisit le scénario joué.
const commitScenario = process.env['MOCK_AGENT_COMMIT'] ?? 'message-commit'
if (!scenarios[commitScenario]) {
  console.error(`[mock-agent] scénario de commit inconnu : ${commitScenario} (voir --list)`)
  process.exit(2)
}
// Essais (fiche 246) : chaque processus inscrit son pid, pour vérifier qu'aucun ne survit.
const pidFile = process.env['MOCK_AGENT_PID_FILE']
if (pidFile) appendFileSync(pidFile, `${process.pid}\n`)

if (!scenarios[scenario]) {
  console.error(`[mock-agent] scénario inconnu : ${scenario} (voir --list)`)
  process.exit(2)
}
const failure = values.panne ?? process.env['MOCK_AGENT_PANNE']
if (failure && !(MOCK_FAILURES as readonly string[]).includes(failure)) {
  console.error(`[mock-agent] panne inconnue : ${failure} (${MOCK_FAILURES.join(', ')})`)
  process.exit(2)
}
// Limite d'étapes d'une session (fiche 209) : scénarios `limite-etapes-*`.
const maxStepsText = values['max-etapes'] ?? process.env['MOCK_AGENT_MAX_ETAPES']
const maxSteps = maxStepsText === undefined ? undefined : Number(maxStepsText)
if (maxSteps !== undefined && (!Number.isInteger(maxSteps) || maxSteps < 1)) {
  console.error(`[mock-agent] limite d'étapes invalide : ${String(maxStepsText)}`)
  process.exit(2)
}
// Modes installés comme Bob ou OpenCode (fiche 223, phase 4), lus sous un dossier personnel d'essai.
const installedKind = values['modes-installes']
if (installedKind && (!['bob', 'opencode'].includes(installedKind) || !values.perso)) {
  console.error('[mock-agent] --modes-installes bob|opencode demande --perso <dossier>')
  process.exit(2)
}
if (!Number.isFinite(delayMs) || delayMs < 0) {
  console.error(`[mock-agent] délai invalide : ${String(values.delay)}`)
  process.exit(2)
}
if (chunkDelayMs !== undefined && (!Number.isFinite(chunkDelayMs) || chunkDelayMs < 0)) {
  console.error(`[mock-agent] pas des morceaux invalide : ${String(chunkText)}`)
  process.exit(2)
}

// Tour de table (fiche 285) : scénario par modèle (`modèle=scénario,…`), modèles refusés ou qui
// retombent en silence (`a,b`).
const list = (value: string | undefined) =>
  (value ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
const byModelEntries = list(
  values['scenario-par-modele'] ?? process.env['MOCK_AGENT_SCENARIO_BY_MODEL']
).map((entry) => entry.split('=').map((part) => part.trim()) as [string, string])
for (const [model, name] of byModelEntries) {
  if (!model || !name || !scenarios[name]) {
    console.error(`[mock-agent] scénario par modèle invalide : ${model}=${name} (voir --list)`)
    process.exit(2)
  }
}
const scenarioByModel = Object.fromEntries(byModelEntries)
const refusedModels = list(values['refuser-modele'] ?? process.env['MOCK_AGENT_REFUSE_MODEL'])
const fallbackModels = list(values['modele-retombe'] ?? process.env['MOCK_AGENT_FALLBACK_MODEL'])

const stream = ndJsonStream(
  Writable.toWeb(process.stdout) as WritableStream<Uint8Array>,
  Readable.toWeb(process.stdin) as ReadableStream<Uint8Array>
)
const connection = connectMockAgent(stream, {
  scenario,
  commitScenario,
  delayMs,
  ...(chunkDelayMs !== undefined ? { chunkDelayMs } : {}),
  withConfigOptions: !values['sans-options'],
  withHistory: !values['sans-historique'],
  withReplay: !values['sans-rejeu'],
  withTitles: values.titres === true,
  promptTitles: values['titres-invite'] === true,
  ...(values['mode-depart'] ? { startModeKey: values['mode-depart'] } : {}),
  trustAll: values.trust === true,
  storeDir: values.store ?? process.env['MOCK_AGENT_STORE'],
  withUsage: !values['sans-usage'],
  lateReplay: values['rejeu-tardif'] === true || values['rejeu-tardif-ms'] !== undefined,
  ...(values['rejeu-tardif-ms'] ? { lateReplayMs: Number(values['rejeu-tardif-ms']) } : {}),
  textOnly: values['sans-images'] === true,
  announceSso: values.sso === true,
  stallInitialize: values['demarrage-bloque'] === true,
  ...(failure ? { failure: failure as MockFailure } : {}),
  ...((values['demarrage-lent'] ?? process.env['MOCK_AGENT_SLOW_START_MS'])
    ? { slowStartMs: Number(values['demarrage-lent'] ?? process.env['MOCK_AGENT_SLOW_START_MS']) }
    : {}),
  ...(values['verrou-fin-de-tour'] ? { turnLock: values['verrou-fin-de-tour'] } : {}),
  ...((values['verrou-demarrage'] ?? process.env['MOCK_AGENT_START_LOCK'])
    ? { startLock: values['verrou-demarrage'] ?? process.env['MOCK_AGENT_START_LOCK'] }
    : {}),
  ...(process.env['MOCK_AGENT_SLOW_CANCEL_MS']
    ? { slowCancelMs: Number(process.env['MOCK_AGENT_SLOW_CANCEL_MS']) }
    : {}),
  withoutPlan: values['sans-plan'] === true,
  followTools: values['suit-outils'] === true || process.env['MOCK_AGENT_SUIT_OUTILS'] === '1',
  ...(values['arriere-plan-ms'] ? { backgroundMs: Number(values['arriere-plan-ms']) } : {}),
  withoutResume: values['sans-reprise'] === true,
  forgetControls: values['reglages-oublies'] === true,
  ...(values['bob-db'] ? { bobDb: values['bob-db'] } : {}),
  ...(values['journal-messages'] ? { promptLog: values['journal-messages'] } : {}),
  ...(values['cout-bob'] ? { bobCost: true } : {}),
  ...(values['sans-cout'] ? { withoutCost: true } : {}),
  ...(values['cout-nul'] ? { zeroCost: true } : {}),
  ...(values['dossiers-en-plus'] ? { additionalDirectories: true } : {}),
  ...(values.nom ? { title: values.nom } : {}),
  ...(values.vitrine ? { showcase: true } : {}),
  ...(maxSteps !== undefined ? { maxSteps } : {}),
  language: mockLanguage(values.langue ?? process.env['MOCK_AGENT_LANG']),
  ...(values.devise ? { costCurrency: values.devise } : {}),
  ...(byModelEntries.length ? { scenarioByModel } : {}),
  ...(refusedModels.length ? { refusedModels } : {}),
  ...(fallbackModels.length ? { fallbackModels } : {}),
  ...(installedKind && values.perso
    ? { installedModes: { kind: installedKind as 'bob' | 'opencode', home: values.perso } }
    : {})
})
// Agent tenace (fiche 195) : ignore SIGTERM et survit à la fin de sa connexion ; seul un SIGKILL
// l'arrête (essais « rien ne reste en quittant » et orphelins après un `kill -9` de Bobine).
const stubborn = process.env['MOCK_AGENT_TENACE'] === '1'
if (stubborn) {
  process.on('SIGTERM', () => {})
  setInterval(() => {}, 60_000)
}
console.error(
  `[mock-agent] prêt (scénario : ${scenario}, délai : ${delayMs} ms${chunkDelayMs !== undefined ? `, morceaux : ${chunkDelayMs} ms` : ''})`
)

connection.signal.addEventListener('abort', () => {
  if (!stubborn) process.exit(0)
})
