/**
 * Parcours de la mémoire (fiche 182) contre l'agent factice, dans un vrai sous-processus, par le
 * vrai serveur MCP de l'app : proposition pendant que le tour continue, « Non » puis « Retenir »,
 * issue dite au message suivant, index reçu par la conversation suivante, secret refusé, borne des
 * propositions, mémoire coupée.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { MemoryProposalItem } from '@shared/memory'
import { MOCK_AGENT_ENTRY } from '../../mock-agent/testing.mts'
import type { AgentProfile } from '../agent/profiles'
import { ConversationManager } from '../conversations/manager'
import { memoryToolsModule } from '../mcp/memory-tools'
import { AppToolServer } from '../mcp/tool-server'
import { MemoryService } from './service'
import { MemoryStore } from './store'

function waitFor(predicate: () => boolean, timeoutMs = 15_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const started = Date.now()
    const check = () => {
      if (predicate()) return resolve()
      if (Date.now() - started > timeoutMs) return reject(new Error('waitFor : délai dépassé'))
      setTimeout(check, 10)
    }
    check()
  })
}

const stops: (() => void)[] = []
afterEach(() => {
  for (const stop of stops.splice(0)) stop()
})

async function environment() {
  const root = mkdtempSync(join(tmpdir(), 'memoire-parcours-'))
  const repo = realpathSync(mkdtempSync(join(tmpdir(), 'memoire-depot-')))
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: repo })
  const profile: AgentProfile = {
    id: 'factice',
    label: 'Factice',
    command: process.execPath,
    args: [MOCK_AGENT_ENTRY, '--scenario', 'echo', '--delay', '0', '--store', join(root, 's')],
    env: {}
  }
  const toolServer = new AppToolServer()
  await toolServer.start()
  let enabled = true
  // `manager` est créé juste après : le service ne l'appelle qu'à l'appel d'un outil.
  const service: MemoryService = new MemoryService({
    store: new MemoryStore(join(root, 'memory')),
    conversations: {
      items: (id) => manager.view(id).transcript.items,
      post: (id, event) => manager.post(id, event),
      workspaceOf: (id) => manager.workspaceOf(id),
      agentLabel: (id) => manager.view(id).summary.profileLabel
    },
    enabled: () => enabled
  })
  const manager: ConversationManager = new ConversationManager({
    profiles: [profile],
    toolServer,
    toolModules: [memoryToolsModule(service, () => false)],
    memory: service,
    settingsFile: join(root, 'settings.json'),
    conversationsDir: join(root, 'conversations'),
    defaultWorkspace: repo,
    neutralFolder: repo,
    pathEnv: () => process.env['PATH'],
    agentHome: mkdtempSync(join(tmpdir(), 'maison-vide-'))
  })
  stops.push(() => {
    manager.stopAll()
    toolServer.stop()
  })
  const items = (id: string) => manager.view(id).transcript.items
  const cards = (id: string) =>
    items(id).filter((i): i is MemoryProposalItem => i.kind === 'memory-proposal')
  const lastReply = (id: string) => items(id).findLast((i) => i.kind === 'agent')?.text ?? ''
  /** Envoie un message et attend la fin du tour. */
  const send = async (id: string, text: string) => {
    await manager.prompt(id, text)
    await waitFor(() => manager.view(id).summary.status === 'ready')
  }
  const fresh = async () => {
    const id = (await manager.create()).summary.id
    await manager.ready(id)
    return id
  }
  return {
    repo,
    manager,
    service,
    items,
    cards,
    lastReply,
    send,
    fresh,
    setEnabled: (value: boolean) => {
      enabled = value
    }
  }
}

