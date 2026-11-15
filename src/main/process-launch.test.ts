import { describe, expect, it } from 'vitest'
import {
  cmdLine,
  envValue,
  findProgram,
  launchOptions,
  normalizeEnv,
  pathEntries,
  pathKey,
  planLaunch,
  planShellCommand,
  processSystem,
  quoteWindowsArg,
  UnsafeArgumentError,
  type LaunchContext
} from './process-launch'

/** Machine Windows simulée : fichiers présents, insensibles à la casse comme NTFS. */
function windows(files: string[], env: NodeJS.ProcessEnv = {}): LaunchContext {
  const key = (f: string) => f.toLowerCase().replace(/\//g, '\\')
  const set = new Set(files.map(key))
  return {
    system: 'windows',
    env: {
      Path: 'C:\\Windows\\System32;C:\\Users\\Ana\\AppData\\Roaming\\npm;"C:\\Program Files\\nodejs"',
      PATHEXT: '.COM;.EXE;.BAT;.CMD;.VBS;.JS',
      ComSpec: 'C:\\Windows\\system32\\cmd.exe',
      SystemRoot: 'C:\\Windows',
      ...env
    },
    isProgram: (file) => set.has(key(file))
  }
}

function posixCtx(files: string[], PATH = '/usr/bin:/opt/homebrew/bin'): LaunchContext {
  const set = new Set(files)
  return { system: 'posix', env: { PATH }, isProgram: (file) => set.has(file) }
}

/**
 * Relecture de la ligne par `cmd.exe` (fonction de référence, simplifiée) : `^` retire le sens du
 * caractère suivant ; `"` non échappé ouvre une zone où `^` est littéral. Sert à vérifier que la
 * ligne ne contient aucun caractère spécial actif, puis à retrouver ce que reçoit le programme.
 */
function cmdPass(line: string): { text: string; active: string[] } {
  let text = ''
  const active: string[] = []
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i] ?? ''
    if (!quoted && c === '^') {
      text += line[i + 1] ?? ''
      i++
      continue
    }
    if (c === '"') quoted = !quoted
    if (!quoted && '&|<>()%!'.includes(c)) active.push(c)
    text += c
  }
  return { text, active }
}

/** `CommandLineToArgvW`, pour les arguments (après le nom du programme). */
function argv(line: string): string[] {
  const out: string[] = []
  let i = 0
  while (i < line.length) {
    while (line[i] === ' ' || line[i] === '\t') i++
    if (i >= line.length) break
    let arg = ''
    let quoted = false
    for (; i < line.length; i++) {
      const c = line[i]
      if (c === '\\') {
        let n = 0
        while (line[i] === '\\') {
          n++
          i++
        }
        if (line[i] === '"') {
          arg += '\\'.repeat(Math.floor(n / 2))
          if (n % 2 === 1) arg += '"'
          else {
            quoted = !quoted
          }
        } else {
          arg += '\\'.repeat(n)
          i--
        }
        continue
      }
      if (c === '"') {
        quoted = !quoted
        continue
      }
      if (!quoted && (c === ' ' || c === '\t')) break
      arg += c
    }
    out.push(arg)
  }
  return out
}

const TRAPS = [
  'simple',
  'avec espace',
  '',
  '"guillemets"',
  'a"b',
  'fin\\',
  'C:\\dossier avec espace\\',
  '\\"',
  '\\\\serveur\\partage',
  '&calc.exe',
  'a & b | c',
  '%PATH%',
  '%~dp0',
  '^',
  '^^',
  '!USERNAME!',
  '(x)',
  '<in >out 2>&1',
  ';,=',
  '*?[]',
  '`echo`',
  'é€ 漢字',
  '--flag=a b'
]

describe('système des processus (ADR-0050)', () => {
  it('Windows à part, le reste en Unix', () => {
    expect(processSystem('win32')).toBe('windows')
    expect(processSystem('darwin')).toBe('posix')
    expect(processSystem('linux')).toBe('posix')
  })
})

