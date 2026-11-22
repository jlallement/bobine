/**
 * Ordre des envois (revue de la fiche 272) : la garde du dossier est asynchrone ; deux messages
 * envoyés coup sur coup, le premier à la garde plus lente, arrivent dans l'ordre où ils sont partis.
 */
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { MOCK_AGENT_ENTRY } from '../../mock-agent/testing.mts'
import type { AgentProfile } from '../agent/profiles'
import { ConversationManager } from './manager'

// Garde du dossier : la première lente (partage réseau), les suivantes immédiates ; ou retenue par
// l'essai tant que `held` est posée.
let calls = 0
let held: Promise<void> | undefined
let guards = 0
vi.mock('./send-folder', () => ({
  guardSendFolder: () => {
    guards++
    if (held) return held
    return new Promise<void>((resolve) => setTimeout(resolve, calls++ === 0 ? 80 : 0))
  }
}))

function launch(): ConversationManager {
  const root = mkdtempSync(join(tmpdir(), 'ordre-'))
  const workspace = mkdtempSync(join(tmpdir(), 'ordre-projet-'))
  const profile: AgentProfile = {
    id: 'texte',
    label: 'Factice',
    command: process.execPath,
    args: [MOCK_AGENT_ENTRY, '--scenario', 'echo', '--delay', '0', '--store', join(root, 's')],
    env: {}
  }
  return new ConversationManager({
    profiles: [profile],
    settingsFile: join(root, 'settings.json'),
    conversationsDir: join(root, 'conversations'),
    defaultWorkspace: workspace,
    neutralFolder: join(root, 'workspace'),
    pathEnv: () => process.env['PATH'],
    agentHome: mkdtempSync(join(tmpdir(), 'maison-vide-'))
  })
}

describe('ordre des envois d’une conversation (fiche 272)', () => {
  it('deux messages coup sur coup : dans l’ordre d’envoi, même si la garde du premier tarde', async () => {
    const manager = launch()
    try {
      const id = manager.state().activeId
      await manager.startActive()
      const first = manager.prompt(id, 'un')
      const second = manager.prompt(id, 'deux')
      await Promise.all([first, second])
      await vi.waitFor(() => {
        const texts = manager
          .view(id)
          .transcript.items.flatMap((i) => (i.kind === 'user' ? [i.text] : []))
        expect(texts).toEqual(['un', 'deux'])
      })
    } finally {
      manager.stopAll()
    }
  })

  // `children-review` (CI Windows du 2026-11-21) : le relecteur lancé en fin d'essai attendait son
  // agent puis envoyait son premier message ; l'arrêt de tous les agents (`stopAll`, comme à la
  // fermeture de l'app) tombait entre-temps, et l'envoi relançait l'agent, qui faisait son tour
  // (et ses commandes git) pendant l'essai suivant.
  it('agents arrêtés pendant la préparation d’un envoi : l’agent n’est pas relancé', async () => {
    const manager = launch()
    try {
      const id = manager.state().activeId
      await manager.startActive()
      expect(manager.view(id).summary.status).toBe('ready')
      let release = () => {}
      held = new Promise<void>((resolve) => (release = resolve))
      const before = guards
      const sending = manager.prompt(id, 'un')
      await vi.waitFor(() => expect(guards).toBe(before + 1))
      manager.stopAll()
      held = undefined
      release()
      await expect(sending).rejects.toThrow()
      expect(manager.view(id).summary.status).toBe('idle')
      expect(manager.view(id).transcript.items.some((i) => i.kind === 'user')).toBe(false)
    } finally {
      held = undefined
      manager.stopAll()
    }
  })

  it('agents arrêtés pendant son démarrage : l’attente rend la main, l’envoi qui suit ne relance rien', async () => {
    const manager = launch()
    try {
      const id = manager.state().activeId
      // Comme le relecteur (`children-review.ts`, `launch`) : son agent attendu, puis son message.
      const ready = manager.ready(id)
      expect(manager.view(id).summary.status).toBe('starting')
      manager.stopAll()
      await ready
      await expect(manager.prompt(id, 'un')).rejects.toThrow()
      await expect(manager.ready(id)).rejects.toThrow()
      expect(manager.view(id).summary.status).toBe('idle')
    } finally {
      manager.stopAll()
    }
  })
})
