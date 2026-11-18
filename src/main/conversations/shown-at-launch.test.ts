import { describe, expect, it } from 'vitest'
import { conversationToReopen, shownToRemember } from './shown-at-launch'

describe('conversation affichée au lancement (fiche 243)', () => {
  const records = [{ id: 'a' }, { id: 'b', archived: true }, { id: 'c' }]

  it('la dernière affichée, si elle est encore dans l’historique', () => {
    expect(conversationToReopen('c', records)).toBe('c')
    expect(conversationToReopen('c', records, { profileId: '', workspace: '' })).toBe('c')
  })

  it('rien de retenu, supprimée ou archivée : aucune (nouvelle conversation)', () => {
    expect(conversationToReopen(undefined, records)).toBeUndefined()
    expect(conversationToReopen('', records)).toBeUndefined()
    expect(conversationToReopen('disparue', records)).toBeUndefined()
    expect(conversationToReopen('b', records)).toBeUndefined()
  })

  it('agent ou dossier imposé : il gagne, aucune', () => {
    expect(conversationToReopen('c', records, { profileId: 'mock' })).toBeUndefined()
    expect(conversationToReopen('c', records, { workspace: '/projet' })).toBeUndefined()
  })

  it('un brouillon n’est jamais retenu', () => {
    expect(shownToRemember({ record: { id: 'a' }, draft: false })).toBe('a')
    expect(shownToRemember({ record: { id: 'brouillon' }, draft: true })).toBeUndefined()
    expect(shownToRemember(undefined)).toBeUndefined()
  })
})
