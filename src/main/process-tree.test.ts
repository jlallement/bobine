import { EventEmitter } from 'node:events'
import type { ChildProcess } from 'node:child_process'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as group from './process-group'
import * as registry from './process-registry'
import {
  configureProcessTrees,
  settleStoppedTrees,
  stopRemainingTrees,
  stopTree,
  treesStopping
} from './process-tree'
import { WindowsTrees } from './process-tree-windows'

const child = () =>
  Object.assign(new EventEmitter(), {
    pid: 42,
    exitCode: null,
    signalCode: null,
    stdin: null,
    kill: vi.fn()
  }) as unknown as ChildProcess

afterEach(() => {
  configureProcessTrees(undefined)
  vi.restoreAllMocks()
})

describe('arbres de processus : un seul point d’entrée (ADR-0050)', () => {
  it('sans configuration (Unix) : exactement les groupes d’avant', async () => {
    // Sous Windows, la préparation des essais configure les objets de tâche (`test-setup.ts`).
    configureProcessTrees(undefined)
    const stop = vi.spyOn(group, 'stopGroup').mockImplementation(() => {})
    const settle = vi.spyOn(group, 'settleStoppedGroups').mockResolvedValue(0)
    vi.spyOn(group, 'stoppingGroups').mockReturnValue([7])
    const remaining = vi.spyOn(registry, 'stopTrackedChildren').mockReturnValue(0)
    const c = child()
    stopTree(c, 10)
    expect(stop).toHaveBeenCalledWith(c, 10)
    expect(treesStopping()).toBe(true)
    await settleStoppedTrees()
    expect(settle).toHaveBeenCalled()
    stopRemainingTrees()
    expect(remaining).toHaveBeenCalled()
  })

  it('Windows : les objets de tâche, jamais les groupes', () => {
    const stop = vi.spyOn(group, 'stopGroup')
    const trees = new WindowsTrees({ taskkill: vi.fn(), log: vi.fn(), graceMs: 0 })
    const winStop = vi.spyOn(trees, 'stop')
    configureProcessTrees(trees)
    const c = child()
    stopTree(c)
    expect(winStop).toHaveBeenCalledWith(c, undefined)
    expect(stop).not.toHaveBeenCalled()
    expect(treesStopping()).toBe(false)
    expect(stopRemainingTrees()).toBe(0)
  })
})
