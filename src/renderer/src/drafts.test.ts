import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PromptAttachment } from '@shared/attachments'
import { flushDraftsForTests, loadDraft, MAX_STORED_DRAFTS_CHARS, saveDraft } from './drafts'

const KEY = 'bob:brouillons'
const file: PromptAttachment = { kind: 'file', path: '/projet/a.ts' }
const pasted: PromptAttachment = { kind: 'text', name: 'Texte collé', text: 'a\nb' }
const image = (size: number): PromptAttachment => ({
  kind: 'image',
  name: 'capture.png',
  mimeType: 'image/png',
  data: 'A'.repeat(size)
})

describe('brouillons (fiches 026, 155)', () => {
  beforeEach(() => {
    localStorage.clear()
    flushDraftsForTests()
  })
  afterEach(() => vi.restoreAllMocks())

  it('relit l’ancien format (texte seul)', () => {
    localStorage.setItem(KEY, JSON.stringify({ c1: 'à finir' }))
    flushDraftsForTests()
    expect(loadDraft('c1')).toEqual({ text: 'à finir', attachments: [] })
    expect(loadDraft('c2')).toEqual({ text: '', attachments: [] })
  })

  it('garde texte et pièces jointes, en mémoire puis après un redémarrage', () => {
    const attachments = [
      file,
      pasted,
      { kind: 'context', source: 'git-changes' } as const,
      image(8)
    ]
    saveDraft('c1', { text: '', attachments })
    expect(loadDraft('c1').attachments).toBe(attachments)
    flushDraftsForTests()
    expect(loadDraft('c1')).toEqual({ text: '', attachments })
  })

  it('brouillon vidé (message envoyé) : effacé', () => {
    saveDraft('c1', { text: 'x', attachments: [file] })
    saveDraft('c1', { text: ' ', attachments: [] })
    flushDraftsForTests()
    expect(JSON.parse(localStorage.getItem(KEY) ?? '{}')).toEqual({})
  })

  it('message envoyé puis app quittée aussitôt : le brouillon ne revient pas (fiche 243)', () => {
    vi.useFakeTimers()
    try {
      saveDraft('c1', { text: '/scenario attend-stop', attachments: [] })
      vi.advanceTimersByTime(300)
      expect(JSON.parse(localStorage.getItem(KEY) ?? '{}')).toHaveProperty('c1')
      // Envoyé : vidé, et l'app quitte avant le délai d'écriture (aucun minuteur ne passe).
      saveDraft('c1', { text: '', attachments: [] })
      expect(JSON.parse(localStorage.getItem(KEY) ?? '{}')).not.toHaveProperty('c1')
    } finally {
      vi.useRealTimers()
    }
  })

  it('page qui s’en va (fenêtre fermée, app quittée) : la saisie en cours est écrite', () => {
    vi.useFakeTimers()
    try {
      saveDraft('c1', { text: 'à finir', attachments: [] })
      window.dispatchEvent(new Event('pagehide'))
      expect(JSON.parse(localStorage.getItem(KEY) ?? '{}')).toHaveProperty('c1')
    } finally {
      vi.useRealTimers()
    }
  })

  it('images trop lourdes pour le stockage : écrites sans elles, gardées en mémoire', () => {
    const big = image(MAX_STORED_DRAFTS_CHARS)
    saveDraft('c1', { text: 'voir', attachments: [file, big] })
    expect(loadDraft('c1').attachments).toHaveLength(2)
    flushDraftsForTests()
    expect(loadDraft('c1')).toEqual({ text: 'voir', attachments: [file] })
  })

  it('stockage plein : sans les images, puis sans les textes collés, puis en mémoire seulement', () => {
    const calls: string[] = []
    const real = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      key: string,
      value: string
    ) {
      calls.push(value)
      if (value.includes('"image"')) throw new DOMException('plein', 'QuotaExceededError')
      real.call(this, key, value)
    })
    saveDraft('c1', { text: 't', attachments: [file, pasted, image(8)] })
    flushDraftsForTests()
    expect(calls).toHaveLength(2)
    expect(loadDraft('c1')).toEqual({ text: 't', attachments: [file, pasted] })

    vi.restoreAllMocks()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('plein', 'QuotaExceededError')
    })
    saveDraft('c2', { text: 'mémoire', attachments: [] })
    expect(() => flushDraftsForTests()).not.toThrow()
    // Rien d'écrit : l'ancien contenu reste lisible.
    expect(loadDraft('c1').text).toBe('t')
  })
})
