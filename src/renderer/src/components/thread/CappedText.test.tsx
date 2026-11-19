import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CappedText, FindQueryContext } from './CappedText'
import { EditorContext } from './OpenInEditor'

const lines = (n: number) =>
  Array.from({ length: n }, (_, i) => `test ${i + 1} ok`).join('\n') + '\n'

/** Résultat d'une recherche (posée après la saisie) : relu jusqu'à 5 s, sur une machine chargée. */
const UNTIL = { timeout: 5000 }

async function frames(n: number) {
  for (let i = 0; i < n; i++) {
    await act(() => new Promise((resolve) => requestAnimationFrame(() => resolve(undefined))))
  }
}

describe('CappedText (fiche 192)', () => {
  it('courte : ni bandeau ni rien de masqué', () => {
    render(<CappedText text={'a\nb\n'} className="tool-output" testId="out" />)
    expect(screen.queryByTestId('output-cap')).toBeNull()
    expect(screen.getByTestId('out').textContent).toBe('a\nb\n')
  })

  it('longue : les 500 dernières lignes, le nombre masqué localisé, « Afficher tout »', async () => {
    const text = lines(16_384)
    render(<CappedText text={text} className="tool-output" testId="out" />)
    expect(screen.getByTestId('output-cap').textContent).toMatch(
      /^15 884 premières lignes masquées \(.+ au total\)Afficher toutCopier tout$/
    )
    expect(screen.getByTestId('out').textContent?.startsWith('test 15885 ok\n')).toBe(true)
    fireEvent.click(screen.getByTestId('cap-show-all'))
    await frames(10)
    expect(screen.getByTestId('out').textContent).toBe(text)
    expect(screen.queryByTestId('output-cap')).toBeNull()
    expect(document.activeElement?.parentElement).toBe(screen.getByTestId('out'))
    expect(document.querySelector('[aria-live]')?.textContent).toBe('16 384 lignes affichées')
  })

  it('ligne unique géante : « Début masqué »', () => {
    render(<CappedText text={'x'.repeat(1024 * 1024)} className="tool-output" testId="out" />)
    expect(screen.getByTestId('output-cap').textContent).toMatch(/^Début masqué \(1\sMo au total\)/)
    expect(screen.getByTestId('out').textContent).toHaveLength(200 * 1024)
  })

  it('trop grosse : « Ouvrir dans l’éditeur » à la place de « Afficher tout », « Copier tout »', async () => {
    const openText = vi.fn()
    const writeText = vi.fn(async () => {})
    Object.assign(navigator, { clipboard: { writeText } })
    const text = lines(60_000)
    render(
      <EditorContext.Provider value={{ name: 'Zed', open: () => {}, openText }}>
        <CappedText text={text} className="tool-output" />
      </EditorContext.Provider>
    )
    expect(screen.queryByTestId('cap-show-all')).toBeNull()
    fireEvent.click(screen.getByTestId('cap-open-editor'))
    expect(openText).toHaveBeenCalledWith(text)
    fireEvent.click(screen.getByTestId('cap-copy-all'))
    expect(writeText).toHaveBeenCalledWith(text)
    expect(await screen.findByText('Copié')).toBeTruthy()
  })

  it('recherche ouverte : le début masqué qui contient ce qu’on cherche est montré, par paquets', async () => {
    const text = lines(16_384).replace('test 7 ok', 'test 7 JETON-UNIQUE')
    const { rerender } = render(
      <FindQueryContext.Provider value={undefined}>
        <CappedText text={text} className="tool-output" testId="out" />
      </FindQueryContext.Provider>
    )
    expect(screen.getByTestId('out').textContent).not.toContain('JETON-UNIQUE')
    rerender(
      <FindQueryContext.Provider value="jeton-unique">
        <CappedText text={text} className="tool-output" testId="out" />
      </FindQueryContext.Provider>
    )
    // La recherche attend que la saisie se pose : son résultat attendu tel quel (fiche 250).
    await waitFor(
      () => expect(screen.getByTestId('out').textContent).toContain('test 7 JETON-UNIQUE\n'),
      UNTIL
    )
  })

  it('« Afficher tout » montre la sortie entière, lignes longues comme courtes', async () => {
    const long = Array.from({ length: 1000 }, (_, i) => `${i}:${'y'.repeat(1000)}`).join('\n')
    for (const text of [long, lines(3000)]) {
      const { unmount } = render(<CappedText text={text} className="tool-output" testId="out" />)
      expect(screen.getByTestId('output-cap')).toBeTruthy()
      fireEvent.click(screen.getByTestId('cap-show-all'))
      await frames(5)
      expect(screen.getByTestId('out').textContent).toBe(text)
      expect(screen.queryByTestId('output-cap')).toBeNull()
      unmount()
    }
  })

  it('trouvé dans une sortie trop grosse : rien de plus rendu, dit seulement', async () => {
    const text = lines(60_000).replace('test 3 ok', 'test 3 JETON-UNIQUE')
    render(
      <FindQueryContext.Provider value="jeton-unique">
        <CappedText text={text} className="tool-output" testId="out" />
      </FindQueryContext.Provider>
    )
    await waitFor(
      () =>
        expect(screen.getByTestId('output-cap').textContent).toMatch(
          /^Trouvé dans le contenu masqué/
        ),
      UNTIL
    )
    expect(screen.getByTestId('out').textContent).not.toContain('JETON-UNIQUE')
  })
})
