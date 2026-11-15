import {
  existsSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { ConversationEvent } from '@shared/agent'
import { MOCK_AGENT_ENTRY } from '../../mock-agent/testing.mts'
import type { AgentProfile } from '../agent/profiles'
import { ConversationManager } from './manager'
import { discussionFolder, discussionsRoot } from './discussion-space'
import { ConversationTrash } from './trash'
import { ON_WINDOWS, tempDir } from '../test-platform'

/** Espace Discussion (fiche 224) : gestionnaire sur des dossiers jetables, agent factice. */
function launch(scenario = 'echo', root = tempDir('discussion-')) {
  const workspace = mkdtempSync(join(tmpdir(), 'projet-'))
  const conversationsDir = join(root, 'conversations')
  const events: ConversationEvent[] = []
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
    emit: (event) => events.push(event),
    emitList: () => {},
    agentHome: mkdtempSync(join(tmpdir(), 'maison-vide-'))
  })
  return { root, workspace, conversationsDir, manager, events }
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
    // Fenêtre rapide depuis une discussion : la cible est le dossier de projet, pas le sien.
    expect(manager.newConversationTarget().workspace).toBe(workspace)
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
    // Sous Windows, le dossier part quand l'agent du brouillon s'est arrêté (nouvel essai).
    await vi.waitFor(() => expect(existsSync(first.summary.workspace)).toBe(false), {
      timeout: 8000
    })
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
    // Sous Windows, effacé quand son agent s'est arrêté (nouvel essai).
    await vi.waitFor(() => expect(existsSync(view.summary.workspace)).toBe(false), {
      timeout: 8000
    })
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

  it('agent factice `discussion-lien-physique` : un fichier à plusieurs noms n’est pas accordé d’office (fiche 230)', async () => {
    const { manager, events } = launch('discussion-lien-physique')
    const view = await manager.create({ space: 'discussion' })
    const id = view.summary.id
    const folder = view.summary.workspace
    const secret = join(mkdtempSync(join(tmpdir(), 'ailleurs-')), 'secret.txt')
    writeFileSync(secret, 'à garder\n')
    linkSync(secret, join(folder, 'Notes.md'))
    const turn = manager.prompt(id, 'Mets à jour les notes')
    let request: ConversationEvent['event'] | undefined
    for (let i = 0; i < 200 && !request; i++) {
      await new Promise((r) => setTimeout(r, 10))
      request = events.find((e) => e.event.type === 'permission-request')?.event
    }
    if (request?.type !== 'permission-request') throw new Error('pas de demande posée')
    // La carte dit pourquoi : le fichier modifierait aussi un autre fichier.
    expect(request.risks).toEqual([{ kind: 'shared-file', path: 'Notes.md' }])
    manager.respondPermission(id, request.requestId, 'reject')
    await turn
    expect(readFileSync(secret, 'utf8')).toBe('à garder\n')
    const keys = manager
      .view(id)
      .transcript.items.flatMap((i) =>
        i.kind === 'notice' && typeof i.message === 'object' ? [i.message.key] : []
      )
    expect(keys).not.toContain('discussion.notice.writeAllowed')
    manager.stopAll()
  })

  it('B1 : une branche a son propre dossier ; effacer l’originale ne touche pas la branche', async () => {
    const { manager, conversationsDir } = launch()
    const a = await manager.create({ space: 'discussion' })
    await manager.prompt(a.summary.id, 'Bonjour')
    writeFileSync(join(a.summary.workspace, 'Synthèse.docx'), 'doc')
    const asked = manager.view(a.summary.id).transcript.items.find((i) => i.kind === 'user')
    const b = await manager.branch(a.summary.id, asked?.id ?? 0, 'Autre chose')
    expect(b.summary.space).toBe('discussion')
    expect(b.summary.workspace).toBe(discussionFolder(conversationsDir, b.summary.id))
    expect(readFileSync(join(b.summary.workspace, 'Synthèse.docx'), 'utf8')).toBe('doc')
    await manager.delete(a.summary.id, { fromAgent: false })
    new ConversationTrash(conversationsDir).erase(a.summary.id)
    // Sous Windows, effacé quand son agent s'est arrêté (nouvel essai).
    await vi.waitFor(() => expect(existsSync(a.summary.workspace)).toBe(false), {
      timeout: 8000
    })
    expect(readFileSync(join(b.summary.workspace, 'Synthèse.docx'), 'utf8')).toBe('doc')
    manager.stopAll()
  })

  it('effacement : jamais un dossier qu’une autre conversation désigne ; une conversation Code ne touche pas `discussions/`', async () => {
    const { manager, conversationsDir, workspace } = launch()
    const a = await manager.create({ space: 'discussion' })
    await manager.prompt(a.summary.id, 'Bonjour')
    const code = await manager.create({ workspace })
    await manager.prompt(code.summary.id, 'Bonjour')
    const before = readdirSync(discussionsRoot(conversationsDir)).sort()
    await manager.delete(code.summary.id, { fromAgent: false })
    new ConversationTrash(conversationsDir).erase(code.summary.id)
    expect(readdirSync(discussionsRoot(conversationsDir)).sort()).toEqual(before)
    // Un autre enregistrement (dans l'index, comme une branche d'avant la correction) qui désigne
    // le dossier de A : gardé à l'effacement.
    await manager.delete(a.summary.id, { fromAgent: false })
    const index = join(conversationsDir, 'index.json')
    const records = JSON.parse(readFileSync(index, 'utf8')) as unknown[]
    const now = new Date().toISOString()
    const branch = { id: 'branche-ancienne', title: 'B', titleSource: 'app', profileId: 'texte' }
    writeFileSync(
      index,
      JSON.stringify([
        ...records,
        {
          ...branch,
          workspace: a.summary.workspace,
          space: 'discussion',
          createdAt: now,
          updatedAt: now
        }
      ])
    )
    new ConversationTrash(conversationsDir).erase(a.summary.id)
    expect(existsSync(a.summary.workspace)).toBe(true)
    manager.stopAll()
  })

  it('I3 : brouillon avec les traces de l’agent (`.bob/`) mais sans document : son dossier part', async () => {
    const { manager } = launch()
    const draft = await manager.create({ space: 'discussion' })
    mkdirSync(join(draft.summary.workspace, '.bob', 'plugins'), { recursive: true })
    await manager.create()
    await vi.waitFor(() => expect(existsSync(draft.summary.workspace)).toBe(false), {
      timeout: 8000
    })
    manager.stopAll()
  })

  it('I3 : au lancement, les dossiers que plus rien ne connaît partent, sauf s’ils ont un document', async () => {
    const first = launch()
    const kept = await first.manager.create({ space: 'discussion' })
    await first.manager.prompt(kept.summary.id, 'Bonjour')
    first.manager.stopAll()
    const root = discussionsRoot(first.conversationsDir)
    mkdirSync(join(root, 'brouillon-perdu', '.bob'), { recursive: true })
    mkdirSync(join(root, 'avec-document'))
    writeFileSync(join(root, 'avec-document', 'note.txt'), 'x')
    const again = launch('echo', first.root)
    expect(readdirSync(root).sort()).toEqual(
      expect.arrayContaining(['avec-document', kept.summary.id])
    )
    expect(readdirSync(root)).not.toContain('brouillon-perdu')
    again.manager.stopAll()
  })

  it('I5 : dossier supprimé dans le Finder : recréé, l’agent repart', async () => {
    const { manager } = launch()
    const view = await manager.create({ space: 'discussion' })
    await manager.prompt(view.summary.id, 'Bonjour')
    manager.stopAll()
    // Sous Windows, l'agent arrêté libère son dossier courant un peu après (EPERM d'ici là).
    rmSync(
      view.summary.workspace,
      ON_WINDOWS
        ? { recursive: true, force: true, maxRetries: 50, retryDelay: 100 }
        : { recursive: true, force: true }
    )
    await manager.restart(view.summary.id)
    await manager.prompt(view.summary.id, 'Encore')
    expect(existsSync(view.summary.workspace)).toBe(true)
    expect(manager.view(view.summary.id).snapshot?.status).not.toBe('error')
    manager.stopAll()
  })
})
