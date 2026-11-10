import type { SessionUpdate, ToolCallContent } from '../../shared/acp-sdk.mts'
import { describe, expect, it } from 'vitest'
import { ProfileUpdates } from './profile-updates'
import { ToolCallMemory, withPermissionDiffs } from './tool-call-memory'

const DIFF: ToolCallContent = {
  type: 'diff',
  path: '/projet/autre.md',
  oldText: 'ancien contenu\n',
  newText: 'remplacé'
}
const TEXT: ToolCallContent = {
  type: 'content',
  content: { type: 'text', text: 'Wrote file successfully: autre.md' }
}

const update = (fields: Record<string, unknown>): SessionUpdate =>
  ({ sessionUpdate: 'tool_call_update', toolCallId: 't1', ...fields }) as SessionUpdate

const diffsIn = (u: SessionUpdate) =>
  'content' in u && Array.isArray(u.content) ? u.content.filter((c) => c.type === 'diff') : []

describe('mémoire des appels d’outil (fiche 202)', () => {
  it('garde le dernier titre, genre et entrée non vide ; oublie à la demande', () => {
    const memory = new ToolCallMemory()
    memory.note({
      sessionUpdate: 'tool_call',
      toolCallId: 't1',
      title: 'write',
      kind: 'edit',
      rawInput: {}
    })
    const input = { path: 'a', content: 'x' }
    memory.note(update({ status: 'in_progress', rawInput: input }))
    const soFar = memory.note(update({ status: 'completed', rawInput: {} }))
    expect(soFar).toEqual({
      title: 'write',
      kind: 'edit',
      rawInput: input,
      permissionDiffs: [],
      checkedPaths: new Set(),
      absentPaths: new Set()
    })
    memory.forget('t1')
    expect(memory.note(update({}))).toEqual({
      permissionDiffs: [],
      checkedPaths: new Set(),
      absentPaths: new Set()
    })
    expect(memory.note({ sessionUpdate: 'plan', entries: [] })).toBeUndefined()
  })

  it('reste bornée : les appels jamais finis les plus anciens sortent', () => {
    const memory = new ToolCallMemory()
    for (let i = 0; i < 600; i++) memory.note(update({ toolCallId: `t${i}`, title: `n${i}` }))
    expect(memory.note(update({ toolCallId: 't0' }))?.title).toBeUndefined()
    expect(memory.note(update({ toolCallId: 't599' }))?.title).toBe('n599')
  })

  it('le diff de la demande d’autorisation complète une fin qui ne le porte pas', () => {
    const soFar = {
      permissionDiffs: [DIFF as Extract<ToolCallContent, { type: 'diff' }>],
      checkedPaths: new Set<string>(),
      absentPaths: new Set<string>()
    }
    const done = update({ status: 'completed', content: [TEXT] })
    expect(diffsIn(withPermissionDiffs(done, soFar))).toEqual([DIFF])
    // Diff déjà là (même chemin), outil pas fini, en échec, ou fin sans contenu : rien.
    const withDiff = update({ status: 'completed', content: [TEXT, { ...DIFF, newText: 'x' }] })
    expect(withPermissionDiffs(withDiff, soFar)).toBe(withDiff)
    for (const status of ['in_progress', 'failed']) {
      const other = update({ status, content: [TEXT] })
      expect(withPermissionDiffs(other, soFar)).toBe(other)
    }
    const bare = update({ status: 'completed' })
    expect(withPermissionDiffs(bare, soFar)).toBe(bare)
    expect(
      withPermissionDiffs(done, {
        permissionDiffs: [],
        checkedPaths: new Set(),
        absentPaths: new Set()
      })
    ).toBe(done)
  })
})

describe('ProfileUpdates : diffs des demandes d’autorisation, pour tout agent (fiche 202)', () => {
  it('accordée puis terminée sans diff : le diff accordé reste', () => {
    const updates = new ProfileUpdates({}, '/projet')
    updates.adapt({ sessionUpdate: 'tool_call', toolCallId: 't1', title: 'write', kind: 'edit' })
    updates.permission({ toolCallId: 't1', content: [DIFF] })
    const done = updates.adapt(update({ status: 'completed', content: [TEXT] }))
    expect(diffsIn(done)).toEqual([DIFF])
  })

  it('refusée (en échec) : rien ; un autre appel ensuite ne reprend pas ce diff', () => {
    const updates = new ProfileUpdates({}, '/projet')
    updates.permission({ toolCallId: 't1', content: [DIFF] })
    const failed = updates.adapt(update({ status: 'failed', content: [TEXT] }))
    expect(diffsIn(failed)).toEqual([])
    // Même identifiant réutilisé après la fin : la mémoire a été vidée.
    const later = updates.adapt(update({ status: 'completed', content: [TEXT] }))
    expect(diffsIn(later)).toEqual([])
  })

  it('sans demande d’autorisation : la fin reste telle quelle', () => {
    const updates = new ProfileUpdates({}, '/projet')
    const done = update({ status: 'completed', content: [TEXT] })
    expect(updates.adapt(done)).toBe(done)
  })
})
