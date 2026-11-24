import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  AgentSettingsView,
  ConversationEvent,
  ConversationsState,
  ConversationView
} from '@shared/agent'
import { MOCK_AGENT_ENTRY } from '../mock-agent/testing.mts'
import { AgentHost } from './agent/agent-host'
import { ApiKeyStore, type Cipher } from './agent-config/api-keys'
import type { AgentProfile } from './agent/profiles'
import { ConversationManager } from './conversations/manager'
import { createHandlers, registerIpcHandlers, type IpcSenderEvent } from './ipc'
import { initLog, setVerbosity } from './log'

/**
 * Le câblage IPC du main sans fenêtre : les vrais gestionnaires de `ipc.ts` branchés sur le vrai
 * `ConversationManager` et ses réglages, contre l'agent factice (comme `manager.test.ts`). Ce que
 * les tests de composant simulent (`window.api`) et ce que les tests du gestionnaire appellent
 * directement se rejoignent ici : canal → main → agent → fil. Seuls le preload et la page restent
 * hors champ (journées types).
 */

async function waitFor(condition: () => boolean, timeoutMs = 10_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (!condition()) {
    if (Date.now() > deadline) throw new Error(`délai dépassé : ${condition.toString()}`)
    await new Promise((r) => setTimeout(r, 20))
  }
}

/** Ce que l'IPC ne sert pas ici : présent pour le contrat, jamais appelé. */
const unused = new Proxy(
  {},
  {
    get: (_target, name) => () => {
      throw new Error(`non branché dans cet essai : ${String(name)}`)
    }
  }
)

function app(options: { workspace?: string | null; apiKeys?: ApiKeyStore } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'ipc-agent-'))
  const workspace = mkdtempSync(join(tmpdir(), 'ipc-agent-ws-'))
  const profile: AgentProfile = {
    id: 'mock',
    label: 'Agent factice',
    command: process.execPath,
    args: [MOCK_AGENT_ENTRY, '--scenario', 'echo', '--delay', '0', '--store', join(root, 'store')],
    env: {},
    // Comme Bob : une clé d'API enregistrée par l'app (fiche 022).
    apiKeys: [{ env: 'MOCK_AGENT_API_KEY', label: 'Clé de l’agent factice' }]
  }
  const events: ConversationEvent[] = []
  const manager = new ConversationManager({
    profiles: [profile],
    settingsFile: join(root, 'settings.json'),
    conversationsDir: join(root, 'conversations'),
    ...(options.workspace === null ? {} : { defaultWorkspace: options.workspace ?? workspace }),
    neutralFolder: workspace,
    pathEnv: () => process.env['PATH'],
    emit: (e) => events.push(e),
    emitList: () => {},
    agentHome: mkdtempSync(join(tmpdir(), 'maison-vide-')),
    ...(options.apiKeys ? { apiKeys: options.apiKeys } : {})
  })
  const saveFile = vi.fn(async (name: string) => join(root, name))
  const reveal = vi.fn()
  const listeners = new Map<string, (event: IpcSenderEvent, ...args: unknown[]) => unknown>()
  registerIpcHandlers(
    { handle: (channel, listener) => listeners.set(channel, listener) },
    createHandlers({
      appName: 'bobine',
      appVersion: '1.0.0',
      electronVersion: '44.0.0',
      platform: process.platform,
      conversations: manager,
      settings: manager.settings,
      chooseDirectory: async () => null,
      openTerminal: async () => {},
      chooseFiles: async () => [],
      searchFiles: async () => [],
      saveFile,
      browser: unused as never,
      devServers: unused as never,
      simulator: unused as never,
      android: unused as never,
      terminals: unused as never,
      attention: () => ({}),
      attentionDetails: () => ({}),
      notifications: { status: () => ({}), openSettings: async () => {} },
      git: { status: async () => null },
      commands: { project: async () => [] },
      changes: {
        git: unused as never,
        openPath: async () => '',
        reveal,
        openExternal: async () => {}
      }
    }),
    { trusted: () => true }
  )
  const event: IpcSenderEvent = { sender: {}, senderFrame: {} }
  /** Un appel du renderer, comme le preload le transmet. */
  const call = async <T>(channel: string, ...args: unknown[]): Promise<T> => {
    const listener = listeners.get(channel)
    if (!listener) throw new Error(`canal inconnu : ${channel}`)
    return (await listener(event, ...args)) as T
  }
  const status = (id: string) => manager.view(id).snapshot?.status
  const ready = (id: string) => waitFor(() => status(id) === 'ready')
  const kinds = (id: string) => manager.view(id).transcript.items.map((i) => i.kind)
  const requests = () => events.filter((e) => e.event.type === 'permission-request')
  return { root, workspace, manager, call, ready, kinds, requests, saveFile, reveal, events }
}

