/**
 * Branchement de la connexion par l'agent sur l'app (fiche 293) : la garde des essais suit bien
 * `app.isPackaged` (relecture adverse du lot 2, point 6). Dans l'app installée, ni fausse commande
 * (`BOBINE_FAKE_MCP_AUTH`), ni délai raccourci (`BOBINE_FAKE_MCP_AUTH_MS`), ni page notée dans un
 * fichier (`BOBINE_OPEN_LOG`) ; dans l'app de développement, les trois.
 */
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { McpOAuthAppDeps } from './mcp-settings'

const electron = vi.hoisted(() => ({
  app: { isPackaged: false },
  shell: { openExternal: vi.fn(async (_url: string) => {}) }
}))
const captured = vi.hoisted(() => ({ deps: undefined as unknown }))

vi.mock('electron', () => electron)
vi.mock('../app-windows', () => ({ broadcast: vi.fn() }))
vi.mock('./api-keys', () => ({ withEnvChanges: (env: unknown) => env }))
vi.mock('./mcp-settings', () => ({
  McpSettings: vi.fn(function (_profiles: unknown, _locations: unknown, deps: unknown) {
    captured.deps = deps
  })
}))

const { setupMcpSettings } = await import('./mcp-oauth-setup')

const ENV = ['BOBINE_FAKE_MCP_AUTH', 'BOBINE_FAKE_MCP_AUTH_MS', 'BOBINE_OPEN_LOG'] as const
const saved = Object.fromEntries(ENV.map((k) => [k, process.env[k]]))
afterEach(() => {
  for (const k of ENV) {
    if (saved[k] === undefined) Reflect.deleteProperty(process.env, k)
    else process.env[k] = saved[k]
  }
  electron.shell.openExternal.mockClear()
})

function setup(isPackaged: boolean): McpOAuthAppDeps {
  const dir = mkdtempSync(join(tmpdir(), 'mcp-setup-'))
  process.env['BOBINE_FAKE_MCP_AUTH'] = join(dir, 'faux.mjs')
  process.env['BOBINE_FAKE_MCP_AUTH_MS'] = '1500'
  process.env['BOBINE_OPEN_LOG'] = join(dir, 'open.log')
  electron.app.isPackaged = isPackaged
  setupMcpSettings([], { home: dir }, dir, () => ({ credentials: async () => [] }) as never)
  return captured.deps as McpOAuthAppDeps
}

describe('branchement de la connexion par l’agent (fiche 293)', () => {
  it('app installée : variables d’essai ignorées, page ouverte dans le navigateur', async () => {
    const deps = setup(true)
    expect(deps.start).toBeUndefined()
    expect(deps.limits).toBeUndefined()
    await deps.openExternal('https://www.figma.com/oauth/mcp?state=S&code_challenge=C')
    expect(electron.shell.openExternal).toHaveBeenCalledTimes(1)
    expect(() => readFileSync(process.env['BOBINE_OPEN_LOG'] ?? '', 'utf8')).toThrow()
  })

  it('app de développement : fausse commande, délai raccourci, page notée sans navigateur', async () => {
    const deps = setup(false)
    expect(deps.start).toBeTypeOf('function')
    expect(deps.limits).toEqual({ attemptMs: 1500, noPageMs: 1500 })
    expect(deps.findCommand('opencode', {})).toBe(process.execPath)
    await deps.openExternal('https://www.figma.com/oauth/mcp?state=S')
    expect(electron.shell.openExternal).not.toHaveBeenCalled()
    expect(readFileSync(process.env['BOBINE_OPEN_LOG'] ?? '', 'utf8')).toBe(
      'external https://www.figma.com/oauth/mcp?state=S\n'
    )
  })
})
