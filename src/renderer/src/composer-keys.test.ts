import { describe, expect, it } from 'vitest'
import { composerKeyAction, nextOption, type ComposerKeyState } from './composer-keys'

const closed = { open: false, count: 0, active: 0 }
const state = (change: Partial<ComposerKeyState> = {}): ComposerKeyState => ({
  mentions: closed,
  commands: closed,
  busy: false,
  empty: false,
  hasQueued: false,
  canCycleMode: false,
  ...change
})
const key = (k: string, options: { shift?: boolean; composing?: boolean } = {}) => ({
  key: k,
  shift: options.shift ?? false,
  composing: options.composing ?? false
})

describe('touches de la zone de saisie (fiche 089)', () => {
  it('Entrée envoie ; Maj+Entrée et la composition IME non', () => {
    expect(composerKeyAction(key('Enter'), state())).toEqual({ kind: 'submit' })
    expect(composerKeyAction(key('Enter', { shift: true }), state())).toEqual({ kind: 'none' })
    expect(composerKeyAction(key('Enter', { composing: true }), state())).toEqual({ kind: 'none' })
  })

  it('menu « / » : flèches en boucle, Tab complète, Entrée choisit, Échap referme', () => {
    const commands = { open: true, count: 3, active: 0 }
    expect(composerKeyAction(key('ArrowDown'), state({ commands }))).toEqual({
      kind: 'command-move',
      index: 1
    })
    expect(composerKeyAction(key('ArrowUp'), state({ commands }))).toEqual({
      kind: 'command-move',
      index: 2
    })
    expect(composerKeyAction(key('Tab'), state({ commands }))).toEqual({
      kind: 'command-pick',
      complete: true
    })
    expect(composerKeyAction(key('Enter'), state({ commands }))).toEqual({
      kind: 'command-pick',
      complete: false
    })
    expect(composerKeyAction(key('Escape'), state({ commands }))).toEqual({
      kind: 'command-dismiss'
    })
  })

  it('menu sans résultat : les flèches sont absorbées, Entrée envoie le texte', () => {
    const commands = { open: true, count: 0, active: 0 }
    expect(composerKeyAction(key('ArrowDown'), state({ commands }))).toEqual({ kind: 'prevent' })
    expect(composerKeyAction(key('Enter'), state({ commands }))).toEqual({ kind: 'submit' })
  })

  it('menu `@` avant le menu « / » ; Tab et Entrée choisissent le fichier', () => {
    const mentions = { open: true, count: 2, active: 1 }
    expect(composerKeyAction(key('ArrowDown'), state({ mentions }))).toEqual({
      kind: 'mention-move',
      index: 0
    })
    expect(composerKeyAction(key('Tab'), state({ mentions }))).toEqual({ kind: 'mention-pick' })
    expect(composerKeyAction(key('Enter'), state({ mentions }))).toEqual({ kind: 'mention-pick' })
    expect(composerKeyAction(key('Escape'), state({ mentions }))).toEqual({
      kind: 'mention-dismiss'
    })
    // Pendant une composition IME, le menu ne prend pas la touche.
    expect(composerKeyAction(key('Enter', { composing: true }), state({ mentions }))).toEqual({
      kind: 'none'
    })
  })

  it('Échap arrête la réponse ; ↑ dans une zone vide reprend le dernier message en attente', () => {
    expect(composerKeyAction(key('Escape'), state({ busy: true }))).toEqual({ kind: 'cancel' })
    expect(composerKeyAction(key('Escape'), state())).toEqual({ kind: 'none' })
    expect(composerKeyAction(key('ArrowUp'), state({ empty: true, hasQueued: true }))).toEqual({
      kind: 'edit-last-queued'
    })
    expect(composerKeyAction(key('ArrowUp'), state({ hasQueued: true }))).toEqual({
      kind: 'none'
    })
  })

  it('Maj+Tab : mode suivant quand il y en a un à choisir', () => {
    expect(composerKeyAction(key('Tab', { shift: true }), state({ canCycleMode: true }))).toEqual({
      kind: 'next-mode'
    })
    expect(composerKeyAction(key('Tab', { shift: true }), state())).toEqual({ kind: 'none' })
  })
})

describe('mode suivant (Maj+Tab)', () => {
  it('option suivante, en boucle', () => {
    const options = [{ value: 'code' }, { value: 'ask' }, { value: 'plan' }]
    expect(nextOption({ currentValue: 'code', options })).toBe('ask')
    expect(nextOption({ currentValue: 'plan', options })).toBe('code')
    expect(nextOption({ currentValue: 'inconnu', options })).toBe('code')
    expect(nextOption({ currentValue: 'code', options: [] })).toBeUndefined()
  })
})
