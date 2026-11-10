import { execFileSync } from 'node:child_process'
import { initI18n } from './i18n'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { COMMAND_MARKER, CommandLine, commandScript, nodeCommandLineIo } from './command-line'
import { parseLaunchArgs } from './launch-request'

function setup(options: { systemWritable: boolean; path?: string }) {
  const root = mkdtempSync(join(tmpdir(), 'bobine-cmd-'))
  const system = join(root, 'usr-local-bin')
  const home = join(root, 'home')
  if (options.systemWritable) mkdirSync(system)
  mkdirSync(home)
  const line = new CommandLine({
    io: nodeCommandLineIo(),
    launcher: () => ({ bundle: '/Applications/Bobine.app' }),
    home,
    systemBin: system,
    pathEnv: () => options.path ?? ''
  })
  return { root, system, home, line }
}

initI18n('fr')

describe('commandScript', () => {
  it('macOS : relance par open -n -a avec le dossier résolu', () => {
    const script = commandScript({ bundle: "/Applications/L'app.app" })
    expect(script).toContain(COMMAND_MARKER)
    expect(script).toContain(`open -n -a '/Applications/L'\\''app.app' --args "$dir" -- "$*"`)
    expect(script).toContain('pwd -P')
  })
  it('sources ou Linux : appelle le binaire, détaché', () => {
    const script = commandScript({ binary: '/opt/Bobine/bobine' })
    expect(script).toContain(`'/opt/Bobine/bobine' "$dir" -- "$*" >/dev/null 2>&1 &`)
  })
  it('un message qui commence par « - » reste un message (fiche 196, relecture)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bobine-sh-'))
    const fake = join(dir, 'app')
    writeFileSync(fake, '#!/bin/sh\nprintf "%s\\n" "$@"\n', { mode: 0o755 })
    const file = join(dir, 'bobine')
    writeFileSync(file, commandScript({ binary: fake }).replaceAll(' >/dev/null 2>&1 &', ''))
    const args = execFileSync('sh', [file, dir, '-v', 'corrige'], { encoding: 'utf8' })
      .trim()
      .split('\n')
    expect(parseLaunchArgs(args.slice(0), '/w')).toEqual({
      folder: realpathSync(dir),
      message: '-v corrige'
    })
  })
  it('est du sh valide, et refuse un dossier absent', () => {
    const script = commandScript({ bundle: '/Applications/Bobine.app' })
    const file = join(mkdtempSync(join(tmpdir(), 'bobine-sh-')), 'bobine')
    writeFileSync(file, script)
    execFileSync('sh', ['-n', file])
    expect(() => execFileSync('sh', [file, '/inexistant-bobine'], { stdio: 'pipe' })).toThrow()
  })
})

describe('CommandLine', () => {
  it('installe dans le dossier système quand on peut y écrire', () => {
    const { system, line } = setup({ systemWritable: true, path: '/usr/bin' })
    const status = line.install()
    expect(status.path).toBe(join(system, 'bobine'))
    expect(status.current).toBe(true)
    expect(statSync(join(system, 'bobine')).mode & 0o111).not.toBe(0)
    expect(status.inPath).toBe(false)
  })
  it('sinon dans ~/.local/bin, et dit si le PATH le contient', () => {
    const { home, line } = setup({ systemWritable: false })
    const status = line.install()
    expect(status.path).toBe(join(home, '.local', 'bin', 'bobine'))
    expect(status.inPath).toBe(false)
    const withPath = setup({ systemWritable: false })
    const inPath = new CommandLine({
      launcher: () => ({ bundle: '/Applications/Bobine.app' }),
      home: withPath.home,
      systemBin: withPath.system,
      pathEnv: () => `/usr/bin:${join(withPath.home, '.local', 'bin')}`
    })
    expect(inPath.install().inPath).toBe(true)
  })
  it('désinstalle, et ne touche pas à un bobine qui n’est pas le sien', () => {
    const { system, line } = setup({ systemWritable: true })
    writeFileSync(join(system, 'bobine'), '#!/bin/sh\necho autre\n')
    expect(() => line.install()).toThrow('n’a pas été installé par Bobine')
    expect(line.uninstall().path).toBeUndefined()
    expect(readFileSync(join(system, 'bobine'), 'utf8')).toContain('autre')
    writeFileSync(join(system, 'bobine'), '')
    rmOurs(line, system)
  })
  it('signale un script périmé (app déplacée)', () => {
    const { system, home, line } = setup({ systemWritable: true })
    line.install()
    const moved = new CommandLine({
      launcher: () => ({ bundle: '/Users/moi/Applications/Bobine.app' }),
      home,
      systemBin: system
    })
    expect(moved.status().current).toBe(false)
    expect(moved.install().current).toBe(true)
    expect(moved.uninstall().path).toBeUndefined()
    expect(existsSync(join(system, 'bobine'))).toBe(false)
  })
})

function rmOurs(line: CommandLine, system: string): void {
  writeFileSync(join(system, 'bobine'), `${COMMAND_MARKER}\n`)
  line.uninstall()
  expect(existsSync(join(system, 'bobine'))).toBe(false)
}
