import { act, fireEvent, render, screen } from '@testing-library/react'
import i18next from 'i18next'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FileLinkCheck } from '@shared/file-links'
import type { TranscriptItem } from '@shared/transcript'
import { ConversationScope } from './ConversationScope'
import { FileExistsContext, FileLinksContext, GONE_BUBBLE_MS, type OpenFileLink } from './FileLink'
import { FileChecks, fileChecksFor, resetFileChecks } from './file-checks'
import { Markdown } from './Markdown'

/**
 * Lien vers un fichier introuvable dans le fil (fiche 272, D2, option C) : au clic, le lien devient
 * du code barré et grisé, une bulle « Fichier introuvable » s'affiche 3 s (zone `status`), rien
 * n'entre dans le fil ; le « non » est retenu par la mémoire de la conversation, et le lien revient
 * avec le fichier. Minuteries simulées : aucune pause réelle.
 */

const GONE = () => i18next.t('fileLink.gone')

/** Dossiers des conversations : chemins qui existent, par conversation. */
let folders: Record<string, string[]>
const api = window.api

/** Ouverture d'un lien : le main répond « introuvable » (le lien le dit, s'il sait le dire). */
const missingOpen = vi.fn<OpenFileLink>((_href, options) => options.onMissing?.())

/** Laisse passer la vérification (minuterie nulle, puis la réponse). */
const settle = () => act(() => vi.advanceTimersByTimeAsync(0))

beforeEach(() => {
  vi.useFakeTimers()
  resetFileChecks()
  missingOpen.mockClear()
  folders = {}
  window.api = {
    ...api,
    fileLinks: {
      existing: (id: string, hrefs: string[]): Promise<FileLinkCheck> =>
        Promise.resolve({ existing: hrefs.filter((h) => folders[id]?.includes(h)), unknown: [] })
    },
    settings: { get: () => new Promise(() => {}), onChanged: () => () => {} }
  } as unknown as Window['api']
})
afterEach(() => {
  vi.useRealTimers()
  window.api = api
})

/** Un fichier écrit : signal « des fichiers ont pu changer ». */
const written = (id: number): TranscriptItem => ({
  kind: 'tool',
  id,
  toolCallId: `t${id}`,
  title: 'write',
  toolKind: 'edit',
  status: 'completed',
  content: [],
  locations: []
})

function Thread({ id, text, items }: { id: string; text: string; items?: TranscriptItem[] }) {
  return (
    <ConversationScope
      key={id}
      conversationId={id}
      openLink={missingOpen}
      loadSubagentWork={() => new Promise(() => {})}
      items={items ?? []}
    >
      <Markdown text={text} />
    </ConversationScope>
  )
}

const status = () => screen.queryAllByRole('status').map((s) => s.textContent)
const gone = () => document.querySelectorAll('[data-testid=file-link-gone]')
const links = () => document.querySelectorAll('[data-testid=file-link]')

