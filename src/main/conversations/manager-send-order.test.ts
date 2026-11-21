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

// Garde du dossier : la première lente (partage réseau), les suivantes immédiates.
let calls = 0
vi.mock('./send-folder', () => ({
  guardSendFolder: () => new Promise<void>((resolve) => setTimeout(resolve, calls++ === 0 ? 80 : 0))
}))

describe('ordre des envois d’une conversation (fiche 272)', () => {
  it('deux messages coup sur coup : dans l’ordre d’envoi, même si la garde du premier tarde', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ordre-'))
    const workspace = mkdtempSync(join(tmpdir(), 'ordre-projet-'))
    const profile: AgentProfile = {
      id: 'texte',
      label: 'Factice',
      command: process.execPath,
      args: [MOCK_AGENT_ENTRY, '--scenario', 'echo', '--delay', '0', '--store', join(root, 's')],
      env: {}
    }
    const manager = new ConversationManager({
      profiles: [profile],
      settingsFile: join(root, 'settings.json'),
      conversationsDir: join(root, 'conversations'),
      defaultWorkspace: workspace,
      neutralFolder: join(root, 'workspace'),
      pathEnv: () => process.env['PATH'],
      agentHome: mkdtempSync(join(tmpdir(), 'maison-vide-'))
    })
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
})
