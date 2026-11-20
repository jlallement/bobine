import * as Tooltip from '@radix-ui/react-tooltip'
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
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

function tree(rows: ReturnType<typeof treeRows>, selected?: string) {
  return (
    <Tooltip.Provider>
      <FileTree
        rows={rows}
        selected={selected}
        changed={changed}
        exclusionFiles={[]}
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