describe('IPC branché sur le vrai gestionnaire, contre l’agent factice', () => {
  const started: ConversationManager[] = []
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    started.splice(0).forEach((m) => m.stopAll())
    vi.restoreAllMocks()
  })

  it('« Nouvelle conversation » : l’ancienne reste dans l’historique avec son fil ; le brouillon vide quitté disparaît', async () => {
    const a = app()
    started.push(a.manager)
    const first = a.manager.state().activeId
    await a.manager.startActive()
    await a.call('agent:prompt', first, 'Premier message')
    // Le canal ne demande rien : aucune confirmation, l'ancienne conversation est gardée.
    const created = await a.call<ConversationView>('conversation:create', {})
    const draft = created.summary.id
    const list = await a.call<ConversationsState>('conversations:get')
    expect(list.activeId).toBe(draft)
    expect(list.conversations.find((c) => c.id === first)).toMatchObject({
      draft: false,
      title: 'Premier message'
    })
    // Retour sur l'ancienne : fil intact, le brouillon vide n'est plus listé.
    const back = await a.call<ConversationView>('conversation:select', first)
    expect(back.transcript.items.map((i) => i.kind)).toEqual(['user', 'agent'])
    const after = await a.call<ConversationsState>('conversations:get')
    expect(after.conversations.some((c) => c.id === draft)).toBe(false)
  })

  it('« Toujours autoriser » oublié par Réglages : la demande revient au tour suivant', async () => {
    const a = app()
    started.push(a.manager)
    const id = a.manager.state().activeId
    await a.manager.startActive()
    const answer = async (kind: 'allow_always' | 'allow_once') => {
      const count = a.requests().length
      const turn = a.call('agent:prompt', id, '/scenario liste-taches')
      await waitFor(() => a.requests().length === count + 1)
      const request = a.requests().at(-1)?.event
      if (request?.type !== 'permission-request') throw new Error('pas de demande')
      const option = request.options.find((o) => o.kind === kind)
      await a.call('agent:respondPermission', id, request.requestId, option?.optionId ?? null)
      await turn
    }
    await answer('allow_always')
    const remembered = (await a.call<AgentSettingsView>('settings:get')).rememberedTools
    expect(remembered).toEqual([
      { profileId: 'mock', profileLabel: 'Agent factice', tools: ['Updating todo list'] }
    ])
    // Retenu : le tour suivant passe sans demande.
    const before = a.requests().length
    await a.call('agent:prompt', id, '/scenario liste-taches')
    expect(a.requests()).toHaveLength(before)
    // Oublié par le canal des Réglages : la vue rendue est à jour, la question revient.
    const view = await a.call<AgentSettingsView>(
      'settings:forgetTool',
      'mock',
      'Updating todo list'
    )
    expect(view.rememberedTools).toEqual([])
    await answer('allow_once')
    expect(a.requests()).toHaveLength(before + 1)
  })

  it('clé d’API enregistrée par le canal (fiche 022) : jamais renvoyée à l’interface, ni à l’enregistrement ni ensuite', async () => {
    const secret = 'carotte-fraise-42'
    // Faux chiffrement réversible : le trousseau du système n'est jamais touché.
    const cipher: Cipher = {
      available: () => Promise.resolve(true),
      encrypt: (text) => Promise.resolve(Buffer.from(`enc:${text}`).reverse()),
      decrypt: (data) =>
        Promise.resolve({ text: Buffer.from(data).reverse().toString().slice(4), reencrypt: false })
    }
    const keys = new ApiKeyStore(
      join(mkdtempSync(join(tmpdir(), 'cles-')), 'api-keys.json'),
      cipher
    )
    const a = app({ apiKeys: keys })
    started.push(a.manager)
    const saved = await a.call<AgentSettingsView>(
      'settings:setApiKey',
      'mock',
      'MOCK_AGENT_API_KEY',
      secret
    )
    expect(keys.has('mock', 'MOCK_AGENT_API_KEY')).toBe(true)
    // La vue dit qu'une clé est enregistrée, sans sa valeur.
    expect(JSON.stringify(saved)).toMatch(/"env":"MOCK_AGENT_API_KEY"[^}]*"stored":true/)
    expect(JSON.stringify(saved)).not.toContain(secret)
    expect(JSON.stringify(await a.call('settings:get'))).not.toContain(secret)
    expect(JSON.stringify(await a.call('conversations:get'))).not.toContain(secret)
    // L'agent, lui, la reçoit dans son environnement.
    expect(await keys.credentials('mock', [{ env: 'MOCK_AGENT_API_KEY', label: '' }])).toEqual({
      MOCK_AGENT_API_KEY: secret
    })
  })

  it('export Markdown et JSON par le canal : le fil réel écrit sur le disque, montré dans le Finder', async () => {
    const a = app()
    started.push(a.manager)
    const id = a.manager.state().activeId
    await a.manager.startActive()
    await a.call('agent:prompt', id, 'Bonjour, exporte-moi')
    const markdown = await a.call<string>('conversation:export', id, 'markdown')
    // Nom tiré du titre de la conversation, une seule extension.
    expect(markdown).toMatch(/bonjour-exporte-moi-\d{4}-\d{2}-\d{2}\.md$/)
    const text = readFileSync(markdown, 'utf8')
    expect(text).toMatch(/^# Bonjour, exporte-moi/)
    expect(text).toContain('Bonjour, exporte-moi')
    expect(a.reveal).toHaveBeenCalledWith(markdown)

    const json = await a.call<string>('conversation:export', id, 'json')
    expect(json).toMatch(/\.json$/)
    const data = JSON.parse(readFileSync(json, 'utf8')) as {
      format?: string
      transcript?: { items: { kind: string }[] }
    }
    expect(data.format).toBe('bobine-conversation')
    expect(data.transcript?.items.map((i) => i.kind)).toEqual(['user', 'agent'])
    // Dialogue annulé : rien d'écrit, rien de montré.
    a.saveFile.mockResolvedValueOnce(null as never)
    expect(await a.call('conversation:export', id, 'markdown')).toBeNull()
    expect(a.reveal).toHaveBeenCalledTimes(2)
  })

  it('conversation sans dossier (fiche 093) : aucun agent lancé, ni au lancement ni par les canaux de lecture', async () => {
    const starts = vi.spyOn(
      AgentHost.prototype as unknown as { doStart: () => Promise<void> },
      'doStart'
    )
    const a = app({ workspace: null })
    started.push(a.manager)
    const id = a.manager.state().activeId
    await a.manager.startActive()
    await a.call('conversation:select', id)
    await a.call('settings:get')
    await a.call('conversations:get')
    expect(starts).not.toHaveBeenCalled()
    expect(a.manager.view(id).snapshot?.status ?? 'idle').not.toBe('starting')
    expect(a.manager.view(id).snapshot?.status ?? 'idle').not.toBe('ready')
    // Témoin : avec un dossier, le même lancement démarre bien l'agent (l'espion le voit).
    const b = app()
    started.push(b.manager)
    await b.manager.startActive()
    expect(starts).toHaveBeenCalled()
  })
})

