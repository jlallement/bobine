import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { OPENCODE_MCP_AUTH } from './opencode-mcp-auth'
import { TerminalLines } from './mcp-oauth-output'
import type { McpAuthLine } from '../agent/adapters'

const FIXTURES = join(__dirname, 'fixtures', 'opencode-2.3.0-mcp-auth')
const fixture = (name: string) => readFileSync(join(FIXTURES, name))

/** Lignes reconnues d'une sortie relevée, lue comme le moteur la lit. */
function recognized(bytes: Buffer): McpAuthLine[] {
  const found: McpAuthLine[] = []
  const lines = new TerminalLines((line) => {
    const read = OPENCODE_MCP_AUTH.readLine(line)
    if (read) found.push(read)
  })
  lines.push(bytes)
  lines.end()
  return found
}

const URL_RELEVEE =
  'https://www.figma.com/oauth/mcp?response_type=code&client_id=FAKECLIENTID&code_challenge=FAKECHALLENGE&code_challenge_method=S256&redirect_uri=http%3A%2F%2F127.0.0.1%3A54321%2Fcallback&state=FAKESTATE&scope=mcp%3Aconnect&resource=https%3A%2F%2Fmcp.figma.com%2Fmcp'

describe('connexion d’un serveur MCP par OpenCode 2.3.0 (fiche 293, sorties relevées)', () => {
  it('arguments : `--standalone` toujours, sauf la commande à copier dans un terminal', () => {
    expect(OPENCODE_MCP_AUTH.connectArgs('figma')).toEqual(['mcp', 'auth', 'figma', '--standalone'])
    expect(OPENCODE_MCP_AUTH.disconnectArgs('figma')).toEqual([
      'mcp',
      'logout',
      'figma',
      '--standalone'
    ])
    expect(OPENCODE_MCP_AUTH.statesArgs()).toEqual([
      'auth',
      'list',
      '--format',
      'json',
      '--standalone'
    ])
    expect(OPENCODE_MCP_AUTH.terminalArgs('figma')).toEqual(['mcp', 'auth', 'figma'])
  })

  it('sortie réussie relevée : l’adresse seule sur sa ligne, puis « Connected to figma »', () => {
    expect(recognized(fixture('sortie-reussie.txt'))).toEqual([
      { kind: 'url', url: URL_RELEVEE },
      { kind: 'connected' }
    ])
  })

  it('sortie annulée relevée (R6) : l’adresse, puis « Cancelled »', () => {
    expect(recognized(fixture('sortie-annulee.txt'))).toEqual([
      { kind: 'url', url: URL_RELEVEE },
      { kind: 'cancelled' }
    ])
  })

  it('mêmes sorties en CRLF (dépôt extrait sous Windows) : même lecture', () => {
    const crlf = Buffer.from(fixture('sortie-reussie.txt').toString('utf8').replace(/\n/g, '\r\n'))
    expect(recognized(crlf)).toEqual(recognized(fixture('sortie-reussie.txt')))
  })

  it('expiration relevée à l’écran : « ■  Authorization expired » puis « └  Failed »', () => {
    expect(OPENCODE_MCP_AUTH.readLine('■  Authorization expired')).toEqual({ kind: 'expired' })
    expect(OPENCODE_MCP_AUTH.readLine('└  Failed')).toEqual({ kind: 'failed' })
  })

  it('le reste n’est pas reconnu : consignes, tourniquet, adresse au milieu d’une phrase', () => {
    for (const line of [
      '●  Authorize figma in your browser. This window will close automatically.',
      '◇  Waiting for authorization...',
      '└  Done',
      '│',
      'Open https://www.figma.com/oauth/mcp to continue',
      'figma has expired credentials. Re-authenticating...',
      // TODO(R2) : aucun refus n'est inventé tant que sa sortie n'est pas relevée.
      '■  Access denied'
    ]) {
      expect(OPENCODE_MCP_AUTH.readLine(line), line).toBeUndefined()
    }
  })

  it('une adresse de tout schéma est rendue au moteur, qui seul décide (http, javascript…)', () => {
    expect(OPENCODE_MCP_AUTH.readLine('●  http://www.figma.com/oauth')).toEqual({
      kind: 'url',
      url: 'http://www.figma.com/oauth'
    })
    expect(OPENCODE_MCP_AUTH.readLine('●  file:///etc/passwd')?.kind).toBe('url')
  })
})

describe('état des connexions : `opencode auth list --format json` (fiche 293)', () => {
  const read = (data: unknown) => OPENCODE_MCP_AUTH.readStates(JSON.stringify(data))
  const figma = (connections: unknown[]) => ({ id: 'mcp_abc123', name: 'figma', connections })
  const oauth = { type: 'credential', id: 'cred_1', label: 'x', method: 'oauth' }

  it('R5 : serveur déclaré sans connexion, absent de la liste (`[]`) : rien de connecté', () => {
    expect(read([])).toEqual(new Map())
  })

  it('R4 : connexion `oauth` sans `status` : connecté', () => {
    expect(read([figma([oauth])])).toEqual(new Map([['figma', 'connected']]))
  })

  it('`status.needs_auth` (champ facultatif, jamais relevé : R1) : expiré ; autre statut : inconnu', () => {
    expect(read([figma([{ ...oauth, status: { status: 'needs_auth', message: 'm' } }])])).toEqual(
      new Map([['figma', 'expired']])
    )
    expect(read([figma([{ ...oauth, status: { status: 'autre' } }])])).toEqual(
      new Map([['figma', 'unknown']])
    )
    // Plusieurs connexions : une valable suffit.
    expect(
      read([figma([{ ...oauth, status: { status: 'needs_auth' } }, oauth])])?.get('figma')
    ).toBe('connected')
  })

  it('intégrations d’autre nature ignorées : fournisseur de même nom, méthode autre qu’oauth', () => {
    expect(
      read([
        { id: 'anthropic', name: 'figma', connections: [oauth] },
        { id: 'mcp_x', name: 'autre', connections: [{ ...oauth, method: 'api' }] },
        { id: 'mcp_y', name: 'vide', connections: [] },
        'n’importe quoi',
        { id: 'mcp_z', name: 'z' }
      ])
    ).toEqual(new Map())
  })

  it('sortie illisible : `undefined`, jamais « à connecter » par défaut', () => {
    expect(OPENCODE_MCP_AUTH.readStates('No authenticated integrations')).toBeUndefined()
    expect(OPENCODE_MCP_AUTH.readStates('')).toBeUndefined()
    expect(OPENCODE_MCP_AUTH.readStates('{"figma": "stored"}')).toBeUndefined()
  })
})