describe('environnement', () => {
  it('PATH lu sans casse sous Windows, tel quel sous Unix', () => {
    expect(envValue({ Path: 'a' }, 'PATH', 'windows')).toBe('a')
    expect(envValue({ Path: 'a' }, 'PATH', 'posix')).toBeUndefined()
    expect(pathKey({ Path: 'a' }, 'windows')).toBe('Path')
    expect(pathKey({}, 'windows')).toBe('Path')
    expect(pathKey({ Path: 'a' }, 'posix')).toBe('PATH')
  })

  it('une seule clé par nom sous Windows : la dernière valeur, la première orthographe', () => {
    expect(normalizeEnv({ Path: 'a', FOO: '1', PATH: 'b' }, 'windows')).toEqual({
      Path: 'b',
      FOO: '1'
    })
    const env = { Path: 'a', PATH: 'b' }
    expect(normalizeEnv(env, 'posix')).toBe(env)
  })

  it('PATH coupé sur `;` (guillemets retirés) ou `:`', () => {
    expect(pathEntries('C:\\a;"C:\\b c";;C:\\d', 'windows')).toEqual(['C:\\a', 'C:\\b c', 'C:\\d'])
    expect(pathEntries('/a:/b::/c', 'posix')).toEqual(['/a', '/b', '/c'])
  })
})

describe('recherche du programme', () => {
  it('Unix : premier dossier du PATH qui l’a, ou le chemin donné', () => {
    const ctx = posixCtx(['/opt/homebrew/bin/opencode', '/tmp/x'])
    expect(findProgram('opencode', ctx)).toBe('/opt/homebrew/bin/opencode')
    expect(findProgram('/tmp/x', ctx)).toBe('/tmp/x')
    expect(findProgram('bob', ctx)).toBeUndefined()
  })

  it('Windows : PATHEXT dans son ordre, dossiers dans le leur (`.exe` avant `.cmd`)', () => {
    const npm = 'C:\\Users\\Ana\\AppData\\Roaming\\npm'
    expect(findProgram('bob', windows([`${npm}\\bob.cmd`, `${npm}\\bob.ps1`, `${npm}\\bob`]))).toBe(
      `${npm}\\bob.cmd`
    )
    expect(findProgram('opencode', windows([`${npm}\\opencode.exe`, `${npm}\\opencode.cmd`]))).toBe(
      `${npm}\\opencode.exe`
    )
    // Dossier du PATH entre guillemets.
    expect(findProgram('node', windows(['C:\\Program Files\\nodejs\\node.exe']))).toBe(
      'C:\\Program Files\\nodejs\\node.exe'
    )
    // Extension donnée : telle quelle, casse ignorée.
    expect(findProgram('BOB.CMD', windows([`${npm}\\bob.cmd`]))).toBe(`${npm}\\BOB.CMD`)
  })

  it('Windows : `.ps1` seulement en dernier recours ; jamais le dossier courant', () => {
    const npm = 'C:\\Users\\Ana\\AppData\\Roaming\\npm'
    expect(findProgram('bob', windows([`${npm}\\bob.ps1`]))).toBe(`${npm}\\bob.ps1`)
    expect(findProgram('bob', windows(['bob.cmd', '.\\bob.cmd']))).toBeUndefined()
  })

  it('Windows : chemin à lettre de lecteur ou à barre, avec ou sans extension', () => {
    const ctx = windows(['D:\\outils\\agent.cmd', 'C:\\x\\y.exe'])
    expect(findProgram('D:\\outils\\agent', ctx)).toBe('D:\\outils\\agent.cmd')
    expect(findProgram('C:/x/y.exe', ctx)).toBe('C:/x/y.exe')
    // Une lettre de lecteur n'est pas un séparateur du PATH.
    expect(findProgram('C:\\x\\y', ctx)).toBe('C:\\x\\y.exe')
  })

  it('PATHEXT absent : celui de Windows par défaut', () => {
    const ctx = windows(['C:\\Windows\\System32\\where.exe'], { PATHEXT: undefined })
    expect(findProgram('where', ctx)).toBe('C:\\Windows\\System32\\where.exe')
  })
})

describe('citation pour CommandLineToArgvW', () => {
  it('chaque argument piégé relu à l’identique', () => {
    for (const arg of TRAPS) expect(argv(quoteWindowsArg(arg))).toEqual([arg])
    expect(argv(TRAPS.map(quoteWindowsArg).join(' '))).toEqual(TRAPS)
  })

  it('formes connues', () => {
    expect(quoteWindowsArg('a b')).toBe('"a b"')
    expect(quoteWindowsArg('a"b')).toBe('"a\\"b"')
    expect(quoteWindowsArg('fin\\')).toBe('"fin\\\\"')
    expect(quoteWindowsArg('a\\b')).toBe('"a\\b"')
    expect(quoteWindowsArg('')).toBe('""')
  })
})

