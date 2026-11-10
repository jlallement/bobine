import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WorkspaceFile } from '@shared/attachments'
import { useMentions } from './useMentions'

const readme: WorkspaceFile = { path: '/projet/README.md', relative: 'README.md' }

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

function setup(text: string, options: { commandMenuOpen?: boolean; blocked?: boolean } = {}) {
  const onSearchFiles = vi.fn(async () => [readme])
  const hook = renderHook(
    ({ value }) =>
      useMentions({
        text: value,
        caret: value.length,
        commandMenuOpen: options.commandMenuOpen ?? false,
        blocked: options.blocked ?? false,
        onSearchFiles
      }),
    { initialProps: { value: text } }
  )
  return { ...hook, onSearchFiles }
}

describe('mentions `@` (fiche 089)', () => {
  it('au curseur : mentions de contexte, puis fichiers cherchés après un court délai', async () => {
    const { result, onSearchFiles } = setup('Regarde @')
    expect(result.current.open).toBe(true)
    expect(result.current.entries.map((e) => e.kind)).toEqual(['context', 'context'])
    await act(async () => {
      await vi.advanceTimersByTimeAsync(150)
    })
    expect(onSearchFiles).toHaveBeenCalledWith('')
    expect(result.current.entries.at(-1)).toEqual({ kind: 'file', file: readme })
  })

  it('Échap referme le menu jusqu’au texte suivant', () => {
    const { result, rerender } = setup('@RE')
    act(() => result.current.dismiss())
    expect(result.current.open).toBe(false)
    act(() => result.current.textChanged())
    rerender({ value: '@REA' })
    expect(result.current.open).toBe(true)
  })

  it('pas de menu pendant celui des commandes « / », ni quand la saisie est bloquée', () => {
    expect(setup('/x @', { commandMenuOpen: true }).result.current.mention).toBeUndefined()
    const blocked = setup('@', { blocked: true }).result.current
    expect(blocked.mention).toBeDefined()
    expect(blocked.open).toBe(false)
  })
})
