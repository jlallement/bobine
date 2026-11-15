/**
 * Lecture des commandes PowerShell et `cmd` (fiche 229, lot 3b, « apprendre les courantes ») :
 * tables de cas, dont les pièges. Règle : le doute reste « inconnu ».
 */
import { describe, expect, it } from 'vitest'
import { permissionRisks, type RiskContext } from './permission-risk'
import { windowsCommandWrites } from './windows-command-writes'

const CWD = 'C:\\Users\\ada\\projet'

/** Ce que la lecture rend : les cibles écrites (telles qu'écrites) et si elle a douté. */
const read = (text: string) => {
  const found = windowsCommandWrites(text, CWD)
  return { writes: found.writes.map((w) => w.path), unknown: found.unknown }
}

type Case = [command: string, writes: string[]]

describe('lues sans doute : lectures pures', () => {
  const cases = [
    'Get-ChildItem',
    'Get-ChildItem -Recurse -Filter *.ts | Select-Object FullName',
    'gci -Path src -Include *.md',
    'ls',
    'dir /s /b',
    'dir src',
    'Get-Content README.md',
    'cat README.md | Select-String TODO',
    'type README.md',
    'Select-String -Path src\\*.ts -Pattern "TODO"',
    'sls TODO src\\a.ts',
    'Test-Path C:\\Windows',
    'Get-Location',
    'pwd',
    'Get-Command node',
    'gcm git',
    'Get-ChildItem | Measure-Object',
    'Get-Process | Sort-Object CPU | Select-Object -First 5',
    'Write-Output bonjour',
    'echo bonjour',
    'Write-Host "C:\\Windows"',
    'Get-Item C:\\Windows\\win.ini',
    'Get-ItemProperty HKCU:\\Software\\X',
    'Get-FileHash a.zip',
    'Get-ChildItem | Where-Object Name -like "*.md"',
    'Get-Content a.json | ConvertFrom-Json | Format-List',
    'findstr /s TODO *.ts',
    'where git',
    'whoami',
    'tree /f',
    'Get-ChildItem | sort',
    'reg query HKLM\\Software\\Microsoft'
  ]
  it.each(cases)('%s', (command) => {
    expect(read(command)).toEqual({ writes: [], unknown: false })
  })
})

describe('lues sans doute : programmes courants (comme sous Unix)', () => {
  const cases = [
    'git status',
    'git commit -m "message"',
    'npm test',
    'npm.cmd run build',
    'npx vitest run',
    'pnpm install',
    'node script.js',
    'C:\\nodejs\\node.exe -v',
    'python -m pytest',
    'python3 manage.py migrate',
    'py -3 a.py',
    'cargo build --release',
    'dotnet test',
    'git status && npm test',
    'cd src; npm test'
  ]
  it.each(cases)('%s', (command) => {
    expect(read(command)).toEqual({ writes: [], unknown: false })
  })
  it('leur redirection est lue', () => {
    expect(read('npm test > C:\\Windows\\log.txt')).toEqual({
      writes: ['C:\\Windows\\log.txt'],
      unknown: false
    })
    expect(read('npm test 2>&1 | Out-File -FilePath log.txt')).toEqual({
      writes: ['log.txt'],
      unknown: false
    })
  })
})