describe('ligne de cmd.exe pour un .cmd', () => {
  const script = 'C:\\Users\\Ana\\AppData\\Roaming\\npm\\bob.cmd'

  it('aucun caractère spécial actif, après chacune des deux lectures', () => {
    const line = cmdLine(script, TRAPS)
    const first = cmdPass(line)
    expect(first.active).toEqual([])
    // Seconde lecture : `%*` développé dans le script, relu par cmd.exe.
    const args = first.text.slice(first.text.indexOf(' ') + 1)
    const second = cmdPass(args)
    expect(second.active).toEqual([])
    expect(argv(second.text)).toEqual(TRAPS)
  })

  it('chemin du script avec espaces et `&` : échappé une fois, sans guillemets', () => {
    const line = cmdLine('C:\\Program Files\\A&B\\x.cmd', ['y'])
    expect(line.startsWith('C:\\Program^ Files\\A^&B\\x.cmd ')).toBe(true)
    expect(cmdPass(line).active).toEqual([])
  })

  it('retour à la ligne ou caractère nul : refusé', () => {
    expect(() => cmdLine(script, ['a\nb'])).toThrow(UnsafeArgumentError)
    expect(() => cmdLine(script, ['a\rb'])).toThrow(UnsafeArgumentError)
    expect(() => cmdLine(script, ['a\0b'])).toThrow(UnsafeArgumentError)
    expect(() => cmdLine('C:\\a\nb.cmd', [])).toThrow(UnsafeArgumentError)
  })
})

describe('plan de lancement', () => {
  const npm = 'C:\\Users\\Ana\\AppData\\Roaming\\npm'

  it('Unix : inchangé, `spawn` cherche lui-même', () => {
    expect(planLaunch('bob', ['acp'], posixCtx([]))).toEqual({
      file: 'bob',
      args: ['acp'],
      verbatim: false,
      kind: 'direct'
    })
  })

  it('Windows, `.cmd` : cmd.exe /d /s /v:off /c, ligne entre guillemets', () => {
    const plan = planLaunch('bob', ['acp', '--x=a b'], windows([`${npm}\\bob.cmd`]))
    expect(plan.file).toBe('C:\\Windows\\system32\\cmd.exe')
    expect(plan.args.slice(0, 4)).toEqual(['/d', '/s', '/v:off', '/c'])
    expect(plan.args[4]).toBe(`"${cmdLine(`${npm}\\bob.cmd`, ['acp', '--x=a b'])}"`)
    expect(plan).toMatchObject({ verbatim: true, kind: 'cmd', resolved: `${npm}\\bob.cmd` })
  })

  it('Windows, `.exe` : direct, par son chemin', () => {
    const plan = planLaunch('opencode', ['acp'], windows([`${npm}\\opencode.exe`]))
    expect(plan).toEqual({
      file: `${npm}\\opencode.exe`,
      args: ['acp'],
      verbatim: false,
      resolved: `${npm}\\opencode.exe`,
      kind: 'direct'
    })
  })

  it('Windows, `.ps1` : PowerShell, stratégie d’exécution non contournée', () => {
    const plan = planLaunch('bob', ['acp'], windows([`${npm}\\bob.ps1`]))
    expect(plan.file).toBe('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe')
    expect(plan.args).toEqual([
      '-NoLogo',
      '-NoProfile',
      '-NonInteractive',
      '-File',
      `${npm}\\bob.ps1`,
      'acp'
    ])
    expect(plan.args.join(' ')).not.toMatch(/ExecutionPolicy|Bypass/i)
  })

  it('Windows, introuvable : tel quel (ENOENT dit par spawn)', () => {
    expect(planLaunch('bob', ['acp'], windows([]))).toMatchObject({ file: 'bob', kind: 'direct' })
  })

  it('commande de shell : /bin/sh -c, ou cmd.exe /d /s /c', () => {
    expect(planShellCommand('pnpm dev', posixCtx([]))).toMatchObject({
      file: '/bin/sh',
      args: ['-c', 'pnpm dev']
    })
    expect(planShellCommand('pnpm dev', windows([]))).toMatchObject({
      file: 'C:\\Windows\\system32\\cmd.exe',
      args: ['/d', '/s', '/c', '"pnpm dev"'],
      verbatim: true
    })
  })
})

describe('options de spawn', () => {
  it('Unix : propre groupe, rien d’autre', () => {
    expect(launchOptions({ verbatim: false }, 'posix', { cwd: '/x' })).toEqual({
      cwd: '/x',
      detached: true
    })
  })

  it('Windows : jamais detached, pas de console, environnement à clés uniques', () => {
    expect(
      launchOptions({ verbatim: true }, 'windows', { cwd: 'C:\\x', env: { Path: 'a', PATH: 'b' } })
    ).toEqual({
      cwd: 'C:\\x',
      env: { Path: 'b' },
      detached: false,
      windowsHide: true,
      windowsVerbatimArguments: true
    })
  })
})
