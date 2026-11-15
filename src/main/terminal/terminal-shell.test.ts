import { describe, expect, it } from 'vitest'
import { terminalShell } from './terminal-shell'

const env = {
  Path: 'C:\\Windows\\System32;C:\\Program Files\\PowerShell\\7',
  SystemRoot: 'C:\\Windows'
}

describe('shell des terminaux (D5)', () => {
  it('Unix : rien d’imposé (shell de l’utilisateur, `-l`)', () => {
    expect(terminalShell({ system: 'posix', env: {}, isProgram: () => true })).toEqual({})
  })

  it('Windows : pwsh s’il est dans le PATH, sinon powershell.exe ; sans bannière', () => {
    const pwsh = 'C:\\Program Files\\PowerShell\\7\\pwsh.exe'
    expect(terminalShell({ system: 'windows', env, isProgram: (f) => f === pwsh })).toEqual({
      shell: pwsh,
      shellArgs: ['-NoLogo'],
      shellNames: ['pwsh', 'powershell', 'cmd']
    })
    expect(terminalShell({ system: 'windows', env, isProgram: () => false }).shell).toBe(
      'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'
    )
  })
})
