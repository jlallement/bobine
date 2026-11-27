/**
 * Moteur de connexion (fiche 293) contre une vraie fausse commande (`fixtures/fake-agent-mcp-auth.mjs`,
 * lancée par Node) : vrai lancement (`startProcess`), vrai arrêt de l'arbre (`killTree` : groupes
 * sous macOS et Linux, objets de tâche sous Windows, `test-setup.ts`). Portable : ni signal, ni
 * shell, ni port ; un processus est « vivant » tant que `process.kill(pid, 0)` réussit (Node le
 * permet aussi sous Windows). Jamais le vrai OpenCode, jamais Figma, aucun réseau.
 */
import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { McpAuthState } from '@shared/mcp'
import { resolveProfiles, type AgentProfile } from '../agent/profiles'
import { McpOAuth } from './mcp-oauth'
import { OPENCODE_MCP_AUTH } from './opencode-mcp-auth'

const SCRIPT = join(__dirname, 'fixtures', 'fake-agent-mcp-auth.mjs')
const launched: number[] = []

const alive = (pid: number): boolean => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

afterEach(() => {
  // Filet : un essai rouge ne laisse rien derrière lui (seulement ce que l'essai a lancé).
  for (const pid of launched.splice(0)) if (alive(pid)) process.kill(pid)
})

function fakeAgent(): AgentProfile {
  const opencode = resolveProfiles({
    appPath: '/app',
    execPath: '/electron',
    isPackaged: false,
    env: {}
  }).find((p) => p.mcpOAuth)
  if (!opencode?.mcpOAuth) throw new Error('profil avec mcpOAuth attendu')
  return {
    ...opencode,
    command: process.execPath,
    mcpOAuth: {
      ...OPENCODE_MCP_AUTH,
      connectArgs: (name) => [SCRIPT, ...OPENCODE_MCP_AUTH.connectArgs(name)],
      statesArgs: () => [SCRIPT, ...OPENCODE_MCP_AUTH.statesArgs()]
    }
  }
}

describe('connexion par l’agent : vrai processus, vrai arrêt de l’arbre (fiche 293, R6)', () => {
  it('adresse lue dans le flux réel, page ouverte, « Annuler » arrête le processus et son enfant', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mcp-oauth-real-'))
    const pidsFile = join(dir, 'pids.json')
    const states: McpAuthState[] = []
    const opened: string[] = []
    const profile = fakeAgent()
    const engine = new McpOAuth({
      profiles: () => [profile],
      servers: () => [
        {
          name: 'figma',
          transport: 'http',
          url: 'https://mcp.figma.com/mcp',
          enabled: true,
          scope: 'global',
          file: join(dir, 'opencode.json')
        }
      ],
      fallbackCwd: dir,
      env: async () => ({ ...process.env, FAKE_MCP_AUTH_PIDS: pidsFile }),
      findCommand: (command) => command,
      openExternal: (url) => {
        opened.push(url)
      },
      onState: (state) => states.push(state)
    })
    expect(await engine.connect(profile.id, 'figma', dir)).toEqual({ started: true })
    await vi.waitFor(() => expect(existsSync(pidsFile)).toBe(true), { timeout: 10_000 })
    const pids = JSON.parse(readFileSync(pidsFile, 'utf8')) as number[]
    launched.push(...pids)
    expect(pids).toHaveLength(2)
    await vi.waitFor(() => expect(opened).toHaveLength(1), { timeout: 10_000 })
    expect(opened[0]?.startsWith('https://www.figma.com/oauth/mcp?')).toBe(true)
    expect(pids.every(alive)).toBe(true)

    expect(engine.cancel(profile.id, 'figma')).toBe(true)
    await vi.waitFor(() => expect(states.at(-1)?.status).toBe('to-connect'), { timeout: 10_000 })
    // Rien d'orphelin : le processus lancé et son enfant sont arrêtés.
    await vi.waitFor(() => expect(pids.filter(alive)).toEqual([]), { timeout: 10_000 })
    expect(states.map((s) => s.status)).toEqual(['connecting', 'to-connect'])
  })
})
