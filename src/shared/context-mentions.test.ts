import { describe, expect, it } from 'vitest'
import { parseAttachments } from './attachments'
import { matchContextMentions } from './context-mentions'

describe('mentions de contexte (fiche 057)', () => {
  it('proposées selon ce qui est tapé après @', () => {
    expect(matchContextMentions('').map((m) => m.name)).toEqual(['git-changes', 'terminal'])
    expect(matchContextMentions('git').map((m) => m.name)).toEqual(['git-changes'])
    expect(matchContextMentions('Term').map((m) => m.name)).toEqual(['terminal'])
    expect(matchContextMentions('modif').map((m) => m.name)).toEqual(['git-changes'])
    expect(matchContextMentions('src/')).toEqual([])
  })

  it('pièce jointe de contexte : seulement une source connue', () => {
    expect(parseAttachments([{ kind: 'context', source: 'terminal' }])).toEqual([
      { kind: 'context', source: 'terminal' }
    ])
    expect(() => parseAttachments([{ kind: 'context', source: 'secrets' }])).toThrow('inconnue')
    expect(() => parseAttachments([{ kind: 'html', text: 'injecté' }])).toThrow('inconnue')
  })
})