describe('parcours de la mémoire contre l’agent factice (fiche 182)', () => {
  it('propose, le tour continue ; « Non » puis « Retenir » ; issue au message suivant ; index ensuite', async () => {
    const env = await environment()
    const id = env.manager.state().activeId
    await env.manager.startActive()
    await env.send(id, '/scenario memoire-retient')
    // La carte attend, le tour est fini, rien n'est écrit.
    const [first] = env.cards(id)
    expect(first).toMatchObject({ status: 'pending', draft: { name: 'tests-e2e' } })
    expect(env.lastReply(id)).toContain('waiting for the user')
    expect(env.lastReply(id)).toContain('sans attendre votre décision')
    expect((await env.service.memoriesFor(env.repo)).project).toEqual([])

    await env.service.decide({
      conversationId: id,
      proposalId: first?.proposalId ?? '',
      accept: false
    })
    await env.send(id, '/scenario memoire-retient')
    expect(env.lastReply(id)).toContain('pas retenu ma proposition')
    expect((await env.service.memoriesFor(env.repo)).project).toEqual([])

    // Le même message relancé : nouvelle proposition (l'issue a déjà été dite).
    await env.send(id, '/scenario memoire-retient')
    const second = env.cards(id).at(-1)
    expect(second?.status).toBe('pending')
    await env.service.decide({
      conversationId: id,
      proposalId: second?.proposalId ?? '',
      accept: true
    })
    await env.send(id, '/scenario memoire-retient')
    expect(env.lastReply(id)).toContain('retenu ma proposition')
    expect((await env.service.memoriesFor(env.repo)).project.map((e) => e.name)).toEqual([
      'tests-e2e'
    ])

    // Conversation suivante : l'index arrive avec le premier message.
    const next = await env.fresh()
    await env.send(next, '/scenario memoire-index')
    expect(env.lastReply(next)).toContain('J’y vois « tests-e2e »')
    // Poids de l'index envoyé, pour la ligne « Mémoire » de l'onglet Session.
    expect(env.manager.view(next).transcript.memoryTokens).toBeGreaterThan(100)
  }, 60_000)

  it('secret refusé, onze propositions : dix cartes', async () => {
    const env = await environment()
    const id = env.manager.state().activeId
    await env.manager.startActive()
    await env.send(id, '/scenario memoire-secret')
    expect(env.lastReply(id)).toContain('Never remember a secret')
    expect(env.cards(id)).toEqual([])
    await env.send(id, '/scenario memoire-rafale')
    expect(env.cards(id)).toHaveLength(10)
    expect(env.lastReply(id)).toContain('Too many pending proposals')
  }, 60_000)

  it('mémoire coupée : ni outil ni index pour les sessions suivantes', async () => {
    const env = await environment()
    env.setEnabled(false)
    const id = env.manager.state().activeId
    await env.manager.startActive()
    await env.send(id, '/scenario memoire-sans-outil')
    expect(env.lastReply(id)).toContain('Pas d’outil remember')
    await env.send(id, '/scenario memoire-index')
    // Deuxième message : pas de contexte de session de toute façon ; on vérifie sur une neuve.
    const next = await env.fresh()
    await env.send(next, '/scenario memoire-index')
    expect(env.lastReply(next)).toContain('Pas d’index de la mémoire')
    env.setEnabled(true)
    const third = await env.fresh()
    await env.send(third, '/scenario memoire-sans-outil')
    expect(env.lastReply(third)).toContain('Outil remember reçu')
  }, 60_000)

  it('mémoire coupée après l’ouverture de la session : plus d’index au premier message', async () => {
    const env = await environment()
    const id = env.manager.state().activeId
    await env.manager.startActive()
    await env.manager.ready(id)
    env.manager.settings.setPreferences({ memoryEnabled: false })
    await env.send(id, '/scenario memoire-index')
    expect(env.lastReply(id)).toContain('Pas d’index de la mémoire')
  }, 60_000)

  it('après une compaction : index de nouveau, sauf mémoire coupée entre-temps', async () => {
    const env = await environment()
    const id = env.manager.state().activeId
    await env.manager.startActive()
    await env.send(id, 'Bonjour')
    await env.send(id, '/compact')
    await env.send(id, '/scenario memoire-index')
    expect(env.lastReply(id)).toContain('Index de la mémoire reçu')
    const other = await env.fresh()
    await env.send(other, 'Bonjour')
    env.manager.settings.setPreferences({ memoryEnabled: false })
    await env.send(other, '/compact')
    await env.send(other, '/scenario memoire-index')
    expect(env.lastReply(other)).toContain('Pas d’index de la mémoire')
  }, 60_000)
})
