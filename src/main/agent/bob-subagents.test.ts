import { describe, expect, it } from 'vitest'
import { bobSubagentOf as subagentOf } from './bob-subagents'

describe('sous-agents de Bob (fiches 010, 140)', () => {
  it('Bob 2.0.6 : « Running subagent: … », type dans rawInput.name', () => {
    expect(
      subagentOf('Running subagent: Read notes.txt and summarize it.', {
        description: 'Read notes.txt and summarize it.',
        name: 'explore'
      })
    ).toEqual({ type: 'explore', task: 'Read notes.txt and summarize it.' })
    // Sans rawInput (demande d'autorisation seule) : la consigne vient du titre.
    expect(subagentOf('Running subagent: Lire notes.txt', undefined)).toEqual({
      task: 'Lire notes.txt'
    })
  })

  it('autres outils, et formes d’OpenCode : pas un sous-agent de Bob', () => {
    expect(subagentOf('Reading notes.txt', { path: 'notes.txt' })).toBeUndefined()
    expect(subagentOf(undefined, null)).toBeUndefined()
    expect(
      subagentOf('subagent', { agent: 'explore', description: 'Lire', prompt: 'Lis' })
    ).toBeUndefined()
  })
})
