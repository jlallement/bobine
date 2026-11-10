import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IPC_CHANNELS } from '@shared/ipc'
import type { ConversationView } from '@shared/agent'
import {
  createHandlers,
  registerIpcHandlers,
  type ConversationController,
  type IpcMainLike,
  type IpcSenderEvent
} from './ipc'

const view = {
  summary: {
    id: 'c1',
    title: 'Conversation',
    profileId: 'mock',
    profileLabel: 'Factice',
    workspace: '/projet',
    updatedAt: '2026-10-13T10:00:00.000Z',
    status: 'ready',
    draft: false
  },
  snapshot: null,
  transcript: { items: [{ kind: 'user', id: 1, text: 'Salut' }], nextId: 2 }
} as unknown as ConversationView

function fakeConversations() {
  return {
    state: vi.fn(() => ({ conversations: [], activeId: 'c1' })),
    view: vi.fn(() => view),
    select: vi.fn(() => view),
    create: vi.fn(async () => view),
    configure: vi.fn(async () => view),
    rename: vi.fn(),
    delete: vi.fn(async () => ({ conversations: [], activeId: 'c2' })),
    setPinned: vi.fn(),
    search: vi.fn(() => [{ id: 'c1', snippet: 'postgres', highlights: [[0, 8]] }]),
    prompt: vi.fn(async () => {}),
    cancel: vi.fn(async () => {}),
    restart: vi.fn(async () => {}),
    respondPermission: vi.fn(),
    setControl: vi.fn(async () => {}),
    respondElicitation: vi.fn(),
    authenticate: vi.fn(async () => {}),
    retrySession: vi.fn(async () => {}),
    trustForSession: vi.fn(async () => {}),
    workspaceOf: vi.fn(() => '/projet'),
    profileOf: vi.fn(() => undefined),
    readFolder: vi.fn(
      <T>(_id: string, read: (folder: string) => T | Promise<T>, _none: T): Promise<T> =>
        Promise.resolve(read('/projet'))
    ),
    readDocument: vi.fn(async () => {
      throw new Error('Hors du dossier de la conversation')
    }),
    revertFile: vi.fn(async () => 'restored' as const),
    settled: vi.fn(async () => {}),
    branch: vi.fn(async () => ({ ...view, summary: { ...view.summary, id: 'c2' } })),
    settingsView: vi.fn(() => ({
      profiles: [],
      profileId: 'mock',
      workspace: '/tmp',
      recentWorkspaces: [],
      notifications: settings.notifications
    }))
  }
}

/** Réglages partagés par les faux gestionnaire et réglages : la vue suit les changements. */
const settings = { notifications: true }

function fakeSettings() {
  return {
    setNotifications: vi.fn((enabled: boolean) => {
      settings.notifications = enabled
    }),
    setPreferences: vi.fn(),
    forgetWorkspace: vi.fn(),
    forgetTool: vi.fn(),
    setNewConversation: vi.fn(),
    setCommands: vi.fn(),
    setApiKey: vi.fn(),
    removeApiKey: vi.fn(),
    setAppToolFamily: vi.fn(),
    saveCustomAgent: vi.fn(() => 'custom-a'),
    removeCustomAgent: vi.fn(),
    tips: vi.fn(() => ({ hidden: [] })),
    recordTip: vi.fn(() => ({ hidden: [] })),
    resetTips: vi.fn(() => ({ hidden: [] })),
    noteSentMessage: vi.fn(() => true),
    tipsSince: vi.fn(() => ({ hidden: [] }))
  }
}

