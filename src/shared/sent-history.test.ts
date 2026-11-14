import { describe, expect, it } from 'vitest'
import {
  addSentEntry,
  MAX_SENT_HISTORY,
  MAX_SENT_TEXT,
  parseSentEntry,
  parseSentHistory,
  type SentEntry
} from './sent-history'
import { emptyTranscript, reduceTranscript } from './transcript'

const role = { name: 'security-expert', label: 'Expert sécu' }

describe('historique de la saisie (fiche 225)', () => {
  it('doublons consécutifs fusionnés (le plus récent gagne), pas les doublons séparés', () => {
    let list: SentEntry[] = []
    for (const text of ['continue', 'continue', 'continue']) list = addSentEntry(list, { text })
    expect(list).toEqual([{ text: 'continue' }])
    list = addSentEntry(list, { text: 'autre' })
    list = addSentEntry(list, { text: 'continue', attachments: 2 })
    expect(list.map((e) => e.text)).toEqual(['continue', 'autre', 'continue'])
    // Même texte, rôles différents : deux messages différents.
    list = addSentEntry(list, { text: 'continue', roles: [role] })
    expect(list).toHaveLength(4)
    list = addSentEntry(list, { text: 'continue', roles: [role], attachments: 1 })
    expect(list).toHaveLength(4)
    expect(list.at(-1)).toEqual({ text: 'continue', roles: [role], attachments: 1 })
  })

  it('message vide ignoré ; un jeton seul compte', () => {
    expect(addSentEntry([], { text: '  \n' })).toEqual([])
    expect(addSentEntry([], { text: '', roles: [role] })).toHaveLength(1)
  })

  it('100 entrées au plus : les plus anciennes s’en vont', () => {
    let list: SentEntry[] = []
    for (let i = 0; i < MAX_SENT_HISTORY + 5; i++) list = addSentEntry(list, { text: `m${i}` })
    expect(list).toHaveLength(MAX_SENT_HISTORY)
    expect(list[0]?.text).toBe('m5')
    expect(list.at(-1)?.text).toBe(`m${MAX_SENT_HISTORY + 4}`)
  })

  it('ce qui vient du renderer ou du disque est vérifié', () => {
    expect(parseSentEntry({ text: 'a', roles: [role], attachments: 2 })).toEqual({
      text: 'a',
      roles: [role],
      attachments: 2
    })
    expect(parseSentEntry({ text: 'a', attachments: 0, roles: [] })).toEqual({ text: 'a' })
    expect(parseSentEntry({ text: 'a', roles: [{ name: 'x', label: '' }] })).toEqual({
      text: 'a',
      roles: [{ name: 'x', label: 'x' }]
    })
    for (const bad of [
      null,
      'a',
      { text: 3 },
      { text: 'x'.repeat(MAX_SENT_TEXT + 1) },
      { text: 'a', roles: 'x' },
      { text: 'a', roles: [{ name: '', label: 'x' }] },
      { text: 'a', attachments: 1.5 },
      { text: 'a', attachments: -1 }
    ]) {
      expect(parseSentEntry(bad)).toBeUndefined()
    }
    expect(parseSentHistory([{ text: 'a' }, { text: 1 }, { text: 'b' }])).toEqual([
      { text: 'a' },
      { text: 'b' }
    ])
    expect(parseSentHistory('x')).toEqual([])
  })

  it('dans le fil : ajouté par `sent-recorded`, gardé au rejeu d’une session (`reset`)', () => {
    let state = reduceTranscript(emptyTranscript, {
      type: 'sent-recorded',
      entry: { text: 'Bonjour' }
    })
    state = reduceTranscript(state, { type: 'sent-recorded', entry: { text: 'Suite' } })
    expect(state.items).toEqual([])
    state = reduceTranscript(state, { type: 'reset' })
    expect(state.sentHistory?.map((e) => e.text)).toEqual(['Bonjour', 'Suite'])
    // Fil abîmé sur le disque : l'historique repart, sans planter.
    const damaged = { ...emptyTranscript, sentHistory: 'x' as unknown as SentEntry[] }
    expect(
      reduceTranscript(damaged, { type: 'sent-recorded', entry: { text: 'a' } }).sentHistory
    ).toEqual([{ text: 'a' }])
  })
})
