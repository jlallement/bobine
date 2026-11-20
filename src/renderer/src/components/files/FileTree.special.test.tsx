import * as Tooltip from '@radix-ui/react-tooltip'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { FileActions } from './FileActions'
import { FileTree, treeRows } from './FileTree'

const actions: FileActions = {
  openDefault: vi.fn(),
  reveal: vi.fn(),
  copyRelative: vi.fn(),
  copyAbsolute: vi.fn(),
  absolute: (item) => `/p/app/${item.path}`
}

describe('FIFO, socket, périphérique dans l’arbre (B1)', () => {
  it('grisé, dit spécial, jamais ouvert ni glissé', () => {
    const rows = treeRows(
      [{ index: 0, name: 'app', path: '/p/app' }],
      {
        '0:': {
          listing: {
            entries: [
              { name: 'tuyau', path: 'tuyau', kind: 'file', special: true },
              { name: 'a.ts', path: 'a.ts', kind: 'file' }
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
    const [fifo, file] = screen.getAllByTestId('file-row')
    if (!fifo || !file) throw new Error('lignes attendues')
    expect(fifo.className).toContain('special')
    expect(fifo.getAttribute('draggable')).toBe('false')
    expect(fifo.getAttribute('aria-label')).toMatch(/tuyau, .+/)
    fireEvent.click(fifo)
    fireEvent.keyDown(fifo, { key: 'Enter' })
    expect(onOpen).not.toHaveBeenCalled()
    fireEvent.click(file)
    expect(onOpen).toHaveBeenCalledWith(0, 'a.ts')
  })
})

describe('autres dossiers que l’agent ne reçoit pas (C10, Q26)', () => {
  it('leur racine est marquée « non transmis », la principale non', () => {
    const rows = treeRows(
      [
        { index: 0, name: 'app', path: '/p/app' },
        { index: 1, name: 'lib', path: '/p/lib', notSent: true }
      ],
      { '0:': { listing: { entries: [], more: 0 } } },
      new Set(['0:'])
    )
    render(
      <Tooltip.Provider>
        <FileTree
          rows={rows}
          changed={new Set()}
          exclusionFiles={[]}
          actions={actions}
          onToggle={() => {}}
          onOpen={() => {}}
          onCollapseDir={() => {}}
          onType={() => {}}
        />
      </Tooltip.Provider>
    )
    const [app, lib] = screen.getAllByTestId('file-row').filter((r) => r.classList.contains('root'))
    expect(app?.querySelector('[data-testid=file-row-not-sent]')).toBeNull()
    expect(lib?.querySelector('[data-testid=file-row-not-sent]')).not.toBeNull()
    expect(lib?.getAttribute('aria-label')).toMatch(/lib, .+/)
  })
})
