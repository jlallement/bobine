/**
 * Moteur de connexion (fiche 293) contre une vraie fausse commande (`fixtures/fake-agent-mcp-auth.mjs`,
 * lancée par Node) : vrai lancement (`startProcess`), vrai arrêt de l'arbre (`killTree` : groupes
 * sous macOS et Linux, objets de tâche sous Windows, `test-setup.ts`).
 *
 * Portable : ni shell, ni port, et **aucun signal envoyé à un numéro de processus** (Windows
 * réattribue vite les numéros, `process-group.ts`). Le processus lancé est suivi par son objet
 * `ChildProcess` (événement `exit`) ; la mort de son enfant se prouve par un battement (fichier
 * réécrit toutes les 100 ms) qui s'arrête. Nettoyage : par les objets lancés, et un fichier `.stop`
 * que l'enfant guette (il s'arrête aussi seul au bout d'une minute). Délais larges pour la CI.
 */
import type { ChildProcess, SpawnOptions } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { McpAuthState } from '@shared/mcp'
import { startProcess } from '../process-tree'
import { resolveProfiles, type AgentProfile } from '../agent/profiles'
import { McpOAuth } from './mcp-oauth'
import { OPENCODE_MCP_AUTH } from './opencode-mcp-auth'

const SCRIPT = join(__dirname, 'fixtures', 'fake-agent-mcp-auth.mjs')
const WAIT = { timeout: 20_000, interval: 50 }
const launched: ChildProcess[] = []
const beats: string[] = []

afterEach(() => {
  // Filet : un essai rouge ne laisse rien derrière lui (seulement ce que l'essai a lancé).
  for (const child of launched.splice(0)) {
    if (child.exitCode === null && child.signalCode === null) child.kill()
  }
  for (const beat of beats.splice(0)) writeFileSync(`${beat}.stop`, '')
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

const beatOf = (file: string): number => (existsSync(file) ? Number(readFileSync(file, 'utf8')) : 0)

describe('connexion par l’agent : vrai processus, vrai arrêt de l’arbre (fiche 293, R6)', () => {
  it('adresse lue dans le flux réel, page ouverte, « Annuler » arrête le processus et son enfant', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mcp-oauth-real-'))
    const beat = join(dir, 'battement')
    beats.push(beat)
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
      env: async () => ({ ...process.env, FAKE_MCP_AUTH_BEAT: beat }),
      findCommand: (command) => command,
      openExternal: (url) => {
        opened.push(url)
      },
      onState: (state) => states.push(state),
      start: (command: string, args: readonly string[], options: SpawnOptions) => {
        const child = startProcess(command, args, options).child
        launched.push(child)
        return child
      }
    })
    expect(await engine.connect(profile.id, 'figma', dir)).toEqual({ started: true })
    const attempt = launched[0]
    if (!attempt) throw new Error('tentative non lancée')
    const exited = new Promise<void>((resolve) => attempt.once('exit', () => resolve()))
    // L'enfant bat (au moins trois fois), la page est ouverte d'après la sortie réelle.
    await vi.waitFor(() => expect(beatOf(beat)).toBeGreaterThanOrEqual(3), WAIT)
    await vi.waitFor(() => expect(opened).toHaveLength(1), WAIT)
    expect(opened[0]?.startsWith('https://www.figma.com/oauth/mcp?')).toBe(true)

    expect(engine.cancel(profile.id, 'figma')).toBe(true)
    await exited
    await vi.waitFor(() => expect(states.at(-1)?.status).toBe('to-connect'), WAIT)
    // Rien d'orphelin : le battement de l'enfant s'arrête (inchangé sur 1,5 s ; il bat toutes les
    // 100 ms tant qu'il vit).
    let previous = -1
    await vi.waitFor(
      () => {
        const now = beatOf(beat)
        const still = now === previous
        previous = now
        if (!still) throw new Error(`l’enfant bat encore (${now})`)
      },
      { timeout: 30_000, interval: 1_500 }
    )
    expect(states.map((s) => s.status)).toEqual(['connecting', 'to-connect'])
  }, 60_000)
})
