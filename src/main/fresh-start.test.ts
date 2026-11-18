import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  createFreshStart,
  FRESH_AGENTS_SWITCH,
  RESET_SWITCH,
  resetRelaunch,
  TEMPORARY_CLEANUP,
  TEMPORARY_PREFIX,
  TEMPORARY_SWITCH,
  touchesRealAgents,
  type FreshStartApp,
  type FreshStartIo
} from './fresh-start'
import { POSIX_SHELL } from './test-platform'

function setup(switches: string[], packaged = false) {
  const quitListeners: (() => void)[] = []
  const app: FreshStartApp = {
    hasSwitch: (name) => switches.includes(name),
    onWillQuit: (listener) => quitListeners.push(listener),
    isPackaged: packaged,
    execPath: '/Applications/Bobine.app/Contents/MacOS/Bobine',
    appPath: () => '/dev/bobine'
  }
  const unref = vi.fn()
  const io: FreshStartIo = {
    spawn: vi.fn(() => ({ unref })),
    tmp: mkdtempSync(join(tmpdir(), 'neuf-')),
    env: { PATH: '/usr/bin', ELECTRON_RUN_AS_NODE: '1' },
    pid: 4242,
    // L'assistant d'Unix (`sh`) ; celui de Windows est essayé par `reset-windows.test.ts`.
    system: 'posix'
  }
  return {
    fresh: createFreshStart(app, io),
    io,
    unref,
    quit: () => quitListeners.forEach((l) => l())
  }
}

describe('recommencer à neuf : options de lancement (fiche 148)', () => {
  it('sans option : dossier de données habituel, rien d’isolé', () => {
    const { fresh } = setup([])
    expect(fresh.userData('/réel')).toBe('/réel')
    expect([fresh.temporary, fresh.isolated, fresh.askReset, fresh.freshAgents]).toEqual([
      false,
      false,
      false,
      false
    ])
    expect(setup(['user-data-dir']).fresh.isolated).toBe(true)
    expect(setup([RESET_SWITCH]).fresh.askReset).toBe(true)
  })

  it('profil temporaire : dossier neuf dans les fichiers temporaires, supprimé à la fermeture', () => {
    const { fresh, io, quit } = setup([TEMPORARY_SWITCH])
    const folder = fresh.userData('/réel')
    expect(folder.startsWith(join(io.tmp, TEMPORARY_PREFIX))).toBe(true)
    expect(fresh.userData('/réel')).toBe(folder)
    expect(existsSync(folder)).toBe(true)
    expect(fresh.isolated).toBe(true)
    quit()
    expect(existsSync(folder)).toBe(false)
    // Puis l'assistant, pour ce que Chromium écrit encore après `will-quit` : par /bin/sh, jamais
    // en mode Node (fusible RunAsNode coupé dans l'app packagée, fiche 187).
    expect(io.spawn).toHaveBeenCalledWith(
      '/bin/sh',
      ['-c', TEMPORARY_CLEANUP, 'bobine-cleanup', folder, '4242', '600'],
      { detached: true, stdio: 'ignore', env: { PATH: '/usr/bin' } }
    )
  })

  it('`will-quit` émis deux fois (attente des processus, fiche 195) : un seul nettoyage', () => {
    const { fresh, io, quit } = setup([TEMPORARY_SWITCH])
    fresh.userData('/réel')
    quit()
    quit()
    expect(io.spawn).toHaveBeenCalledTimes(1)
  })

  const cleanup = (folder: string, pid: number, tenths = 600) =>
    spawnSync('/bin/sh', [
      '-c',
      TEMPORARY_CLEANUP,
      'bobine-cleanup',
      folder,
      String(pid),
      String(tenths)
    ])

  it.runIf(POSIX_SHELL)(
    'assistant de ménage, pour de vrai : il attend la fin de l’app, puis supprime le dossier',
    () => {
      const folder = mkdtempSync(join(tmpdir(), TEMPORARY_PREFIX))
      writeFileSync(join(folder, 'Local State'), '{}')
      const done = spawnSync('/usr/bin/true')
      expect(cleanup(folder, done.pid ?? 999_999).status).toBe(0)
      expect(existsSync(folder)).toBe(false)
    }
  )

  it.runIf(POSIX_SHELL)(
    'assistant de ménage : jamais un dossier qui n’est pas un profil temporaire, ni app ouverte',
    () => {
      const other = mkdtempSync(join(tmpdir(), 'pas-un-profil-'))
      expect(cleanup(other, spawnSync('/usr/bin/true').pid ?? 999_999).status).toBe(2)
      expect(existsSync(other)).toBe(true)
      const folder = mkdtempSync(join(tmpdir(), TEMPORARY_PREFIX))
      expect(cleanup(folder, process.pid, 2).status).toBe(1)
      expect(existsSync(folder)).toBe(true)
    }
  )

  it('agents comme sur un Mac neuf : HOME et XDG_* dans le profil, seulement s’ils sont demandés', () => {
    const plain = setup([TEMPORARY_SWITCH])
    plain.fresh.userData('/réel')
    const env: NodeJS.ProcessEnv = { HOME: '/Users/ada' }
    expect(plain.fresh.isolateAgents(env)).toBeUndefined()
    expect(env['HOME']).toBe('/Users/ada')
    // `--agents-neufs` sans profil temporaire : ignoré.
    expect(setup([FRESH_AGENTS_SWITCH]).fresh.freshAgents).toBe(false)

    const { fresh } = setup([TEMPORARY_SWITCH, FRESH_AGENTS_SWITCH])
    const folder = fresh.userData('/réel')
    const home = fresh.isolateAgents(env)
    expect(home).toBe(join(folder, 'maison'))
    expect(env['HOME']).toBe(home)
    expect(env['XDG_CONFIG_HOME']).toBe(join(folder, 'maison', '.config'))
    expect(env['XDG_DATA_HOME']).toBe(join(folder, 'maison', '.local/share'))
    expect(existsSync(join(folder, 'maison', '.cache'))).toBe(true)
  })

  it('seconde Bobine : lancée détachée, sans le mode Node, avec ses options', () => {
    const dev = setup([])
    dev.fresh.openTemporary(false)
    expect(dev.io.spawn).toHaveBeenCalledWith(
      '/Applications/Bobine.app/Contents/MacOS/Bobine',
      ['/dev/bobine', `--${TEMPORARY_SWITCH}`],
      { detached: true, stdio: 'ignore', env: { PATH: '/usr/bin' } }
    )
    expect(dev.unref).toHaveBeenCalled()
    const packaged = setup([], true)
    packaged.fresh.openTemporary(true)
    expect(vi.mocked(packaged.io.spawn).mock.calls[0]?.[1]).toEqual([
      `--${TEMPORARY_SWITCH}`,
      `--${FRESH_AGENTS_SWITCH}`
    ])
  })
})

