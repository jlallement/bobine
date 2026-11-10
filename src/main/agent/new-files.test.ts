import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { SessionUpdate, ToolCallContent, ToolCallUpdate } from '../../shared/acp-sdk.mts'
import { existsOnDisk } from './new-files'
import { ProfileUpdates } from './profile-updates'

/** Diff de Bob 2.0.9 pour un fichier qu'il écrit : `oldText: ""`, neuf ou vide. */
const diff = (path: string): ToolCallContent => ({
  type: 'diff',
  path,
  oldText: '',
  newText: 'bonjour'
})
const oldTexts = (content: readonly ToolCallContent[] | null | undefined) =>
  (content ?? []).flatMap((c) => (c.type === 'diff' ? [c.oldText] : []))
const contentOf = (u: SessionUpdate) =>
  u.sessionUpdate === 'tool_call' || u.sessionUpdate === 'tool_call_update' ? u.content : undefined

/** Le disque vu par l'adaptation : les chemins regardés, et ceux qui existent. */
function disk(existing: string[] = []) {
  const asked: string[] = []
  return {
    asked,
    exists: (path: string) => {
      asked.push(path)
      return existing.includes(path)
    }
  }
}

const proposed = (fields: Partial<ToolCallUpdate> = {}): SessionUpdate =>
  ({
    sessionUpdate: 'tool_call',
    toolCallId: 't1',
    title: 'Writing file /p/notes/a.txt',
    kind: 'edit',
    status: 'pending',
    locations: [{ path: '/p/notes/a.txt' }],
    ...fields
  }) as SessionUpdate
const asked = (fields: Partial<ToolCallUpdate> = {}): ToolCallUpdate => ({
  toolCallId: 't1',
  kind: 'edit',
  status: 'pending',
  content: [diff('/p/notes/a.txt')],
  ...fields
})
const done = (): SessionUpdate => ({
  sessionUpdate: 'tool_call_update',
  toolCallId: 't1',
  status: 'completed',
  content: [diff('/p/notes/a.txt')]
})

describe('fichiers nouveaux d’après le disque (fiche 203, Bob 2.0.9)', () => {
  it('absent quand il est proposé : création, à la demande comme à la fin, regardé une fois', () => {
    const d = disk()
    const updates = new ProfileUpdates({}, '/p', d.exists)
    updates.adapt(proposed())
    expect(oldTexts(updates.permission(asked()).content)).toEqual([null])
    // Écrit depuis : le disque n'est plus regardé, le constat d'avant tient.
    expect(oldTexts(contentOf(updates.adapt(done())))).toEqual([null])
    expect(d.asked).toEqual(['/p/notes/a.txt'])
  })

  it('demande d’autorisation sans tool_call d’abord : regardé à la demande', () => {
    const updates = new ProfileUpdates({}, '/p', disk().exists)
    expect(oldTexts(updates.permission(asked()).content)).toEqual([null])
  })

  it('fichier vide existant : oldText "" gardé (modification)', () => {
    const updates = new ProfileUpdates({}, '/p', disk(['/p/notes/a.txt']).exists)
    updates.adapt(proposed())
    expect(oldTexts(updates.permission(asked()).content)).toEqual([''])
    expect(oldTexts(contentOf(updates.adapt(done())))).toEqual([''])
  })

  it('un vrai ancien texte n’est jamais touché', () => {
    const updates = new ProfileUpdates({}, '/p', disk().exists)
    const call = asked({
      content: [{ type: 'diff', path: '/p/notes/a.txt', oldText: 'avant', newText: 'après' }]
    })
    expect(oldTexts(updates.permission(call).content)).toEqual(['avant'])
  })

  it('outil déjà lancé, autre genre, chemin relatif, rejeu : le disque n’est pas regardé', () => {
    const d = disk()
    const updates = new ProfileUpdates({}, '/p', d.exists)
    // Vu pour la première fois en cours ou fini : l'agent a pu écrire.
    expect(oldTexts(contentOf(updates.adapt(done())))).toEqual([''])
    updates.adapt(proposed({ toolCallId: 't2', status: 'in_progress' }))
    // Lecture : pas une écriture.
    updates.adapt(proposed({ toolCallId: 't3', kind: 'read' }))
    // Chemin relatif : rien de résolu au hasard.
    updates.adapt(proposed({ toolCallId: 't4', locations: [{ path: 'notes/a.txt' }] }))
    // Rejeu de `session/load` : il parle du passé.
    updates.adapt(proposed({ toolCallId: 't5' }), false)
    expect(d.asked).toEqual([])
  })
})

describe('existsOnDisk', () => {
  let dir: string | undefined
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true })
  })

  it('fichier, dossier, lien cassé : existent ; absent : non', () => {
    dir = mkdtempSync(join(tmpdir(), 'bobine-nouveaux-'))
    writeFileSync(join(dir, 'vide.txt'), '')
    mkdirSync(join(dir, 'sous'))
    symlinkSync(join(dir, 'nulle-part'), join(dir, 'lien'))
    expect(existsOnDisk(join(dir, 'vide.txt'))).toBe(true)
    expect(existsOnDisk(join(dir, 'sous'))).toBe(true)
    expect(existsOnDisk(join(dir, 'lien'))).toBe(true)
    expect(existsOnDisk(join(dir, 'absent.txt'))).toBe(false)
  })
})