/** Émetteur des appels d'essai : par défaut, toujours digne de confiance. */
function setup(trusted: (event: IpcSenderEvent) => boolean = () => true) {
  settings.notifications = true
  const conversations = fakeConversations()
  const settingsStore = fakeSettings()
  const send = vi.fn()
  const openTerminal = vi.fn(async () => {})
  const openPath = vi.fn(async (path: string) => (path.endsWith('absent.txt') ? 'introuvable' : ''))
  const reveal = vi.fn()
  const openExternal = vi.fn(async () => {})
  const chooseFiles = vi.fn(async () => ['/projet/a.txt'])
  const searchFiles = vi.fn(async () => [{ path: '/projet/src/a.ts', relative: 'src/a.ts' }])
  const reloadShellEnv = vi.fn(async () => {})
  const saveFile = vi.fn(async (name: string) =>
    name.endsWith('.json') ? null : `/export/${name}`
  )
  const writeExport = vi.fn(async () => {})
  const backupHistory = vi.fn(async (dir: string) => `${dir}/bobine-sauvegarde-x`)
  const approvals = { forgetSite: vi.fn(), forgetCommand: vi.fn(), forgetWorktreeSetup: vi.fn() }
  const log = { status: vi.fn(), setLevel: vi.fn(), open: vi.fn(), reveal: vi.fn() }
  const android = {
    state: vi.fn(async () => ({
      conversationId: 'c1',
      device: null,
      screen: null,
      sdk: false
    })),
    screenshot: vi.fn(async () => null),
    tap: vi.fn(async () => {}),
    swipe: vi.fn(async () => {}),
    key: vi.fn(async () => {}),
    startStream: vi.fn(async () => false),
    stopStream: vi.fn()
  }
  const browser = {
    show: vi.fn(),
    hide: vi.fn(),
    navigate: vi.fn(async () => {}),
    openTab: vi.fn(async () => {}),
    go: vi.fn(async () => {}),
    state: vi.fn(() => null),
    selectTab: vi.fn(),
    closeTab: vi.fn(),
    inherit: vi.fn(),
    showDownload: vi.fn(),
    freeze: vi.fn(async () => null),
    noteShot: vi.fn(async () => null),
    annotate: vi.fn(async () => {}),
    pagePins: vi.fn(async () => {})
  }
  const listeners = new Map<string, (event: IpcSenderEvent, ...args: unknown[]) => unknown>()
  const ipcMain: IpcMainLike = { handle: (channel, listener) => listeners.set(channel, listener) }
  registerIpcHandlers(
    ipcMain,
    createHandlers({
      appName: 'bobine',
      appVersion: '0.1.0',
      electronVersion: '44.0.0',
      platform: 'darwin',
      conversations: conversations as unknown as ConversationController,
      settings: settingsStore,
      chooseDirectory: async () => '/choisi',
      openTerminal,
      chooseFiles,
      searchFiles,
      reloadShellEnv,
      saveFile,
      writeExport,
      backupHistory,
      browser,
      devServers: { list: vi.fn(() => []), stop: vi.fn(() => true), logs: vi.fn(() => []) },
      approvals,
      log,
      attention: () => ({ c1: 'done' }),
      send,
      attentionDetails: () => ({}),
      notifications: { status: () => ({ blocked: 'refusé' }), openSettings: async () => {} },
      commands: { project: vi.fn(async () => []) },
      git: { status: vi.fn(async () => null) },
      changes: {
        git: {
          changes: vi.fn(async () => null),
          fileDiff: vi.fn(async () => ({ oldText: 'a', newText: 'b' }))
        },
        openPath,
        reveal,
        openExternal
      },
      simulator: {
        state: vi.fn(async () => ({
          conversationId: 'c1',
          device: null,
          screen: null,
          touch: false
        })),
        screenshot: vi.fn(async () => null),
        tap: vi.fn(async () => {}),
        swipe: vi.fn(async () => {}),
        button: vi.fn(async () => {}),
        startStream: vi.fn(async () => false),
        stopStream: vi.fn()
      },
      terminals: {
        list: vi.fn(() => []),
        create: vi.fn(() => ({ id: '1', title: 'projet', cwd: '/tmp', busy: false })),
        write: vi.fn(),
        resize: vi.fn(),
        close: vi.fn(),
        stop: vi.fn(),
        snapshot: vi.fn(async () => ''),
        run: vi.fn(() => ({ id: '2', title: 'projet', cwd: '/tmp', busy: true }))
      },
      android
    }),
    { trusted }
  )
  const event: IpcSenderEvent = { sender: {}, senderFrame: {} }
  const call = (channel: string, ...args: unknown[]) => listeners.get(channel)?.(event, ...args)
  return {
    android,
    conversations,
    settings: settingsStore,
    send,
    listeners,
    call,
    openTerminal,
    chooseFiles,
    searchFiles,
    reloadShellEnv,
    log,
    saveFile,
    writeExport,
    backupHistory,
    browser,
    openPath,
    reveal,
    openExternal,
    approvals
  }
}

