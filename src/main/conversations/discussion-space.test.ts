import {
  closeSync,
  existsSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  symlinkSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { emptyTranscript, type TranscriptState } from '@shared/transcript'
import { handoverContext } from '@shared/handover'
import {
  addDocuments,
  changedDocuments,
  copyDocument,
  continuedTranscript,
  discussionFolder,
  documentPath,
  documentsFingerprint,
  folderPlan,
  listDocuments,
  openDocument,
  sameDraft,
  spaceOf
} from './discussion-space'

const folder = () => mkdtempSync(join(tmpdir(), 'documents-'))

describe('espace Discussion (fiche 224)', () => {
  it('espace d’une nouvelle conversation : demandé, sinon gardé quand seul l’agent change', () => {
    const discussion = { space: 'discussion' as const }
    expect(spaceOf({ space: 'discussion' }, {})).toBe('discussion')
    expect(spaceOf({ profileId: 'bob' }, discussion)).toBe('discussion')
    expect(spaceOf({}, discussion)).toBe('code')
    expect(spaceOf({ workspace: '/p' }, discussion)).toBe('code')
    expect(spaceOf({ profileId: 'bob' }, {})).toBe('code')
  })

  it('dossier : jamais celui d’une discussion hérité dans l’espace Code', () => {
    const projet = folder()
    const active = { space: 'discussion' as const, workspace: '/donnees/discussions/x' }
    const plan = folderPlan({}, active, { workspace: projet }, [])
    expect(plan).toEqual({ discussion: false, wanted: projet, workspace: projet })
    expect(folderPlan({ space: 'discussion' }, active, {}, []).discussion).toBe(true)
    expect(sameDraft({ ...active, profileId: 'bob' }, 'bob', { ...plan, discussion: true })).toBe(
      true
    )
    expect(sameDraft({ ...active, profileId: 'bob' }, 'bob', plan)).toBe(false)
  })

  it('identifiant de discussion sûr exigé', () => {
    expect(() => discussionFolder('/d/conversations', '../x')).toThrow()
    expect(discussionFolder('/d/conversations', 'abc-1')).toBe('/d/discussions/abc-1')
  })

  it('documents : fichiers visibles du premier niveau ; copies numérotées, originaux intacts', () => {
    const dir = folder()
    const source = folder()
    writeFileSync(join(source, 'Ventes.xlsx'), 'v1')
    mkdirSync(join(dir, '.bob'))
    mkdirSync(join(dir, 'sous-dossier'))
    writeFileSync(join(dir, '.cache'), 'x')
    expect(addDocuments(dir, [join(source, 'Ventes.xlsx')])).toEqual(['Ventes.xlsx'])
    expect(addDocuments(dir, [join(source, 'Ventes.xlsx')])).toEqual(['Ventes (2).xlsx'])
    expect(
      listDocuments(dir)
        .map((d) => d.name)
        .sort()
    ).toEqual(['Ventes (2).xlsx', 'Ventes.xlsx'])
    expect(readFileSync(join(source, 'Ventes.xlsx'), 'utf8')).toBe('v1')
    expect(listDocuments(join(dir, 'absent'))).toEqual([])
  })

  it('un document est un fichier ordinaire du dossier : ni chemin, ni caché, ni lien symbolique', () => {
    const dir = folder()
    writeFileSync(join(dir, 'a.docx'), 'x')
    expect(documentPath(dir, 'a.docx')).toBe(join(dir, 'a.docx'))
    const secret = join(folder(), 'secret.txt')
    writeFileSync(secret, 'clé')
    symlinkSync(secret, join(dir, 'lien.txt'))
    mkdirSync(join(dir, 'sous'))
    for (const bad of ['../a', 'x/y', '.bob', '', 'lien.txt', 'sous', 'absent.txt'])
      expect(() => documentPath(dir, bad)).toThrow()
    expect(listDocuments(dir).map((d) => d.name)).toEqual(['a.docx'])
  })

  it('documents créés ou modifiés pendant un tour', () => {
    const dir = folder()
    writeFileSync(join(dir, 'garde.txt'), 'a')
    writeFileSync(join(dir, 'change.txt'), 'a')
    const before = documentsFingerprint(dir)
    writeFileSync(join(dir, 'change.txt'), 'plus long')
    writeFileSync(join(dir, 'Synthèse.docx'), 'neuf')
    expect(changedDocuments(before, documentsFingerprint(dir)).sort()).toEqual([
      'Synthèse.docx',
      'change.txt'
    ])
  })

  it('continuer dans un projet : l’échange de la discussion part en texte au premier message', () => {
    const source: TranscriptState = {
      ...emptyTranscript,
      items: [
        { kind: 'user', id: 1, text: 'Écris un e-mail' },
        { kind: 'notice', id: 2, level: 'info', message: 'bruit' },
        { kind: 'agent', id: 3, text: 'Voici l’e-mail.' }
      ],
      nextId: 4
    } as TranscriptState
    const agent = { profileId: 'bob', label: 'IBM Bob' }
    const next = continuedTranscript(source, agent)
    expect(next.items.map((i) => i.kind)).toEqual(['user', 'agent', 'handover'])
    expect(next.nextId).toBe(5)
    const context = handoverContext(next.items) ?? ''
    expect(context).toContain('outside any project folder')
    expect(context).toContain('Voici l’e-mail.')
  })
})

describe('documents à plusieurs noms (lien physique, fiche 230)', () => {
  /** Un dossier de discussion avec `Notes.md`, autre nom d'un fichier extérieur. */
  function linked() {
    const docs = folder()
    const secret = join(folder(), 'secret.txt')
    writeFileSync(secret, 'contenu extérieur')
    linkSync(secret, join(docs, 'Notes.md'))
    writeFileSync(join(docs, 'Seul.md'), 'à moi')
    return { docs, secret }
  }

  it('pas un document : ni listé, ni désigné, ni ouvert', () => {
    const { docs } = linked()
    expect(listDocuments(docs).map((d) => d.name)).toEqual(['Seul.md'])
    expect(() => documentPath(docs, 'Notes.md')).toThrow()
    expect(() => openDocument(join(docs, 'Notes.md'))).toThrow()
    closeSync(openDocument(join(docs, 'Seul.md')))
    expect(documentsFingerprint(docs).has('Notes.md')).toBe(false)
  })

  it('jamais copié hors de la discussion (branche, continuer dans un projet, copie)', () => {
    const { docs } = linked()
    const target = folder()
    expect(
      addDocuments(target, [join(docs, 'Notes.md'), join(docs, 'Seul.md')], {
        fromDocuments: true
      })
    ).toEqual(['Seul.md'])
    expect(readFileSync(join(target, 'Seul.md'), 'utf8')).toBe('à moi')
    expect(() => copyDocument(join(docs, 'Notes.md'), join(target, 'copie.md'))).toThrow()
    expect(existsSync(join(target, 'copie.md'))).toBe(false)
    // Un lien symbolique non plus.
    symlinkSync(join(docs, 'Seul.md'), join(docs, 'Lien.md'))
    expect(addDocuments(target, [join(docs, 'Lien.md')], { fromDocuments: true })).toEqual([])
  })

  it('un fichier choisi par l’utilisateur, même à plusieurs noms, est copié (nouveau fichier)', () => {
    const { secret } = linked()
    const target = folder()
    expect(addDocuments(target, [secret])).toEqual(['secret.txt'])
    writeFileSync(join(target, 'secret.txt'), 'changé')
    expect(readFileSync(secret, 'utf8')).toBe('contenu extérieur')
  })
})
