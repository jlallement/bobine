import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  applyShellEnv,
  extractEnv,
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

  it('shell introuvable : rien, sans exception, problème dit', async () => {
    expect(await loginShellEnv('/nexiste/pas')).toMatchObject({
      values: {},
      problem: expect.stringContaining('/nexiste/pas')
    })
  })

  it.runIf(LOGIN_SHELL)('shell trop lent (fiche 043) : arrêté au délai, problème dit', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'shell-'))
    const slow = join(dir, 'sh')
    writeFileSync(slow, '#!/bin/sh\nsleep 5\n')
    chmodSync(slow, 0o755)
    const result = await loginShellEnv(slow, 200)
    expect(result.values).toEqual({})
    expect(result.problem).toContain('n’a pas répondu')
    expect(result.ms).toBeLessThan(2000)
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
