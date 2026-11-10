import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MOCK_AGENT_ENTRY } from '../../mock-agent/testing.mts'
import type { AgentProfile } from './profiles'
import { listAgentSessions, sessionNotFound } from './session-list'

const mock = (...args: string[]): AgentProfile => ({
  id: 'mock',
  label: 'Agent factice',
  command: process.execPath,
  args: [MOCK_AGENT_ENTRY, '--delay', '0', ...args],
  env: {}
})

/** Session mémorisée par l'agent factice, comme une session commencée dans un terminal. */
function stored(store: string, sessionId: string, cwd: string, title: string) {
  writeFileSync(
    join(store, `${sessionId}.json`),
    JSON.stringify({
      sessionId,
      cwd,
      title,
      updatedAt: '2026-10-14T10:00:00.000Z',
      modeId: 'code',
      model: 'factice-rapide',
      verbose: false,
      history: []
    })
  )
}

describe('sessions gardées par l’agent (fiche 055)', () => {
  it('fusionne la liste sans dossier et celles des dossiers demandés, sans doublon', async () => {
    const store = mkdtempSync(join(tmpdir(), 'mock-store-'))
    stored(store, 'a', '/projets/a', 'Session A')
    stored(store, 'b', '/projets/b', 'Session B')
    const profile = mock('--store', store)
    const all = await listAgentSessions({
      profile,
      cwd: tmpdir(),
      folders: [undefined, '/projets/a']
    })
    expect(all.map((s) => s.sessionId).sort()).toEqual(['a', 'b'])
    const one = await listAgentSessions({ profile, cwd: tmpdir(), folders: ['/projets/b'] })
    expect(one).toEqual([
      {
        sessionId: 'b',
        cwd: '/projets/b',
        title: 'Session B',
        updatedAt: '2026-10-14T10:00:00.000Z'
      }
    ])
  })

  it('agent sans `session/list` : il le dit, sans rien ouvrir', async () => {
    await expect(
      listAgentSessions({ profile: mock('--sans-historique'), cwd: tmpdir(), folders: [undefined] })
    ).rejects.toThrow('ne sait pas lister ses sessions')
  })

  it('commande introuvable : message clair', async () => {
    const profile = { ...mock(), command: '/nulle/part/agent' }
    await expect(
      listAgentSessions({ profile, cwd: tmpdir(), folders: [undefined] })
    ).rejects.toThrow('introuvable')
  })
})

describe('session introuvable (fiche 188)', () => {
  it('code -32002, ou un message qui parle de session ; pas un « not found » quelconque', () => {
    expect(sessionNotFound({ code: -32002, message: 'Resource not found' })).toBe(true)
    expect(sessionNotFound(new Error('Session ses_1 not found'))).toBe(true)
    expect(sessionNotFound(new Error('Unknown session: ses_1'))).toBe(true)
    expect(sessionNotFound(new Error('command not found: opencode'))).toBe(false)
    expect(sessionNotFound(new Error('Model not found'))).toBe(false)
    expect(sessionNotFound(new Error('ENOENT: file not found'))).toBe(false)
  })
})
