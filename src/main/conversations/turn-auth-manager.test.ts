import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { MOCK_AGENT_ENTRY } from '../../mock-agent/testing.mts'
import { AgentHost } from '../agent/agent-host'
import type { AgentProfile } from '../agent/profiles'
import { ConversationManager } from './manager'

/** Connexion expirée par le vrai chemin du gestionnaire (recette 0.9, D10, N1). */
async function waitFor(condition: () => boolean, timeoutMs = 8000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (!condition()) {
    if (Date.now() > deadline) throw new Error(`délai dépassé : ${condition.toString()}`)
    await new Promise((r) => setTimeout(r, 20))
  }
}

function launch(scenario: string) {
  const hooks: { onStatus?: (status: string) => void } = {}
  const root = mkdtempSync(join(tmpdir(), 'turn-auth-manager-'))
  const workspace = mkdtempSync(join(tmpdir(), 'turn-auth-ws-'))
  const log = join(root, 'messages.log')
  const profile: AgentProfile = {
    id: 'mock',
    label: 'Agent factice',
    command: process.execPath,
    args: [
      MOCK_AGENT_ENTRY,
      '--scenario',
      scenario,
      '--delay',
      '0',
      '--store',
      join(root, 'store'),
      '--journal-messages',
      log
    ],
    env: {},
    authAtTurn: { pattern: /authentication required/i }
  }
  const manager = new ConversationManager({
    profiles: [profile],
    settingsFile: join(root, 'settings.json'),
    conversationsDir: join(root, 'conversations'),
    defaultWorkspace: workspace,
    neutralFolder: workspace,
    pathEnv: () => process.env['PATH'],
    emit: (e) => {
      if (e.event.type === 'status') hooks.onStatus?.(e.event.snapshot.status)
    },
    emitList: () => {},
    agentHome: mkdtempSync(join(tmpdir(), 'maison-vide-'))
  })
  const id = manager.state().activeId
  const view = () => manager.view(id)
  const status = () => view().snapshot?.status
  const kinds = () => view().transcript.items.map((i) => i.kind)
  const replies = () => view().transcript.items.flatMap((i) => (i.kind === 'agent' ? [i.text] : []))
  // Messages reçus par l'agent (`session/prompt`), dans l'ordre.
  const received = () =>
    existsSync(log) ? readFileSync(log, 'utf8').split('\n').filter(Boolean) : []
  const login = () => writeFileSync(join(workspace, '.mock-agent-logged-in'), '')
  return { manager, id, status, kinds, replies, hooks, received, login }
}

describe('connexion expirée, par le gestionnaire (D10)', () => {
  it('SSO, puis un message écrit pendant le renvoi : un seul agent, renvoi puis le nouveau message', async () => {
    const starts = vi.spyOn(
      AgentHost.prototype as unknown as { doStart: () => Promise<void> },
      'doStart'
    )
    const { manager, id, status, kinds, replies, hooks, received } = launch('connexion-expiree-sso')
    try {
      await manager.startActive()
      await manager.prompt(id, 'Ajoute un test')
      await waitFor(() => status() === 'needs-action')
      // Écrit dès la réouverture (statut « démarrage ») : il attend le renvoi, puis part à son tour.
      let second: Promise<void> | undefined
      let fired = false
      hooks.onStatus = (current) => {
        if (current !== 'starting' || fired) return
        fired = true
        second = manager.prompt(id, 'Et ensuite ?')
      }
      const auth = manager.authenticate(id, 'mock-sso')
      await auth
      await waitFor(() => second !== undefined)
      await second
      await waitFor(() => replies().length === 2 && status() === 'ready')
      expect(starts).toHaveBeenCalledTimes(1)
      expect(kinds().filter((k) => k === 'user')).toHaveLength(2)
      const texts = manager
        .view(id)
        .transcript.items.flatMap((i) => (i.kind === 'user' || i.kind === 'agent' ? [i.kind] : []))
      expect(texts).toEqual(['user', 'agent', 'user', 'agent'])
      // L'agent a reçu le message refusé, son renvoi (une fois), puis le nouveau.
      expect(received()).toEqual(['Ajoute un test', 'Ajoute un test', 'Et ensuite ?'])
    } finally {
      starts.mockRestore()
      manager.stopAll()
    }
  })

  it('message envoyé pendant une carte de connexion : refusé, jamais un second agent', async () => {
    const starts = vi.spyOn(
      AgentHost.prototype as unknown as { doStart: () => Promise<void> },
      'doStart'
    )
    const { manager, id, status, received } = launch('connexion-expiree')
    try {
      await manager.startActive()
      await manager.prompt(id, 'Ajoute un test')
      await waitFor(() => status() === 'needs-action')
      await expect(manager.prompt(id, 'Autre chose')).rejects.toThrow()
      expect(status()).toBe('needs-action')
      expect(starts).toHaveBeenCalledTimes(1)
      expect(received()).toEqual(['Ajoute un test'])
    } finally {
      starts.mockRestore()
      manager.stopAll()
    }
  })

  it('autre modèle choisi sur la carte (fiche 210) : même conversation, message renvoyé une fois, modèle refusé marqué', async () => {
    const starts = vi.spyOn(
      AgentHost.prototype as unknown as { doStart: () => Promise<void> },
      'doStart'
    )
    const { manager, id, status, kinds, replies, received } = launch('connexion-expiree-modele')
    try {
      await manager.startActive()
      await manager.prompt(id, 'Ajoute un test')
      await waitFor(() => status() === 'needs-action')
      expect(manager.view(id).snapshot?.blocker).toMatchObject({ model: { id: 'factice-rapide' } })
      await manager.setControl(id, 'model', 'factice-precis')
      await waitFor(() => replies().length === 1 && status() === 'ready')
      expect(manager.state().conversations).toHaveLength(1)
      expect(kinds()).not.toContain('branch')
      expect(kinds().filter((k) => k === 'user')).toHaveLength(1)
      expect(received()).toEqual(['Ajoute un test', 'Ajoute un test'])
      expect(starts).toHaveBeenCalledTimes(1)
      const model = manager.view(id).snapshot?.controls.find((c) => c.id === 'model')
      expect(model?.currentValue).toBe('factice-precis')
      expect(model?.options.filter((o) => o.authRequired).map((o) => o.value)).toEqual([
        'factice-rapide'
      ])
    } finally {
      starts.mockRestore()
      manager.stopAll()
    }
  })
})
