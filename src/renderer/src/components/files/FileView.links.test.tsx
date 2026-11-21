import * as Tooltip from '@radix-ui/react-tooltip'
import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FileLinkCheck } from '@shared/file-links'
import { fileChecksFor, resetFileChecks } from '../thread/file-checks'
import { absoluteIn, type FileActions } from './FileActions'
import { FileView } from './FileView'
import type { OpenContent } from './useFilesTab'

/**
 * Markdown rendu dans l'onglet Fichiers (fiche 271) : un code en ligne n'y est un lien que si le
 * fichier existe (fiche 272, `files:existing`), relatif au dossier du document, comme dans le fil.
 */

const root = { index: 0, name: 'projet', path: '/p/projet' }
const target = { root: 0, path: 'docs/guide.md' }

/** Laisse passer la vérification (minuterie nulle, puis la réponse). */
const settle = () => act(() => new Promise((done) => setTimeout(done, 0)))

const linked = (text: string) => screen.getByText(text).closest('a')?.dataset['testid'] ?? null

let answer: (hrefs: string[], base?: string) => FileLinkCheck
let existing: ReturnType<
  typeof vi.fn<(id: string, hrefs: string[], base?: string) => Promise<FileLinkCheck>>
>
const api = window.api

beforeEach(() => {
  resetFileChecks()
  answer = () => ({ existing: [], unknown: [] })
  existing = vi.fn((_id: string, hrefs: string[], base?: string) =>
    Promise.resolve(answer(hrefs, base))
  )
  window.api = { ...api, fileLinks: { existing } } as unknown as Window['api']
})
afterEach(() => {
  window.api = api
  resetFileChecks()
})

function view(text: string) {
  const content: OpenContent = {
    target,
    seq: 1,
    content: { kind: 'text', text, size: text.length, truncated: false, modified: 1 }
  }
  const actions: FileActions = {
    openDefault: vi.fn(),
    reveal: vi.fn(),
    copyRelative: vi.fn(),
    copyAbsolute: vi.fn(),
    absolute: (item) => absoluteIn(root, item.path)
  }
  return render(
    <Tooltip.Provider>
      <FileView
        conversationId="A"
        root={root}
        showRoot={false}
        target={target}
        content={content}
        wrap={false}
        actions={actions}
        changed={false}
        openLink={vi.fn()}
        canBack={false}
        canForward={false}
        treeShown={false}
        onToggleTree={vi.fn()}
        onStep={vi.fn()}
        onRevealDir={vi.fn()}
        viewMenu={null}
      />
    </Tooltip.Provider>
  )
}

describe('onglet Fichiers : codes en ligne d’un Markdown rendu (fiche 272)', () => {
  it('un chemin qui existe devient un lien, un chemin absent reste du code', async () => {
    answer = (hrefs) => ({ existing: hrefs.filter((h) => h === 'suite.md'), unknown: [] })
    view('Lire `suite.md`, puis `absent.md`.')
    // Tant qu'on ne sait pas : du code, jamais un lien.
    expect(linked('suite.md')).toBeNull()
    await settle()
    // Une seule demande, relative au dossier du document, pour la conversation de l'onglet.
    expect(existing).toHaveBeenCalledTimes(1)
    expect(existing.mock.calls[0]).toEqual(['A', ['suite.md', 'absent.md'], '/p/projet/docs'])
    expect(linked('suite.md')).toBe('file-link')
    expect(linked('absent.md')).toBeNull()
  })

  it('réponse « inconnu » (délai dépassé) : reste du code, redemandé au prochain signal du fil', async () => {
    answer = (hrefs) => ({ existing: [], unknown: hrefs })
    view('Lire `lent.md`.')
    await settle()
    expect(linked('lent.md')).toBeNull()
    // L'onglet seul ne redemande pas (pas de nouvelle demande pour un chemin déjà connu)…
    expect(existing).toHaveBeenCalledTimes(1)
    // …mais la mémoire est celle de la conversation : un signal du fil (fin de tour, outil
    // d'écriture terminé) revérifie l'inconnu, et le lien apparaît dans l'onglet.
    answer = (hrefs) => ({ existing: hrefs, unknown: [] })
    act(() => {
      fileChecksFor('A').sync(1)
      fileChecksFor('A').sync(2)
    })
    await settle()
    expect(existing).toHaveBeenCalledTimes(2)
    expect(linked('lent.md')).toBe('file-link')
  })

  it('appel en échec : comme « inconnu », du code', async () => {
    existing.mockImplementation(() => Promise.reject(new Error('IPC')))
    view('Lire `suite.md`.')
    await settle()
    expect(linked('suite.md')).toBeNull()
  })
})
