import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ConversationSummary } from '@shared/agent'
import { TASKS_FILE } from './task-store'

/**
 * Mise en place du planificateur comme au lancement (`setupScheduler`, fiches 178, 196), avec un
 * Electron simulé : en lecture seule, une tâche échue ne lance rien et son fichier reste tel quel.
 * Remplace côté main « la tâche échue n'a rien lancé » (e2e `profil` n° 38).
 */

const powerMonitor = { on: vi.fn() }
vi.mock('electron', () => ({
  Notification: Object.assign(vi.fn(), { isSupported: () => false }),
  powerMonitor
}))

const { setupScheduler } = await import('./scheduler-ipc')

/** Un profil avec une tâche échue il y a une minute, à rattraper. */
function profileWithDueTask() {
  const userData = mkdtempSync(join(tmpdir(), 'planif-'))
  const folder = mkdtempSync(join(tmpdir(), 'planif-dossier-'))
  const file = join(userData, TASKS_FILE)
  const text = JSON.stringify({
    version: 1,
    tasks: [
      {
        id: 't1',
        name: 'Revue',
        instruction: 'Relis les PR ouvertes',
        folder,
        profileId: 'mock',
        schedule: { kind: 'interval', hours: 1 },
        worktree: false,
        catchUp: true,
        paused: false,
        createdAt: new Date(Date.now() - 3_600_000).toISOString(),
        nextRunAt: new Date(Date.now() - 60_000).toISOString(),
        runs: []
      }
    ]
  })
  writeFileSync(file, text)
  return { userData, file, text }
}

function fakeManager() {
  return {
    createDetached: vi.fn(async () => ({ id: 'c1' }) as ConversationSummary),
    prompt: vi.fn(async () => {}),
    subscribe: vi.fn(() => () => {}),
    state: () => ({ activeId: '', conversations: [] }),
    view: () => ({ transcript: {} }) as never,
    post: vi.fn()
  }
}

describe('planificateur au lancement (fiches 178, 196)', () => {
  const started: { stop: () => void }[] = []
  afterEach(() => {
    started.splice(0).forEach((s) => s.stop())
    powerMonitor.on.mockClear()
  })

  it('profil en lecture seule : la tâche échue ne lance rien, le fichier n’est pas touché', async () => {
    const { userData, file, text } = profileWithDueTask()
    const manager = fakeManager()
    const send = vi.fn()
    const scheduler = setupScheduler(manager as never, userData, {
      notifications: () => true,
      send,
      readOnly: () => true
    })
    started.push(scheduler)
    await new Promise((r) => setTimeout(r, 20))
    expect(manager.createDetached).not.toHaveBeenCalled()
    expect(manager.prompt).not.toHaveBeenCalled()
    expect(send).not.toHaveBeenCalled()
    // Pas même le contrôle au réveil du Mac.
    expect(powerMonitor.on).not.toHaveBeenCalled()
    expect(readFileSync(file, 'utf8')).toBe(text)
  })

  it('profil normal : la même tâche est rattrapée au lancement (témoin)', async () => {
    const { userData } = profileWithDueTask()
    const manager = fakeManager()
    const scheduler = setupScheduler(manager as never, userData, {
      notifications: () => true,
      send: vi.fn(),
      readOnly: () => false
    })
    started.push(scheduler)
    await vi.waitFor(() =>
      expect(manager.prompt).toHaveBeenCalledWith('c1', 'Relis les PR ouvertes')
    )
    expect(manager.createDetached).toHaveBeenCalledTimes(1)
    expect(powerMonitor.on).toHaveBeenCalledWith('resume', expect.any(Function))
  })
})
