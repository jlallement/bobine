import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import { AppToolServer } from '../mcp/tool-server'
import { probeMcpServer } from './mcp-probe'

const FIXTURE = join(__dirname, '../../../e2e/fixtures/mcp-serveur.mjs')
const stdio = (...args: string[]) => ({
  name: 'essai',
  transport: 'stdio' as const,
  command: process.execPath,
  args: [FIXTURE, ...args],
  enabled: true
})
const servers: AppToolServer[] = []
afterEach(() => servers.splice(0).forEach((s) => s.stop()))

describe('« Tester » un serveur MCP (fiche 060)', () => {
  it('commande locale : serveur, outils sur deux pages, prompts ; répond à ses requêtes', async () => {
    const result = await probeMcpServer(stdio(), { cwd: tmpdir() })
    expect(result).toMatchObject({
      ok: true,
      server: { name: 'essai-bobine', version: '1.2.3' },
      tools: ['echo', 'additionner', 'lire_note'],
      prompts: 1
    })
    expect(result.ok && result.resources).toBeUndefined()
    // Poids des définitions (fiche 166) : estimé, jamais nul quand il y a des outils.
    expect(result.ok && result.toolTokens).toBeGreaterThan(10)
  })

  it('serveur HTTP (celui de l’app) : session, outils', async () => {
    const app = new AppToolServer()
    servers.push(app)
    await app.start()
    const endpoint = app.register([
      {
        definition: { name: 'ask_user', description: 'Question', inputSchema: { type: 'object' } },
        autoAllow: true,
        call: async () => ({ content: [{ type: 'text', text: 'ok' }] })
      }
    ])
    const result = await probeMcpServer(
      { name: 'app', transport: 'http', url: endpoint?.url ?? '', enabled: true },
      { cwd: tmpdir() }
    )
    expect(result).toMatchObject({ ok: true, tools: ['ask_user'] })
  })

  it('erreurs lisibles : serveur qui s’arrête (avec sa sortie), muet, introuvable, adresse fausse', async () => {
    const crash = await probeMcpServer(stdio('--plante'), { cwd: tmpdir() })
    expect(crash.ok).toBe(false)
    expect(!crash.ok && crash.error).toContain('code 3')
    expect(!crash.ok && crash.error).toContain('SERVICE_TOKEN manquante')

    const mute = await probeMcpServer(stdio('--muet'), { cwd: tmpdir(), timeoutMs: 800 })
    expect(!mute.ok && mute.error).toContain('Pas de réponse à temps')

    const missing = await probeMcpServer(
      { name: 'x', transport: 'stdio', command: '/nulle/part/serveur', enabled: true },
      { cwd: tmpdir() }
    )
    expect(!missing.ok && missing.error).toContain('introuvable')

    const http = await probeMcpServer(
      { name: 'x', transport: 'http', url: 'http://127.0.0.1:9/mcp', enabled: true },
      { cwd: tmpdir(), timeoutMs: 3000 }
    )
    expect(http.ok).toBe(false)
  })
})
