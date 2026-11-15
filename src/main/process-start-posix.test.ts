/**
 * Chemin macOS et Linux figé (fiche 229, consigne de Jérôme : « ne casse pas la version macOS ») :
 * sans configuration Windows, chaque lancement passe à `spawn` exactement ce que les appelants lui
 * passaient avant ADR-0050, et le registre note la même commande.
 */
import { EventEmitter } from 'node:events'
import { afterEach, describe, expect, it, vi } from 'vitest'

const spawn = vi.fn(() => Object.assign(new EventEmitter(), { pid: 4242 }))
vi.mock('node:child_process', async (original) => ({
  ...(await original<typeof import('node:child_process')>()),
  spawn
}))
const trackChild = vi.fn()
vi.mock('./process-registry', async (original) => ({
  ...(await original<typeof import('./process-registry')>()),
  trackChild
}))

const { startProcess } = await import('./process-tree')
const { configureProcessLaunch, launchSystem } = await import('./process-launch')

afterEach(() => {
  spawn.mockClear()
  trackChild.mockClear()
})

describe('lancement sous macOS et Linux : identique à avant (ADR-0050)', () => {
  it('système par défaut : Unix', () => {
    expect(launchSystem()).toBe('posix')
  })

  it('agent : commande telle quelle, mêmes options plus `detached`, même entrée au registre', () => {
    configureProcessLaunch('posix')
    const env = { PATH: '/usr/bin', BOB: '1' }
    startProcess('bob', ['acp', '--x=a b'], { cwd: '/p', env, stdio: ['pipe', 'pipe', 'pipe'] })
    expect(spawn).toHaveBeenCalledWith('bob', ['acp', '--x=a b'], {
      cwd: '/p',
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: true
    })
    expect(trackChild.mock.calls[0]?.[1]).toEqual(['bob', 'acp', '--x=a b'])
  })

  it('ligne de shell (serveur de dev) : /bin/sh -c, comme avant', () => {
    startProcess('pnpm dev', [], { cwd: '/p', stdio: ['ignore', 'pipe', 'pipe'] }, true)
    expect(spawn).toHaveBeenCalledWith('/bin/sh', ['-c', 'pnpm dev'], {
      cwd: '/p',
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true
    })
    expect(trackChild.mock.calls[0]?.[1]).toEqual(['/bin/sh', '-c', 'pnpm dev'])
  })

  it('commande notée au registre imposée par l’appelant (préparation d’un worktree)', () => {
    startProcess('pnpm install', [], { cwd: '/p' }, true, ['pnpm install'])
    expect(trackChild.mock.calls[0]?.[1]).toEqual(['pnpm install'])
  })

  it('aucune option propre à Windows', () => {
    startProcess('x', [], { cwd: '/p' })
    const options = (spawn.mock.calls[0] as unknown[])[2] as Record<string, unknown>
    expect(Object.keys(options).sort()).toEqual(['cwd', 'detached'])
  })
})
