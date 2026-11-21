import { describe, expect, it } from 'vitest'
import type { TranscriptItem } from '@shared/transcript'
import { relayOf } from './work-card'

type Report = Extract<TranscriptItem, { kind: 'child-report' }>

const report = { kind: 'child-report', id: 2, childId: 'a' } as unknown as Report
const user = (id: number, extra: Partial<Extract<TranscriptItem, { kind: 'user' }>> = {}) =>
  ({ kind: 'user', id, text: 'x', at: id * 1000, ...extra }) as TranscriptItem
const answer = (id: number) => ({ kind: 'agent', id, text: 'ok' }) as TranscriptItem

describe('transmission d’une réponse de travail (fiche 272)', () => {
  it('une compaction ne la transmet pas : elle attend le prochain vrai message', () => {
    const items = [user(1), report, user(3, { text: '/compact', compaction: true }), answer(4)]
    expect(relayOf(report, items)).toEqual({ sent: false })
    expect(relayOf(report, [...items, user(5), answer(6)])).toEqual({ sent: true, at: 5000 })
  })
})
