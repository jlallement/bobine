import * as Tooltip from '@radix-ui/react-tooltip'
import { fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FileEntry } from '@shared/files'
import type { FileActions } from './FileActions'
import { FileTree, treeRows } from './FileTree'

/** Rendus des icônes d'entrée : un par ligne de l'arbre redessinée. */
const icons = vi.hoisted(() => ({ renders: 0 }))
vi.mock('./file-icons', async (importOriginal) => {
  const real = await importOriginal<typeof import('./file-icons')>()
  return {
    ...real,
    EntryIcon: (props: Parameters<typeof real.EntryIcon>[0]) => {
      icons.renders++
      return real.EntryIcon(props)
    }
  }
})

const actions: FileActions = {
  openDefault: vi.fn(),
  reveal: vi.fn(),
  copyRelative: vi.fn(),
  copyAbsolute: vi.fn(),
  absolute: (item) => `/p/app/${item.path}`
}
const ROOTS = [{ index: 0, name: 'app', path: '/p/app' }]
const file = (name: string): FileEntry => ({ name, path: name, kind: 'file' })
const changed = new Set<string>()
const scrollIntoView = Element.prototype.scrollIntoView
afterEach(() => {
  Element.prototype.scrollIntoView = scrollIntoView
})

/**
 * L'arbre tel que l'onglet le rend : les lignes et les fichiers modifiés sont mémoïsés par
 * l'onglet, le reste (fichiers d'exclusion, fonctions) est recréé à chaque rendu.
 */
function tree(
  rows: ReturnType<typeof treeRows>,
  selected?: string,
  exclusions: readonly string[] = []
) {
  return (
    <Tooltip.Provider>
      <FileTree
        rows={rows}
        selected={selected}
        changed={changed}
        // Un tableau neuf à chaque rendu, de même contenu.
        exclusionFiles={[...exclusions]}
        actions={actions}
        // Fonctions neuves à chaque rendu, comme dans l'onglet.
        onToggle={() => {}}
        onOpen={() => {}}
        onCollapseDir={() => {}}
        onType={() => {}}
      />
    </Tooltip.Provider>
  )
}

describe('arbre : rendus et défilement', () => {
  const rows = treeRows(
    ROOTS,
    { '0:': { listing: { entries: ['a.ts', 'b.ts', 'c.ts'].map(file), more: 0 } } },
    new Set(['0:'])
  )

  it('le parent redessiné avec les mêmes lignes : aucune ligne redessinée (C7)', () => {
    const view = render(tree(rows))
    icons.renders = 0
    view.rerender(tree(rows))
    expect(icons.renders).toBe(0)
  })

  it('fichiers d’exclusion et fonctions recréés, même contenu : aucune ligne redessinée, focus gardé', () => {
    const exclusions = ['.bobignore', '.gitignore']
    const view = render(tree(rows, undefined, exclusions))
    const row = view.getAllByRole('treeitem')[2] as HTMLElement
    fireEvent.click(row)
    expect(row.tabIndex).toBe(0)
    icons.renders = 0
    view.rerender(tree(rows, undefined, [...exclusions]))
    view.rerender(tree(rows, undefined, [...exclusions]))
    expect(icons.renders).toBe(0)
    expect((view.getAllByRole('treeitem')[2] as HTMLElement).tabIndex).toBe(0)
    // Un autre contenu, lui, se voit : les lignes sont redessinées.
    view.rerender(tree(rows, undefined, ['.bobignore']))
    expect(icons.renders).toBeGreaterThan(0)
  })

  it('le fichier ouvert n’est ramené à l’écran que quand il change (C5)', () => {
    const scroll = vi.fn()
    Element.prototype.scrollIntoView = scroll
    const view = render(tree(rows, '0:a.ts'))
    expect(scroll).toHaveBeenCalledTimes(1)
    // Un dossier se déplie (plus de lignes), le fichier ouvert reste le même : rien ne bouge.
    const more = treeRows(
      ROOTS,
      { '0:': { listing: { entries: ['a.ts', 'b.ts', 'c.ts', 'd.ts'].map(file), more: 0 } } },
      new Set(['0:'])
    )
    view.rerender(tree(more, '0:a.ts'))
    expect(scroll).toHaveBeenCalledTimes(1)
    view.rerender(tree(more, '0:d.ts'))
    expect(scroll).toHaveBeenCalledTimes(2)
  })
})
