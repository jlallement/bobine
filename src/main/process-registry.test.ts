import { spawn, type ChildProcess } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { groupAlive, settleStoppedGroups, stoppingGroups, terminateGroup } from './process-group'
import {
  closeProcessRegistry,
  listProcesses,
  openProcessRegistry,
  orphanGroups,
  parsePs,
  ProcessRegistry,
  readEntries,
  reapOrphans,
  sameCommand,
  stopTrackedChildren,
  trackChild,
  type ChildEntry,
  type PsRow
} from './process-registry'

const at = (text: string) => new Date(text).getTime()

const entry = (over: Partial<ChildEntry> = {}): ChildEntry => ({
  pid: 500,
  pgid: 500,
  command: ['/opt/homebrew/bin/bob', 'acp'],
  startedAt: new Date(2026, 9, 24, 10, 0, 0, 400).toISOString(),
  ...over
})

const row = (over: Partial<PsRow> = {}): PsRow => ({
  pid: 500,
  ppid: 1,
  pgid: 500,
  startedAt: new Date(2026, 9, 24, 10, 0, 0).getTime(),
  command: 'node /opt/homebrew/bin/bob acp',
  ...over
})

describe('lecture de ps', () => {
  it('pid, ppid, groupe, heure de départ et commande', () => {
    const rows = parsePs(
      [
        '    1     0     1 Mon Oct 19 08:01:02 2026     /sbin/launchd',
        '  500     1   500 Sat Oct 24 10:00:00 2026     node /opt/homebrew/bin/bob acp --trust',
        '  501   500   500 Sat Oct  4 09:05:07 2026     opencode acp',
        'ligne illisible'
      ].join('\n')
    )
    expect(rows).toHaveLength(3)
    expect(rows[1]).toEqual({
      pid: 500,
      ppid: 1,
      pgid: 500,
      startedAt: new Date(2026, 9, 24, 10, 0, 0).getTime(),
      command: 'node /opt/homebrew/bin/bob acp --trust'
    })
    expect(rows[2]?.startedAt).toBe(new Date(2026, 9, 4, 9, 5, 7).getTime())
  })

  it('même commande : programme puis arguments dans l’ordre, interpréteur devant admis', () => {
    expect(sameCommand('node /opt/homebrew/bin/bob acp', ['/opt/homebrew/bin/bob', 'acp'])).toBe(
      true
    )
    expect(sameCommand('/usr/local/bin/opencode acp', ['opencode', 'acp'])).toBe(true)
    expect(sameCommand('/usr/bin/vim notes.txt', ['opencode', 'acp'])).toBe(false)
    expect(sameCommand('bob chat acp', ['bob', 'acp', '--trust'])).toBe(false)
    expect(sameCommand('acp bob', ['bob', 'acp'])).toBe(false)
  })
})