describe('relance après la réinitialisation (fiche 187, D24)', () => {
  const bundle = '/Applications/Bobine.app'

  it('profil habituel : l’app installée, rien de plus', () => {
    expect(resetRelaunch({ opener: '/usr/bin/open', bundle, temporary: false })).toEqual([
      '/usr/bin/open',
      '-n',
      bundle
    ])
  })

  it('dossier de données imposé : la relance le garde, jamais le vrai profil', () => {
    const userDataDir = '/tmp/essai Bobine/données é'
    expect(
      resetRelaunch({ opener: '/usr/bin/open', bundle, temporary: false, userDataDir })
    ).toEqual(['/usr/bin/open', '-n', bundle, '--args', `--user-data-dir=${userDataDir}`])
  })

  it('profil temporaire : rien à rouvrir', () => {
    expect(
      resetRelaunch({ opener: '/usr/bin/open', bundle, temporary: true, userDataDir: '/tmp/x' })
    ).toBeUndefined()
  })
})

describe('profil jetable sur les vrais agents (fiche 242, D17)', () => {
  it('temporaire ou dossier imposé, agents sur le vrai dossier personnel : oui', () => {
    const launch = (isolated: boolean, freshAgents = false) => ({ isolated, freshAgents })
    expect(touchesRealAgents(launch(true), {})).toBe(true)
    // Profil ordinaire : les données réelles sont celles de l'utilisateur, pas un essai.
    expect(touchesRealAgents(launch(false), {})).toBe(false)
    // Agents neufs (dossier personnel vide) ou dossier personnel d'essai : rien de réel à protéger.
    expect(touchesRealAgents(launch(true, true), {})).toBe(false)
    expect(touchesRealAgents(launch(true), { BOBINE_CONFIG_HOME: '/essai' })).toBe(false)
  })
})
