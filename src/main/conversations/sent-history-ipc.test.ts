import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MOCK_AGENT_ENTRY } from '../../mock-agent/testing.mts'
import { classifyEntry } from '../reset'
import { ConversationManager } from './manager'
import { sentHistoryHandlers } from './sent-history-ipc'
import { ConversationTrash } from './trash'

/** Gestionnaire sur des dossiers jetables, avec l'agent factice. */
function environment() {
  const root = mkdtempSync(join(tmpdir(), 'sent-history-'))
  const workspace = mkdtempSync(join(tmpdir(), 'ws-'))
  const launch = () =>
    new ConversationManager({
      profiles: [
        {
          id: 'echo',
          label: 'Factice',
          command: process.execPath,
          args: [
            MOCK_AGENT_ENTRY,
            '--scenario',
            'echo',
            '--delay',
            '0',
            '--store',
            join(root, 's')
          ],
          env: {}
        }
      ],
      settingsFile: join(root, 'settings.json'),
      conversationsDir: join(root, 'conversations'),
      defaultWorkspace: workspace,
      neutralFolder: workspace,
      pathEnv: () => process.env['PATH'],
      agentHome: mkdtempSync(join(tmpdir(), 'maison-vide-'))
    })
  return { root, dir: join(root, 'conversations'), launch }
}

/** Une conversation de l'historique (plus un brouillon) : son fil s'écrit sur le disque. */
async function saved(manager: ConversationManager): Promise<string> {
  const id = manager.state().activeId
  await manager.startActive()
  await manager.prompt(id, 'Bonjour')
  return id
}

describe('historique de la saisie : stockage (fiche 225)', () => {
  it('par conversation, vérifié, gardé avec le fil, retrouvé au redémarrage', async () => {
    const env = environment()
    const app = env.launch()
    const handlers = sentHistoryHandlers(app)
    const a = await saved(app)
    const b = (await app.create({})).summary.id
    handlers['conversation:recordSent'](a, { text: 'Premier' })
    handlers['conversation:recordSent'](a, {
      text: '/revue src/panier',
      roles: [{ name: 'security-expert', label: 'Expert sécu' }],
      attachments: 2
    })
    expect(() => handlers['conversation:recordSent'](a, { text: 3 } as never)).toThrow('entry')
    expect(() => handlers['conversation:recordSent']('', { text: 'x' })).toThrow('id')
    expect(app.view(a).transcript.sentHistory?.map((e) => e.text)).toEqual([
      'Premier',
      '/revue src/panier'
    ])
    // Une autre conversation (neuve) n'en a rien : jamais emprunté.
    expect(app.view(b).transcript.sentHistory).toBeUndefined()
    await app.settled()
    app.stopAll()
    const file = JSON.parse(readFileSync(join(env.dir, `${a}.json`), 'utf8'))
    expect(file.sentHistory).toHaveLength(2)
    expect(file.items.map((i: { kind: string }) => i.kind)).toEqual(['user', 'agent'])
    const again = env.launch()
    expect(again.view(a).transcript.sentHistory?.at(-1)).toEqual({
      text: '/revue src/panier',
      roles: [{ name: 'security-expert', label: 'Expert sécu' }],
      attachments: 2
    })
    again.stopAll()
  })

  it('part avec la conversation à la corbeille, en revient avec elle, s’efface avec elle', async () => {
    const env = environment()
    const app = env.launch()
    const id = await saved(app)
    sentHistoryHandlers(app)['conversation:recordSent'](id, { text: 'Clé collée par erreur' })
    await app.delete(id, { fromAgent: false })
    expect(existsSync(join(env.dir, `${id}.json`))).toBe(false)
    const trashed = JSON.parse(readFileSync(join(env.dir, '.trash', `${id}.json`), 'utf8'))
    expect(trashed.sentHistory).toEqual([{ text: 'Clé collée par erreur' }])
    app.restoreFromTrash(id)
    expect(app.view(id).transcript.sentHistory).toEqual([{ text: 'Clé collée par erreur' }])
    await app.delete(id, { fromAgent: false })
    new ConversationTrash(env.dir).erase(id)
    await app.settled()
    app.stopAll()
    const left = [join(env.dir, `${id}.json`), join(env.dir, '.trash', `${id}.json`)]
    expect(left.filter((f) => existsSync(f))).toEqual([])
    // « Recommencer à neuf » emporte tout le dossier des conversations, historique compris.
    expect(classifyEntry('conversations')).toBe('conversations')
  })
})
