import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { INITIAL_ENTRIES, useEntryWindow } from './useEntryWindow'

/** Entrées du fil : un identifiant (premier élément), ou un groupe d'outils (plusieurs). */
type Entry = number[]
const idOf = (entry: Entry) => entry[0] ?? 0
const thread = (n: number, step = 1): Entry[] => Array.from({ length: n }, (_, i) => [1 + i * step])

interface Props {
  entries: Entry[]
  complete: boolean
  reveal?: number
}

function hook(initial: Entry[], options: { complete?: boolean; reveal?: number } = {}) {
  const initialProps: Props = { entries: initial, complete: options.complete ?? false }
  if (options.reveal !== undefined) initialProps.reveal = options.reveal
  return renderHook(
    (props: Props) =>
      useEntryWindow(props.entries, idOf, { complete: props.complete, reveal: props.reveal }),
    { initialProps }
  )
}

describe('useEntryWindow (fiche 193)', () => {
  it('fil vide, puis arrivée du fil : ouvert par la fin', () => {
    const { result, rerender } = hook([])
    expect(result.current.start).toBe(0)
    rerender({ entries: thread(500), complete: false })
    expect(result.current.start).toBe(500 - INITIAL_ENTRIES)
  })

  it('court : tout rendu ; le fil qui grandit garde le même début', () => {
    const { result, rerender } = hook(thread(50))
    expect(result.current.start).toBe(0)
    rerender({ entries: thread(400), complete: false })
    expect(result.current.start).toBe(0)
    const long = hook(thread(300))
    const at = long.result.current.start
    long.rerender({ entries: thread(310), complete: false })
    expect(long.result.current.start).toBe(at)
  })

  it('recherche ouverte : tout le fil', () => {
    const { result, rerender } = hook(thread(500))
    expect(result.current.start).toBeGreaterThan(0)
    rerender({ entries: thread(500), complete: true })
    expect(result.current.start).toBe(0)
  })

  it('élément à montrer dans un groupe d’outils, identifiants non contigus', () => {
    // Identifiants de 10 en 10, l'entrée 50 est un groupe de trois outils (501, 502, 503).
    const entries = thread(400, 10)
    entries[50] = [501, 502, 503]
    const { result, rerender } = hook(entries)
    expect(result.current.start).toBe(400 - INITIAL_ENTRIES)
    rerender({ entries, complete: false, reveal: 502 })
    expect(result.current.start).toBe(50)
    // Un identifiant entre deux entrées : celle qui le précède.
    rerender({ entries, complete: false, reveal: 125 })
    expect(result.current.start).toBe(12)
  })

  it('fil raccourci sous le début rendu : repart de la fin', () => {
    const { result, rerender } = hook(thread(500))
    rerender({ entries: thread(100), complete: false })
    expect(result.current.start).toBe(0)
    const shrunk = hook(thread(500))
    shrunk.rerender({ entries: thread(300), complete: false })
    expect(shrunk.result.current.start).toBe(300 - INITIAL_ENTRIES)
  })

  it('conversation suivante (fil remonté) : de nouveau par la fin', () => {
    const first = hook(thread(500), { complete: true })
    expect(first.result.current.start).toBe(0)
    first.unmount()
    const next = hook(thread(500))
    expect(next.result.current.start).toBe(500 - INITIAL_ENTRIES)
  })
})