describe('IPC', () => {
  // Les erreurs des gestionnaires sont journalisées (fiche 041) : console muette pendant les tests.
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('émetteur (fiche 114) : une fenêtre de l’app est servie, un autre émetteur est refusé', () => {
    const frame = {}
    const sender = {}
    const trusted = vi.fn(
      (event: IpcSenderEvent) => event.sender === sender && event.senderFrame === frame
    )
    const { listeners, conversations: c } = setup(trusted)
    const state = listeners.get('conversations:get')
    expect(state?.({ sender, senderFrame: frame })).toEqual({ conversations: [], activeId: 'c1' })
    expect(c.state).toHaveBeenCalledTimes(1)
    // Autre `webContents` (popup d'un site, panneau navigateur) ou `iframe` : rien d'appelé.
    expect(() => state?.({ sender: {}, senderFrame: frame })).toThrow('untrusted sender')
    expect(() => state?.({ sender, senderFrame: {} })).toThrow('untrusted sender')
    expect(() => state?.({ sender, senderFrame: null })).toThrow('untrusted sender')
    expect(c.state).toHaveBeenCalledTimes(1)
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('conversations:get'))
    expect(trusted).toHaveBeenCalledTimes(4)
  })

  it('navigateur : emplacement et action validés avant d’atteindre la page', async () => {
    const { call, browser } = setup()
    await call('browser:show', 'c1', { x: 10, y: 20, width: 300, height: 200 })
    expect(browser.show).toHaveBeenCalledWith('c1', { x: 10, y: 20, width: 300, height: 200 })
    await expect(call('browser:show', 'c1', { x: 'a' })).rejects.toThrow('bounds')
    await call('browser:go', 'c1', 'back')
    expect(browser.go).toHaveBeenCalledWith('c1', 'back')
    await expect(call('browser:go', 'c1', 'rm -rf')).rejects.toThrow('action')
    await call('browser:navigate', 'c1', 'localhost:3000')
    expect(browser.navigate).toHaveBeenCalledWith('c1', 'localhost:3000')
    await call('browser:showDownload', 'c1', '/Users/ada/Downloads/export.csv')
    expect(browser.showDownload).toHaveBeenCalledWith('c1', '/Users/ada/Downloads/export.csv')
  })

  it('annoter la page (fiches 132, 146) : mode, couleurs et épingles vérifiés', async () => {
    const { call, browser } = setup()
    await call('browser:freeze', 'c1')
    expect(browser.freeze).toHaveBeenCalledWith('c1')
    await call('browser:noteShot', 'c1')
    expect(browser.noteShot).toHaveBeenCalledWith('c1')
    const theme = { accent: '#c96442', surface: '#fff', text: '#111', border: '#ddd' }
    await call('browser:annotate', 'c1', true, theme)
    expect(browser.annotate).toHaveBeenCalledWith('c1', true, theme)
    await call('browser:annotate', 'c1', false, null)
    expect(browser.annotate).toHaveBeenLastCalledWith('c1', false, undefined)
    await expect(call('browser:annotate', 'c1', 'oui', null)).rejects.toThrow('on')
    await expect(
      call('browser:annotate', 'c1', true, { ...theme, accent: 'url(x); x' })
    ).rejects.toThrow('theme')
    const pins = [{ id: 'n1', n: 1, text: 'Trop petit', doc: { x: 1, y: 2 } }]
    await call('browser:pagePins', 'c1', pins)
    expect(browser.pagePins).toHaveBeenCalledWith('c1', pins)
    await expect(call('browser:pagePins', 'c1', [{ id: 'n1' }])).rejects.toThrow('pins')
  })

  it('branche (fiche 094) : elle reprend la page de la conversation d’origine', async () => {
    const { call, browser } = setup()
    await call('conversation:branch', 'c1', 3, 'Autrement')
    expect(browser.inherit).toHaveBeenCalledWith('c2', 'c1')
  })

  it('pièces jointes et fichiers du dossier : le main déduit le dossier de la conversation', async () => {
    const { call, conversations: c, chooseFiles, searchFiles } = setup()
    await call('agent:prompt', 'c1', '', [
      { kind: 'image', name: 'a.png', mimeType: 'image/png', data: 'iVBORw==' }
    ])
    expect(c.prompt).toHaveBeenCalledWith(
      'c1',
      '',
      [{ kind: 'image', name: 'a.png', mimeType: 'image/png', data: 'iVBORw==' }],
      {}
    )
    expect(await call('workspace:pickFiles', 'c1')).toEqual(['/projet/a.txt'])
    expect(chooseFiles).toHaveBeenCalledWith('/projet')
    expect(await call('workspace:searchFiles', 'c1', 'a')).toHaveLength(1)
    expect(searchFiles).toHaveBeenCalledWith('/projet', 'a', undefined, undefined)
  })

  it('workspace:excludedPaths (fiche 155) : selon les fichiers d’exclusion du profil', async () => {
    const workspace = mkdtempSync(join(tmpdir(), 'exclus-'))
    writeFileSync(join(workspace, '.bobignore'), '*.secret\n')
    const { call, conversations: c, searchFiles } = setup()
    c.workspaceOf.mockReturnValue(workspace)
    expect(await call('workspace:excludedPaths', 'c1', [join(workspace, 'a.secret')])).toEqual({
      paths: [],
      files: []
    })
    c.profileOf.mockReturnValue({
      exclusions: { summary: () => '', files: ['.bobignore'] }
    } as never)
    expect(
      await call('workspace:excludedPaths', 'c1', [
        join(workspace, 'a.secret'),
        join(workspace, 'a.txt')
      ])
    ).toEqual({ paths: [join(workspace, 'a.secret')], files: ['.bobignore'] })
    await expect(call('workspace:excludedPaths', 'c1', 'a')).rejects.toThrow()
    await call('workspace:searchFiles', 'c1', 'a')
    const lastCall = searchFiles.mock.calls.at(-1) as unknown[] | undefined
    const isExcluded = lastCall?.[3] as (p: string) => Promise<boolean>
    expect(await isExcluded(join(workspace, 'b.secret'))).toBe(true)
  })

  it('settings:reloadShellEnv (fiche 043) : relit le shell puis rend les réglages', async () => {
    const { call, reloadShellEnv } = setup()
    expect(await call('settings:reloadShellEnv')).toMatchObject({ profileId: 'mock' })
    expect(reloadShellEnv).toHaveBeenCalledTimes(1)
  })

  it('log:open et log:reveal (fiches 080, 133) : un des deux journaux, rien d’autre', async () => {
    const { call, log } = setup()
    await call('log:open', 'main')
    await call('log:reveal', 'agents')
    expect(log.open).toHaveBeenCalledWith('main')
    expect(log.reveal).toHaveBeenCalledWith('agents')
    expect(() => call('log:reveal', '../secret')).toThrow('Paramètre invalide : file')
    expect(log.reveal).toHaveBeenCalledTimes(1)
  })

  it('export, sauvegarde et annulation d’une modification (fiche 043)', async () => {
    const { call, conversations: c, saveFile, writeExport, backupHistory, reveal } = setup()
    expect(await call('conversation:export', 'c1', 'markdown')).toMatch(
      /^\/export\/conversation-\d{4}-\d{2}-\d{2}\.md$/
    )
    expect(saveFile).toHaveBeenCalledWith(
      expect.stringMatching(/^conversation-\d{4}-\d{2}-\d{2}\.md$/),
      'markdown'
    )
    expect(writeExport).toHaveBeenCalledWith(
      expect.stringMatching(/\.md$/),
      expect.stringMatching(/^# /)
    )
    expect(reveal).toHaveBeenCalledWith(expect.stringMatching(/\.md$/))
    // Dialogue annulé (le faux rend null pour le JSON) : rien d'écrit.
    expect(await call('conversation:export', 'c1', 'json')).toBeNull()
    expect(writeExport).toHaveBeenCalledTimes(1)
    await expect(call('conversation:export', 'c1', 'pdf')).rejects.toThrow('format')

    expect(await call('app:backupHistory')).toBe('/choisi/bobine-sauvegarde-x')
    expect(c.settled).toHaveBeenCalledTimes(1)
    expect(backupHistory).toHaveBeenCalledWith('/choisi')

    expect(await call('changes:revert', 'c1', '/projet/a.ts')).toBe('restored')
    expect(c.revertFile).toHaveBeenCalledWith('c1', '/projet/a.ts')
    expect(() => call('changes:revert', 'c1', '')).toThrow('path')
  })

  it('un handler pour chaque canal du contrat', () => {
    const { listeners } = setup()
    expect([...listeners.keys()].sort()).toEqual([...IPC_CHANNELS].sort())
  })

  it('app:reportError : écrit dans le journal, champs bornés et vérifiés', async () => {
    const { call } = setup()
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    await call('app:reportError', { source: 'react', message: 'boum', stack: 'at App' })
    await call('app:reportError', 'n’importe quoi')
    expect(error.mock.calls[0]?.[0]).toMatch(/ERROR Interface \(react\) : boum at App/)
    expect(error.mock.calls[1]?.[0]).toMatch(/Interface \(\?\) : \(sans message\)/)
    error.mockRestore()
  })

  it('erreur d’un gestionnaire : renvoyée à l’interface et journalisée', async () => {
    const { call } = setup()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(() => call('conversation:view', 42)).toThrow('Paramètre invalide')
    expect(warn.mock.calls[0]?.[0]).toContain('IPC conversation:view')
    warn.mockRestore()
  })

  it('app:getInfo', async () => {
    const { call } = setup()
    expect(await call('app:getInfo')).toMatchObject({ name: 'bobine', platform: 'darwin' })
  })

  it('conversations : liste, sélection, création, renommage, suppression', async () => {
    const { conversations: c, call } = setup()
    expect(await call('conversations:get')).toEqual({ conversations: [], activeId: 'c1' })
    expect(await call('conversation:select', 'c1')).toBe(view)
    await call('conversation:create', { profileId: 'codex' })
    expect(c.create).toHaveBeenCalledWith({ profileId: 'codex', workspace: undefined })
    await call('conversation:rename', 'c1', 'Titre')
    expect(c.rename).toHaveBeenCalledWith('c1', 'Titre')
    await call('conversation:delete', 'c1')
    expect(c.delete).toHaveBeenCalledWith('c1', { fromAgent: true, removeWorktree: false })
  })

  it('les actions d’agent désignent leur conversation', async () => {
    const { conversations: c, call } = setup()
    await call('agent:prompt', 'c1', 'Bonjour')
    await call('agent:cancel', 'c1')
    await call('agent:restart', 'c1')
    call('agent:respondPermission', 'c1', 'permission-1', 'allow')
    call('agent:respondPermission', 'c1', 'permission-2', null)
    await call('agent:setControl', 'c1', 'mode', 'read-only')
    await call('agent:configure', 'c1', { workspace: '/w' })
    expect(c.prompt).toHaveBeenCalledWith('c1', 'Bonjour', [], {})
    // `/split` (fiche 118) : seule l'option vérifiée passe.
    await call('agent:prompt', 'c1', 'Deux chantiers', [], { askChildren: true, autre: 1 })
    expect(c.prompt).toHaveBeenCalledWith('c1', 'Deux chantiers', [], { askChildren: true })
    await call('agent:prompt', 'c1', 'Rien', [], { askChildren: 'oui' })
    expect(c.prompt).toHaveBeenCalledWith('c1', 'Rien', [], {})
    expect(c.cancel).toHaveBeenCalledWith('c1')
    expect(c.restart).toHaveBeenCalledWith('c1')
    expect(c.respondPermission).toHaveBeenCalledWith('c1', 'permission-1', 'allow')
    expect(c.respondPermission).toHaveBeenCalledWith('c1', 'permission-2', null)
    expect(c.setControl).toHaveBeenCalledWith('c1', 'mode', 'read-only')
    expect(c.configure).toHaveBeenCalledWith('c1', { profileId: undefined, workspace: '/w' })
  })

  it('émulateur Android : toucher, appui long, balayage et touches bornés (fiche 081)', async () => {
    const { call, android } = setup()
    await call('android:tap', 'c1', 10.4, 20.6)
    expect(android.tap).toHaveBeenLastCalledWith('c1', { x: 10, y: 21 }, undefined)
    await call('android:tap', 'c1', 10, 20, 60_000)
    expect(android.tap).toHaveBeenLastCalledWith('c1', { x: 10, y: 20 }, 5000)
    await call('android:swipe', 'c1', 100, 800, 100, 200, 1)
    expect(android.swipe).toHaveBeenLastCalledWith('c1', { x: 100, y: 800 }, { x: 100, y: 200 }, 50)
    await call('android:key', 'c1', 'volume_up')
    expect(android.key).toHaveBeenLastCalledWith('c1', 'volume_up')
    await expect(call('android:key', 'c1', 'KEYCODE_CALL')).rejects.toThrow('key')
    await expect(call('android:swipe', 'c1', 1, 2, 3, 'x', 100)).rejects.toThrow('balayage')
    await expect(call('android:tap', 'c1', 1, 2, 'long')).rejects.toThrow('holdMs')
  })

  it('rejette les arguments invalides venant du renderer', async () => {
    const { call } = setup()
    await expect(call('agent:prompt', 'c1', '   ')).rejects.toThrow('Prompt vide')
    await expect(
      call('agent:prompt', 'c1', '', [{ kind: 'file', path: 'relatif.txt' }])
    ).rejects.toThrow('Chemin de fichier invalide')
    await expect(
      call('agent:prompt', 'c1', 'x', [
        { kind: 'image', name: 'a.svg', mimeType: 'image/svg+xml', data: 'AA==' }
      ])
    ).rejects.toThrow('Format d’image non pris en charge')
    await expect(call('workspace:searchFiles', 'c1', 42)).rejects.toThrow('Recherche invalide')
    await expect(call('agent:prompt', 42, 'Bonjour')).rejects.toThrow('Paramètre invalide')
    expect(() => call('agent:respondPermission', 'c1', 'p', 42)).toThrow('invalide')
    await expect(call('agent:setControl', 'c1', 'mode', 42)).rejects.toThrow('Réglage invalide')
    expect(() => call('conversation:create', null)).toThrow('Requête invalide')
    expect(() => call('conversation:rename', 'c1', '')).toThrow('Paramètre invalide')
  })

  it('actions requises et élicitation', async () => {
    const { conversations: c, call, openTerminal } = setup()
    await call('agent:authenticate', 'c1', 'sso')
    await call('agent:retrySession', 'c1')
    await call('agent:trustForSession', 'c1')
    call('agent:respondElicitation', 'c1', 'e1', { action: 'accept', content: { a: 1 } })
    await call('workspace:openTerminal', 'c1')
    expect(c.authenticate).toHaveBeenCalledWith('c1', 'sso')
    expect(c.retrySession).toHaveBeenCalledWith('c1')
    expect(c.trustForSession).toHaveBeenCalledWith('c1')
    expect(c.respondElicitation).toHaveBeenCalledWith('c1', 'e1', {
      action: 'accept',
      content: { a: 1 }
    })
    // Le terminal s'ouvre dans le dossier de la conversation, pas dans un chemin fourni par l'UI.
    expect(openTerminal).toHaveBeenCalledWith('/projet')
    expect(() => call('agent:respondElicitation', 'c1', 'e1', { action: 'pirater' })).toThrow(
      'invalide'
    )
    expect(() =>
      call('agent:respondElicitation', 'c1', 'e1', { action: 'accept', content: [1] })
    ).toThrow('invalide')
  })

  it('autorisations retenues (fiche 072) : oubliées, réglages à jour rendus', async () => {
    const { call, approvals } = setup()
    expect(await call('settings:forgetSite', 'github.com')).toMatchObject({ profileId: 'mock' })
    expect(approvals.forgetSite).toHaveBeenCalledWith('github.com')
    await call('settings:forgetCommand', '/projet', 'pnpm dev')
    expect(approvals.forgetCommand).toHaveBeenCalledWith('/projet', 'pnpm dev')
    expect(() => call('settings:forgetSite', '')).toThrow('invalide')
  })

  it('sans dossier choisi (fiche 093) : git, commandes du projet et serveurs ne lisent rien', async () => {
    const { call, conversations } = setup()
    conversations.readFolder.mockImplementation(
      async <T>(_id: string, _read: unknown, none: T) => none
    )
    expect(await call('git:status', 'c1')).toBeNull()
    expect(await call('commands:project', 'c1')).toEqual([])
    expect(await call('preview:list', 'c1')).toEqual([])
    expect(conversations.readFolder).toHaveBeenCalledTimes(3)
  })

  it('settings:get et workspace:choose', async () => {
    const { call } = setup()
    expect(await call('settings:get')).toMatchObject({ profileId: 'mock' })
    expect(await call('workspace:choose')).toBe('/choisi')
  })

  it('modifications : seuls les fichiers du dossier de la conversation s’ouvrent', async () => {
    const { call, conversations, openPath, reveal } = setup()
    const workspace = realpathSync(mkdtempSync(join(tmpdir(), 'ipc-ouvrir-')))
    mkdirSync(join(workspace, 'src'))
    writeFileSync(join(workspace, 'src', 'a.ts'), 'export {}\n')
    writeFileSync(join(workspace, 'lancer.command'), 'echo non\n')
    conversations.workspaceOf.mockReturnValue(workspace)
    expect(await call('changes:open', 'c1', 'src/a.ts')).toEqual({
      kind: 'opened',
      path: join(workspace, 'src', 'a.ts')
    })
    expect(openPath).toHaveBeenCalledWith(join(workspace, 'src', 'a.ts'))
    // Fiche 071 : un fichier qui peut s'exécuter est montré dans le Finder, jamais ouvert.
    expect(await call('changes:open', 'c1', 'lancer.command')).toMatchObject({
      kind: 'revealed',
      reason: 'executable'
    })
    expect(openPath).toHaveBeenCalledTimes(1)
    expect(reveal).toHaveBeenCalledWith(join(workspace, 'lancer.command'))
    call('changes:reveal', 'c1', join(workspace, 'README.md'))
    expect(reveal).toHaveBeenCalledWith(join(workspace, 'README.md'))
    await expect(call('changes:open', 'c1', '../../etc/passwd')).rejects.toThrow('hors du dossier')
    expect(() => call('changes:reveal', 'c1', '/etc/hosts')).toThrow('hors du dossier')
    expect(await call('changes:open', 'c1', 'absent.txt')).toMatchObject({ kind: 'missing' })
    expect(await call('changes:gitFile', 'c1', 'a.ts')).toEqual({ oldText: 'a', newText: 'b' })
  })

  it('liens web (fiche 154) : adresse locale dans le navigateur intégré, le reste dans celui du Mac', async () => {
    const { call, browser, openExternal } = setup()
    const local = 'http://localhost:3000/'
    expect(await call('files:openLink', 'c1', local)).toEqual({
      kind: 'browser',
      path: local,
      url: local
    })
    expect(browser.openTab).toHaveBeenCalledWith('c1', local)
    expect(openExternal).not.toHaveBeenCalled()
    expect(await call('files:openLink', 'c1', local, { reveal: true })).toMatchObject({
      kind: 'opened'
    })
    expect(await call('files:openLink', 'c1', 'http://exemple.org/a')).toMatchObject({
      kind: 'opened'
    })
    expect(openExternal.mock.calls).toEqual([[local], ['http://exemple.org/a']])
    expect(browser.openTab).toHaveBeenCalledTimes(1)
  })

  it('lien local vers un serveur arrêté (fiche 154) : le panneau s’ouvre quand même, sans erreur', async () => {
    const { call, browser, openExternal } = setup()
    browser.openTab.mockRejectedValueOnce(new Error('ERR_CONNECTION_REFUSED (-102)'))
    const local = 'http://localhost:3000/'
    expect(await call('files:openLink', 'c1', local)).toEqual({
      kind: 'browser',
      path: local,
      url: local
    })
    expect(openExternal).not.toHaveBeenCalled()
  })

  it('liens de fichiers (fiche 052) : relatifs au dossier de la conversation, liens web (fiche 154)', async () => {
    const { call, openPath, reveal } = setup()
    expect(await call('files:openLink', 'c1', 'absent.md', { reveal: 'oui' })).toEqual({
      kind: 'missing',
      path: '/projet/absent.md'
    })
    await expect(call('files:openLink', 'c1', 'ftp://exemple.org')).rejects.toThrow('invalide')
    await expect(call('files:readMarkdown', 'c1', '/etc/hosts')).rejects.toThrow()
    expect(openPath).not.toHaveBeenCalled()
    expect(reveal).not.toHaveBeenCalled()
  })

  it('historique : suppression avec ou sans l’agent, épinglage, recherche', async () => {
    const { call, conversations } = setup()
    await call('conversation:delete', 'c1')
    expect(conversations.delete).toHaveBeenLastCalledWith('c1', {
      fromAgent: true,
      removeWorktree: false
    })
    await call('conversation:delete', 'c1', { fromAgent: false })
    expect(conversations.delete).toHaveBeenLastCalledWith('c1', {
      fromAgent: false,
      removeWorktree: false
    })
    await call('conversation:delete', 'c1', { removeWorktree: true })
    expect(conversations.delete).toHaveBeenLastCalledWith('c1', {
      fromAgent: true,
      removeWorktree: true
    })
    call('conversation:pin', 'c1', true)
    expect(conversations.setPinned).toHaveBeenCalledWith('c1', true)
    expect(() => call('conversation:pin', 'c1', 'oui')).toThrow('pinned')
    expect(await call('conversations:search', 'postgres')).toHaveLength(1)
    expect(await call('conversations:search', 42)).toEqual([])
  })

  it('notifications : réglage validé, état d’attente lu', async () => {
    const { call } = setup()
    expect(await call('settings:setNotifications', false)).toMatchObject({ notifications: false })
    expect(() => call('settings:setNotifications', 'non')).toThrow('booléen attendu')
    expect(await call('attention:get')).toEqual({ c1: 'done' })
    expect(await call('notifications:status')).toEqual({ blocked: 'refusé' })
  })

  it('astuces (fiche 191) : astuce et action validées, jour décidé par le main', async () => {
    const { call, settings, send } = setup()
    expect(await call('tips:state')).toMatchObject({ hidden: [] })
    await call('tips:record', 'aside', 'never')
    expect(settings.recordTip).toHaveBeenCalledWith(
      'aside',
      'never',
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)
    )
    expect(() => call('tips:record', 'nope', 'never')).toThrow('Astuce invalide')
    expect(() => call('tips:record', 'aside', 'delete')).toThrow('Astuce invalide')
    // « Montrée » ne prévient personne : seuls « Ne plus montrer » (plus haut) et la remise à zéro.
    await call('tips:record', 'aside', 'shown')
    await call('tips:reset')
    expect(settings.resetTips).toHaveBeenCalledOnce()
    // Masquée pour toujours, réaffichées : les vues relisent leur état sans relancer l'app.
    expect(send.mock.calls.filter((c) => c[0] === 'tips:changed')).toHaveLength(2)
    expect(await call('tips:noteMessage', '/projet', 'un message')).toBe(true)
    expect(() => call('tips:noteMessage', 42, 'x')).toThrow('Message invalide')
  })
})

describe('astuces (fiche 191)', () => {
  it('calme d’une conversation neuve : deux minutes, raccourci seulement pour les essais', async () => {
    const { tipsView } = await import('./ipc')
    const day = '2026-11-07'
    const salt = 'b'.repeat(64)
    expect(tipsView({ hidden: [] }, {})).toEqual({
      hidden: [],
      quietMs: 120_000,
      firstDayRule: true
    })
    expect(tipsView({ hidden: [] }, { BOBINE_TIPS_QUIET_MS: '0' })).toMatchObject({
      quietMs: 0,
      firstDayRule: false
    })
    expect(tipsView({ hidden: [] }, { BOBINE_TIPS_QUIET_MS: 'x' }).quietMs).toBe(120_000)
    expect(tipsView({ hidden: [] }, { BOBINE_TIPS_QUIET_MS: '-5' }).quietMs).toBe(120_000)
    // Les empreintes des messages et leur clé ne quittent pas le main.
    expect(
      tipsView(
        { hidden: [], firstDay: day, salt, sent: [{ key: 'a'.repeat(32), days: [day] }] },
        {}
      )
    ).toEqual({ hidden: [], firstDay: day, quietMs: 120_000, firstDayRule: true })
  })
})
