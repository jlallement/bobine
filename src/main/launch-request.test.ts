import { describe, expect, it } from 'vitest'
import { LaunchController, parseLaunchArgs, userArguments } from './launch-request'

describe('userArguments', () => {
  it('saute le chemin de l’app quand Electron la lance depuis les sources', () => {
    expect(userArguments(['electron', '.', '/p'], true)).toEqual(['/p'])
  })
  it('seconde instance depuis les sources : options en tête, le chemin de l’app reste sauté', () => {
    expect(
      userArguments(
        ['electron', '--user-data-dir=/u', '--use-mock-keychain', '/app', '/p', 'msg'],
        true
      )
    ).toEqual(['--user-data-dir=/u', '--use-mock-keychain', '/p', 'msg'])
  })
  it('ne saute que l’exécutable pour l’app packagée', () => {
    expect(userArguments(['/Applications/Bobine.app/x', '/p'], false)).toEqual(['/p'])
  })
})

describe('parseLaunchArgs', () => {
  it('sans argument : rien à ouvrir', () => {
    expect(parseLaunchArgs([], '/w')).toBeUndefined()
    expect(parseLaunchArgs(['  '], '/w')).toBeUndefined()
  })
  it('le dossier est résolu depuis le dossier de travail', () => {
    expect(parseLaunchArgs(['.'], '/w/projet')).toEqual({ folder: '/w/projet' })
    expect(parseLaunchArgs(['../autre'], '/w/projet')).toEqual({ folder: '/w/autre' })
    expect(parseLaunchArgs(['/abs'], '/w')).toEqual({ folder: '/abs' })
  })
  it('les arguments suivants forment le premier message', () => {
    expect(parseLaunchArgs(['/p', 'corrige', 'le bug'], '/w')).toEqual({
      folder: '/p',
      message: 'corrige le bug'
    })
  })
  it('ignore les arguments propres à l’app et à Chromium', () => {
    const own = [
      '--profil-temporaire',
      '--agents-neufs',
      '--reinitialiser',
      '--user-data-dir=/tmp/x',
      '--ejecter-volume=/Volumes/Bobine',
      '--remote-debugging-port=9333',
      '-psn_0_12345'
    ]
    expect(parseLaunchArgs(own, '/w')).toBeUndefined()
    expect(parseLaunchArgs([...own, '/p', 'bonjour'], '/w')).toEqual({
      folder: '/p',
      message: 'bonjour'
    })
    expect(parseLaunchArgs(['/p', '--profil-temporaire'], '/w')).toEqual({ folder: '/p' })
  })
  it('saute un réglage AppKit et sa valeur (lanceur des essais)', () => {
    const appKit = ['-ApplePersistenceIgnoreState', 'YES']
    expect(parseLaunchArgs(appKit, '/w')).toBeUndefined()
    expect(parseLaunchArgs([...appKit, '/p', 'bonjour'], '/w')).toEqual({
      folder: '/p',
      message: 'bonjour'
    })
    expect(parseLaunchArgs(['/p', ...appKit], '/w')).toEqual({ folder: '/p' })
  })
  it('« -- » rend le reste littéral', () => {
    expect(parseLaunchArgs(['--', '-dossier', '--message'], '/w')).toEqual({
      folder: '/w/-dossier',
      message: '--message'
    })
  })
})

describe('LaunchController', () => {
  function setup(isFolder = true) {
    const shown: unknown[] = []
    const failed: string[] = []
    const opened: string[] = []
    const controller = new LaunchController()
    const deps = {
      isFolder: () => isFolder,
      openConversation: async (folder: string) => {
        opened.push(folder)
        return 'c1'
      },
      focus: () => {},
      show: (prefill: unknown, open: boolean) => shown.push([prefill, open]),
      fail: (folder: string) => failed.push(folder)
    }
    return { controller, deps, shown, failed, opened }
  }
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

  it('une demande du premier lancement attend l’app, puis son message l’interface', async () => {
    const { controller, deps, shown, opened } = setup()
    controller.request({ folder: '/p', message: 'bonjour' })
    expect(opened).toEqual([])
    controller.attach(deps)
    await flush()
    expect(opened).toEqual(['/p'])
    expect(shown).toEqual([])
    expect(controller.take()).toEqual({ id: 'c1', text: 'bonjour' })
    expect(controller.take()).toBeNull()
  })
  it('sans message, rien n’est gardé pour l’interface', async () => {
    const { controller, deps } = setup()
    controller.attach(deps)
    controller.request({ folder: '/p' })
    await flush()
    expect(controller.take()).toBeNull()
  })
  it('interface prête : la conversation et le message lui sont envoyés tout de suite', async () => {
    const { controller, deps, shown } = setup()
    controller.attach(deps)
    controller.take()
    controller.request({ folder: '/p', message: 'salut' })
    await flush()
    expect(shown).toEqual([[{ id: 'c1', text: 'salut' }, true]])
  })
  it('après la fermeture de la fenêtre, le message attend la suivante', async () => {
    const { controller, deps, shown } = setup()
    controller.attach(deps)
    controller.take()
    controller.windowClosed()
    controller.request({ folder: '/p', message: 'salut' })
    await flush()
    expect(shown).toEqual([])
    expect(controller.take()).toEqual({ id: 'c1', text: 'salut' })
  })
  it('un dossier absent ou une conversation impossible est signalé, rien n’est ouvert', async () => {
    const missing = setup(false)
    missing.controller.attach(missing.deps)
    missing.controller.request({ folder: '/nope' })
    await flush()
    expect(missing.failed).toEqual(['/nope'])
    expect(missing.opened).toEqual([])
    const broken = setup()
    broken.deps.openConversation = async () => {
      throw new Error('boum')
    }
    broken.controller.attach(broken.deps)
    broken.controller.request({ folder: '/p' })
    await flush()
    expect(broken.failed).toEqual(['/p'])
  })
})
