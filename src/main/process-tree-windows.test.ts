import { EventEmitter } from 'node:events'
import type { ChildProcess } from 'node:child_process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  parseWin32Processes,
  WindowsTrees,
  type JobApi,
  type JobHandle
} from './process-tree-windows'

/** Faux enfant : pid, sortie, entrée standard. */
function fakeChild(pid: number | undefined, withStdin = true) {
  const stdin = withStdin ? { destroyed: false, end: vi.fn() } : null
  const child = Object.assign(new EventEmitter(), {
    pid,
    exitCode: null as number | null,
    signalCode: null as string | null,
    stdin,
    kill: vi.fn(() => true)
  })
  const exit = (code = 0) => {
    child.exitCode = code
    child.emit('exit', code, null)
  }
  return { child: child as unknown as ChildProcess, raw: child, exit }
}

/** Objets de tâche simulés : qui est dans quel job, ce qui a été arrêté. */
function fakeJobs(assignOk = true) {
  let next = 0
  const members = new Map<JobHandle, Set<number>>()
  const log: string[] = []
  const api: JobApi = {
    create: () => {
      const job = { id: ++next }
      members.set(job, new Set())
      log.push(`create ${next}`)
      return job
    },
    assign: (job, pid) => {
      if (!assignOk) return false
      members.get(job)?.add(pid)
      log.push(`assign ${(job as { id: number }).id} ${pid}`)
      return true
    },
    active: (job) => members.get(job)?.size ?? 0,
    terminate: (job) => {
      members.get(job)?.clear()
      log.push(`terminate ${(job as { id: number }).id}`)
    },
    close: (job) => {
      members.delete(job)
      log.push(`close ${(job as { id: number }).id}`)
    }
  }
  return { api, members, log }
}

