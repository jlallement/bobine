import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { ScheduledTask } from '@shared/schedule'
import { TASKS_FILE, TaskStore } from './task-store'

const task: ScheduledTask = {
  id: 't1',
  name: 'Revue',
  instruction: 'Relis les PR',
  folder: '/projet',
  profileId: 'mock',
  schedule: { kind: 'daily', time: '09:00' },
  worktree: false,
  catchUp: true,
  paused: false,
  createdAt: '2026-11-06T08:00:00.000Z',
  nextRunAt: '2026-11-07T08:00:00.000Z',
  runs: [{ id: 'r', at: '2026-11-06T08:00:00.000Z', outcome: 'done' }]
}

describe('TaskStore (fiche 178)', () => {
  const dir = () => mkdtempSync(join(tmpdir(), 'tasks-'))

  it('écrit un fichier versionné et le relit', async () => {
    const file = join(dir(), TASKS_FILE)
    const store = new TaskStore(file)
    expect(store.load()).toEqual([])
    store.save([task])
    await store.flushed()
    expect(JSON.parse(readFileSync(file, 'utf8')).version).toBe(1)
    expect(new TaskStore(file).load()).toEqual([task])
  })

  it('ignore une tâche mal formée, garde les autres', () => {
    const file = join(dir(), TASKS_FILE)
    writeFileSync(file, JSON.stringify({ version: 1, tasks: [task, { id: 'x', schedule: 3 }] }))
    expect(new TaskStore(file).load().map((t) => t.id)).toEqual(['t1'])
  })

  it('met de côté un fichier illisible', () => {
    const d = dir()
    writeFileSync(join(d, TASKS_FILE), '{oups')
    expect(new TaskStore(join(d, TASKS_FILE)).load()).toEqual([])
    expect(readdirSync(d).some((f) => f.startsWith(`${TASKS_FILE}.corrupt-`))).toBe(true)
  })

  it('ne réécrit jamais le fichier d’une version plus récente', async () => {
    const file = join(dir(), TASKS_FILE)
    const newer = JSON.stringify({ version: 2, tasks: [task] })
    writeFileSync(file, newer)
    const store = new TaskStore(file)
    expect(store.load()).toHaveLength(1)
    store.save([])
    await store.flushed()
    expect(readFileSync(file, 'utf8')).toBe(newer)
  })
})
