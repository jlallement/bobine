import { chmodSync, existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  applyShellEnv,
  extractEnv,
  fallbackShell,
  loginShellEnv,
  mergePath,
  parseWindowsEnv,
  WINDOWS_ENV_SCRIPT
} from './shell-env'
import { LOGIN_SHELL } from './test-platform'

const M = '__BOBINE_ENV__'

describe('shell-env', () => {
  it('extrait les variables malgré le bruit des fichiers rc ; vides omises', () => {
    const stdout =
      '[oh-my-zsh] Insecure completion-dependent directories detected\n' +
      `${M}/opt/homebrew/bin:/usr/bin${M}/Users/x/.cfg${M}${M}END\n(prompt)`
    expect(extractEnv(stdout)).toEqual({
      PATH: '/opt/homebrew/bin:/usr/bin',
      XDG_CONFIG_HOME: '/Users/x/.cfg'
    })
    expect(extractEnv('rien ici')).toEqual({})
  })

  it('fusionne : ordre du shell d’abord, puis le reste, sans doublon', () => {
    expect(mergePath('/opt/homebrew/bin:/usr/bin', '/usr/bin:/bin')).toBe(
      '/opt/homebrew/bin:/usr/bin:/bin'
    )
    expect(mergePath(undefined, '/usr/bin:/bin')).toBe('/usr/bin:/bin')
  })

  it('applique : PATH fusionné, XDG du shell seulement s’il manque', () => {
    const env: NodeJS.ProcessEnv = { PATH: '/usr/bin', XDG_DATA_HOME: '/deja' }
    applyShellEnv(
      { PATH: '/opt/homebrew/bin', XDG_CONFIG_HOME: '/cfg', XDG_DATA_HOME: '/autre' },
      env
    )
    expect(env).toEqual({
      PATH: '/opt/homebrew/bin:/usr/bin',
      XDG_CONFIG_HOME: '/cfg',
      XDG_DATA_HOME: '/deja'
    })
  })

  // Shell de connexion : Unix seulement ; sous Windows, `readUserEnv` lit les variables enregistrées.
  it.runIf(LOGIN_SHELL)('récupère les variables depuis un vrai shell', async () => {
    const result = await loginShellEnv('/bin/sh')
    expect(result.values.PATH).toContain('/usr/bin')
    expect(result.problem).toBeUndefined()
  })

  it.runIf(LOGIN_SHELL)('shell introuvable : repli (fiche 253)', async () => {
    const missing = await loginShellEnv('/nexiste/pas', 5000, 'linux')
    expect(missing.values.PATH).toContain('/usr/bin')
    expect(missing.fallbackFrom).toContain('/nexiste/pas')
  })

  it.runIf(LOGIN_SHELL)('shell trop lent (fiche 043) : arrêté au délai, problème dit', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'shell-'))
    const slow = join(dir, 'sh')
    // Comme un shell interactif, il ignore SIGTERM : arrêté quand même, et sans repli (fiche 253).
    writeFileSync(slow, "#!/bin/sh\ntrap '' TERM\nsleep 5\n")
    chmodSync(slow, 0o755)
    const result = await loginShellEnv(slow, 200)
    expect(result.values).toEqual({})
    expect(result.problem).toContain('n’a pas répondu')
    expect(result.fallbackFrom).toBeUndefined()
    expect(result.ms).toBeLessThan(2000)
  })

  describe('shells qui ne s’y prêtent pas (fiche 253)', () => {
    /** Shell factice `name` dans un dossier jetable : `body` reçoit `-ilc` et la commande. */
    function fakeShell(name: string, body: string): string {
      const file = join(mkdtempSync(join(tmpdir(), 'shell-')), name)
      writeFileSync(file, `#!/bin/sh\n${body}\n`)
      chmodSync(file, 0o755)
      return file
    }

    it.runIf(LOGIN_SHELL)(
      'un fichier rc qui lit l’entrée ne fait pas attendre le délai',
      async () => {
        // `read` bloque tant que l'entrée reste ouverte : avec stdin sur /dev/null, il finit aussitôt.
        const reader = fakeShell('sh', 'read answer\nexec /bin/sh -c "$2"')
        const result = await loginShellEnv(reader, 3000)
        expect(result.problem).toBeUndefined()
        expect(result.values.PATH).toContain('/usr/bin')
        expect(result.ms).toBeLessThan(2000)
      }
    )

    it.runIf(LOGIN_SHELL)(
      'shell qui refuse `-ilc` (comme tcsh) : repli, et le journal le dit',
      async () => {
        const refusing = fakeShell('mysh', 'echo "Unknown option: \\`-lc\'" >&2\nexit 1')
        const result = await loginShellEnv(refusing, 5000, 'linux')
        expect(result.problem).toBeUndefined()
        expect(result.values.PATH).toContain('/usr/bin')
        expect(result.fallbackFrom).toBe(`${refusing} (${refusing} : Unknown option: \`-lc')`)
      }
    )

    it.runIf(LOGIN_SHELL)(
      'PATH rendu sans être développé (`$PATH`, comme nushell) : rejeté, repli',
      async () => {
        const literal = fakeShell('mysh', `printf '%s' '${M}$PATH${M.repeat(6)}${M}END'`)
        const result = await loginShellEnv(literal, 5000, 'linux')
        expect(result.values.PATH).toContain('/usr/bin')
        expect(result.values.PATH).not.toContain('$')
        expect(result.fallbackFrom).toContain('PATH')
      }
    )

    it.runIf(LOGIN_SHELL)(
      'shell non POSIX connu (tcsh, nu…) : jamais lancé, repli direct',
      async () => {
        const dir = mkdtempSync(join(tmpdir(), 'shell-'))
        const witness = join(dir, 'lance')
        const tcsh = join(dir, 'tcsh')
        writeFileSync(tcsh, `#!/bin/sh\ntouch '${witness}'\nexit 1\n`)
        chmodSync(tcsh, 0o755)
        const result = await loginShellEnv(tcsh, 5000, 'linux')
        expect(result.values.PATH).toContain('/usr/bin')
        expect(result.fallbackFrom).toBe(`${tcsh} (non POSIX)`)
        expect(existsSync(witness)).toBe(false)
      }
    )

    it('repli : zsh de connexion interactif sous macOS, sh de connexion ailleurs', () => {
      expect(fallbackShell('darwin')).toEqual({ file: '/bin/zsh', flags: '-ilc' })
      expect(fallbackShell('linux')).toEqual({ file: '/bin/sh', flags: '-lc' })
    })
  })
})