describe('arbres de processus sous Windows (ADR-0050)', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('chaque processus dans son propre job, posé au lancement', () => {
    const jobs = fakeJobs()
    const trees = new WindowsTrees({
      jobs: jobs.api,
      taskkill: vi.fn(),
      log: vi.fn(),
      graceMs: 3000
    })
    trees.adopt(fakeChild(10).child)
    trees.adopt(fakeChild(11).child)
    trees.adopt(fakeChild(undefined).child) // Lancement raté : rien.
    expect(jobs.log).toEqual(['create 1', 'assign 1 10', 'create 2', 'assign 2 11'])
    expect(trees.mode).toBe('jobs')
  })

  it('arrêt : entrée standard fermée, puis le job arrêté au bout du délai', () => {
    const jobs = fakeJobs()
    const trees = new WindowsTrees({
      jobs: jobs.api,
      taskkill: vi.fn(),
      log: vi.fn(),
      graceMs: 3000
    })
    const { child, raw } = fakeChild(10)
    trees.adopt(child)
    trees.stop(child)
    expect(raw.stdin?.end).toHaveBeenCalled()
    expect(trees.stopping()).toBe(1)
    expect(jobs.log).not.toContain('terminate 1')
    vi.advanceTimersByTime(3000)
    expect(jobs.log.slice(-2)).toEqual(['terminate 1', 'close 1'])
    expect(child.kill).not.toHaveBeenCalled()
  })

  it('le chef sort pendant l’arrêt : ce qui reste du job est arrêté tout de suite', () => {
    const jobs = fakeJobs()
    const trees = new WindowsTrees({
      jobs: jobs.api,
      taskkill: vi.fn(),
      log: vi.fn(),
      graceMs: 3000
    })
    const { child, exit } = fakeChild(10)
    trees.adopt(child)
    trees.stop(child)
    exit()
    expect(jobs.log.slice(-2)).toEqual(['terminate 1', 'close 1'])
    expect(trees.stopping()).toBe(0)
  })

  it('sans entrée standard (serveur de dev) : pas d’arrêt poli, job arrêté tout de suite', () => {
    const jobs = fakeJobs()
    const trees = new WindowsTrees({
      jobs: jobs.api,
      taskkill: vi.fn(),
      log: vi.fn(),
      graceMs: 3000
    })
    const { child } = fakeChild(10, false)
    trees.adopt(child)
    trees.stop(child)
    expect(jobs.log.slice(-2)).toEqual(['terminate 1', 'close 1'])
  })

  it('sortie d’elle-même : job rendu s’il est vide, gardé si des descendants vivent', () => {
    const jobs = fakeJobs()
    const trees = new WindowsTrees({
      jobs: jobs.api,
      taskkill: vi.fn(),
      log: vi.fn(),
      graceMs: 3000
    })
    const a = fakeChild(10)
    const b = fakeChild(11)
    trees.adopt(a.child)
    trees.adopt(b.child)
    // a : plus personne dans le job ; b : un petit-enfant au travail.
    jobs.members.get([...jobs.members.keys()][0] as JobHandle)?.clear()
    jobs.members.get([...jobs.members.keys()][1] as JobHandle)?.add(99)
    a.exit()
    b.exit()
    expect(jobs.log).toContain('close 1')
    expect(jobs.log).not.toContain('terminate 2')
    // Un arrêt demandé après coup (fiche 195 : agent tué, commande restée) vide le job.
    trees.stop(b.child)
    expect(jobs.log.slice(-2)).toEqual(['terminate 2', 'close 2'])
  })

  it('en quittant : arbres en cours d’arrêt attendus puis arrêtés, puis tout le reste', async () => {
    const jobs = fakeJobs()
    const log = vi.fn()
    const trees = new WindowsTrees({ jobs: jobs.api, taskkill: vi.fn(), log, graceMs: 3000 })
    const stubborn = fakeChild(10)
    const idle = fakeChild(11)
    trees.adopt(stubborn.child)
    trees.adopt(idle.child)
    trees.stop(stubborn.child)
    const settled = trees.settle(100, 10)
    await vi.advanceTimersByTimeAsync(150)
    expect(await settled).toBe(1)
    expect(jobs.log).toContain('terminate 1')
    expect(trees.stopAll()).toBe(1)
    expect(jobs.log.slice(-2)).toEqual(['terminate 2', 'close 2'])
    expect(log).toHaveBeenCalledWith('En quittant : 1 arbre(s) de processus arrêté(s)')
  })

  it('repli sans objets de tâche : taskkill /T sur le chef vivant, jamais sur un pid sorti', () => {
    const taskkill = vi.fn()
    const trees = new WindowsTrees({ taskkill, log: vi.fn(), graceMs: 3000 })
    expect(trees.mode).toBe('taskkill')
    const alive = fakeChild(10)
    trees.adopt(alive.child)
    trees.stop(alive.child)
    vi.advanceTimersByTime(3000)
    expect(taskkill).toHaveBeenCalledWith(10, false)
    const gone = fakeChild(11)
    trees.adopt(gone.child)
    gone.exit()
    trees.stop(gone.child)
    expect(taskkill).toHaveBeenCalledTimes(1)
  })

  it('job refusé (processus déjà sorti) : poignée rendue, repli taskkill pour cet arbre', () => {
    const jobs = fakeJobs(false)
    const taskkill = vi.fn()
    const trees = new WindowsTrees({ jobs: jobs.api, taskkill, log: vi.fn(), graceMs: 0 })
    const { child } = fakeChild(10)
    trees.adopt(child)
    expect(jobs.log).toEqual(['create 1', 'close 1'])
    trees.stop(child)
    expect(taskkill).toHaveBeenCalledWith(10, false)
  })

  it('taskkill en échec : le chef est tué seul', () => {
    const taskkill = vi.fn(() => {
      throw new Error('introuvable')
    })
    const trees = new WindowsTrees({ taskkill, log: vi.fn(), graceMs: 0 })
    const { child } = fakeChild(10)
    trees.adopt(child)
    trees.stop(child)
    expect(child.kill).toHaveBeenCalled()
  })
})

describe('lecture de Win32_Process', () => {
  it('liste ou objet seul, heure UTC, lignes incomplètes ignorées', () => {
    const one =
      '{"ProcessId":4,"ParentProcessId":0,"Start":"2026-11-15T10:00:00.0000000Z","CommandLine":null}'
    expect(parseWin32Processes(one)).toEqual([
      { pid: 4, ppid: 0, startedAt: Date.parse('2026-11-15T10:00:00Z'), command: '' }
    ])
    const many = JSON.stringify([
      {
        ProcessId: 10,
        ParentProcessId: 4,
        Start: '2026-11-15T10:00:01Z',
        CommandLine: 'cmd.exe /c x'
      },
      { ProcessId: 11, ParentProcessId: 4, Start: null, CommandLine: 'sans heure' }
    ])
    expect(parseWin32Processes(many).map((r) => r.pid)).toEqual([10])
    expect(parseWin32Processes('')).toEqual([])
    expect(() => parseWin32Processes('pas du json')).toThrow()
  })
})