describe('groupes à arrêter au démarrage', () => {
  it('chef retrouvé, même commande et même heure : son groupe est arrêté', () => {
    const verdict = orphanGroups([entry()], [row(), row({ pid: 501, ppid: 500 })], 1)
    expect(verdict.stop.map((s) => [s.entry.pid, s.members.length])).toEqual([[500, 2]])
    expect(verdict.skipped).toEqual([])
  })

  it('pid réattribué : jamais touché (autre commande, autre heure, autre groupe)', () => {
    const otherCommand = orphanGroups([entry()], [row({ command: '/usr/bin/vim notes.txt' })], 1)
    const otherTime = orphanGroups([entry()], [row({ startedAt: at('2026-10-24T12:00:00') })], 1)
    const otherGroup = orphanGroups([entry()], [row({ pgid: 300 })], 1)
    for (const verdict of [otherCommand, otherTime, otherGroup]) {
      expect(verdict.stop).toEqual([])
      expect(verdict.skipped[0]?.reason).toMatch(/^pid réattribué/)
    }
  })

  it('chef disparu : orphelins adoptés par launchd arrêtés, groupe repris laissé', () => {
    const orphans = orphanGroups([entry()], [row({ pid: 501, command: 'node agent.js' })], 1)
    expect(orphans.stop).toHaveLength(1)
    // Un autre groupe a repris l'identifiant : membres plus anciens, ou rattachés à leur shell.
    const older = row({ pid: 502, startedAt: at('2026-10-20T10:00:00'), command: 'x' })
    const shellJob = row({ pid: 503, ppid: 42, command: 'y' })
    for (const rows of [[older], [shellJob]]) {
      const verdict = orphanGroups([entry()], rows, 1)
      expect(verdict.stop).toEqual([])
      expect(verdict.skipped).toHaveLength(1)
    }
  })

  it('parti de lui-même : rien à faire ; jamais le main lui-même ni son groupe', () => {
    expect(orphanGroups([entry()], [], 1)).toEqual({ stop: [], skipped: [] })
    const self = row({ pid: 900, pgid: 900, command: 'Bobine' })
    const verdict = orphanGroups([entry({ pid: 900, pgid: 900, command: ['Bobine'] })], [self], 900)
    expect(verdict).toEqual({ stop: [], skipped: [] })
  })

  it('reapOrphans : un SIGTERM par groupe retenu et une ligne de journal par entrée', async () => {
    const terminate = vi.fn(() => true)
    const lines: string[] = []
    const verdict = await reapOrphans(
      [entry(), entry({ pid: 600, pgid: 600, command: ['opencode', 'acp'] })],
      {
        ps: () =>
          Promise.resolve(
            [
              '  500     1   500 Sat Oct 24 10:00:00 2026     node /opt/homebrew/bin/bob acp',
              '  600     1   600 Sat Oct 24 10:00:00 2026     /usr/bin/vim notes.txt'
            ].join('\n')
          ),
        terminate,
        log: (line) => lines.push(line)
      }
    )
    expect(terminate.mock.calls).toEqual([[500]])
    expect(verdict.skipped.map((s) => s.entry.pid)).toEqual([600])
    expect(lines).toHaveLength(2)
    expect(lines[0]).toMatch(/arrêté : \/opt\/homebrew\/bin\/bob acp \(pid 500/)
    expect(lines[1]).toMatch(/laissé : opencode acp \(pid 600.*pid réattribué/)
  })

  it('reapOrphans : ps en échec, dit dans le journal, rien n’est arrêté', async () => {
    const terminate = vi.fn(() => true)
    const lines: string[] = []
    await reapOrphans([entry()], {
      ps: () => Promise.reject(new Error('ps introuvable')),
      terminate,
      log: (line) => lines.push(line)
    })
    expect(terminate).not.toHaveBeenCalled()
    expect(lines[0]).toMatch(/non vérifiés \(ps : ps introuvable\)/)
  })
})

describe('registre agents.pids', () => {
  let dir: string
  let file: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'bobine-pids-'))
    file = join(dir, 'agents.pids')
  })

  afterEach(() => {
    closeProcessRegistry()
    vi.useRealTimers()
    vi.restoreAllMocks()
    rmSync(dir, { recursive: true, force: true })
  })

  const fakeChild = (pid: number | undefined) =>
    Object.assign(new EventEmitter(), { pid }) as unknown as ChildProcess

  it('noté au lancement, retiré quand le groupe est vide', () => {
    const kill = vi.spyOn(process, 'kill').mockImplementation(() => {
      throw new Error('kill ESRCH')
    })
    const registry = new ProcessRegistry(file, () => new Date('2026-10-24T08:00:00.000Z'))
    const child = fakeChild(4242)
    registry.track(child, ['opencode', 'acp'])
    expect(readEntries(file)).toEqual([
      { pid: 4242, pgid: 4242, command: ['opencode', 'acp'], startedAt: '2026-10-24T08:00:00.000Z' }
    ])
    child.emit('exit', 0, null)
    expect(kill).toHaveBeenCalledWith(-4242, 0)
    expect(readEntries(file)).toEqual([])
  })

  it('descendants encore vivants à la sortie du chef : revu après le délai, gardé s’ils survivent', () => {
    vi.useFakeTimers()
    let alive = true
    vi.spyOn(process, 'kill').mockImplementation(() => {
      if (alive) return true
      throw new Error('kill ESRCH')
    })
    const registry = new ProcessRegistry(file)
    const survivor = fakeChild(1111)
    const killed = fakeChild(2222)
    registry.track(survivor, ['a'])
    registry.track(killed, ['b'])
    survivor.emit('exit', null, 'SIGTERM')
    vi.advanceTimersByTime(10_000)
    expect(registry.list().map((e) => e.pid)).toEqual([1111, 2222])
    killed.emit('exit', null, 'SIGTERM')
    alive = false
    vi.advanceTimersByTime(10_000)
    expect(registry.list().map((e) => e.pid)).toEqual([1111])
    expect(readEntries(file).map((e) => e.pid)).toEqual([1111])
  })

  it('lancement raté (sans pid) : rien n’est noté ; sans registre ouvert, trackChild ne fait rien', () => {
    const registry = new ProcessRegistry(file)
    registry.track(fakeChild(undefined), ['introuvable'])
    expect(registry.list()).toEqual([])
    trackChild(fakeChild(77), ['x'])
    expect(() => readFileSync(file)).toThrow()
  })

  it('ouverture : rend les entrées du lancement précédent et repart vide ; fichier abîmé ignoré', () => {
    writeFileSync(file, JSON.stringify({ version: 1, processes: [entry(), { pid: 'x' }] }))
    expect(openProcessRegistry(file)).toEqual([entry()])
    expect(readEntries(file)).toEqual([])
    writeFileSync(file, '{ pas du json')
    expect(openProcessRegistry(file)).toEqual([])
  })
})

