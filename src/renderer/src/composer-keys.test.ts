import { describe, expect, it } from 'vitest'
import {
  composerKeyAction,
  nextOption,
  type ComposerHistoryState,
  type ComposerKeyState
} from './composer-keys'

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

describe('historique de la saisie (fiche 225)', () => {
  const history = (change: Partial<ComposerHistoryState> = {}): ComposerHistoryState => ({
    count: 10,
    index: undefined,
    blank: true,
    firstLine: true,
    lastLine: true,
    ...change
  })
  const at = (h: Partial<ComposerHistoryState>, change: Partial<ComposerKeyState> = {}) =>
    state({ history: history(h), ...change })
  const up = key('ArrowUp')
  const down = key('ArrowDown')

  it('↑ dans une saisie vide : le dernier envoyé (10/10) ; historique vide ou saisie pleine : rien', () => {
    expect(composerKeyAction(up, at({}))).toEqual({ kind: 'history-move', index: 9, from: 'up' })
    expect(composerKeyAction(up, at({ count: 0 }))).toEqual({ kind: 'none' })
    expect(composerKeyAction(up, at({ blank: false }))).toEqual({ kind: 'none' })
    // ↓ n'entre jamais dans l'historique.
    expect(composerKeyAction(down, at({}))).toEqual({ kind: 'none' })
    // Sans historique (saisie rapide) : rien.
    expect(composerKeyAction(up, state({ empty: true }))).toEqual({ kind: 'none' })
  })

  it('priorités : composition IME, menus ouverts, message en attente, puis l’historique', () => {
    expect(composerKeyAction(key('ArrowUp', { composing: true }), at({}))).toEqual({
      kind: 'none'
    })
    const menu = { open: true, count: 3, active: 0 }
    expect(composerKeyAction(up, at({}, { mentions: menu }))).toEqual({
      kind: 'mention-move',
      index: 2
    })
    expect(composerKeyAction(up, at({}, { commands: menu }))).toEqual({
      kind: 'command-move',
      index: 2
    })
    expect(composerKeyAction(up, at({}, { empty: true, hasQueued: true }))).toEqual({
      kind: 'edit-last-queued'
    })
    // ⌘↑, ⌥↑, Maj+↑ : jamais l'historique (sélection, début du texte).
    for (const k of [{ ...up, modified: true }, key('ArrowUp', { shift: true })]) {
      expect(composerKeyAction(k, at({ index: 4 }))).toEqual({ kind: 'none' })
    }
  })

  it('↑ sur 1/10 ne fait rien ; ↓ sur 10/10 rend la saisie vide', () => {
    expect(composerKeyAction(up, at({ index: 0, blank: false }))).toEqual({ kind: 'prevent' })
    expect(composerKeyAction(down, at({ index: 9, blank: false }))).toEqual({
      kind: 'history-exit'
    })
    expect(composerKeyAction(down, at({ index: 3, blank: false }))).toEqual({
      kind: 'history-move',
      index: 4,
      from: 'down'
    })
  })

  it('lignes d’abord : hors de la première (↑) ou de la dernière ligne (↓), le curseur bouge', () => {
    const middle = { index: 4, blank: false, firstLine: false, lastLine: false }
    expect(composerKeyAction(up, at(middle))).toEqual({ kind: 'none' })
    expect(composerKeyAction(down, at(middle))).toEqual({ kind: 'none' })
    // Première ligne : ↑ change de message, ↓ descend d'une ligne.
    const first = { ...middle, firstLine: true }
    expect(composerKeyAction(up, at(first))).toEqual({
      kind: 'history-move',
      index: 3,
      from: 'up'
    })
    expect(composerKeyAction(down, at(first))).toEqual({ kind: 'none' })
    const last = { ...middle, lastLine: true }
    expect(composerKeyAction(up, at(last))).toEqual({ kind: 'none' })
    expect(composerKeyAction(down, at(last))).toEqual({
      kind: 'history-move',
      index: 5,
      from: 'down'
    })
  })

  it('message modifié (plus d’index) : les flèches ne changent plus de message, même en ligne 1', () => {
    const draft = { index: undefined, blank: false }
    expect(composerKeyAction(up, at(draft))).toEqual({ kind: 'none' })
    expect(composerKeyAction(down, at(draft))).toEqual({ kind: 'none' })
    expect(composerKeyAction(key('Escape'), at(draft))).toEqual({ kind: 'none' })
  })

  it('Échap quitte l’historique avant d’arrêter la réponse ; le second arrête', () => {
    expect(
      composerKeyAction(key('Escape'), at({ index: 8, blank: false }, { busy: true }))
    ).toEqual({ kind: 'history-exit' })
    expect(composerKeyAction(key('Escape'), at({}, { busy: true }))).toEqual({ kind: 'cancel' })
    // Un menu ouvert se referme d'abord.
    const menu = { open: true, count: 1, active: 0 }
    expect(composerKeyAction(key('Escape'), at({ index: 8 }, { commands: menu }))).toEqual({
      kind: 'command-dismiss'
    })
  })
})
