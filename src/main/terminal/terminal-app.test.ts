import { describe, expect, it } from 'vitest'
import type { LaunchContext } from '../process-launch'
import { windowsTerminalLaunch } from './terminal-app'

const ctx = (programs: string[]): LaunchContext => ({
  system: 'windows',
  env: {
    Path: 'C:\\Windows\\System32;C:\\Users\\x\\AppData\\Local\\Microsoft\\WindowsApps',
    SystemRoot: 'C:\\Windows'
  },
  isProgram: (file) => programs.some((p) => p.toLowerCase() === file.toLowerCase())
})

describe('terminal du système sous Windows (fiche 229)', () => {
  it('Windows Terminal s’il est là, ouvert dans le dossier', () => {
    const wt = 'C:\\Users\\x\\AppData\\Local\\Microsoft\\WindowsApps\\wt.exe'
    expect(windowsTerminalLaunch('C:\\projets\\a b', ctx([wt]))).toEqual({
      command: wt,
      args: ['-d', 'C:\\projets\\a b'],
      detached: true
    })
  })

  it('sinon une console PowerShell à elle, créée par Start-Process dans le dossier', () => {
    const launch = windowsTerminalLaunch("C:\\projets\\l'a", ctx([]))
    const ps = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'
    expect(launch.command).toBe(ps)
    expect(launch.detached).toBe(false)
    expect(Buffer.from(launch.args.at(-1) ?? '', 'base64').toString('utf16le')).toBe(
      `Start-Process -FilePath '${ps}' -WorkingDirectory 'C:\\projets\\l''a' -ArgumentList '-NoLogo','-NoExit'`
    )
  })
})
