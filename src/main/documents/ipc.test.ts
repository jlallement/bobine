import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { AgentEvent, ConversationEvent, ConversationSummary } from '@shared/agent'
import type { ConversationListeners } from '../conversations/conversation'
import { documentsHandlers, previewOf, type DocumentsHost } from './ipc'

const summary = (id: string, workspace: string, space?: 'discussion'): ConversationSummary => ({
  id,
  title: id,
  profileId: 'p',
  profileLabel: 'P',
  workspace,
  updatedAt: '',
  status: 'ready',
  draft: false,
  ...(space ? { space } : {})
})

function setup() {
  const folder = mkdtempSync(join(tmpdir(), 'docs-'))
  const project = mkdtempSync(join(tmpdir(), 'projet-'))
  const posted: [string, AgentEvent][] = []
  let listener: ConversationListeners = {}
  const host: DocumentsHost = {
    state: () => ({
      conversations: [summary('d', folder, 'discussion'), summary('c', project)],
      activeId: 'd'
    }),
    post: (id, event) => posted.push([id, event]),
    subscribe: (l) => ((listener = l), () => {}),
    continueInProject: vi.fn(async () => ({}) as never)
  }
  const deps = {
    chooseFiles: vi.fn(async () => [] as string[]),
    chooseDirectory: vi.fn(async () => project as string | null),
    openPath: vi.fn(async () => ''),
    reveal: vi.fn()
  }
  const handlers = documentsHandlers(host, deps)
  const status = (id: string, s: 'busy' | 'ready') =>
    listener.event?.({
      conversationId: id,
      event: { type: 'status', snapshot: { status: s } }
    } as unknown as ConversationEvent)
  return { folder, project, posted, host, deps, handlers, status }
}

describe('documents d’une discussion (fiche 224)', () => {
  it('à la fin d’un tour, les documents créés ou modifiés sont posés dans le fil', () => {
    const { folder, posted, status } = setup()
    writeFileSync(join(folder, 'garde.txt'), 'a')
    status('d', 'busy')
    writeFileSync(join(folder, 'Synthèse.docx'), 'neuf')
    status('d', 'busy')
    status('d', 'ready')
    expect(posted).toEqual([['d', { type: 'documents', names: ['Synthèse.docx'] }]])
    // Tour sans document changé : rien. Conversation de l'espace Code : jamais suivie.
    status('d', 'busy')
    status('d', 'ready')
    status('c', 'busy')
    status('c', 'ready')
    expect(posted).toHaveLength(1)
  })

  it('canaux : seulement pour une discussion, jamais un nom qui sort du dossier', async () => {
    const { handlers, folder, deps } = setup()
    expect(await handlers['documents:list']('c')).toEqual([])
    expect(() => handlers['documents:open']('c', 'a')).toThrow()
    expect(() => handlers['documents:reveal']('d', '../x')).toThrow()
    writeFileSync(join(folder, 'a.txt'), 'x')
    handlers['documents:reveal']('d', 'a.txt')
    expect(deps.reveal).toHaveBeenCalledWith(join(folder, 'a.txt'))
    expect(() => handlers['documents:add']('d', [42] as unknown as string[])).toThrow()
  })

  it('copie enregistrée dans le dossier choisi, sous un nom libre', async () => {
    const { handlers, folder, project } = setup()
    writeFileSync(join(folder, 'a.txt'), 'x')
    writeFileSync(join(project, 'a.txt'), 'déjà là')
    expect(await handlers['documents:saveCopy']('d', 'a.txt')).toBe(join(project, 'a (2).txt'))
    expect(readFileSync(join(project, 'a.txt'), 'utf8')).toBe('déjà là')
  })

  it('continuer dans un projet : documents copiés dans `documents/` si demandé', async () => {
    const { handlers, folder, project, host } = setup()
    writeFileSync(join(folder, 'Synthèse.docx'), 'doc')
    await handlers['discussion:continueInProject']('d', { copyDocuments: false })
    expect(existsSync(join(project, 'documents'))).toBe(false)
    await handlers['discussion:continueInProject']('d', { copyDocuments: true })
    expect(readFileSync(join(project, 'documents', 'Synthèse.docx'), 'utf8')).toBe('doc')
    expect(host.continueInProject).toHaveBeenCalledWith('d', project)
  })

  it('aperçu : texte, image, document Word converti, sinon rien', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'apercu-'))
    writeFileSync(join(dir, 'a.md'), '# Titre')
    writeFileSync(join(dir, 'b.png'), Buffer.from([1, 2]))
    writeFileSync(join(dir, 'c.docx'), 'x')
    writeFileSync(join(dir, 'd.xlsx'), 'x')
    const toHtml = async () => '<p>Bonjour</p>'
    expect(await previewOf(join(dir, 'a.md'), toHtml)).toEqual({
      kind: 'text',
      text: '# Titre',
      truncated: false
    })
    expect(await previewOf(join(dir, 'b.png'), toHtml)).toMatchObject({ kind: 'image' })
    expect(await previewOf(join(dir, 'c.docx'), toHtml)).toEqual({
      kind: 'html',
      html: '<p>Bonjour</p>'
    })
    expect(await previewOf(join(dir, 'd.xlsx'), toHtml)).toEqual({ kind: 'none' })
  })
})
