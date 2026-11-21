import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FileLinkCheck } from '@shared/file-links'
import type { TranscriptItem } from '@shared/transcript'
import { ConversationScope } from './ConversationScope'
import { FileExistsContext, FileLinkBase, FileLinksContext } from './FileLink'
import { FileChecks, filesRevision, MAX_KNOWN } from './file-checks'
import { Markdown } from './Markdown'
import { STREAMING_DELAY_MS } from './useInlineFiles'

// Rendus Markdown comptés : le plugin des codes en ligne tourne une fois par rendu.
const renders = vi.hoisted(() => ({ count: 0 }))
vi.mock('./inline-file-code', async (original) => {
  const actual = await original<typeof import('./inline-file-code')>()
  return {
    ...actual,
    rehypeInlineFileCode: (...args: Parameters<typeof actual.rehypeInlineFileCode>) => {
      renders.count += 1
      return actual.rehypeInlineFileCode(...args)
    }
  }
})

/**
 * Code en ligne vers un fichier qui existe (fiche 272, recette de la rc.3) : jamais un lien vers
 * un fichier absent ; mémoire par conversation ; un « non » revérifié quand des fichiers ont pu
 * changer ; un délai dépassé ne vaut pas « non ».
 */

/** Laisse passer la vérification (minuterie nulle, puis la réponse). */
const settle = () => act(() => new Promise((done) => setTimeout(done, 0)))

const linked = (text: string) =>
  screen.getAllByText(text).map((c) => c.closest('a')?.dataset['testid'] ?? null)

/** Dossiers des conversations : chemins qui existent, par conversation. */
let folders: Record<string, string[]>
let existing: ReturnType<
  typeof vi.fn<(id: string, hrefs: string[], base?: string) => Promise<FileLinkCheck>>
>
const api = window.api

beforeEach(() => {
  folders = {}
  existing = vi.fn((id: string, hrefs: string[]) =>
    Promise.resolve({ existing: hrefs.filter((h) => folders[id]?.includes(h)), unknown: [] })
  )
  window.api = {
    ...api,
    fileLinks: { existing },
    // Éditeur préféré (fiche 156), lu par `ConversationScope` : aucun.
    settings: { get: () => new Promise(() => {}), onChanged: () => () => {} }
  } as unknown as Window['api']
})
afterEach(() => {
  window.api = api
})

/** Le fil d'une conversation, comme l'app le monte (`ConversationScope`, remonté par `key`). */
function Thread({ id, text, items }: { id: string; text: string; items?: TranscriptItem[] }) {
  return (
    <ConversationScope
      key={id}
      conversationId={id}
      openLink={() => {}}
      loadSubagentWork={() => new Promise(() => {})}
      {...(items ? { items } : {})}
    >
      <Markdown text={text} />
    </ConversationScope>
  )
}

