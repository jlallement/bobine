import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { describe, expect, it } from 'vitest'
import type { Pty, SpawnPty } from '../terminal/terminal-manager'
import { bobStatusQuota, emptyTasksIn, parseBobStatus } from './bob-status'

/** Panneau de `/status`, même forme que sur Bob 2.0.6 (2026-10-20), valeurs inventées. */
const PANEL = [
  '  ────────────────────────────────────────',
  '  Task Overview',
  '  ────────────────────────────────────────',
  '  Task ID:          0123456789abcdef0123456789abcdef',
  '  Workspace:        file:/Users/moi/Library/Application Support/bobine/agent-status/bob',
  '  Started:          10/20/2026, 5:05:13 PM',
  '  Bobcoins:         0.0000 🅞',
  '',
  '',
  '  Monthly Budget:   300.00 🅞',
  '  Monthly Usage:    12.34 🅞',
  '',
  '',
  '  Version:          2.0.6',
  '  Commit Hash:      0a1b2c3d4',
  '  Auth Method:      SSO',
  '',
  '  Press Esc to close'
].join('\n')

const FETCHING = PANEL.replace(/300\.00 🅞/, 'Fetching budget...').replace(
  /12\.34 🅞/,
  'Fetching budget...'
)

describe('écran de `/status` de Bob (fiche 091)', () => {
  it('plafond, consommation et tâche, sur une vraie capture', () => {
    expect(parseBobStatus(PANEL)).toEqual({
      taskId: '0123456789abcdef0123456789abcdef',
      limit: 300,
      used: 12.34
    })
  })

  it('« Fetching budget... » : pas encore de chiffres ; le dernier panneau compte', () => {
    expect(parseBobStatus(FETCHING)).toEqual({ taskId: '0123456789abcdef0123456789abcdef' })
    expect(parseBobStatus(`${FETCHING}\n${PANEL}`)).toMatchObject({ limit: 300, used: 12.34 })
  })

  it('plafond illimité, budget indisponible, libellés français', () => {
    expect(parseBobStatus(PANEL.replace('300.00 🅞', 'Unlimited'))).toMatchObject({
      limit: null,
      used: 12.34
    })
    expect(parseBobStatus(PANEL.replace('300.00 🅞', '—').replace('12.34 🅞', '—'))).toEqual({
      taskId: '0123456789abcdef0123456789abcdef',
      unavailable: true
    })
    const french = PANEL.replace('Monthly Budget:', 'Budget mensuel :')
      .replace('Monthly Usage:', 'Utilisation mensuelle :')
      .replace('Task ID:', 'ID de tâche :')
    expect(parseBobStatus(french)).toMatchObject({ limit: 300, used: 12.34 })
  })

  it('montants stricts (deux décimales, comme Bob) : rien de douteux', () => {
    expect(parseBobStatus(PANEL.replace('300.00 🅞', '1,000.00 🅞')).limit).toBeUndefined()
    expect(parseBobStatus(PANEL.replace('12.34 🅞', '12,34 🅞')).used).toBeUndefined()
    expect(
      parseBobStatus(PANEL.replace('0123456789abcdef0123456789abcdef', '../x')).taskId
    ).toBeUndefined()
    expect(parseBobStatus('rien')).toEqual({})
  })
})

/** Faux `bob chat` : une bannière, puis le panneau quand on tape `/status` et Entrée. */
function fakeBobChat(screens: { banner: string; panel?: string }): {
  spawn: SpawnPty
  calls: { command: string; args: string[]; env: NodeJS.ProcessEnv }[]
  killed: () => boolean
} {
  const calls: { command: string; args: string[]; env: NodeJS.ProcessEnv }[] = []
  let killed = false
  const spawn: SpawnPty = (command, args, options) => {
    calls.push({ command, args, env: options.env })
    let onData: (data: string) => void = () => {}
    let typed = ''
    const pty: Pty = {
      pid: 1,
      process: 'bob',
      onData: (listener) => {
        onData = listener
        setTimeout(() => onData(screens.banner.replaceAll('\n', '\r\n')), 5)
      },
      onExit: () => {},
      write: (data) => {
        typed += data
        if (typed.endsWith('/status\r') && screens.panel) {
          onData(`\r\n${screens.panel.replaceAll('\n', '\r\n')}`)
        }
      },
      resize: () => {},
      kill: () => (killed = true)
    }
    return pty
  }
  return { spawn, calls, killed: () => killed }
}

const timings = { quietMs: 20, retypeMs: 200, pollMs: 5, enterDelayMs: 5 }

function bobDb(rows: { id: string; workspace: string; firstMessage: string | null }[]): string {
  const path = join(mkdtempSync(join(tmpdir(), 'bob-status-')), 'bob.db')
  const db = new DatabaseSync(path)
  db.exec('CREATE TABLE tasks (id TEXT PRIMARY KEY, env TEXT, first_message TEXT, costs TEXT)')
  const insert = db.prepare('INSERT INTO tasks (id, env, first_message) VALUES (?, ?, ?)')
  for (const row of rows) {
    insert.run(row.id, JSON.stringify({ id: row.id, workspace: row.workspace }), row.firstMessage)
  }
  db.close()
  return path
}

describe('lecture du quota par `bob chat` (fiche 091)', () => {
  it('tape `/status` une fois prêt, rend le quota et la tâche vide à supprimer', async () => {
    const fake = fakeBobChat({ banner: 'Bob Shell\n> ', panel: PANEL })
    const source = bobStatusQuota({ dbPath: '/nulle/part/bob.db', timings })
    const reading = await source.read({
      cwd: '/reserve',
      env: { LANG: 'fr_FR.UTF-8' },
      spawnPty: fake.spawn,
      timeoutMs: 2000
    })
    expect(reading).toEqual({
      quota: { limit: 300, used: 12.34 },
      leftovers: ['0123456789abcdef0123456789abcdef']
    })
    expect(fake.calls[0]?.command).toBe('bob')
    expect(fake.calls[0]?.args).toEqual(['chat', '--trust', '--disable-mcp', '--disable-subagents'])
    expect(fake.calls[0]?.env['LC_ALL']).toBe('en_US.UTF-8')
    expect(fake.killed()).toBe(true)
  })

  it('pas de panneau : quota inconnu, mais les tâches vides du dossier sont rendues', async () => {
    const dbPath = bobDb([
      { id: 'vide1', workspace: '/reserve', firstMessage: null },
      { id: 'pleine', workspace: '/reserve', firstMessage: 'Bonjour' },
      { id: 'ailleurs', workspace: '/projet', firstMessage: null }
    ])
    const fake = fakeBobChat({ banner: 'Please sign in' })
    const reading = await bobStatusQuota({ dbPath, timings }).read({
      cwd: '/reserve',
      env: {},
      spawnPty: fake.spawn,
      timeoutMs: 300
    })
    expect(reading.quota).toBeUndefined()
    expect(reading.problem).toContain('pas de chiffres')
    expect(reading.leftovers).toEqual(['vide1'])
    expect(fake.killed()).toBe(true)
  })

  it('tâches vides du dossier réservé seulement ; base absente ou étrangère : aucune', () => {
    const dbPath = bobDb([
      { id: 'a', workspace: '/reserve', firstMessage: '' },
      { id: 'b', workspace: '/reserve', firstMessage: 'Fais ça' }
    ])
    expect(emptyTasksIn('/reserve', dbPath)).toEqual(['a'])
    expect(emptyTasksIn('/reserve', '/nulle/part.db')).toEqual([])
  })
})
