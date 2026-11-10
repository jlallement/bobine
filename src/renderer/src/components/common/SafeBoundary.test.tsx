import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { t } from 'i18next'
import type { ThreadEntry } from '@shared/tool-groups'
import type { TranscriptItem } from '@shared/transcript'
import { entryKind, ItemBoundary, PaneBoundary } from './SafeBoundary'

/** Composant qui lève tant que `boom.on` est vrai. */
const boom = { on: true }
function Fragile({ text }: { text: string }) {
  if (boom.on) throw new TypeError('text.split is not a function')
  return <p>{text}</p>
}

describe('filets d’erreur par morceau d’interface (fiche 194)', () => {
  const reportError = vi.fn(async () => undefined)
  const showLog = vi.fn(async () => undefined)
  let api: Window['api']['app']
  beforeEach(() => {
    api = window.api.app
    window.api.app = { reportError, showLog } as unknown as Window['api']['app']
    boom.on = true
    // React écrit l'erreur rattrapée dans la console : pas dans la sortie des tests.
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    window.api.app = api
    vi.restoreAllMocks()
  })

  it('élément du fil : seul lui est remplacé, nommé selon ce qu’il est, détail replié', () => {
    render(
      <div>
        <ItemBoundary kind="diff">
          <Fragile text="diff" />
        </ItemBoundary>
        <p>Les tests passent.</p>
      </div>
    )
    expect(screen.getByText('Les tests passent.')).toBeTruthy()
    const fallback = screen.getByTestId('item-error')
    expect(fallback.textContent).toContain(t('errorBoundary.item.diff'))
    expect(fallback.querySelector('details')?.open).toBe(false)
    expect(fallback.textContent).toContain('text.split is not a function')
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'react:item', message: 'text.split is not a function' })
    )
    fireEvent.click(screen.getByRole('button', { name: t('errorBoundary.showLog') }))
    expect(showLog).toHaveBeenCalled()
  })

  it('panneau : « Réessayer » refait l’affichage', () => {
    render(
      <PaneBoundary what="panel">
        <Fragile text="Panneau rétabli" />
      </PaneBoundary>
    )
    expect(screen.getByTestId('pane-error').textContent).toContain(t('errorBoundary.panel.title'))
    boom.on = false
    fireEvent.click(screen.getByRole('button', { name: t('errorBoundary.retry') }))
    expect(screen.getByText('Panneau rétabli')).toBeTruthy()
  })

  it('page de réglages : son propre titre ; une autre page repart de zéro', () => {
    const { rerender } = render(
      <PaneBoundary what="page" resetKey="general">
        <Fragile text="Général" />
      </PaneBoundary>
    )
    expect(screen.getByTestId('pane-error').textContent).toContain(t('errorBoundary.page.title'))
    boom.on = false
    rerender(
      <PaneBoundary what="page" resetKey="agents">
        <Fragile text="Agents" />
      </PaneBoundary>
    )
    expect(screen.getByText('Agents')).toBeTruthy()
  })

  it('nom de l’élément : message, action de l’agent, modifications', () => {
    const item = (value: Partial<TranscriptItem>): ThreadEntry => ({
      kind: 'item',
      item: { id: 1, ...value } as TranscriptItem
    })
    expect(entryKind(item({ kind: 'agent', text: '' }))).toBe('message')
    expect(entryKind(item({ kind: 'tool', content: [] } as Partial<TranscriptItem>))).toBe('tool')
    expect(
      entryKind(
        item({
          kind: 'tool',
          content: [{ type: 'diff', path: 'a', oldText: '', newText: 'b' }]
        } as Partial<TranscriptItem>)
      )
    ).toBe('diff')
    expect(entryKind({ kind: 'tools', key: 2, items: [] })).toBe('tool')
    expect(entryKind(item({ kind: 'notice' } as Partial<TranscriptItem>))).toBe('other')
  })
})
