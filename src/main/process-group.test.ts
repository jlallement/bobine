import { EventEmitter } from 'node:events'
import type { ChildProcess } from 'node:child_process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  groupAlive,
  settleStoppedGroups,
  signalGroup,
  STOP_GRACE_MS,
  stopGroup,
  stoppingGroups,
  terminateGroup
} from './process-group'

/** Faux processus enfant : pid, état de sortie et `kill`. */
function fakeChild(pid: number | undefined): ChildProcess {
  return Object.assign(new EventEmitter(), {
    pid,
    exitCode: null,
    signalCode: null,
    kill: vi.fn(() => true)
  }) as unknown as ChildProcess
}

describe('arrêt d’un groupe de processus', () => {
  let kill: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.useFakeTimers()
    kill = vi.spyOn(process, 'kill').mockImplementation(() => true)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('SIGTERM au groupe, puis SIGKILL au groupe au bout de 3 s', () => {
    const child = fakeChild(4242)
    stopGroup(child)
    expect(kill.mock.calls).toEqual([[-4242, 'SIGTERM']])
    vi.advanceTimersByTime(STOP_GRACE_MS - 1)
    expect(kill).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1)
    expect(kill.mock.calls).toEqual([
      [-4242, 'SIGTERM'],
      [-4242, 'SIGKILL']
    ])
  })

  it('SIGKILL au groupe même si le chef est sorti entre-temps (ses descendants restent)', () => {
    const child = fakeChild(4242)
    stopGroup(child)
    Object.assign(child, { signalCode: 'SIGTERM' })
    vi.advanceTimersByTime(STOP_GRACE_MS)
    expect(kill).toHaveBeenLastCalledWith(-4242, 'SIGKILL')
  })

  it('chef déjà sorti, groupe encore peuplé (fiche 195) : SIGTERM puis SIGKILL au groupe seul', () => {
    const child = Object.assign(fakeChild(4242), { signalCode: 'SIGKILL' })
    stopGroup(child)
    vi.advanceTimersByTime(STOP_GRACE_MS)
    expect(kill.mock.calls).toEqual([
      [-4242, 'SIGTERM'],
      [-4242, 'SIGKILL']
    ])
    expect(child.kill).not.toHaveBeenCalled()
  })

  it('chef déjà sorti, groupe vide : rien, et jamais le pid seul', () => {
    kill.mockImplementation((pid: number) => {
      if (pid < 0) throw Object.assign(new Error('kill ESRCH'), { code: 'ESRCH' })
      return true
    })
    const child = Object.assign(fakeChild(4242), { exitCode: 0 })
    stopGroup(child)
    vi.advanceTimersByTime(STOP_GRACE_MS)
    expect(kill.mock.calls.every(([pid]: unknown[]) => (pid as number) < 0)).toBe(true)
    expect(kill.mock.calls.filter((call: unknown[]) => call[1] === 'SIGKILL')).toEqual([])
    expect(child.kill).not.toHaveBeenCalled()
  })

  it('sans pid, ou plus personne dans le groupe : `child.kill()`', () => {
    const noPid = fakeChild(undefined)
    stopGroup(noPid)
    expect(noPid.kill).toHaveBeenCalled()

    kill.mockImplementation(() => {
      throw Object.assign(new Error('kill ESRCH'), { code: 'ESRCH' })
    })
    const gone = fakeChild(4242)
    stopGroup(gone)
    expect(gone.kill).toHaveBeenCalled()
    vi.advanceTimersByTime(STOP_GRACE_MS)
    // Pas de SIGKILL programmé pour un groupe qui n'existait déjà plus.
    expect(kill.mock.calls.filter((call: unknown[]) => call[1] === 'SIGKILL')).toEqual([])
  })

  it('groupe refusé (pas un chef de groupe) : signal au processus seul', () => {
    kill.mockImplementation((pid: number) => {
      if (pid < 0) throw Object.assign(new Error('kill ESRCH'), { code: 'ESRCH' })
      return true
    })
    expect(signalGroup(77, 'SIGTERM')).toBe(true)
    expect(kill.mock.calls).toEqual([
      [-77, 'SIGTERM'],
      [77, 'SIGTERM']
    ])
    expect(groupAlive(77)).toBe(true)
  })

  it('terminateGroup : rend `false` et ne programme rien si le groupe a disparu', () => {
    kill.mockImplementation(() => {
      throw new Error('kill ESRCH')
    })
    expect(terminateGroup(9)).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })
})

// Jamais atteint pendant l'essai : le SIGKILL du minuteur ne doit pas viser un vrai processus après coup.
const NEVER = 2_147_483_647

describe('en quittant : SIGKILL des groupes arrêtés (fiche 195)', () => {
  afterEach(() => vi.restoreAllMocks())

  /** Faux `process.kill` : groupes vivants jusqu'à leur SIGKILL (ou leur départ). */
  function fakeKill(alive: Set<number>) {
    return vi.spyOn(process, 'kill').mockImplementation((pid, signal) => {
      const group = Math.abs(pid)
      if (!alive.has(group)) throw new Error('ESRCH')
      if (signal === 'SIGKILL') alive.delete(group)
      return true
    })
  }

  it('groupe qui ignore SIGTERM : SIGKILL au bout de l’attente, avant la sortie du main', async () => {
    const kill = fakeKill(new Set([5151]))
    expect(terminateGroup(5151, NEVER)).toBe(true)
    expect(stoppingGroups()).toEqual([5151])
    expect(await settleStoppedGroups(30, 5)).toBe(1)
    expect(kill).toHaveBeenCalledWith(-5151, 'SIGKILL')
    expect(stoppingGroups()).toEqual([])
  })

  it('processus seul (pas un groupe) : jamais attendu ni tué au pid en quittant', async () => {
    const kill = vi.spyOn(process, 'kill').mockImplementation((pid) => {
      if (pid < 0) throw new Error('ESRCH')
      return true
    })
    expect(terminateGroup(7171, NEVER)).toBe(true)
    expect(stoppingGroups()).toEqual([])
    expect(await settleStoppedGroups(30, 5)).toBe(0)
    expect(kill).not.toHaveBeenCalledWith(7171, 'SIGKILL')
    expect(kill).not.toHaveBeenCalledWith(-7171, 'SIGKILL')
  })

  it('groupe sorti de lui-même : rien à attendre, aucun SIGKILL', async () => {
    const alive = new Set([6161])
    const kill = fakeKill(alive)
    terminateGroup(6161, NEVER)
    alive.delete(6161)
    const started = Date.now()
    expect(await settleStoppedGroups(1000, 5)).toBe(0)
    expect(Date.now() - started).toBeLessThan(500)
    expect(kill).not.toHaveBeenCalledWith(-6161, 'SIGKILL')
  })
})
