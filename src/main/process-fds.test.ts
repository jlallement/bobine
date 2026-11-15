import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import {
  CLOSE_FDS_SCRIPT,
  configureFdRelay,
  isProgramFile,
  type LaunchContext,
  type LaunchPlan,
  withClosedFds
} from './process-launch'

const posix = (programs: string[]): LaunchContext => ({
  system: 'posix',
  env: { PATH: '/usr/bin:/bin' },
  isProgram: (file) => programs.includes(file)
})
const plan = (file: string, args: string[] = []): LaunchPlan => ({
  file,
  args,
  verbatim: false,
  kind: 'direct'
})

describe('descripteurs hérités (fiche 145, pannes-visibles)', () => {
  it('relais posé sous Linux seulement, et seulement si bash est là', () => {
    expect(configureFdRelay('darwin', () => true)).toBeUndefined()
    expect(configureFdRelay('win32', () => true)).toBeUndefined()
    expect(configureFdRelay('linux', (f) => f === '/usr/bin/bash')).toBe('/usr/bin/bash')
    expect(configureFdRelay('linux', () => false)).toBeUndefined()
    configureFdRelay('darwin')
  })

  it('sans relais (macOS, Windows) : le plan tel quel', () => {
    const p = plan('git', ['status'])
    expect(withClosedFds(p, posix(['/usr/bin/git']), undefined)).toBe(p)
    const windows: LaunchContext = { ...posix([]), system: 'windows' }
    expect(withClosedFds(p, windows, '/bin/bash')).toBe(p)
  })

  it('Linux : bash ferme les descripteurs puis exec le programme trouvé, mêmes arguments', () => {
    expect(
      withClosedFds(plan('git', ['log', '--', 'a b']), posix(['/usr/bin/git']), '/bin/bash')
    ).toEqual(
      plan('/bin/bash', ['-c', CLOSE_FDS_SCRIPT, 'bobine-fds', '/usr/bin/git', 'log', '--', 'a b'])
    )
  })

  it('programme introuvable : pas de relais (spawn rend ENOENT, comme avant)', () => {
    const p = plan('opencode', ['acp'])
    expect(withClosedFds(p, posix([]), '/bin/bash')).toBe(p)
  })

  it.runIf(process.platform === 'linux')(
    'pour de vrai : un descripteur hérité n’arrive pas',
    () => {
      const list = (file: string, args: string[]) =>
        spawnSync(file, args, { stdio: ['ignore', 'pipe', 'inherit', 'pipe', 'pipe'] })
          .stdout.toString()
          .trim()
          .split('\n')
      // Sans relais : 3 et 4 (passés comme Chromium laisse ses descripteurs) arrivent à l'enfant.
      expect(list('/bin/ls', ['/proc/self/fd'])).toEqual(expect.arrayContaining(['3', '4']))
      const relayed = withClosedFds(
        plan('ls', ['/proc/self/fd']),
        { system: 'posix', env: process.env, isProgram: isProgramFile('posix') },
        '/bin/bash'
      )
      // Avec : 0, 1, 2 et le dossier que `ls` ouvre lui-même pour lire /proc/self/fd.
      expect(
        list(relayed.file, relayed.args).filter((fd) => Number(fd) > 2).length
      ).toBeLessThanOrEqual(1)
    }
  )
})
