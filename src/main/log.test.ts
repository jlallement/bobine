import { existsSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  agentLog,
  agentsLogFile,
  disableConsole,
  formatLine,
  getVerbosity,
  initLog,
  isBrokenPipe,
  log,
  logs,
  logSizes,
  setVerbosity
} from './log'

describe('journal', () => {
  it('ligne datée, niveau, message et pile des erreurs', () => {
    const line = formatLine('error', 'Échec', [new Error('boum'), { a: 1 }], new Date(0))
    expect(line).toMatch(/^1970-01-01T00:00:00.000Z ERROR Échec Error: boum/)
    expect(line).toContain('{"a":1}')
    expect(line.endsWith('\n')).toBe(true)
  })

  it('écrit dans main.log ; un journal trop gros au démarrage devient main.old.log', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bob-log-'))
    writeFileSync(join(dir, 'main.log'), 'x'.repeat(1024 * 1024 + 1))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const file = initLog(dir)
    expect(existsSync(join(dir, 'main.old.log'))).toBe(true)
    log.warn('Attention', 'détail')
    expect(readFileSync(file, 'utf8')).toMatch(/WARN  Attention détail\n$/)
    warn.mockRestore()
  })

  it('erreur en boucle : deux fichiers au plus, de taille bornée', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bob-log-'))
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const file = initLog(dir, 10_000)
    for (let i = 0; i < 2000; i++) log.error('Boucle', new Error(`n° ${i}`))
    expect(statSync(file).size).toBeLessThanOrEqual(10_000)
    expect(statSync(join(dir, 'main.old.log')).size).toBeLessThanOrEqual(10_000)
    error.mockRestore()
  })

  it('console fermée (EPIPE) : plus d’écriture sur la console, ni d’exception', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bob-log-'))
    const file = initLog(dir)
    const broken = Object.assign(new Error('write EPIPE'), { code: 'EPIPE' })
    expect(isBrokenPipe(broken)).toBe(true)
    expect(isBrokenPipe(new Error('autre'))).toBe(false)
    const error = vi.spyOn(console, 'error').mockImplementation(() => {
      throw broken
    })
    expect(() => log.error('Premier')).not.toThrow()
    disableConsole()
    log.error('Second')
    expect(error).toHaveBeenCalledTimes(1)
    expect(readFileSync(file, 'utf8')).toMatch(/Premier[\s\S]*Second/)
    error.mockRestore()
  })

  it('agents.log (fiche 080) : rien au niveau Normal, une ligne par échange en Détaillé, avec sa portée', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bob-log-'))
    initLog(dir)
    const file = agentsLogFile() ?? ''
    setVerbosity('normal')
    agentLog.line({ conversation: 'abcdef1234', agent: 'opencode' }, '→ session/prompt #3')
    expect(existsSync(file)).toBe(false)
    expect(logs('detailed')).toBe(false)
    setVerbosity('detailed')
    expect([getVerbosity(), logs('detailed'), logs('trace')]).toEqual(['detailed', true, false])
    agentLog.line({ conversation: 'abcdef1234', agent: 'opencode' }, '→ session/prompt #3')
    expect(readFileSync(file, 'utf8')).toMatch(/Z \[abcdef12 · opencode\] → session\/prompt #3\n$/)
    setVerbosity('trace')
    expect(logs('trace')).toBe(true)
    expect(logSizes().agents).toBeGreaterThan(0)
    setVerbosity('normal')
  })

  it('agents.log borné à part : deux fichiers au plus, main.log intact', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bob-log-'))
    initLog(dir, 10_000, 5_000)
    setVerbosity('detailed')
    for (let i = 0; i < 500; i++) agentLog.line({ agent: 'mock' }, `← update n° ${i}`)
    setVerbosity('normal')
    expect(statSync(join(dir, 'agents.log')).size).toBeLessThanOrEqual(5_000)
    expect(statSync(join(dir, 'agents.old.log')).size).toBeLessThanOrEqual(5_000)
    expect(existsSync(join(dir, 'main.old.log'))).toBe(false)
  })
})
