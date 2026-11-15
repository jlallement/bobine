import { spawn, spawnSync, type SpawnOptions } from 'node:child_process'
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  CLOSE_FDS_SCRIPT,
  configureFdRelay,
  highestPassedFd,
  isProgramFile,
  kernelExecutes,
  type LaunchContext,
  type LaunchPlan,
  withClosedFds
} from './process-launch'

const ELF = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 2, 1, 1, 0])
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
/** Tous les programmes simulés sont des ELF. */
const elf = { readHead: () => ELF }

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
    expect(withClosedFds(p, posix(['/usr/bin/git']), undefined, elf)).toBe(p)
    const windows: LaunchContext = { ...posix([]), system: 'windows' }
    expect(withClosedFds(p, windows, '/bin/bash', elf)).toBe(p)
  })

  it('Linux : bash ferme les descripteurs au-delà de 2, puis exec le programme trouvé', () => {
    expect(
      withClosedFds(plan('git', ['log', '--', 'a b']), posix(['/usr/bin/git']), '/bin/bash', elf)
    ).toEqual(
      plan('/bin/bash', [
        '-c',
        CLOSE_FDS_SCRIPT,
        'bobine-fds',
        '2',
        '/usr/bin/git',
        'log',
        '--',
        'a b'
      ])
    )
  })

  it('programme introuvable : pas de relais (spawn rend ENOENT, comme avant)', () => {
    const p = plan('opencode', ['acp'])
    expect(withClosedFds(p, posix([]), '/bin/bash', elf)).toBe(p)
  })

  it('chemin relatif : résolu contre le cwd du lancement, pas celui du main', () => {
    const ctx = posix(['/projet/bin/agent'])
    const relayedPlan = withClosedFds(plan('./bin/agent', ['acp']), ctx, '/bin/bash', {
      ...elf,
      cwd: '/projet'
    })
    expect(relayedPlan.args.slice(3)).toEqual(['2', '/projet/bin/agent', 'acp'])
    expect(
      withClosedFds(plan('bin/agent'), ctx, '/bin/bash', { ...elf, cwd: '/projet' }).args[4]
    ).toBe('/projet/bin/agent')
    // Sans cwd : celui du main, comme `spawn`.
    const here = posix([join(process.cwd(), 'bin/agent')])
    expect(withClosedFds(plan('bin/agent'), here, '/bin/bash', elf).args[4]).toBe(
      join(process.cwd(), 'bin/agent')
    )
  })

  it('descripteurs passés par stdio (3 et plus) : gardés, seuls les autres sont fermés', () => {
    expect(highestPassedFd(undefined)).toBe(2)
    expect(highestPassedFd('pipe')).toBe(2)
    expect(highestPassedFd(['ignore', 'pipe', 'pipe'])).toBe(2)
    expect(highestPassedFd(['ignore', 'pipe', 'pipe', 'pipe'])).toBe(3)
    const stdio: SpawnOptions['stdio'] = ['ignore', 'pipe', 'pipe', 'pipe', 'pipe']
    const p = withClosedFds(plan('textutil'), posix(['/usr/bin/textutil']), '/bin/bash', {
      ...elf,
      stdio
    })
    expect(p.args[3]).toBe('4')
  })

  it('le noyau l’exécute tel quel : ELF, ou #! dont l’interpréteur existe', () => {
    const head = (text: string | Buffer) => () => Buffer.from(text)
    const has = (file: string) => file === '/usr/bin/env' || file === '/bin/sh'
    expect(kernelExecutes('/x', head(ELF), has)).toBe(true)
    expect(kernelExecutes('/x', head('#!/bin/sh\necho'), has)).toBe(true)
    expect(kernelExecutes('/x', head('#! /usr/bin/env node\n'), has)).toBe(true)
    // Interpréteur absent : spawn rend ENOENT ; bash rendrait un code 127.
    expect(kernelExecutes('/x', head('#!/nulle/part/node\n'), has)).toBe(false)
    expect(kernelExecutes('/x', head('#!node\n'), has)).toBe(false)
    // Ni ELF ni #! : glibc relance par /bin/sh ; bash rendrait un code 126.
    expect(kernelExecutes('/x', head('echo sans-shebang\n'), has)).toBe(false)
    expect(kernelExecutes('/x', () => undefined, has)).toBe(false)
  })
})