describe('lien vers un fichier introuvable (fiche 272, D2)', () => {
  it('au clic : barré et grisé, bulle annoncée 3 s, le survol le redit ; retenu par la conversation', async () => {
    folders['A'] = ['src/liste.js:4', 'notes/brouillon.md']
    render(<Thread id="A" text={'Dans `src/liste.js:4`, notes dans `notes/brouillon.md`.'} />)
    await settle()
    expect(links()).toHaveLength(2)
    // Le fichier a disparu entre-temps : le main dit « introuvable » au clic.
    fireEvent.click(screen.getByText('notes/brouillon.md'))
    expect(missingOpen).toHaveBeenCalledTimes(1)
    expect(links()).toHaveLength(1)
    const struck = gone()
    expect(struck).toHaveLength(1)
    expect(struck[0]?.textContent).toBe('notes/brouillon.md')
    expect(struck[0]?.closest('a')).toBeNull()
    expect(struck[0]?.getAttribute('title')).toBe(GONE())
    expect(status()).toContain(GONE())
    expect(fileChecksFor('A').gone(undefined, 'notes/brouillon.md')).toBe(true)
    expect(fileChecksFor('A').status(undefined, 'notes/brouillon.md')).toBe(false)
    // Juste avant 3 s : toujours là ; à 3 s : partie, le chemin reste barré.
    await act(() => vi.advanceTimersByTimeAsync(GONE_BUBBLE_MS - 1))
    expect(status()).toContain(GONE())
    await act(() => vi.advanceTimersByTimeAsync(1))
    expect(status()).not.toContain(GONE())
    expect(gone()).toHaveLength(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('le fichier revient (signal du fil) : le lien aussi', async () => {
    folders['A'] = ['notes/brouillon.md']
    const view = render(<Thread id="A" text={'Notes dans `notes/brouillon.md`.'} />)
    await settle()
    fireEvent.click(screen.getByText('notes/brouillon.md'))
    folders['A'] = []
    // Un signal où le fichier manque toujours : toujours barré.
    view.rerender(<Thread id="A" text={'Notes dans `notes/brouillon.md`.'} items={[written(1)]} />)
    await settle()
    expect(gone()).toHaveLength(1)
    folders['A'] = ['notes/brouillon.md']
    view.rerender(
      <Thread id="A" text={'Notes dans `notes/brouillon.md`.'} items={[written(1), written(2)]} />
    )
    await settle()
    expect(gone()).toHaveLength(0)
    expect(links()).toHaveLength(1)
    expect(status()).not.toContain(GONE())
    expect(vi.getTimerCount()).toBe(0)
  })

  it('un vrai lien Markdown aussi ; changement de conversation ou démontage : minuterie nettoyée', async () => {
    const view = render(<Thread id="A" text={'Voir [le brouillon](notes/brouillon.md).'} />)
    await settle()
    fireEvent.click(screen.getByText('le brouillon'))
    expect(gone()).toHaveLength(1)
    expect(vi.getTimerCount()).toBe(1)
    view.rerender(<Thread id="B" text={'Voir [le brouillon](notes/brouillon.md).'} />)
    await settle()
    expect(vi.getTimerCount()).toBe(0)
    expect(status()).not.toContain(GONE())
    // B n'a rien appris : un lien. A garde son « non ».
    expect(links()).toHaveLength(1)
    view.rerender(<Thread id="A" text={'Voir [le brouillon](notes/brouillon.md).'} />)
    await settle()
    expect(gone()).toHaveLength(1)
    expect(status()).not.toContain(GONE())
    fireEvent.click(screen.getByText('le brouillon'))
    // Déjà barré : plus un lien, plus de clic.
    expect(missingOpen).toHaveBeenCalledTimes(1)
    view.unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('hors du fil (aperçu, onglet Fichiers) : pas de bulle, l’avis habituel', async () => {
    const checks = new FileChecks(() => Promise.resolve({ existing: ['a.md'], unknown: [] }))
    render(
      <FileLinksContext.Provider value={missingOpen}>
        <FileExistsContext.Provider value={checks}>
          <Markdown text={'Voir `a.md`.'} />
        </FileExistsContext.Provider>
      </FileLinksContext.Provider>
    )
    await settle()
    fireEvent.click(screen.getByText('a.md'))
    expect(missingOpen.mock.calls[0]?.[1]).toEqual({ reveal: false })
    expect(gone()).toHaveLength(0)
    expect(screen.queryAllByRole('status')).toHaveLength(0)
  })
})

describe('mémoire : « introuvable » appris au clic', () => {
  it('un « oui » demandé avant le clic ne fait pas revenir le lien ; un « oui » après, si', async () => {
    const answers: Array<(check: FileLinkCheck) => void> = []
    const checks = new FileChecks(() => new Promise((done) => answers.push(done)))
    const seen = vi.fn()
    checks.subscribe(seen)
    checks.request(undefined, ['a.md'])
    await settle()
    expect(answers).toHaveLength(1)
    checks.markGone(undefined, 'a.md')
    expect(seen).toHaveBeenCalledTimes(1)
    // Le « oui » d'avant le clic arrive : périmé.
    await act(async () => answers[0]?.({ existing: ['a.md'], unknown: [] }))
    expect(checks.gone(undefined, 'a.md')).toBe(true)
    expect(checks.status(undefined, 'a.md')).toBe(false)
    // Deuxième clic : rien de neuf à dire aux messages.
    checks.markGone(undefined, 'a.md')
    expect(seen).toHaveBeenCalledTimes(1)
    checks.sync(0)
    checks.sync(1)
    await settle()
    await act(async () => answers[1]?.({ existing: ['a.md'], unknown: [] }))
    expect(checks.gone(undefined, 'a.md')).toBe(false)
    expect(checks.status(undefined, 'a.md')).toBe(true)
    expect(seen).toHaveBeenCalledTimes(2)
  })
})
