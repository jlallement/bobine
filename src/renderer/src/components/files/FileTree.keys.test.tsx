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

describe('menu contextuel rouvert aussitôt fermé (e2e `files light`)', () => {
  it('Échap puis clic droit sur une autre ligne : le nouveau menu reste ouvert, sur sa ligne', async () => {
    setup()
    const [first, second] = screen.getAllByTestId('file-row')
    if (!first || !second) throw new Error('lignes attendues')
    fireEvent.contextMenu(first, { clientX: 40, clientY: 10 })
    const menu = await screen.findByTestId('file-context-menu')
    fireEvent.keyDown(menu, { key: 'Escape' })
    expect(screen.queryByTestId('file-context-menu')).toBeNull()
    // Avant que le menu fermé ne rende le clavier à sa ligne (minuteur de Radix) : un autre clic
    // droit, comme un utilisateur rapide ou une fenêtre au second plan (minuteurs ralentis).
    fireEvent.contextMenu(second, { clientX: 40, clientY: 30 })
    expect(await screen.findByTestId('file-context-menu')).toBeTruthy()
    await act(() => new Promise((resolve) => setTimeout(resolve, 20)))
    expect(screen.queryByTestId('file-context-menu')).not.toBeNull()
    expect(second.classList.contains('menu-open')).toBe(true)
  })
})

describe('menu d’une ligne qui disparaît (relecture)', () => {
  it('ligne retirée : le menu se ferme ; revenue, il ne se rouvre pas tout seul', async () => {
    const entries = (names: string[]) =>
      treeRows(
        [{ index: 0, name: 'app', path: '/p/app' }],
        {
          '0:': {
            listing: { entries: names.map((n) => ({ name: n, path: n, kind: 'file' })), more: 0 }
          }
        },
        new Set(['0:'])
      )
    const tree = (rows: ReturnType<typeof treeRows>) => (
      <Tooltip.Provider>
        <FileTree
          rows={rows}
          changed={new Set()}
          exclusionFiles={[]}
          actions={{
            openDefault: vi.fn(),
            reveal: vi.fn(),
            copyRelative: vi.fn(),
            copyAbsolute: vi.fn(),
            absolute: (item) => `/p/app/${item.path}`
          }}
          onToggle={() => {}}
          onOpen={() => {}}
          onCollapseDir={() => {}}
          onType={() => {}}
        />
      </Tooltip.Provider>
    )
    const view = render(tree(entries(['a.ts', 'b.ts'])))
    const b = () =>
      document.querySelector('[data-testid=file-row][data-path="b.ts"]') as HTMLElement
    fireEvent.contextMenu(b(), { clientX: 40, clientY: 30 })
    await screen.findByTestId('file-context-menu')
    view.rerender(tree(entries(['a.ts'])))
    expect(screen.queryByTestId('file-context-menu')).toBeNull()
    view.rerender(tree(entries(['a.ts', 'b.ts'])))
    await act(() => new Promise((resolve) => setTimeout(resolve, 20)))
    expect(screen.queryByTestId('file-context-menu')).toBeNull()
    expect(b().classList.contains('menu-open')).toBe(false)
  })
})
