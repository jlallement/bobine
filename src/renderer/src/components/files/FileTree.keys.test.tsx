import * as Tooltip from '@radix-ui/react-tooltip'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { FileActions } from './FileActions'
import { FileTree, treeRows } from './FileTree'

function setup() {
  const actions: FileActions = {
    openDefault: vi.fn(),
    reveal: vi.fn(),
    copyRelative: vi.fn(),
    copyAbsolute: vi.fn(),
    absolute: (item) => `/p/app/${item.path}`
  }
  const rows = treeRows(
    [{ index: 0, name: 'app', path: '/p/app' }],
    {
      '0:': {
        listing: {
          entries: [
            { name: 'a.ts', path: 'a.ts', kind: 'file' },
            { name: 'b.ts', path: 'b.ts', kind: 'file' }
          ],
          more: 0
        }
      }
    },
    new Set(['0:'])
  )
  const onOpen = vi.fn()
  render(
    <Tooltip.Provider>
      <FileTree
        rows={rows}
        changed={new Set()}
        exclusionFiles={[]}
        actions={actions}
        onToggle={() => {}}
        onOpen={onOpen}
        onCollapseDir={() => {}}
        onType={() => {}}
      />
    </Tooltip.Provider>
  )
  return { actions, onOpen }
}

describe('clavier dans les menus de l’arbre (B1)', () => {
  it('Maj+F10, ↓, ↵ : l’entrée du menu seulement, ni ouverture ni ligne suivante', async () => {
    const { actions, onOpen } = setup()
    const [first, second] = screen.getAllByTestId('file-row')
    if (!first || !second) throw new Error('lignes attendues')
    act(() => first.focus())
    fireEvent.keyDown(first, { key: 'F10', shiftKey: true })
    const menu = await screen.findByTestId('file-context-menu')
    const items = [...menu.querySelectorAll<HTMLElement>('[role=menuitem]')]
    const copy = items.find((i) => i.dataset['testid'] === 'file-action-copy')
    if (!copy) throw new Error('« Copier le chemin » attendu')
    act(() => copy.focus())
    fireEvent.keyDown(copy, { key: 'ArrowDown' })
    expect(document.activeElement).not.toBe(second)
    fireEvent.keyDown(copy, { key: 'Enter' })
    expect(onOpen).not.toHaveBeenCalled()
    expect(actions.copyRelative).toHaveBeenCalled()
  })

  it('le bouton ⋮ d’une ligne n’est pas un arrêt de tabulation ; ↵ dessus n’ouvre pas le fichier', () => {
    const { onOpen } = setup()
    const more = screen.getAllByTestId('file-row-actions')
    expect(more.every((b) => b.getAttribute('tabindex') === '-1')).toBe(true)
    fireEvent.keyDown(more[0] as HTMLElement, { key: 'Enter' })
    expect(onOpen).not.toHaveBeenCalled()
  })
})