/** Attend que `check` soit vrai (au plus `ms`). */
async function until(check: () => boolean, ms = 5000): Promise<boolean> {
  const end = Date.now() + ms
  while (Date.now() < end) {
    if (check()) return true
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  return check()
}

const alive = (pid: number) => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

describe.skipIf(process.platform === 'win32')('plantage du main puis démarrage suivant', () => {
  let dir: string
  const spawned: ChildProcess[] = []

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'bobine-reap-'))
  })

  afterEach(() => {
    closeProcessRegistry()
    for (const child of spawned) if (child.pid !== undefined) terminateGroup(child.pid, 100)
    rmSync(dir, { recursive: true, force: true })
  })

  it('un agent factice et son descendant, laissés par un main coupé, sont arrêtés', async () => {
    const file = join(dir, 'agents.pids')
    const pidFile = join(dir, 'grandchild.pid')
    // Un « agent » qui lance un descendant dans son groupe, puis ignore SIGTERM.
    const script = [
      `const c = require('child_process').spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });`,
      `require('fs').writeFileSync(${JSON.stringify(pidFile)}, String(c.pid));`,
      `process.on('SIGTERM', () => {});`,
      `setInterval(() => {}, 1000);`
    ].join(' ')
    // Un processus sans rapport, dont le pid figure dans le registre sous une autre commande.
    const bystander = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
      stdio: 'ignore',
      detached: true
    })
    spawned.push(bystander)

    // Premier lancement : le registre note l'agent.
    openProcessRegistry(file)
    const agent = spawn(process.execPath, ['-e', script], { stdio: 'ignore', detached: true })
    spawned.push(agent)
    trackChild(agent, [process.execPath, '-e', script])
    expect(await until(() => readEntries(file).length === 1)).toBe(true)
    expect(await until(() => readFileSync(pidFile, { flag: 'a+' }).length > 0)).toBe(true)
    const grandchild = Number(readFileSync(pidFile, 'utf8'))
    expect(alive(grandchild)).toBe(true)

    // Le main est coupé : plus de registre, rien n'est arrêté. On y ajoute un pid réattribué.
    closeProcessRegistry()
    const left = readEntries(file)
    const reused: ChildEntry = {
      pid: bystander.pid ?? 0,
      pgid: bystander.pid ?? 0,
      command: ['/usr/local/bin/bob', 'acp'],
      startedAt: new Date().toISOString()
    }
    writeFileSync(file, JSON.stringify({ version: 1, processes: [...left, reused] }))

    // Démarrage suivant.
    const lines: string[] = []
    const previous = openProcessRegistry(file)
    expect(previous.map((e) => e.pid)).toEqual([agent.pid, bystander.pid])
    const verdict = await reapOrphans(previous, {
      ps: listProcesses,
      terminate: (pgid) => terminateGroup(pgid, 300),
      log: (line) => lines.push(line)
    })
    expect(verdict.stop.map((s) => s.entry.pid)).toEqual([agent.pid])
    expect(verdict.stop[0]?.members.length).toBeGreaterThanOrEqual(2)
    // SIGTERM ignoré : le SIGKILL du délai emporte l'agent et son descendant.
    expect(await until(() => !alive(grandchild) && !groupAlive(agent.pid ?? 0))).toBe(true)
    expect(alive(bystander.pid ?? 0)).toBe(true)
    expect(lines.some((l) => l.includes('arrêté'))).toBe(true)
    expect(lines.some((l) => l.includes('pid réattribué'))).toBe(true)
  }, 20_000)
})

