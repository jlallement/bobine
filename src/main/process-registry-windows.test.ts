import { describe, expect, it, vi } from 'vitest'
import type { ChildEntry } from './process-registry'
import {
  orphanTreesWindows,
  reapOrphansWindows,
  sameCommandWindows
} from './process-registry-windows'
import type { WinProcessRow } from './process-tree-windows'

const started = '2026-11-15T10:00:00.400Z'
const at = (iso: string) => Date.parse(iso)

const entry = (over: Partial<ChildEntry> = {}): ChildEntry => ({
  pid: 500,
  pgid: 500,
  command: ['bob', 'acp'],
  startedAt: started,
  ...over
})

const row = (over: Partial<WinProcessRow>): WinProcessRow => ({
  pid: 1,
  ppid: 4,
  startedAt: at('2026-11-15T10:00:00Z'),
  command: '',
  ...over
})

const CMD_LINE =
  'C:\\Windows\\system32\\cmd.exe /d /s /v:off /c "C:\\Users\\Ana\\AppData\\Roaming\\npm\\bob.cmd ^^^"acp^^^""'

describe('même commande sous Windows', () => {
  it('sans casse, nom sans dossier ni extension, arguments dans l’ordre', () => {
    expect(sameCommandWindows(CMD_LINE, ['bob', 'acp'])).toBe(true)
    expect(sameCommandWindows('"C:\\x\\OpenCode.exe" acp', ['C:\\x\\opencode.exe', 'acp'])).toBe(
      true
    )
    expect(sameCommandWindows('notepad.exe notes.txt', ['bob', 'acp'])).toBe(false)
    expect(sameCommandWindows('bob.cmd x acp', ['bob', 'serve'])).toBe(false)
  })
})

describe('arbres à arrêter au démarrage (Windows)', () => {
  it('chef retrouvé, même commande et même heure : son arbre', () => {
    const leader = row({ pid: 500, command: CMD_LINE })
    expect(orphanTreesWindows([entry()], [leader], 1).stop).toEqual([
      { entry: entry(), roots: [leader] }
    ])
  })

  it('pid réattribué : jamais touché (autre commande, autre heure)', () => {
    const other = orphanTreesWindows([entry()], [row({ pid: 500, command: 'notepad.exe' })], 1)
    expect(other.skipped[0]?.reason).toMatch(/autre commande/)
    const later = orphanTreesWindows(
      [entry()],
      [row({ pid: 500, command: CMD_LINE, startedAt: at('2026-11-15T11:00:00Z') })],
      1
    )
    expect(later.skipped[0]?.reason).toMatch(/autre heure/)
  })

  it('chef disparu : ses enfants créés après lui sont les racines ; les plus anciens laissés', () => {
    const orphan = row({ pid: 700, ppid: 500, startedAt: at('2026-11-15T10:00:02Z') })
    const older = row({ pid: 701, ppid: 500, startedAt: at('2026-11-14T10:00:00Z') })
    const verdict = orphanTreesWindows([entry()], [orphan, older], 1)
    expect(verdict.stop).toEqual([{ entry: entry(), roots: [orphan] }])
  })

  it('parti de lui-même, ou le main lui-même : rien', () => {
    expect(orphanTreesWindows([entry()], [], 1)).toEqual({ stop: [], skipped: [] })
    expect(orphanTreesWindows([entry({ pid: 900 })], [row({ pid: 900 })], 900)).toEqual({
      stop: [],
      skipped: []
    })
  })

  it('reapOrphansWindows : taskkill par racine, journal ; liste illisible : rien', async () => {
    const taskkill = vi.fn()
    const lines: string[] = []
    const list = JSON.stringify([
      { ProcessId: 500, ParentProcessId: 4, Start: '2026-11-15T10:00:00Z', CommandLine: CMD_LINE }
    ])
    await reapOrphansWindows([entry()], {
      list: () => Promise.resolve(list),
      taskkill,
      log: (line) => lines.push(line),
      self: 1
    })
    expect(taskkill.mock.calls).toEqual([[500]])
    expect(lines[0]).toMatch(/arrêté : bob acp \(pid 500/)
    taskkill.mockClear()
    await reapOrphansWindows([entry()], {
      list: () => Promise.resolve('oups'),
      taskkill,
      log: (line) => lines.push(line),
      self: 1
    })
    expect(taskkill).not.toHaveBeenCalled()
    expect(lines.at(-1)).toMatch(/non vérifiés \(Win32_Process/)
  })
})
