import { describe, expect, it, vi } from 'vitest'
import { contextMenuTemplate, MAX_SUGGESTIONS, type ContextMenuTarget } from './context-menu'

// `electron` n'existe pas sous Vitest : seule la fonction pure est essayée.
vi.mock('electron', () => ({ Menu: {}, clipboard: {} }))

const target = (over: Partial<ContextMenuTarget> = {}): ContextMenuTarget => ({
  isEditable: false,
  selectionText: '',
  linkURL: '',
  hasImage: false,
  misspelledWord: '',
  dictionarySuggestions: [],
  canCut: true,
  canCopy: true,
  canPaste: true,
  canSelectAll: true,
  ...over
})
const actions = () => ({ replaceMisspelling: vi.fn(), copyLink: vi.fn(), copyImage: vi.fn() })
const labels = (items: { label?: string; type?: string }[]) =>
  items.map((item) => (item.type === 'separator' ? '-' : item.label))

describe('menu contextuel (fiche 154)', () => {
  it('champ éditable : suggestions, puis Couper, Copier, Coller, Tout sélectionner', () => {
    const a = actions()
    const items = contextMenuTemplate(
      target({
        isEditable: true,
        misspelledWord: 'bonjoure',
        dictionarySuggestions: ['bonjour', 'bonjours']
      }),
      a
    )
    expect(labels(items)).toEqual([
      'bonjour',
      'bonjours',
      '-',
      'Couper',
      'Copier',
      'Coller',
      'Tout sélectionner'
    ])
    items[0]?.click?.({} as never, undefined, {} as never)
    expect(a.replaceMisspelling).toHaveBeenCalledWith('bonjour')
  })

  it('champ éditable sans faute : seulement les quatre entrées d’édition, grisées si impossibles', () => {
    const items = contextMenuTemplate(
      target({ isEditable: true, canCut: false, canCopy: false }),
      actions()
    )
    expect(labels(items)).toEqual(['Couper', 'Copier', 'Coller', 'Tout sélectionner'])
    expect(items.map((item) => item.enabled)).toEqual([false, false, true, true])
  })

  it('faute sans suggestion : pas de séparateur orphelin ; suggestions bornées', () => {
    expect(
      labels(contextMenuTemplate(target({ isEditable: true, misspelledWord: 'xyzzy' }), actions()))
    ).toEqual(['Couper', 'Copier', 'Coller', 'Tout sélectionner'])
    const many = Array.from({ length: 12 }, (_, i) => `mot${i}`)
    const items = contextMenuTemplate(
      target({ isEditable: true, misspelledWord: 'x', dictionarySuggestions: many }),
      actions()
    )
    expect(items.filter((item) => item.label?.startsWith('mot'))).toHaveLength(MAX_SUGGESTIONS)
  })

  it('sélection hors champ : Copier ; lien : Copier l’adresse ; image : Copier l’image', () => {
    const a = actions()
    expect(labels(contextMenuTemplate(target({ selectionText: 'texte' }), a))).toEqual(['Copier'])
    const link = contextMenuTemplate(target({ linkURL: 'http://localhost:3000' }), a)
    expect(labels(link)).toEqual(['Copier l’adresse du lien'])
    link[0]?.click?.({} as never, undefined, {} as never)
    expect(a.copyLink).toHaveBeenCalledWith('http://localhost:3000')
    expect(labels(contextMenuTemplate(target({ hasImage: true }), a))).toEqual(['Copier l’image'])
    expect(
      labels(contextMenuTemplate(target({ selectionText: 'x', linkURL: 'https://a.b' }), a))
    ).toEqual(['Copier', 'Copier l’adresse du lien'])
  })

  it('rien de sélectionné ni de lien : pas de menu', () => {
    expect(contextMenuTemplate(target({ selectionText: '  ' }), actions())).toEqual([])
  })
})
