import type { ChildProcess, SpawnOptions } from 'node:child_process'
import { describe, expect, it, vi } from 'vitest'
import { forcedMcpAuth, pageOpener } from './mcp-oauth-forced'

const child = {} as ChildProcess

describe('fausse commande de connexion des essais (fiche 293)', () => {
  it('jamais dans l’app installée, même avec la variable', () => {
    expect(
      forcedMcpAuth({ isPackaged: true, env: { BOBINE_FAKE_MCP_AUTH: '/x/faux.mjs' } })
    ).toBeUndefined()
    expect(forcedMcpAuth({ isPackaged: true, env: { BOBINE_FAKE_MCP_AUTH: '' } })).toBeUndefined()
    expect(forcedMcpAuth({ isPackaged: false, env: {} })).toBeUndefined()
  })

  it('script lancé par l’exécutable de l’app comme Node, avec les arguments de l’agent', () => {
    const forced = forcedMcpAuth({
      isPackaged: false,
      env: { BOBINE_FAKE_MCP_AUTH: '/x/faux.mjs', BOBINE_FAKE_MCP_AUTH_MS: '1500' }
    })
    const start = vi.fn((_c: string, _a: readonly string[], _o: SpawnOptions) => ({ child }))
    const deps = forced?.deps('/app/Electron', start)
    expect(deps?.findCommand?.('opencode', {})).toBe('/app/Electron')
    expect(
      deps?.start?.('opencode', ['mcp', 'auth', 'figma', '--standalone'], {
        cwd: '/w',
        env: { PATH: '/p' }
      })
    ).toBe(child)
    expect(start).toHaveBeenCalledWith(
      '/app/Electron',
      ['/x/faux.mjs', 'mcp', 'auth', 'figma', '--standalone'],
      { cwd: '/w', env: { PATH: '/p', ELECTRON_RUN_AS_NODE: '1' } }
    )
    expect(deps?.limits).toEqual({ attemptMs: 1500, noPageMs: 1500 })
  })

  it('vide : commande introuvable, rien de lancé ; délai invalide ignoré', () => {
    const forced = forcedMcpAuth({
      isPackaged: false,
      env: { BOBINE_FAKE_MCP_AUTH: '', BOBINE_FAKE_MCP_AUTH_MS: 'abc' }
    })
    const start = vi.fn()
    const deps = forced?.deps('/app/Electron', start)
    expect(deps?.findCommand?.('opencode', {})).toBeUndefined()
    expect(() => deps?.start?.('opencode', ['auth', 'list'], {})).toThrow(/ENOENT/)
    expect(start).not.toHaveBeenCalled()
    expect(deps?.limits).toBeUndefined()
  })
})

describe('page de connexion en essai (`BOBINE_OPEN_LOG`, fiche 293)', () => {
  const url = 'https://www.figma.com/oauth/mcp?state=S&code_challenge=C'
  it('app installée : toujours le navigateur, rien d’écrit dans un fichier', async () => {
    const browser = vi.fn(async () => {})
    const append = vi.fn()
    await pageOpener(
      { isPackaged: true, env: { BOBINE_OPEN_LOG: '/x/open.log' } },
      browser,
      append
    )(url)
    expect(browser).toHaveBeenCalledWith(url)
    expect(append).not.toHaveBeenCalled()
  })

  it('app de développement : notée dans le fichier, sans navigateur ; sans la variable, le navigateur', async () => {
    const browser = vi.fn(async () => {})
    const append = vi.fn()
    await pageOpener(
      { isPackaged: false, env: { BOBINE_OPEN_LOG: '/x/open.log' } },
      browser,
      append
    )(url)
    expect(append).toHaveBeenCalledWith('/x/open.log', `external ${url}\n`)
    expect(browser).not.toHaveBeenCalled()
    await pageOpener({ isPackaged: false, env: {} }, browser, append)(url)
    expect(browser).toHaveBeenCalledWith(url)
  })
})