describe('écritures PowerShell lues', () => {
  const cases: Case[] = [
    ['Set-Content -Path notes.md -Value x', ['notes.md']],
    ['Set-Content notes.md "x"', ['notes.md']],
    ["Set-Content -LiteralPath 'a [1].md' -Value x", ['a [1].md']],
    ['Set-Content -Path:notes.md -Value:x', ['notes.md']],
    ['Set-Content -Pat notes.md x', ['notes.md']],
    ['Set-Content -Li notes.md x', ['notes.md']],
    ['Set-Content -LP notes.md x', ['notes.md']],
    ['Set-Content -Value x -Path notes.md', ['notes.md']],
    ['Set-Content -Path a.md, b.md -Value x', ['a.md', 'b.md']],
    ['Set-Content a.md,b.md x', ['a.md', 'b.md']],
    ['Set-Content -Path "C:\\Mes documents\\a.md" -Value x', ['C:\\Mes documents\\a.md']],
    ["Set-Content -Path 'C:\\l''été\\a.md' -Value x", ["C:\\l'été\\a.md"]],
    ['Set-Content -Path "dit ""bonjour"".md" -Value x', ['dit "bonjour".md']],
    ['Set-Content -Path $env:USERPROFILE\\.gitconfig -Value x', ['$env:USERPROFILE\\.gitconfig']],
    ['Set-Content -Path "$env:APPDATA\\x.json" -Value x', ['$env:APPDATA\\x.json']],
    ['Set-Content -Path notes.md -Value x -Force -ErrorAction Stop', ['notes.md']],
    ['Set-Content -Path notes.md -Value x -Verbose:$false', ['notes.md']],
    ['Add-Content -Path log.txt -Value x', ['log.txt']],
    ['ac log.txt x', ['log.txt']],
    ['Clear-Content log.txt', ['log.txt']],
    ['Out-File -FilePath out.txt -InputObject x', ['out.txt']],
    ['Write-Output x | Out-File out.txt -Encoding utf8', ['out.txt']],
    ['Get-Content a | Set-Content b', ['b']],
    ['Get-Content a | Tee-Object -FilePath b.log', ['b.log']],
    ['Get-Content a | tee b.log', ['b.log']],
    ['Get-Process | Export-Csv -Path p.csv -NoTypeInformation', ['p.csv']],
    ['New-Item notes.md', ['notes.md']],
    ['New-Item -ItemType File -Path notes.md', ['notes.md']],
    ['New-Item -ItemType Directory src\\lib', ['src\\lib']],
    ['New-Item -Path src -Name a.ts -ItemType File', ['src\\a.ts']],
    ['New-Item -Name a.ts', ['a.ts']],
    ['ni a.ts -Force', ['a.ts']],
    ['mkdir build', ['build', 'build']],
    ['md build -Force', ['build', '-Force', 'build']],
    ['Remove-Item build -Recurse -Force', ['build']],
    ['Remove-Item -Path *.log', ['*.log']],
    ['rm a.txt', ['a.txt']],
    ['ri -LiteralPath a.txt', ['a.txt']],
    ['Copy-Item a.txt b.txt', ['b.txt']],
    ['Copy-Item -Path a.txt -Destination C:\\Windows\\b.txt', ['C:\\Windows\\b.txt']],
    ['Copy-Item a.txt', ['.']],
    ['cp -Recurse src dist', ['dist']],
    ['Move-Item a.txt b.txt', ['a.txt', 'b.txt']],
    ['mv C:\\Users\\ada\\.ssh\\id x', ['C:\\Users\\ada\\.ssh\\id', 'x']],
    ['Rename-Item a.txt b.txt', ['a.txt', 'b.txt']],
    ['Rename-Item -Path src\\a.txt -NewName b.txt', ['src\\a.txt', 'src\\b.txt']],
    ['Expand-Archive a.zip -DestinationPath out', ['out']],
    ['Expand-Archive -Path a.zip', ['.']],
    ['Compress-Archive -Path src -DestinationPath src.zip', ['src.zip']],
    ['Set-Content notes.md x; Get-Content notes.md', ['notes.md']],
    ['Set-Content notes.md x && git add notes.md', ['notes.md']]
  ]
  it.each(cases)('%s', (command, writes) => {
    expect(read(command)).toEqual({ writes, unknown: false })
  })
})

