import { describe, expect, it } from 'vitest'
import {
  configSignature,
  parseWorktreeConfig,
  setupContext,
  setupSeconds,
  stripAnsi,
  tailOutput
} from './worktree-setup'

describe('préparation des worktrees, fonctions pures (fiche 175)', () => {
  it('lecture de .bobine/worktree.json', () => {
    expect(parseWorktreeConfig({ setup: ' pnpm install ', archive: '', other: 1 })).toEqual({
      setup: 'pnpm install'
    })
    expect(parseWorktreeConfig('x')).toEqual({})
    expect(parseWorktreeConfig({ setup: 3 })).toEqual({})
    expect(configSignature({ setup: 'a' })).not.toBe(configSignature({ archive: 'a' }))
  })

  it('fin de sortie : sans ANSI, retours chariot résolus, bornée', () => {
    expect(stripAnsi('\u001b[1;31mrouge\u001b[0m')).toBe('rouge')
    expect(tailOutput('10%\r50%\r100%\nfini\n')).toBe('100%\nfini\n')
    const long = Array.from({ length: 200 }, (_, i) => `ligne ${i}`).join('\n')
    const tail = tailOutput(long)
    expect(tail.startsWith('ligne 120')).toBe(true)
    expect(tailOutput('x'.repeat(20_000))).toHaveLength(8000)
  })

  it('ligne de contexte pour l’agent', () => {
    expect(setupContext(undefined)).toBeUndefined()
    expect(setupContext({ command: 'a', state: 'done' })).toBeUndefined()
    expect(setupContext({ command: 'a', state: 'failed', exitCode: 1 })).toContain(
      'failed with exit code 1'
    )
    expect(setupContext({ command: 'a', state: 'failed', error: 'ENOENT' })).toContain(
      'could not be started'
    )
    expect(setupContext({ command: 'a', state: 'approval' })).toContain('approval')
    expect(setupContext({ command: 'a', state: 'failed', stopped: true })).toContain(
      'stopped by the user'
    )
    expect(setupContext({ command: 'a', state: 'skipped', unattended: true })).toContain(
      'unattended run'
    )
    expect(setupContext({ command: 'a', state: 'running', proceeded: true })).toContain(
      'still running'
    )
    expect(setupContext({ command: 'a', state: 'running' })).toBeUndefined()
    // `archive` seule : rien à dire à l'agent à la création.
    expect(setupContext({ archive: 'b', state: 'approval' })).toBeUndefined()
  })

  it('durée arrondie', () => {
    expect(
      setupSeconds({
        state: 'done',
        startedAt: '2026-11-06T10:00:00.000Z',
        endedAt: '2026-11-06T10:00:12.400Z'
      })
    ).toBe(12)
    expect(setupSeconds({ state: 'running' })).toBeUndefined()
  })
})
