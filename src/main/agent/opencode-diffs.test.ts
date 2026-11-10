import type { SessionUpdate, ToolCallContent } from '../../shared/acp-sdk.mts'
import { createTwoFilesPatch } from 'diff'
import { describe, expect, it } from 'vitest'
import { computeDiff } from '@shared/diff'
import { diffsFromPatch, filesOf, withCreatedFile, withPatchDiffs } from './opencode-diffs'
import type { ToolCallSoFar } from './tool-call-memory'

const CWD = '/projet'
const BEFORE = 'un\ndeux\ntrois\nquatre\ncinq\nsix\nsept\nhuit\nneuf\ndix\nonze\ndouze\n'
const AFTER = 'un\nDEUX\ntrois\nquatre\ncinq\nsix\nsept\nhuit\nneuf\ndix\nonze\ndouze\ntreize\n'

/** Patch au format d'OpenCode 2.0.32 (`createTwoFilesPatch`, en-tête `Index:` absolu). */
const patchOf = (path: string, before: string, after: string) =>
  createTwoFilesPatch(path, path, before, after)

/** `tool_call_update` terminé d'un « patch » rejoué, tel qu'OpenCode 2.0.32 l'envoie. */
function replayed(content: ToolCallContent[], files: unknown[]): SessionUpdate {
  return {
    sessionUpdate: 'tool_call_update',
    toolCallId: 'call_patch',
    status: 'completed',
    content,
    rawOutput: { metadata: { files } }
  }
}

const TEXT: ToolCallContent = {
  type: 'content',
  content: { type: 'text', text: 'Success. Updated the following files:\nM src/a.js\nA notes.md' }
}

const diffsIn = (update: SessionUpdate) =>
  'content' in update && Array.isArray(update.content)
    ? update.content.flatMap((c) => (c.type === 'diff' ? [c] : []))
    : []

describe('diffs d’OpenCode retrouvés au rejeu (fiche 096)', () => {
  it('un diff par bloc du patch, chemin résolu dans le dossier de la session', () => {
    const update = replayed(
      [TEXT],
      [
        {
          file: 'src/a.js',
          patch: patchOf('/projet/src/a.js', BEFORE, AFTER),
          additions: 2,
          deletions: 1,
          status: 'modified'
        }
      ]
    )
    const diffs = diffsIn(withPatchDiffs(update, CWD))
    expect(diffs).toEqual([
      {
        type: 'diff',
        path: '/projet/src/a.js',
        oldText: 'un\ndeux\ntrois\nquatre\ncinq\nsix\n',
        newText: 'un\nDEUX\ntrois\nquatre\ncinq\nsix\n'
      },
      {
        type: 'diff',
        path: '/projet/src/a.js',
        oldText: 'neuf\ndix\nonze\ndouze\n',
        newText: 'neuf\ndix\nonze\ndouze\ntreize\n'
      }
    ])
    // Mêmes totaux que ceux d'OpenCode (`additions`, `deletions`).
    const totals = diffs.reduce(
      (sum, d) => {
        const diff = computeDiff(d.oldText, d.newText, 0)
        return { added: sum.added + diff.added, removed: sum.removed + diff.removed }
      },
      { added: 0, removed: 0 }
    )
    expect(totals).toEqual({ added: 2, removed: 1 })
    // Le texte de l'outil reste en tête.
    expect((withPatchDiffs(update, CWD) as { content: ToolCallContent[] }).content[0]).toBe(TEXT)
  })

  it('fichier créé : oldText nul, sans saut de ligne final s’il n’y en avait pas', () => {
    const diffs = diffsFromPatch('/projet/notes.md', {
      file: 'notes.md',
      patch: patchOf('/projet/notes.md', '', 'a\nb'),
      status: 'added'
    })
    expect(diffs).toEqual([
      { type: 'diff', path: '/projet/notes.md', oldText: null, newText: 'a\nb' }
    ])
  })

  it('fichier supprimé : tout en retrait', () => {
    const diffs = diffsFromPatch('/projet/vieux.txt', {
      file: 'vieux.txt',
      patch: patchOf('/projet/vieux.txt', 'x\ny\n', ''),
      status: 'deleted'
    })
    expect(diffs).toEqual([
      { type: 'diff', path: '/projet/vieux.txt', oldText: 'x\ny\n', newText: '' }
    ])
  })

  it('seuls les fichiers sans diff sont complétés (OpenCode garde celui d’un fichier créé)', () => {
    const kept: ToolCallContent = {
      type: 'diff',
      path: '/projet/notes.md',
      oldText: null,
      newText: 'contenu actuel\n'
    }
    const update = replayed(
      [TEXT, kept],
      [
        {
          file: 'notes.md',
          patch: patchOf('/projet/notes.md', '', 'contenu\n'),
          status: 'added'
        },
        { file: '/projet/src/a.js', patch: patchOf('/projet/src/a.js', BEFORE, AFTER) }
      ]
    )
    const paths = diffsIn(withPatchDiffs(update, CWD)).map((d) => d.path)
    expect(paths).toEqual(['/projet/notes.md', '/projet/src/a.js', '/projet/src/a.js'])
  })

  it('rien à faire : en direct (diffs joints), outil en cours, sans contenu, sortie inconnue', () => {
    const files = [{ file: 'src/a.js', patch: patchOf('/projet/src/a.js', BEFORE, AFTER) }]
    const live = replayed(
      [TEXT, { type: 'diff', path: '/projet/src/a.js', oldText: BEFORE, newText: AFTER }],
      files
    )
    expect(withPatchDiffs(live, CWD)).toBe(live)
    const running = { ...replayed([TEXT], files), status: 'in_progress' as const }
    expect(withPatchDiffs(running, CWD)).toBe(running)
    const { content: _content, ...withoutContent } = replayed([TEXT], files) as {
      content: unknown
    } & SessionUpdate
    expect(withPatchDiffs(withoutContent as SessionUpdate, CWD)).toBe(withoutContent)
    const other: SessionUpdate = {
      sessionUpdate: 'tool_call_update',
      toolCallId: 'call_shell',
      status: 'completed',
      content: [TEXT],
      rawOutput: { metadata: { exit: 0 } }
    }
    expect(withPatchDiffs(other, CWD)).toBe(other)
    const chunk: SessionUpdate = {
      sessionUpdate: 'agent_message_chunk',
      content: { type: 'text', text: 'x' }
    }
    expect(withPatchDiffs(chunk, CWD)).toBe(chunk)
  })

  it('entrées mal formées ou patch illisible : écartées sans erreur', () => {
    expect(filesOf(undefined)).toEqual([])
    expect(filesOf({ metadata: { files: 'x' } })).toEqual([])
    expect(
      filesOf({
        metadata: { files: [null, { file: 'a' }, { file: 'b', patch: 'p', status: '?' }] }
      })
    ).toEqual([{ file: 'b', patch: 'p' }])
    expect(diffsFromPatch('/projet/a', { file: 'a', patch: '@@ n’importe quoi' })).toEqual([])
  })
})

