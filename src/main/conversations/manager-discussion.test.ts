import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MOCK_AGENT_ENTRY } from '../../mock-agent/testing.mts'
import type { AgentProfile } from '../agent/profiles'
import { ConversationManager } from './manager'
import { discussionsRoot } from './discussion-space'
import { ConversationTrash } from './trash'

/** Espace Discussion (fiche 224) : gestionnaire sur des dossiers jetables, agent factice. */
function launch(scenario = 'echo') {
  const root = mkdtempSync(join(tmpdir(), 'discussion-'))
  const workspace = mkdtempSync(join(tmpdir(), 'projet-'))
  const conversationsDir = join(root, 'conversations')
  const profile: AgentProfile = {
    id: 'texte',
    label: 'Factice',
    command: process.execPath,
    args: [MOCK_AGENT_ENTRY, '--scenario', scenario, '--delay', '0', '--store', join(root, 's')],
    env: {}
  }
  const manager = new ConversationManager({
    profiles: [profile],
    settingsFile: join(root, 'settings.json'),
    conversationsDir,
    defaultWorkspace: workspace,
    neutralFolder: workspace,
    pathEnv: () => process.env['PATH'],
    emit: () => {},
    emitList: () => {},
    agentHome: mkdtempSync(join(tmpdir(), 'maison-vide-'))
  })
  return { root, workspace, conversationsDir, manager }
}

describe('espace Discussion (fiche 224)', () => {
  it('une discussion vit dans son dossier tenu par Bobine, jamais dans les dossiers récents', async () => {
    const { manager, conversationsDir } = launch()
    const view = await manager.create({ space: 'discussion' })
    const { workspace, space } = view.summary
    expect(space).toBe('discussion')
    expect(workspace).toBe(join(discussionsRoot(conversationsDir), view.summary.id))
    expect(existsSync(workspace)).toBe(true)
    expect(manager.settingsView().recentWorkspaces).not.toContain(workspace)
    await manager.prompt(view.summary.id, 'Bonjour')
    expect(manager.view(view.summary.id).summary.draft).toBe(false)
    manager.stopAll()
  })

  it('changer d’agent garde l’espace ; « Nouvelle conversation » revient à l’espace Code', async () => {
    const { manager, workspace } = launch()
    // Un dossier de projet déjà choisi (dernier dossier retenu).
    await manager.create({ workspace })
    const discussion = await manager.create({ space: 'discussion' })
    const again = await manager.configure(discussion.summary.id, { profileId: 'texte' })
    expect(again.summary.space).toBe('discussion')
    const code = await manager.create()
    expect(code.summary.space).toBeUndefined()
    // Jamais le dossier d'une discussion hérité par une conversation de l'espace Code.
    expect(code.summary.workspace).toBe(workspace)
    manager.stopAll()
  })

  it('un brouillon de discussion quitté sans rien laisse partir son dossier vide', async () => {
    const { manager } = launch()
    const first = await manager.create({ space: 'discussion' })
    await manager.create()
    expect(existsSync(first.summary.workspace)).toBe(false)
    // Avec un document déposé, le dossier reste.
    const second = await manager.create({ space: 'discussion' })
    writeFileSync(join(second.summary.workspace, 'note.txt'), 'x')
    await manager.create()
    expect(existsSync(second.summary.workspace)).toBe(true)
    manager.stopAll()
  })

  it('supprimée, la discussion active laisse place à une discussion ; ses documents restent jusqu’à l’effacement', async () => {
    const { manager, conversationsDir } = launch()
    const view = await manager.create({ space: 'discussion' })
    const id = view.summary.id
    await manager.prompt(id, 'Bonjour')
    writeFileSync(join(view.summary.workspace, 'Synthèse.docx'), 'doc')
    await manager.delete(id, { fromAgent: false })
    const active = manager.view(manager.state().activeId).summary
    expect(active.space).toBe('discussion')
    expect(existsSync(join(view.summary.workspace, 'Synthèse.docx'))).toBe(true)
    new ConversationTrash(conversationsDir).erase(id)
    expect(existsSync(view.summary.workspace)).toBe(false)
    expect(readdirSync(discussionsRoot(conversationsDir))).toContain(active.id)
    manager.stopAll()
  })

  it('« Continuer dans un projet » : nouvelle conversation de l’espace Code, la discussion intacte', async () => {
    const { manager, workspace } = launch()
    const view = await manager.create({ space: 'discussion' })
    const id = view.summary.id
    await manager.prompt(id, 'Écris un e-mail de relance')
    const before = manager.view(id).transcript.items.length
    const next = await manager.continueInProject(id, workspace)
    expect(next.summary).toMatchObject({ workspace, draft: false })
    expect(next.summary.space).toBeUndefined()
    const kinds = next.transcript.items.map((i) => i.kind)
    expect(kinds.at(-1)).toBe('handover')
    expect(kinds).toContain('user')
    expect(manager.view(id).transcript.items).toHaveLength(before)
    expect(manager.settingsView().recentWorkspaces).toContain(workspace)
    manager.stopAll()
  })

  it('agent factice `discussion-document` : écriture accordée dans les documents, refusée hors du dossier', async () => {
    const { manager } = launch('discussion-document')
    const view = await manager.create({ space: 'discussion' })
    const id = view.summary.id
    await manager.prompt(id, 'Fais la synthèse')
    const folder = view.summary.workspace
    expect(readFileSync(join(folder, 'Synthèse.md'), 'utf8')).toContain('L’Ouest')
    expect(existsSync(join(folder, 'jamais.md'))).toBe(false)
    const keys = manager
      .view(id)
      .transcript.items.flatMap((i) =>
        i.kind === 'notice' && typeof i.message === 'object' ? [i.message.key] : []
      )
    expect(keys).toEqual(['discussion.notice.writeAllowed', 'discussion.notice.writeRefused'])
    manager.stopAll()
  })
})