describe('écritures de cmd lues', () => {
  const cases: Case[] = [
    ['del a.txt', ['a.txt', 'a.txt']],
    ['del /q /f a.txt b.txt', ['a.txt', 'b.txt']],
    ['erase /s *.tmp', ['*.tmp']],
    ['rd /s /q build', ['build']],
    ['rmdir build', ['build', 'build']],
    ['md build', ['build', 'build']],
    ['copy a.txt b.txt', ['b.txt', 'b.txt']],
    ['copy /y a.txt C:\\Windows\\', ['C:\\Windows\\']],
    ['copy a.txt', ['.', '.']],
    ['xcopy src dist /e /i', ['dist']],
    ['xcopy src', ['.']],
    ['robocopy src C:\\ProgramData\\x /MIR', ['C:\\ProgramData\\x']],
    ['move a.txt b.txt', ['a.txt', 'b.txt', 'a.txt', 'b.txt']],
    ['move /y a.txt dossier', ['a.txt', 'dossier']],
    ['ren a.txt b.txt', ['a.txt', 'b.txt', 'a.txt', 'b.txt']],
    ['rename src\\a.txt b.txt', ['src\\a.txt', 'src\\b.txt']],
    ['echo x > a.txt', ['a.txt']],
    ['echo x>>a.txt', ['a.txt']],
    ['dir > liste.txt 2> erreurs.txt', ['liste.txt', 'erreurs.txt']],
    ['type a.txt > NUL', []],
    ['dir 2>nul', []],
    ['del %TEMP%\\x.tmp', ['%TEMP%\\x.tmp', '%TEMP%\\x.tmp']],
    [
      'copy a.txt "C:\\Program Files\\App\\b.txt"',
      ['C:\\Program Files\\App\\b.txt', 'C:\\Program Files\\App\\b.txt']
    ]
  ]
  it.each(cases)('%s', (command, writes) => {
    expect(read(command)).toEqual({ writes, unknown: false })
  })
})

describe('pièges : toujours « inconnu »', () => {
  const cases = [
    // Guillemets et échappements
    'Set-Content -Path "a`"b.md" -Value x',
    'Set-Content -Path a.md `\n -Value x',
    'Set-Content -Path "$(Get-Location)\\a.md" -Value x',
    "Set-Content -Path 'a.md -Value x",
    'echo x ^> a.txt',
    "del 'a b.txt'",
    // Paramètres
    'Set-Content -Pth notes.md -Value x',
    'Set-Content -Pa notes.md -Value x',
    'Set-Content -P notes.md -Value x',
    'Set-Content -Path notes.md -Path b.md -Value x',
    'Set-Content -Path notes.md -Value',
    'Set-Content -Path: -Value x',
    'Set-Content a.md b c',
    'Set-Content -Value x',
    'Remove-Item',
    'Copy-Item a b -ToSession $s',
    'Rename-Item a.txt sous\\b.txt',
    'Set-Content -Force:maybe a.md x',
    // Tuyaux sans cible connue
    'Get-ChildItem *.log | Remove-Item',
    'gci | ri',
    'Get-ChildItem | ForEach-Object { Remove-Item $_ }',
    'Get-ChildItem | % { $_.Delete() }',
    // Variables, sous-expressions, blocs, appels
    'Set-Content -Path @("a","b") -Value x',
    '[IO.File]::WriteAllText("C:\\Windows\\x", "y")',
    '& .\\build.ps1',
    '& { Remove-Item x }',
    'Start-Job { Remove-Item x } &',
    'iex "Remove-Item x"',
    'Invoke-Expression "Remove-Item x"',
    'powershell -EncodedCommand ZQBjAGgAbwA=',
    'powershell -Command "Remove-Item C:\\x"',
    'pwsh -c "rm x"',
    'cmd /c del x',
    'Start-Process notepad',
    '.\\script.ps1',
    'build.cmd',
    '. .\\profile.ps1',
    'Set-Content -Path a.md -Value x # commentaire',
    // Liens, fournisseurs
    'New-Item -ItemType SymbolicLink -Path lien -Target C:\\Windows',
    'New-Item -ItemType HardLink -Path a -Target C:\\Users\\ada\\.ssh\\id',
    'New-Item -ItemType Junction -Path j -Target C:\\',
    'mklink /J j C:\\',
    'Remove-Item Cert:\\CurrentUser\\My\\X',
    'Set-Content Env:\\PATH x',
    'Set-Content Function:\\prompt x',
    // Commandes inconnues
    'sc stop service',
    'curl -o x https://exemple.test',
    'Invoke-WebRequest https://exemple.test -OutFile x',
    'fsutil hardlink create a b',
    'sort /o out.txt in.txt',
    'icacls x /grant Everyone:F',
    // Une chaîne seule en tête : une valeur pour PowerShell, un programme lancé pour cmd
    '"x" | Out-File out.txt',
    '"C:\\outils\\x.exe"',
    // Syntaxe
    'Get-ChildItem |',
    'echo x >',
    'type < a.txt',
    'Remove-Item src\\*\\..\\..\\x',
    'cd $env:FOO; del x'
  ]
  it.each(cases)('%s', (command) => {
    expect(read(command).unknown).toBe(true)
  })
})