describe('fichier créé par write (fiche 202)', () => {
  /** Fin d'un `write`, telle qu'OpenCode 2.2.5 l'envoie : un texte, ni diff ni `metadata.files`. */
  const done = (text: string, extra: Record<string, unknown> = {}): SessionUpdate =>
    ({
      sessionUpdate: 'tool_call_update',
      toolCallId: 'call_write',
      status: 'completed',
      locations: [{ path: '/projet/nouveau.txt' }],
      content: [{ type: 'content', content: { type: 'text', text } }],
      rawOutput: { metadata: { truncated: false } },
      ...extra
    }) as SessionUpdate
  const soFar: ToolCallSoFar = {
    title: 'write',
    kind: 'edit',
    rawInput: { path: '/projet/nouveau.txt', content: 'bonjour\n' },
    permissionDiffs: [],
    checkedPaths: new Set(),
    absentPaths: new Set()
  }
  const CREATED = 'Created file successfully: nouveau.txt'

  it('« Created file successfully » : tout en ajout, depuis l’entrée de l’outil', () => {
    const diffs = diffsIn(withCreatedFile(done(CREATED), CWD, soFar))
    expect(diffs).toEqual([
      { type: 'diff', path: '/projet/nouveau.txt', oldText: null, newText: 'bonjour\n' }
    ])
    // Rouvert (`session/load`) : chemin relatif dans l'entrée, résolu dans le dossier.
    const relative = { ...soFar, rawInput: { path: 'nouveau.txt', content: 'bonjour\n' } }
    expect(diffsIn(withCreatedFile(done(CREATED), CWD, relative))).toEqual(diffs)
    // Tout dans la même mise à jour, sans rien avant : pareil.
    const alone = done(CREATED, { title: 'write', kind: 'edit', rawInput: soFar.rawInput })
    expect(diffsIn(withCreatedFile(alone, CWD))).toEqual(diffs)
    // Fin qui renvoie une entrée vide : celle d'avant compte.
    expect(diffsIn(withCreatedFile(done(CREATED, { rawInput: {} }), CWD, soFar))).toEqual(diffs)
    // Outil d'un sous-agent d'OpenCode 2 : « <description> : write ».
    const child = { ...soFar, title: 'Explorer le code: write' }
    expect(diffsIn(withCreatedFile(done(CREATED), CWD, child))).toEqual(diffs)
    expect(withCreatedFile(done(CREATED), CWD, { ...soFar, title: 'rewrite' })).toEqual(
      done(CREATED)
    )
  })

  it('rien : fichier réécrit, diff déjà là, autre outil, entrée inconnue, pas fini', () => {
    const rewritten = done('Wrote file successfully: nouveau.txt')
    expect(withCreatedFile(rewritten, CWD, soFar)).toBe(rewritten)
    const withDiff = done(CREATED, {
      content: [
        { type: 'content', content: { type: 'text', text: CREATED } },
        { type: 'diff', path: '/projet/nouveau.txt', oldText: null, newText: 'bonjour\n' }
      ]
    })
    expect(withCreatedFile(withDiff, CWD, soFar)).toBe(withDiff)
    const created = done(CREATED)
    expect(withCreatedFile(created, CWD, { ...soFar, title: 'edit' })).toBe(created)
    expect(withCreatedFile(created, CWD, { ...soFar, kind: 'other' })).toBe(created)
    expect(withCreatedFile(created, CWD, { ...soFar, rawInput: { path: 'a' } })).toBe(created)
    expect(withCreatedFile(created, CWD)).toBe(created)
    const running = done(CREATED, { status: 'in_progress' })
    expect(withCreatedFile(running, CWD, soFar)).toBe(running)
    const { content: _content, ...bare } = created as { content: unknown } & SessionUpdate
    expect(withCreatedFile(bare as SessionUpdate, CWD, soFar)).toBe(bare)
  })
})
