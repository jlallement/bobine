import { describe, expect, it } from 'vitest'
import { EDITORS, chosenEditor, parseEditorId } from './editors'
import { parsePreferences } from './preferences'

describe('éditeurs (fiche 156)', () => {
  const installed = [
    { id: 'zed', name: 'Zed' },
    { id: 'idea', name: 'IntelliJ IDEA' }
  ]
  it('celui du réglage s’il est installé, sinon le premier ; aucun installé : aucun', () => {
    expect(chosenEditor(installed, 'idea')?.id).toBe('idea')
    expect(chosenEditor(installed, 'vscode')?.id).toBe('zed')
    expect(chosenEditor(installed, undefined)?.id).toBe('zed')
    expect(chosenEditor([], 'zed')).toBeUndefined()
  })
  it('identifiants connus seulement, ids uniques ; préférence lue du disque', () => {
    expect(parseEditorId('cursor')).toBe('cursor')
    expect(parseEditorId('emacs')).toBeUndefined()
    expect(new Set(EDITORS.map((e) => e.id)).size).toBe(EDITORS.length)
    expect(parsePreferences({ editor: 'zed' })).toEqual({ editor: 'zed' })
    expect(parsePreferences({ editor: 'rm -rf' })).toEqual({})
  })
})