/** Sortie d'un lancement : erreur de spawn, ou code et texte. */
function outcome(file: string, args: string[]): Promise<string> {
  return new Promise((resolve) => {
    let out = ''
    let done = false
    const child = spawn(file, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    child.stdout.on('data', (d: Buffer) => (out += d.toString()))
    child.stderr.on('data', (d: Buffer) => (out += d.toString()))
    child.on('error', (e: NodeJS.ErrnoException) => {
      if (!done) resolve(`error ${e.code}`)
      done = true
    })
    child.on('close', (code) => {
      if (!done) resolve(`exit ${code} ${out.trim()}`)
      done = true
    })
  })
}

describe.runIf(process.platform === 'linux')('relais, pour de vrai (Linux)', () => {
  const real = (): LaunchContext => ({
    system: 'posix',
    env: process.env,
    isProgram: isProgramFile('posix')
  })
  const fdsOf = (file: string, args: string[], stdio: SpawnOptions['stdio']) =>
    // bash ouvre 7 et 150 sans FD_CLOEXEC (comme Chromium les laisse), puis exec le lancement.
    spawnSync(
      '/bin/bash',
      ['-c', 'exec 7</dev/null 150</dev/null; exec "$@"', 'x', file, ...args],
      {
        stdio
      }
    )
      .stdout.toString()
      .trim()
      .split('\n')

  it('les descripteurs hérités n’arrivent plus ; ceux passés par stdio, si', () => {
    expect(fdsOf('/bin/ls', ['/proc/self/fd'], ['ignore', 'pipe', 'inherit'])).toEqual(
      expect.arrayContaining(['7', '150'])
    )
    const stdio: SpawnOptions['stdio'] = ['ignore', 'pipe', 'inherit', 'pipe']
    const p = withClosedFds(plan('ls', ['/proc/self/fd']), real(), '/bin/bash', { stdio })
    const fds = fdsOf(p.file, p.args, stdio)
    expect(fds).not.toContain('7')
    expect(fds).not.toContain('150')
    expect(fds).toContain('3')
  })

  it('mêmes erreurs qu’un spawn direct quand le programme ne peut pas se lancer', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'relais-'))
    const write = (name: string, text: string | Buffer, mode: number) => {
      writeFileSync(join(dir, name), text)
      chmodSync(join(dir, name), mode)
      return join(dir, name)
    }
    const cases = [
      write('interpreteur-absent', '#!/nulle/part/node\necho hi\n', 0o755),
      write('non-executable', '#!/bin/sh\necho hi\n', 0o644),
      write('ni-elf-ni-shebang', Buffer.from([1, 2, 3, 4, 0, 0, 9, 9]), 0o755),
      write('sans-shebang', 'echo sans-shebang\n', 0o755),
      join(dir, 'absent')
    ]
    mkdirSync(join(dir, 'dossier'))
    cases.push(join(dir, 'dossier'))
    for (const file of cases) {
      const p = withClosedFds(plan(file), real(), '/bin/bash')
      expect(await outcome(p.file, p.args)).toBe(await outcome(file, []))
    }
    // Un script valide passe bien par le relais, et marche.
    const ok = write('valide', '#!/bin/sh\necho valide\n', 0o755)
    const p = withClosedFds(plan(ok), real(), '/bin/bash')
    expect(p.file).toBe('/bin/bash')
    expect(await outcome(p.file, p.args)).toBe('exit 0 valide')
  })
})