describe('environnement sous Windows (fiche 229)', () => {
  it('PATH fusionné sur `;`, sans casse ni `\\` final en double, sous la clé `Path`', () => {
    expect(
      mergePath('C:\\Windows;C:\\Users\\a\\AppData\\Roaming\\npm', 'c:\\windows\\;D:\\x', 'windows')
    ).toBe('C:\\Windows;C:\\Users\\a\\AppData\\Roaming\\npm;D:\\x')
    const env: NodeJS.ProcessEnv = { Path: 'C:\\Windows' }
    applyShellEnv({ PATH: 'C:\\npm' }, env, 'windows')
    expect(env).toEqual({ Path: 'C:\\npm;C:\\Windows' })
  })

  it('variables enregistrées lues en JSON ; vides et sortie illisible ignorées', () => {
    expect(
      parseWindowsEnv('{"PATH":"C:\\\\a;C:\\\\b","HTTPS_PROXY":"","XDG_CONFIG_HOME":null}')
    ).toEqual({
      PATH: 'C:\\a;C:\\b'
    })
    expect(parseWindowsEnv('oups')).toEqual({})
    // Script constant : seulement les variables connues, rien de l’extérieur.
    expect(WINDOWS_ENV_SCRIPT).toContain("'PATH','XDG_CONFIG_HOME'")
    expect(WINDOWS_ENV_SCRIPT).toContain("GetEnvironmentVariable($n,'User')")
  })
})