describe('code en ligne : lien seulement vers un fichier qui existe (rc.3)', () => {
  it('fichiers à créer, chemin relatif ailleurs : du code ; un seul appel pour tout le fil', async () => {
    folders['A'] = ['liste.js:4']
    const text =
      'Crée `package.json`, puis `tests/liste.test.js` qui importe `../liste.js` ; ' +
      'la fonction est dans `liste.js:4`. Lien : [absent](absent.md).'
    render(
      <ConversationScope conversationId="A" openLink={() => {}} loadSubagentWork={vi.fn()}>
        <Markdown text={text} />
        <Markdown text={'Toujours `liste.js:4`.'} />
      </ConversationScope>
    )
    // Tant qu'on ne sait pas : du code, jamais un lien.
    expect(document.querySelectorAll('[data-testid=file-link] code')).toHaveLength(0)
    await settle()
    expect(existing).toHaveBeenCalledTimes(1)
    expect(existing.mock.calls[0]?.[1]).toEqual([
      'package.json',
      'tests/liste.test.js',
      '../liste.js',
      'liste.js:4'
    ])
    for (const missing of ['package.json', 'tests/liste.test.js', '../liste.js']) {
      expect(linked(missing), missing).toEqual([null])
    }
    expect(linked('liste.js:4')).toEqual(['file-link', 'file-link'])
    // Un vrai lien Markdown ne change pas : toujours un lien, même vers un fichier absent.
    expect(screen.getByText('absent').dataset['testid']).toBe('file-link')
  })

  it('A → B → A, comme l’app (fil remonté) : la mémoire de A est retrouvée, sans clignoter', async () => {
    folders['A'] = ['src/a.js']
    folders['B'] = ['src/b.js']
    const view = render(<Thread id="A" text={'Voir `src/a.js`.'} />)
    await settle()
    expect(linked('src/a.js')).toEqual(['file-link'])
    view.rerender(<Thread id="B" text={'Voir `src/b.js`.'} />)
    await settle()
    view.rerender(<Thread id="A" text={'Voir `src/a.js`.'} />)
    // Avant toute réponse : déjà un lien, et rien de redemandé pour A.
    expect(linked('src/a.js')).toEqual(['file-link'])
    await settle()
    expect(existing.mock.calls.map(([id]) => id)).toEqual(['A', 'B'])
  })

  it('aperçu d’un document : une réponse arrivée après un changement de document est ignorée', async () => {
    const answers: Array<(check: FileLinkCheck) => void> = []
    const checks = new FileChecks(() => new Promise((done) => answers.push(done)))
    const doc = (base: string) => (
      <FileLinksContext.Provider value={() => {}}>
        <FileExistsContext.Provider value={checks}>
          <FileLinkBase.Provider value={base}>
            <Markdown text={'Voir `suite.md`.'} />
          </FileLinkBase.Provider>
        </FileExistsContext.Provider>
      </FileLinksContext.Provider>
    )
    const view = render(doc('/p/docs'))
    await settle()
    view.rerender(doc('/p/autre'))
    await settle()
    expect(answers).toHaveLength(2)
    // `suite.md` existe dans /p/docs, pas dans /p/autre : la première réponse arrive en retard.
    await act(async () => answers[0]?.({ existing: ['suite.md'], unknown: [] }))
    expect(linked('suite.md')).toEqual([null])
    await act(async () => answers[1]?.({ existing: [], unknown: [] }))
    expect(linked('suite.md')).toEqual([null])
    // Revenu au premier document : sa réponse, retenue sous sa base, sert.
    view.rerender(doc('/p/docs'))
    expect(linked('suite.md')).toEqual(['file-link'])
  })

  it('fichier créé après sa mention : revérifié quand un outil d’écriture se termine', async () => {
    const user: TranscriptItem = { kind: 'user', id: 1, text: 'Crée le test', at: 0 }
    const reply: TranscriptItem = { kind: 'agent', id: 2, text: 'Je crée `tests/a.test.js`.' }
    const write = (status: 'in_progress' | 'completed'): TranscriptItem => ({
      kind: 'tool',
      id: 3,
      toolCallId: 't3',
      title: 'write',
      toolKind: 'edit',
      status,
      content: [],
      locations: []
    })
    const view = render(
      <Thread id="A" text={reply.text} items={[user, reply, write('in_progress')]} />
    )
    await settle()
    expect(linked('tests/a.test.js')).toEqual([null])
    // Un nouveau rendu sans signal ne redemande rien.
    view.rerender(<Thread id="A" text={reply.text} items={[user, reply, write('in_progress')]} />)
    await settle()
    expect(existing).toHaveBeenCalledTimes(1)
    folders['A'] = ['tests/a.test.js']
    view.rerender(<Thread id="A" text={reply.text} items={[user, reply, write('completed')]} />)
    await settle()
    expect(existing).toHaveBeenCalledTimes(2)
    expect(linked('tests/a.test.js')).toEqual(['file-link'])
  })

  it('délai dépassé ou appel en échec : ni oui ni non ; du code, redemandé au signal suivant', async () => {
    const ask = vi
      .fn<(hrefs: string[]) => Promise<FileLinkCheck>>()
      .mockResolvedValueOnce({ existing: [], unknown: ['src/a.js'] })
      .mockRejectedValueOnce(new Error('IPC'))
      .mockResolvedValue({ existing: ['src/a.js'], unknown: [] })
    const checks = new FileChecks(ask)
    checks.sync(0)
    const ui = (
      <FileLinksContext.Provider value={() => {}}>
        <FileExistsContext.Provider value={checks}>
          <Markdown text={'Voir `src/a.js`.'} />
        </FileExistsContext.Provider>
      </FileLinksContext.Provider>
    )
    const view = render(ui)
    await settle()
    expect(checks.status(undefined, 'src/a.js')).toBe(false)
    view.rerender(ui)
    await settle()
    expect(ask).toHaveBeenCalledTimes(1)
    await act(async () => checks.sync(1))
    await settle()
    expect(ask).toHaveBeenCalledTimes(2)
    expect(linked('src/a.js')).toEqual([null])
    await act(async () => checks.sync(2))
    await settle()
    expect(linked('src/a.js')).toEqual(['file-link'])
  })

  it('réponse en cours d’écriture : demandé après 300 ms de pause, pas à chaque morceau', async () => {
    vi.useFakeTimers()
    try {
      const ask = vi.fn(() => Promise.resolve({ existing: ['src/a.js'], unknown: [] }))
      const checks = new FileChecks(ask)
      const ui = (text: string) => (
        <FileLinksContext.Provider value={() => {}}>
          <FileExistsContext.Provider value={checks}>
            <Markdown text={text} streaming />
          </FileExistsContext.Provider>
        </FileLinksContext.Provider>
      )
      const view = render(ui('Voir `src/a.js`'))
      await act(async () => vi.advanceTimersByTime(STREAMING_DELAY_MS - 50))
      view.rerender(ui('Voir `src/a.js`, puis'))
      await act(async () => vi.advanceTimersByTime(STREAMING_DELAY_MS - 50))
      expect(ask).not.toHaveBeenCalled()
      await act(async () => vi.advanceTimersByTime(60))
      await act(async () => vi.advanceTimersByTime(1))
      expect(ask).toHaveBeenCalledTimes(1)
      expect(linked('src/a.js')).toEqual(['file-link'])
    } finally {
      vi.useRealTimers()
    }
  })

  it('sans mémoire (hors d’un fil) : du code', () => {
    render(<Markdown text={'Voir `src/a.js`.'} />)
    expect(linked('src/a.js')).toEqual([null])
  })

  it('signal du fil : outils d’écriture ou de commande terminés, réponses finies', () => {
    const tool = (toolKind: 'read' | 'execute', status: 'completed' | 'in_progress') =>
      ({
        kind: 'tool',
        id: 1,
        toolCallId: 't',
        title: 'x',
        toolKind,
        status,
        content: [],
        locations: []
      }) as TranscriptItem
    expect(
      filesRevision([
        tool('read', 'completed'),
        tool('execute', 'in_progress'),
        tool('execute', 'completed'),
        { kind: 'agent', id: 2, text: 'a' },
        { kind: 'agent', id: 3, text: 'b', at: 1 }
      ])
    ).toBe(2)
  })

  it('signal sans fichier devenu lien : aucun rendu des messages, même revérifiés', async () => {
    const user: TranscriptItem = { kind: 'user', id: 1, text: 'Va', at: 0 }
    const texts = Array.from({ length: 5 }, (_, i) => `Crée \`tests/t${i}.test.js\`.`)
    const tool = (id: number): TranscriptItem => ({
      kind: 'tool',
      id,
      toolCallId: `t${id}`,
      title: 'run',
      toolKind: 'execute',
      status: 'completed',
      content: [],
      locations: []
    })
    const thread = (items: TranscriptItem[]) => (
      <ConversationScope
        conversationId="A"
        openLink={() => {}}
        loadSubagentWork={vi.fn()}
        items={items}
      >
        {texts.map((text) => (
          <Markdown key={text} text={text} />
        ))}
      </ConversationScope>
    )
    const items: TranscriptItem[] = [user]
    const view = render(thread(items))
    await settle()
    const settled = renders.count
    for (let id = 10; id < 40; id++) {
      items.push(tool(id))
      view.rerender(thread([...items]))
      await settle()
    }
    // 30 outils : 30 revérifications groupées (une par signal), aucun rendu Markdown de plus.
    expect(existing).toHaveBeenCalledTimes(31)
    expect(renders.count).toBe(settled)
    // Le jour où un fichier apparaît : seul son message refait son rendu.
    folders['A'] = ['tests/t2.test.js']
    items.push(tool(99))
    view.rerender(thread([...items]))
    await settle()
    expect(renders.count).toBe(settled + 1)
    expect(linked('tests/t2.test.js')).toEqual(['file-link'])
  })

  it('signal pendant une demande en cours : la réponse d’avant ne dit plus « non », redemandée', async () => {
    const answers: Array<(check: FileLinkCheck) => void> = []
    const checks = new FileChecks(() => new Promise((done) => answers.push(done)))
    checks.sync(0)
    checks.request(undefined, ['src/a.js'])
    await settle()
    expect(answers).toHaveLength(1)
    checks.sync(1)
    // Le fichier n'existait pas à la première vérification, il existe après le signal.
    await act(async () => answers[0]?.({ existing: [], unknown: [] }))
    await settle()
    expect(answers).toHaveLength(2)
    await act(async () => answers[1]?.({ existing: ['src/a.js'], unknown: [] }))
    expect(checks.status(undefined, 'src/a.js')).toBe(true)
  })

  it('au-delà de la borne : les plus anciennes oubliées une à une, les « oui » récents gardés', async () => {
    const checks = new FileChecks((hrefs) => Promise.resolve({ existing: hrefs, unknown: [] }))
    const all = Array.from({ length: MAX_KNOWN + 10 }, (_, i) => `f${i}.js`)
    for (let i = 0; i < all.length; i += 200) {
      checks.request(undefined, all.slice(i, i + 200))
      await settle()
    }
    expect(checks.size).toBe(MAX_KNOWN)
    expect(checks.status(undefined, 'f0.js')).toBeUndefined()
    expect(checks.status(undefined, 'f9.js')).toBeUndefined()
    expect(checks.status(undefined, 'f10.js')).toBe(true)
    expect(checks.status(undefined, `f${MAX_KNOWN + 9}.js`)).toBe(true)
  })
})
