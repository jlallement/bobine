import { act, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DiffView } from './DiffView'
import { EditorContext } from './OpenInEditor'
import { FindQueryContext } from './CappedText'
import { useReveal } from './useReveal'

const text = (prefix: string, n: number) =>
  Array.from({ length: n }, (_, i) => `${prefix} ${i}`).join('\n') + '\n'

/** Laisse passer les images d'animation (rendu par paquets). */
async function frames(n: number) {
  for (let i = 0; i < n; i++) {
    await act(() => new Promise((resolve) => requestAnimationFrame(() => resolve(undefined))))
  }
}

describe('DiffView plafonné (fiche 192)', () => {
  it('diff simplifié : 200 lignes retirées, 200 ajoutées, la note, les nombres localisés', () => {
    const { container } = render(
      <DiffView
        path="/p/gros.txt"
        oldText={text('ancienne', 5000)}
        newText={text('nouvelle', 5000)}
      />
    )
    expect(screen.getByTestId('diff-simplified').textContent).toContain('ligne à ligne')
    expect(container.querySelectorAll('tr.diff-del')).toHaveLength(200)
    expect(container.querySelectorAll('tr.diff-add')).toHaveLength(200)
    const caps = screen.getAllByTestId('diff-cap')
    expect(caps.map((c) => c.dataset['kind'])).toEqual(['removed', 'added'])
    expect(caps[0]?.textContent).toMatch(/^⋯ 4 800 lignes retirées de plus/)
    expect(container.querySelector('.diff-stats')?.textContent).toBe('+5 000 −5 000')
  })

  it('« Afficher tout » : focus sur la première ligne nouvelle, total annoncé', async () => {
    // 200 modifications éparses dans 2 000 lignes : ligne à ligne, ≈ 1 600 lignes avec le contexte.
    const before = text('ligne', 2000)
    const after = before.replace(/ligne (\d*0)\n/g, 'L$1\n')
    const { container } = render(<DiffView path="/p/a.txt" oldText={before} newText={after} />)
    const rows = () => container.querySelectorAll('tr.diff-del, tr.diff-add, tr.diff-ctx').length
    expect(screen.queryByTestId('diff-simplified')).toBeNull()
    expect(rows()).toBe(400)
    fireEvent.click(screen.getByTestId('cap-show-all'))
    await frames(1)
    expect(document.activeElement?.tagName).toBe('TR')
    expect(document.activeElement?.getAttribute('data-line')).toBeTruthy()
    expect(screen.queryByTestId('diff-cap')).toBeNull()
    expect(rows()).toBeGreaterThan(400)
    expect(container.querySelector('[aria-live]')?.textContent).toMatch(/lignes affichées$/)
  })

  it('paquets de 2 000 lignes, un par image, « Affichage… » entre-temps', async () => {
    const { result } = renderHook(() => useReveal(9000, 400))
    expect(result.current).toMatchObject({ shown: 400, revealing: false, revealed: false })
    act(() => result.current.reveal())
    expect(result.current).toMatchObject({ shown: 2400, revealing: true })
    await frames(1)
    expect(result.current.shown).toBe(4400)
    await frames(3)
    expect(result.current).toMatchObject({ shown: 9000, revealing: false, revealed: true })
  })

  it('trop gros en octets : « Ouvrir dans l’éditeur » ouvre le diff entier ; « Copier tout » toujours', () => {
    const openText = vi.fn()
    const writeText = vi.fn(async (_text: string) => {})
    Object.assign(navigator, { clipboard: { writeText } })
    const long = (c: string) =>
      Array.from({ length: 300 }, (_, i) => `${c}${i} ${c.repeat(20_000)}`).join('\n') + '\n'
    const oldText = long('a')
    const newText = long('b')
    const { rerender } = render(
      <DiffView path="src/gros.txt" oldText={oldText} newText={newText} />
    )
    // Sans éditeur : pas d'« Afficher tout » (trop gros), « Copier tout » quand même.
    expect(screen.queryByTestId('cap-show-all')).toBeNull()
    expect(screen.queryByTestId('cap-open-editor')).toBeNull()
    fireEvent.click(screen.getAllByTestId('cap-copy-all')[0] as HTMLElement)
    expect(writeText.mock.calls[0]?.[0]).toMatch(
      /^--- a\/src\/gros\.txt\n\+\+\+ b\/src\/gros\.txt\n-a0 /
    )
    rerender(
      <EditorContext.Provider value={{ name: 'Zed', open: () => {}, openText }}>
        <DiffView path="src/gros.txt" oldText={oldText} newText={newText} />
      </EditorContext.Provider>
    )
    fireEvent.click(screen.getAllByTestId('cap-open-editor')[0] as HTMLElement)
    expect(openText.mock.calls[0]?.[0]).toContain('+b299 ')
  })

  it('recherche ouverte : les lignes masquées trouvées sont montrées, par paquets', async () => {
    const before = text('ancienne', 5000)
    const after = text('nouvelle', 5000)
    const { container, rerender } = render(
      <DiffView path="/p/gros.txt" oldText={before} newText={after} />
    )
    expect(container.textContent).not.toContain('ancienne 3000')
    rerender(
      <FindQueryContext.Provider value="ancienne 3000">
        <DiffView path="/p/gros.txt" oldText={before} newText={after} />
      </FindQueryContext.Provider>
    )
    // Rien à la frappe : la recherche attend que la saisie se pose.
    expect(container.textContent).not.toContain('ancienne 3000')
    await act(() => new Promise((resolve) => setTimeout(resolve, 200)))
    await frames(3)
    expect(container.textContent).toContain('ancienne 3000')
    expect(container.querySelectorAll('tr.diff-add')).toHaveLength(200)
  })

  it('trouvé au fond d’un diff au-delà du plafond dur : rien de plus rendu, dit seulement', async () => {
    const before = text('ancienne', 60_000)
    const after = text('nouvelle', 60_000)
    const { container } = render(
      <FindQueryContext.Provider value="ancienne 59999">
        <DiffView path="/p/enorme.txt" oldText={before} newText={after} />
      </FindQueryContext.Provider>
    )
    await act(() => new Promise((resolve) => setTimeout(resolve, 200)))
    await frames(5)
    expect(container.querySelectorAll('tr.diff-del')).toHaveLength(200)
    expect(screen.getAllByTestId('diff-cap')[0]?.textContent).toMatch(
      /^Trouvé dans le contenu masqué · ⋯ 59\u202f800 lignes retirées de plus/
    )
  })
})