describe.skipIf(process.platform === 'win32')('en quittant : rien ne survit (fiche 208)', () => {
  let dir: string
  const spawned: ChildProcess[] = []

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'bobine-quit-'))
  })

  afterEach(() => {
    closeProcessRegistry()
    for (const child of spawned) if (child.pid !== undefined) terminateGroup(child.pid, 100)
    rmSync(dir, { recursive: true, force: true })
  })

  it('agent lancé hors conversation (essai du diagnostic) et que rien n’a arrêté : arrêté', async () => {
    openProcessRegistry(join(dir, 'agents.pids'))
    // Un agent qui ignore SIGTERM, comme MOCK_AGENT_TENACE : seul le SIGKILL l'emporte.
    const script = `process.on('SIGTERM', () => {}); setInterval(() => {}, 1000)`
    const agent = spawn(process.execPath, ['-e', script], { stdio: 'ignore', detached: true })
    spawned.push(agent)
    trackChild(agent, [process.execPath, '-e', script])
    // Un autre, déjà arrêté par son propriétaire (conversation) : pas visé une seconde fois.
    const stopped = spawn(process.execPath, ['-e', script], { stdio: 'ignore', detached: true })
    spawned.push(stopped)
    trackChild(stopped, [process.execPath, '-e', script])
    await new Promise((resolve) => setTimeout(resolve, 200))
    terminateGroup(stopped.pid ?? 0, 60_000)
    const kill = vi.spyOn(process, 'kill')
    try {
      expect(stopTrackedChildren()).toBe(1)
      expect(kill).toHaveBeenCalledWith(-(agent.pid ?? 0), 'SIGTERM')
      expect(kill).not.toHaveBeenCalledWith(-(stopped.pid ?? 0), 'SIGTERM')
    } finally {
      kill.mockRestore()
    }
    // `will-quit` attend les groupes arrêtés, puis SIGKILL (fiche 195).
    expect(stoppingGroups()).toEqual(expect.arrayContaining([agent.pid, stopped.pid]))
    await settleStoppedGroups(300)
    expect(await until(() => !groupAlive(agent.pid ?? 0) && !groupAlive(stopped.pid ?? 0))).toBe(
      true
    )
  }, 20_000)

  it('sans registre ouvert : rien', () => {
    expect(stopTrackedChildren()).toBe(0)
  })

  it('vérifié par ps : identifiant repris par d’autres jamais visé ; groupes vides ou repris retirés', () => {
    const file = join(dir, 'agents.pids')
    openProcessRegistry(file)
    const fake = (pid: number) =>
      Object.assign(new EventEmitter(), { pid }) as unknown as ChildProcess
    // Heures notées par le registre : maintenant (à la seconde près pour `ps`).
    trackChild(fake(4101), ['bob', 'acp']) // toujours là : arrêté
    trackChild(fake(4102), ['opencode', 'acp']) // pid repris par un autre programme
    trackChild(fake(4103), ['bob', 'acp']) // même commande, mais lancé bien plus tard
    trackChild(fake(4104), ['bob', 'acp']) // groupe vide
    const lstart = (date: Date) => {
      const [day, month, dd, year, time] = date.toString().split(' ')
      return `${day} ${month} ${dd} ${time} ${year}`
    }
    const now = new Date()
    const later = new Date(now.getTime() + 3_600_000)
    const ps = [
      `${process.pid} 1 ${process.pid} ${lstart(now)} Electron`,
      `4101 ${process.pid} 4101 ${lstart(now)} node /usr/local/bin/bob acp`,
      `4102 1 4102 ${lstart(now)} /Applications/Mail.app/Contents/MacOS/Mail`,
      `4103 1 4103 ${lstart(later)} node /usr/local/bin/bob acp`
    ].join('\n')
    const terminate = vi.fn(() => true)
    const lines: string[] = []
    expect(stopTrackedChildren({ ps: () => ps, terminate, log: (l) => lines.push(l) })).toBe(1)
    expect(terminate.mock.calls).toEqual([[4101]])
    expect(lines.filter((l) => l.includes('pid réattribué'))).toHaveLength(2)
    expect(readEntries(file).map((e) => e.pid)).toEqual([4101])
  })

  it('ps en échec : rien n’est arrêté', () => {
    openProcessRegistry(join(dir, 'agents.pids'))
    trackChild(Object.assign(new EventEmitter(), { pid: 4201 }) as unknown as ChildProcess, ['bob'])
    const terminate = vi.fn(() => true)
    const lines: string[] = []
    const ps = () => {
      throw new Error('ps introuvable')
    }
    expect(stopTrackedChildren({ ps, terminate, log: (l) => lines.push(l) })).toBe(0)
    expect(terminate).not.toHaveBeenCalled()
    expect(lines[0]).toContain('aucun arrêté')
  })
})