describe('journal changé à chaud (fiche 080), sur de vrais échanges ACP', () => {
  afterEach(() => setVerbosity('normal'))

  it('Normal puis Détaillé sans relancer l’agent : les échanges suivants seulement vont dans agents.log', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'journal-a-chaud-'))
    initLog(dir)
    setVerbosity('normal')
    const a = app()
    try {
      const id = a.manager.state().activeId
      await a.manager.startActive()
      await a.call('agent:prompt', id, 'Avant')
      const file = join(dir, 'agents.log')
      const before = existsSync(file) ? readFileSync(file, 'utf8') : ''
      expect(before).not.toContain('session/prompt')

      // Même agent, même session : le niveau change pendant qu'il tourne.
      setVerbosity('detailed')
      await a.call('agent:prompt', id, 'Pendant')
      const detailed = readFileSync(file, 'utf8')
      expect(detailed).toMatch(/→ session\/prompt #\d+/)
      expect(detailed).toMatch(/← réponse #\d+ session\/prompt end_turn/)
      // Détaillé : jamais le contenu des messages.
      expect(detailed).not.toContain('Pendant')

      setVerbosity('normal')
      const length = detailed.length
      await a.call('agent:prompt', id, 'Après')
      expect(readFileSync(file, 'utf8').length).toBe(length)
      expect(a.kinds(id)).toEqual(['user', 'agent', 'user', 'agent', 'user', 'agent'])
    } finally {
      a.manager.stopAll()
    }
  })

  it('« Exécuter » le plan (fiche 095) : le mode changé arrive à l’agent avant la demande d’exécution', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'journal-plan-'))
    initLog(dir)
    setVerbosity('detailed')
    const a = app()
    try {
      const id = a.manager.state().activeId
      await a.manager.startActive()
      const mode = a.manager
        .view(id)
        .snapshot?.controls.find((c) => c.category === 'mode' && c.type === 'select')
      if (mode?.type !== 'select') throw new Error('pas de sélecteur de mode')
      const other = mode.options.find((o) => o.value !== mode.currentValue)?.value
      if (!other) throw new Error('un seul mode')
      // Comme le renderer : le réglage attendu, puis la demande.
      await a.call('agent:setControl', id, mode.id, other)
      await a.call('agent:prompt', id, 'Exécute ce plan.')
      const lines = readFileSync(join(dir, 'agents.log'), 'utf8').split('\n')
      const prompt = lines.findIndex((l) => /→ session\/prompt/.test(l))
      // Le dernier réglage envoyé avant la demande, et sa réponse, revenue avant qu'elle parte.
      const setting = lines.findLastIndex(
        (l, i) => i < prompt && /→ session\/set_(mode|config_option)/.test(l)
      )
      const answered = lines.findIndex(
        (l, i) => i > setting && /← réponse #\d+ session\/set_(mode|config_option)/.test(l)
      )
      expect(prompt).toBeGreaterThan(-1)
      expect(setting).toBeGreaterThan(-1)
      expect(answered).toBeGreaterThan(setting)
      expect(answered).toBeLessThan(prompt)
      const after = a.manager.view(id).snapshot?.controls.find((c) => c.id === mode.id)
      expect(after?.type === 'select' ? after.currentValue : undefined).toBe(other)
    } finally {
      a.manager.stopAll()
    }
  })
})
