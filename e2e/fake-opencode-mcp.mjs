/**
 * Fausse commande de connexion des serveurs MCP (fiche 293) pour les essais de bout en bout :
 * jamais le vrai OpenCode, jamais Figma, aucun réseau. Imposée par `BOBINE_FAKE_MCP_AUTH` (lancée
 * par l'exécutable de l'app comme Node, sans shell : portable), elle imite les sorties relevées
 * d'OpenCode 2.3.0 (`src/main/agent-config/fixtures/opencode-2.3.0-mcp-auth/`). Son état est un
 * fichier JSON (`FAKE_OPENCODE_MCP_STATE`) que l'essai modifie :
 *   { mode, logout, connected: { <nom>: 'ok' | 'expired' }, approve }
 * Chaque appel est ajouté, une ligne JSON, à `<état>.calls` (jamais réécrit : pas de course avec
 * l'essai qui change l'état). Seules la déconnexion et l'accord écrivent l'état.
 * - `mcp auth <nom> --standalone`, selon `mode` :
 *   `success` : l'adresse de la page, puis « Waiting for authorization... » ; quand l'essai écrit
 *   `approve: true`, la connexion est notée et « Connected to <nom> » ; `hang` : la page, puis
 *   rien (l'app arrête la commande : « Annuler », délai) ; `unexpected` : une page sur un autre
 *   hôte ; `unknown-command` : commande inconnue, sans page (OpenCode trop ancien) ;
 * - `mcp logout <nom> --standalone` : la connexion est oubliée (`logout: 'keep'` : gardée) ;
 * - `auth list --format json --standalone` : les connexions notées, au format relevé (R5).
 * La commande s'arrête seule au bout de deux minutes : jamais d'orphelin.
 */
import { appendFileSync, readFileSync, renameSync, writeFileSync } from 'node:fs'

const stateFile = process.env.FAKE_OPENCODE_MCP_STATE
const args = process.argv.slice(2)

const read = () => {
  for (let i = 0; ; i++) {
    try {
      return JSON.parse(readFileSync(stateFile, 'utf8'))
    } catch (error) {
      // Fichier en cours de remplacement par l'essai : relu un peu plus tard.
      if (i > 50) throw error
    }
  }
}
const write = (state) => {
  const temp = `${stateFile}.${process.pid}.tmp`
  writeFileSync(temp, JSON.stringify(state, null, 2))
  renameSync(temp, stateFile)
}
const note = () => {
  appendFileSync(`${stateFile}.calls`, `${JSON.stringify(args)}\n`)
  return read()
}

/** Adresse de la page comme OpenCode l'écrit (valeurs factices, retour vers cette machine). */
const page = (host) =>
  `https://${host}/oauth/mcp?response_type=code&client_id=E2E_CLIENT&code_challenge=E2E_CHALLENGE&code_challenge_method=S256&redirect_uri=http%3A%2F%2F127.0.0.1%3A54321%2Fcallback&state=E2E_STATE&scope=mcp%3Aconnect`

const [first, second, name] = args
if (first === 'auth' && second === 'list') {
  const { connected = {} } = note()
  const list = Object.entries(connected).map(([server, kind]) => ({
    id: `mcp_${server}`,
    name: server,
    connections: [
      {
        type: 'credential',
        id: `cred_${server}`,
        label: server,
        method: 'oauth',
        ...(kind === 'expired' ? { status: { status: 'needs_auth', message: 'expired' } } : {})
      }
    ]
  }))
  process.stdout.write(`${JSON.stringify(list)}\n`)
} else if (first === 'mcp' && second === 'logout') {
  const state = note()
  if (state.logout !== 'keep') delete state.connected?.[name]
  write(state)
  process.stdout.write(`Removed OAuth credentials for ${name}\n`)
} else if (first === 'mcp' && second === 'auth') {
  const { mode } = note()
  if (mode === 'unknown-command') {
    process.stderr.write(`Error: unknown command "auth"\n`)
    process.exit(1)
  }
  const out = (line) => process.stdout.write(`${line}\n`)
  out('┌  MCP OAuth Authentication')
  out('│')
  out(`●  Authorize ${name} in your browser. This window will close automatically.`)
  out('│')
  out(page(mode === 'unexpected' ? 'www.figma.com.evil.test' : 'www.figma.com'))
  out('│')
  out('◒  Waiting for authorization...')
  setTimeout(() => process.exit(0), 120_000)
  if (mode === 'success') {
    setInterval(() => {
      const state = read()
      if (!state.approve) return
      state.approve = false
      state.connected = { ...state.connected, [name]: 'ok' }
      write(state)
      out(`●  Connected to ${name}`)
      out('└  Done')
      process.exit(0)
    }, 100)
  } else setInterval(() => {}, 1000)
} else {
  note()
  process.stderr.write(`commande inconnue : ${args.join(' ')}\n`)
  process.exit(1)
}
