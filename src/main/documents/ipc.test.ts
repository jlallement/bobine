import { execFileSync } from 'node:child_process'
import {
  existsSync,
  linkSync,
  mkdtempSync,
  readFileSync,
  symlinkSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { AgentEvent, ConversationEvent, ConversationSummary } from '@shared/agent'
import type { ConversationListeners } from '../conversations/conversation'
import { canOpenDocument } from '@shared/documents'
import {
  attachToDocuments,
  documentsHandlers,
  previewOf,
  textutilText,
  type DocumentsHost
} from './ipc'

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

function setup(writesWithoutAsking = false) {
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
    settingsView: () => ({ profiles: [{ id: 'p', label: 'P', writesWithoutAsking }] }),
    view: () => ({
      transcript: {
        items: posted.map(([, e], n) => ({
          id: n,
          kind: 'notice' as const,
          level: 'warning' as const,
          ...(e.type === 'notice' && typeof e.message === 'object' ? { message: e.message } : {})
        }))
      }
    }),
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
  const status = (id: string, s: 'busy' | 'ready' | 'needs-action') =>
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

  it('aperçu : texte, image, texte d’un document Word, sinon rien', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'apercu-'))
    writeFileSync(join(dir, 'a.md'), '# Titre')
    writeFileSync(join(dir, 'b.png'), Buffer.from([1, 2]))
    writeFileSync(join(dir, 'c.docx'), 'x')
    writeFileSync(join(dir, 'd.xlsx'), 'x')
    const toText = async () => 'Bonjour'
    expect(await previewOf(join(dir, 'a.md'), toText)).toEqual({
      kind: 'text',
      text: '# Titre',
      truncated: false
    })
    expect(await previewOf(join(dir, 'b.png'), toText)).toMatchObject({ kind: 'image' })
    expect(await previewOf(join(dir, 'c.docx'), toText)).toEqual({
      kind: 'text',
      text: 'Bonjour',
      truncated: false
    })
    expect(await previewOf(join(dir, 'd.xlsx'), toText)).toEqual({ kind: 'none' })
  })

  // Relecture M1 (fiche 224) : `textutil` lit le descripteur ouvert en `O_NOFOLLOW`, pas le chemin.
  it.runIf(process.platform === 'darwin')(
    'texte d’un Word par textutil : lu par le descripteur, jamais à travers un lien',
    async () => {
      const dir = mkdtempSync(join(tmpdir(), 'textutil-'))
      const outside = mkdtempSync(join(tmpdir(), 'dehors-'))
      writeFileSync(join(dir, 'a.txt'), 'Bonjour le monde\n')
      execFileSync('/usr/bin/textutil', ['-convert', 'docx', join(dir, 'a.txt')])
      expect(await textutilText(join(dir, 'a.docx'))).toBe('Bonjour le monde\n')
      // Un RTF nommé .doc : reconnu au contenu, comme avant.
      execFileSync('/usr/bin/textutil', ['-convert', 'rtf', join(dir, 'a.txt')])
      execFileSync('/bin/cp', [join(dir, 'a.rtf'), join(dir, 'b.doc')])
      expect(await textutilText(join(dir, 'b.doc'))).toBe('Bonjour le monde\n')
      execFileSync('/usr/bin/textutil', [
        '-convert',
        'docx',
        '-output',
        join(outside, 's.docx'),
        join(dir, 'a.txt')
      ])
      symlinkSync(join(outside, 's.docx'), join(dir, 'lien.docx'))
      expect(await textutilText(join(dir, 'lien.docx'))).toBeUndefined()
      execFileSync('/usr/bin/mkfifo', [join(dir, 'tube.docx')])
      expect(await textutilText(join(dir, 'tube.docx'))).toBeUndefined()
      expect(await textutilText(join(dir, 'absent.docx'))).toBeUndefined()
    }
  )

  it('fichiers joints à une discussion : copiés dans ses documents, l’agent reçoit la copie', () => {
    const { host, folder, project } = setup()
    const outside = join(project, 'Ventes.xlsx')
    writeFileSync(outside, 'v')
    writeFileSync(join(folder, 'déjà.txt'), 'x')
    const sent = attachToDocuments(host, 'd', [
      { kind: 'file', path: outside },
      { kind: 'file', path: join(folder, 'déjà.txt') }
    ])
    expect(sent).toEqual([
      { kind: 'file', path: join(folder, 'Ventes.xlsx') },
      { kind: 'file', path: join(folder, 'déjà.txt') }
    ])
    expect(attachToDocuments(host, 'c', [{ kind: 'file', path: outside }])).toEqual([
      { kind: 'file', path: outside }
    ])
  })

  it('agent qui écrit sans demander : la limite aux documents seulement demandée, dite une fois', () => {
    const { posted, status } = setup(true)
    status('d', 'busy')
    status('d', 'ready')
    status('d', 'busy')
    status('d', 'ready')
    status('c', 'busy')
    expect(posted).toEqual([
      [
        'd',
        {
          type: 'notice',
          level: 'warning',
          message: { key: 'discussion.notice.limitRequestedOnly', params: { agent: 'P' } }
        }
      ]
    ])
  })

  it('I6 : « Ouvrir » seulement pour un document ou une image ; un exécutable : refusé', async () => {
    const { handlers, folder, deps } = setup()
    for (const name of ['lance.command', 'a.terminal', 'x.webloc', 'page.html', 'b.svg'])
      writeFileSync(join(folder, name), 'x')
    writeFileSync(join(folder, 'Synthèse.docx'), 'x')
    for (const name of ['lance.command', 'a.terminal', 'x.webloc', 'page.html', 'b.svg'])
      expect(() => handlers['documents:open']('d', name)).toThrow()
    await handlers['documents:open']('d', 'Synthèse.docx')
    expect(deps.openPath).toHaveBeenCalledTimes(1)
    expect(canOpenDocument('Photo.HEIC')).toBe(true)
    expect(canOpenDocument('sans-extension')).toBe(false)
  })

  it('M3 : pièce jointe disparue : pas envoyée, et dit dans le fil', () => {
    const { host, posted } = setup()
    const sent = attachToDocuments(host, 'd', [{ kind: 'file', path: '/nulle/part/absent.pdf' }])
    expect(sent).toEqual([])
    expect(posted).toEqual([
      [
        'd',
        {
          type: 'notice',
          level: 'warning',
          message: { key: 'discussion.notice.attachmentMissing', params: { names: 'absent.pdf' } }
        }
      ]
    ])
  })

  it('M6 : une autorisation à donner suspend le tour sans le finir', () => {
    const { folder, posted, status } = setup()
    status('d', 'busy')
    status('d', 'needs-action')
    writeFileSync(join(folder, 'Synthèse.docx'), 'neuf')
    status('d', 'busy')
    expect(posted).toEqual([])
    status('d', 'ready')
    expect(posted).toEqual([['d', { type: 'documents', names: ['Synthèse.docx'] }]])
  })

  it('M2 : la copie n’écrase jamais un fichier existant', async () => {
    const { handlers, folder, project } = setup()
    writeFileSync(join(folder, 'a.txt'), 'x')
    writeFileSync(join(project, 'a.txt'), 'à garder')
    writeFileSync(join(project, 'a (2).txt'), 'à garder aussi')
    expect(await handlers['documents:saveCopy']('d', 'a.txt')).toBe(join(project, 'a (3).txt'))
    expect(readFileSync(join(project, 'a (2).txt'), 'utf8')).toBe('à garder aussi')
  })

  it('fiche 230 : un document à plusieurs noms (lien physique) n’est ni montré, ni ouvert, ni copié', async () => {
    const { handlers, folder, project, deps } = setup()
    const secret = join(mkdtempSync(join(tmpdir(), 'ailleurs-')), 'secret.txt')
    writeFileSync(secret, 'contenu extérieur')
    linkSync(secret, join(folder, 'Notes.txt'))
    expect(await handlers['documents:list']('d')).toEqual([])
    await expect(async () => handlers['documents:preview']('d', 'Notes.txt')).rejects.toThrow()
    expect(() => handlers['documents:open']('d', 'Notes.txt')).toThrow()
    await expect(handlers['documents:saveCopy']('d', 'Notes.txt')).rejects.toThrow()
    expect(existsSync(join(project, 'Notes.txt'))).toBe(false)
    expect(deps.openPath).not.toHaveBeenCalled()
    // Lu directement (lien posé après le contrôle du nom) : refusé sur le descripteur.
    await expect(previewOf(join(folder, 'Notes.txt'))).rejects.toThrow()
    expect(await textutilText(join(folder, 'Notes.txt'))).toBeUndefined()
  })
})