describe('registre et droits', () => {
  it('cmdlets sur le registre : risque registre, pas un fichier', () => {
    const found = windowsCommandWrites(
      'Set-ItemProperty -Path HKCU:\\Software\\X -Name a -Value 1',
      CWD
    )
    expect(found).toMatchObject({ writes: [], registry: ['HKCU:\\Software\\X'], unknown: false })
    expect(windowsCommandWrites('New-Item -Path HKCU:\\Software\\Bobine', CWD).registry).toEqual([
      'HKCU:\\Software\\Bobine'
    ])
    expect(
      windowsCommandWrites('Remove-Item -Path Registry::HKEY_CURRENT_USER\\X', CWD).registry
    ).toEqual(['Registry::HKEY_CURRENT_USER\\X'])
  })
  it('`reg add`, `regedit`', () => {
    expect(windowsCommandWrites('reg add HKCU\\X /v a /d b /f', CWD).registry).toEqual(['HKCU\\X'])
    expect(windowsCommandWrites('regedit /s a.reg', CWD).registry).toHaveLength(1)
  })
  it('droits d’administrateur', () => {
    expect(windowsCommandWrites('sudo del x', CWD)).toMatchObject({
      privilege: ['sudo'],
      unknown: true
    })
    expect(windowsCommandWrites('Start-Process pwsh -Verb RunAs', CWD).privilege).toEqual([
      'Start-Process -Verb RunAs'
    ])
    expect(windowsCommandWrites('Start-Process pwsh -Verb:RunAs', CWD).privilege).toEqual([
      'Start-Process -Verb RunAs'
    ])
  })
})

describe('« Toujours » retrouvé quand c’est sûr (aucun risque)', () => {
  const context: RiskContext = {
    workspace: CWD,
    home: 'C:\\Users\\ada',
    windows: true,
    env: {
      TEMP: 'C:\\Users\\ada\\AppData\\Local\\Temp',
      APPDATA: 'C:\\Users\\ada\\AppData\\Roaming'
    },
    realpath: () => {
      throw new Error('ENOENT')
    },
    otherNames: () => false
  }
  const risks = (text: string) =>
    permissionRisks({ kind: 'execute', rawInput: { command: text } }, context)
  it.each([
    'npm test',
    'pnpm build',
    'git status',
    'Get-ChildItem -Recurse',
    'New-Item -ItemType Directory build',
    'Set-Content notes.md "bonjour"',
    'Remove-Item build -Recurse -Force',
    'del /q build\\*.obj',
    'Expand-Archive a.zip -DestinationPath out',
    'npm test > test.log'
  ])('%s', (command) => {
    expect(risks(command)).toEqual([])
  })
  it.each([
    ['Remove-Item $env:APPDATA\\Code -Recurse', 'home-dotfile'],
    ['Copy-Item a.txt C:\\Windows\\System32\\', 'system-path'],
    ['Set-Content ..\\voisin.txt x', 'outside-folder'],
    ['del %TEMP%\\x', 'outside-folder'],
    ['Set-Content -Path $env:FOO\\a x', 'unknown-writes'],
    ['Set-Content -Path $profile -Value x', 'unknown-writes'],
    ['del %PATH%\\x', 'unknown-writes'],
    ['Set-Content -Path ~\\.ssh\\config x', 'home-dotfile']
  ])('%s : %s', (command, kind) => {
    expect(risks(command).map((r) => r.kind)).toEqual([kind])
  })
})
