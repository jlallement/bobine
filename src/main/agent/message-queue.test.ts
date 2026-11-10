import { describe, expect, it } from 'vitest'
import { MAX_ATTACHMENTS, type PromptAttachment } from '@shared/attachments'
import { MAX_QUEUED, MessageQueue } from './message-queue'

const files = (n: number): PromptAttachment[] =>
  Array.from({ length: n }, (_, i) => ({ kind: 'file', path: `/tmp/f${i}.txt` }))

describe('MessageQueue', () => {
  it('messages réunis en un envoi, dans la limite des pièces jointes ; le reste attend', () => {
    const queue = new MessageQueue()
    queue.add('un', files(MAX_ATTACHMENTS - 1))
    queue.add('  ', [])
    queue.add('trois', files(2))
    const first = queue.takeBatch()
    expect(first).toMatchObject({ text: 'un' })
    expect(first?.attachments).toHaveLength(MAX_ATTACHMENTS - 1)
    expect(queue.views().map((v) => v.text)).toEqual(['trois'])
    // Envoi refusé : les messages reviennent en tête, dans l'ordre.
    first?.restore()
    expect(queue.views().map((v) => v.text)).toEqual(['un', '  ', 'trois'])
  })

  it('retirer, passer en tête, et limite du nombre de messages', () => {
    const queue = new MessageQueue()
    queue.add('a', [])
    queue.add('b', files(1))
    const [, b] = queue.views()
    expect(b?.attachments).toEqual([{ kind: 'file', name: 'f0.txt' }])
    queue.promote(b?.id ?? '')
    expect(queue.views().map((v) => v.text)).toEqual(['b', 'a'])
    expect(queue.remove(b?.id ?? '')).toMatchObject({ text: 'b' })
    expect(() => queue.remove('inconnu')).toThrow('introuvable')
    for (let i = queue.length; i < MAX_QUEUED; i++) queue.add(`m${i}`, [])
    expect(() => queue.add('de trop', [])).toThrow(`Au plus ${MAX_QUEUED}`)
    expect(queue.takeBatch()?.text.split('\n\n')).toHaveLength(MAX_QUEUED)
    expect(queue.takeBatch()).toBeUndefined()
  })

  it('provenance (fiche 097) : gardée, et un envoi ne réunit qu’une seule provenance', () => {
    const queue = new MessageQueue()
    const parent = { kind: 'parent', id: 'm', title: 'Carnet' } as const
    queue.add('de la mère', [], parent)
    queue.add('encore', [], parent)
    queue.add('de moi', [])
    queue.add('de la fille', [], { kind: 'child', id: 'f', title: 'Import' })
    expect(queue.views().map((v) => v.from?.kind)).toEqual(['parent', 'parent', undefined, 'child'])
    expect(queue.takeBatch()).toMatchObject({ text: 'de la mère\n\nencore', from: parent })
    const mine = queue.takeBatch()
    expect(mine?.text).toBe('de moi')
    expect(mine && 'from' in mine).toBe(false)
    // « Relancer » (fiche 043) : la provenance passe au nouvel hôte.
    expect(queue.drain()).toEqual([
      { text: 'de la fille', attachments: [], from: { kind: 'child', id: 'f', title: 'Import' } }
    ])
  })

  it('/split (fiche 118) : la demande reste attachée au message, tapé avec la commande', () => {
    const queue = new MessageQueue()
    queue.add('Trois chantiers', [], undefined, true)
    queue.add('autre chose', [])
    expect(queue.views().map((v) => v.text)).toEqual(['/split Trois chantiers', 'autre chose'])
    expect(queue.takeBatch()).toMatchObject({ text: 'Trois chantiers', askChildren: true })
    const plain = queue.takeBatch()
    expect(plain?.text).toBe('autre chose')
    expect(plain && 'askChildren' in plain).toBe(false)
    // « Modifier » : rendu à la zone de saisie tel qu'il a été tapé.
    queue.add('Deux chantiers', [], undefined, true)
    const [view] = queue.views()
    expect(view && queue.remove(view.id).text).toBe('/split Deux chantiers')
  })
})
