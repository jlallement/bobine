import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { AgentEvent } from '@shared/agent'
import { emptyTranscript, reduceTranscript, type TranscriptState } from '@shared/transcript'
import { branchTitle, prepareBranch, previewBranch, revertChange } from './branching'

const end: AgentEvent = { type: 'turn-end', stopReason: 'end_turn' }
const reply = (text: string): AgentEvent => ({
  type: 'update',
  update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text } }
})
const edit = (id: string, path: string, oldText: string | null, newText: string): AgentEvent => ({
  type: 'update',
  update: {
    sessionUpdate: 'tool_call',
    toolCallId: id,
    title: `Écrire ${path}`,
    kind: 'edit',
    status: 'completed',
    content: [{ type: 'diff', path, oldText, newText }]
  }
})
const command: AgentEvent = {
  type: 'update',
  update: {
    sessionUpdate: 'tool_call',
    toolCallId: 'x1',
    title: 'npm test',
    kind: 'execute',
    status: 'completed'
  }
}
const build = (...events: AgentEvent[]): TranscriptState =>
  events.reduce(reduceTranscript, emptyTranscript)

/** Un dossier où l'agent a modifié `a.txt` et créé `b.txt` après le deuxième message. */
function scene() {
  const root = mkdtempSync(join(tmpdir(), 'branche-'))
  const a = join(root, 'a.txt')
  const b = join(root, 'b.txt')
  writeFileSync(a, 'après')
  writeFileSync(b, 'nouveau')
  const transcript = build(
    { type: 'user-message', text: 'Bonjour' },
    reply('Bonjour !'),
    end,
    {
      type: 'user-message',
      text: 'Modifie',
      attachments: [{ kind: 'file', name: 'notes.md', path: join(root, 'notes.md') }]
    },
    edit('e1', a, 'avant', 'après'),
    edit('e2', b, null, 'nouveau'),
    command,
    end
  )
  const second = transcript.items.filter((i) => i.kind === 'user')[1]?.id ?? -1
  return { root, a, b, transcript, second }
}

describe('branche et annulation (fiche 089, logique des fiches 023 et 021)', () => {
  it('aperçu : fichiers à remettre et commandes lancées depuis le message', async () => {
    const { root, a, b, transcript, second } = scene()
    const preview = await previewBranch(transcript.items, second, root)
    expect(preview).toEqual({
      files: [
        { path: a, status: 'restore', created: false },
        { path: b, status: 'restore', created: true }
      ],
      commands: 1
    })
    await expect(previewBranch(transcript.items, 999, root)).rejects.toThrow()
  })

  it('branche préparée : fil repris et marqué, pièces jointes, contexte, titre ; fichiers remis', async () => {
    const { root, a, b, transcript, second } = scene()
    const source = { id: 'c1', title: 'Migration', workspace: root, transcript }
    const prepared = await prepareBranch(source, second, '  Modifie autrement  ', {
      restoreFiles: true
    })
    expect(prepared.text).toBe('Modifie autrement')
    expect(prepared.attachments).toEqual([{ kind: 'file', path: join(root, 'notes.md') }])
    expect(prepared.transcript.items.map((i) => i.kind)).toEqual(['user', 'agent', 'branch'])
    expect(prepared.transcript.items.at(-1)).toMatchObject({
      kind: 'branch',
      fromId: 'c1',
      fromTitle: 'Migration',
      restored: 2,
      skipped: 0
    })
    expect(prepared.transcript.nextId).toBe(transcript.nextId + 1)
    expect(prepared.context).toContain('User: Bonjour')
    expect(prepared.title).toBe('Migration · branche')
    expect(readFileSync(a, 'utf8')).toBe('avant')
    expect(existsSync(b)).toBe(false)
  })

  it('branche sans remettre les fichiers ; message vide refusé', async () => {
    const { root, a, transcript, second } = scene()
    const first = transcript.items[0]?.id ?? -1
    const source = { id: 'c1', title: 'Migration', workspace: root, transcript }
    const prepared = await prepareBranch(source, second, 'Encore')
    expect(prepared.transcript.items.at(-1)).toMatchObject({ restored: 0, skipped: 0 })
    expect(readFileSync(a, 'utf8')).toBe('après')
    await expect(prepareBranch(source, first, '   ')).rejects.toThrow()
    await expect(prepareBranch(source, 999, 'x')).rejects.toThrow()
  })

  it('titre : la marque ne s’accumule pas de branche en branche', () => {
    expect(branchTitle('Migration · branche')).toBe('Migration · branche')
    expect(branchTitle('Migration · branche 2')).toBe('Migration · branche')
  })

  it('annuler : fichier remis, créé supprimé, modifié depuis laissé ; avis dans chaque cas', async () => {
    const { root, a, b, transcript } = scene()
    expect(await revertChange(transcript.items, a, root)).toEqual({
      outcome: 'restored',
      notice: {
        level: 'info',
        message: { key: 'conversations.notice.reverted', params: { file: 'a.txt' } }
      }
    })
    expect(readFileSync(a, 'utf8')).toBe('avant')
    writeFileSync(b, 'modifié à la main')
    const conflict = await revertChange(transcript.items, b, root)
    expect(conflict.outcome).toBe('conflict')
    expect(conflict.notice.level).toBe('warning')
    expect(readFileSync(b, 'utf8')).toBe('modifié à la main')
    const again = await revertChange(transcript.items, a, root)
    expect(again).toMatchObject({ outcome: 'unchanged', notice: { level: 'info' } })
    await expect(revertChange(transcript.items, join(root, 'autre.txt'), root)).rejects.toThrow()
  })
})
