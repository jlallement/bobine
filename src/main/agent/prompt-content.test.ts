import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'
import { MAX_EMBED_BYTES } from '@shared/attachments'
import { buildPrompt, pastedTextBlock } from './prompt-content'

const all = { image: true, embeddedContext: true }
const none = { image: false, embeddedContext: false }
const PNG = Buffer.from('89504e470d0a1a0a', 'hex')

function files() {
  const dir = mkdtempSync(join(tmpdir(), 'prompt-'))
  const write = (name: string, content: string | Buffer) => {
    const path = join(dir, name)
    writeFileSync(path, content)
    return path
  }
  return {
    text: write('notes.md', '# Notes'),
    big: write('gros.log', 'x'.repeat(MAX_EMBED_BYTES + 1)),
    binary: write('donnees.bin', Buffer.from([0, 1, 2, 3])),
    image: write('capture.png', PNG),
    missing: join(dir, 'absent.txt')
  }
}

describe('buildPrompt', () => {
  it('texte d’abord, image collée, fichier texte embarqué', async () => {
    const f = files()
    const { blocks, views } = await buildPrompt(
      'Regarde',
      [
        { kind: 'image', name: 'collée.png', mimeType: 'image/png', data: 'iVBORw==' },
        { kind: 'file', path: f.text }
      ],
      all,
      'Agent'
    )
    expect(blocks).toEqual([
      { type: 'text', text: 'Regarde' },
      { type: 'image', mimeType: 'image/png', data: 'iVBORw==' },
      {
        type: 'resource',
        resource: { uri: pathToFileURL(f.text).href, mimeType: 'text/plain', text: '# Notes' }
      }
    ])
    expect(views.map((v) => v.name)).toEqual(['collée.png', 'notes.md'])
  })

  it('gros fichier, binaire ou agent sans embeddedContext : lien vers le fichier', async () => {
    const f = files()
    const big = await buildPrompt('', [{ kind: 'file', path: f.big }], all, 'Agent')
    const binary = await buildPrompt('', [{ kind: 'file', path: f.binary }], all, 'Agent')
    const plain = await buildPrompt('', [{ kind: 'file', path: f.text }], none, 'Agent')
    for (const { blocks } of [big, binary, plain]) expect(blocks[0]?.type).toBe('resource_link')
    expect(plain.blocks[0]).toMatchObject({ name: 'notes.md', size: 7 })
  })

  it('fichier image : bloc image si accepté, sinon lien', async () => {
    const f = files()
    const accepted = await buildPrompt('', [{ kind: 'file', path: f.image }], all, 'Agent')
    expect(accepted.blocks[0]).toMatchObject({ type: 'image', mimeType: 'image/png' })
    expect(accepted.views[0]).toMatchObject({ kind: 'image', name: 'capture.png' })
    const refused = await buildPrompt('', [{ kind: 'file', path: f.image }], none, 'Agent')
    expect(refused.blocks[0]?.type).toBe('resource_link')
  })

  it('@git-changes, @terminal (fiche 057) : contenu lu à l’envoi, joint en texte', async () => {
    const built = await buildPrompt(
      'Relis',
      [
        { kind: 'context', source: 'git-changes' },
        { kind: 'context', source: 'terminal' }
      ],
      { image: false, embeddedContext: false },
      'Bob',
      async (source) => {
        if (source === 'terminal') throw new Error('terminal fermé')
        return '+deux'
      }
    )
    expect(built.blocks).toEqual([
      { type: 'text', text: 'Relis' },
      { type: 'text', text: 'Contenu de @git-changes :\n\n+deux' },
      { type: 'text', text: 'Contenu de @terminal :\n\nLecture impossible : terminal fermé' }
    ])
    expect(built.views).toEqual([
      { kind: 'context', source: 'git-changes', name: 'git-changes' },
      { kind: 'context', source: 'terminal', name: 'terminal' }
    ])
  })

  it('erreurs lisibles : image refusée par l’agent, fichier absent, message vide', async () => {
    const f = files()
    await expect(
      buildPrompt(
        'x',
        [{ kind: 'image', name: 'a.png', mimeType: 'image/png', data: 'AA==' }],
        none,
        'Bob'
      )
    ).rejects.toThrow('Bob n’accepte pas les images')
    await expect(
      buildPrompt('x', [{ kind: 'file', path: f.missing }], all, 'Agent')
    ).rejects.toThrow('Fichier introuvable')
    await expect(buildPrompt('  ', [], all, 'Agent')).rejects.toThrow('Message vide')
  })
})

describe('buildPrompt : long texte collé (fiche 155)', () => {
  it('bloc de texte à part, annoncé, même sans embeddedContext ; montré dans le fil', async () => {
    const pasted = 'ligne 1\nligne 2\nligne 3\n'
    const built = await buildPrompt(
      'Regarde ce journal',
      [{ kind: 'text', name: 'Texte collé', text: pasted }],
      none,
      'Agent'
    )
    expect(built.blocks).toEqual([
      { type: 'text', text: 'Regarde ce journal' },
      { type: 'text', text: `Texte collé (3 lignes) :\n\n${pasted}` }
    ])
    expect(built.views).toEqual([{ kind: 'text', name: 'Texte collé', text: pasted }])
  })
})

describe('pastedTextBlock (fiche 155)', () => {
  it('une ligne au singulier, plusieurs au pluriel', () => {
    expect(pastedTextBlock('seule')).toBe('Texte collé (1 ligne) :\n\nseule')
    expect(pastedTextBlock('a\nb')).toBe('Texte collé (2 lignes) :\n\na\nb')
  })
})
