import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Markdown } from './Markdown'
import { mermaidError } from './MermaidBlock'

// Mermaid ne dessine pas sans vrai moteur de rendu : le module de dessin est simulé.
const renderMermaid = vi.fn<(source: string) => Promise<string>>()
vi.mock('../../mermaid-render', () => ({ renderMermaid: (s: string) => renderMermaid(s) }))

afterEach(() => renderMermaid.mockReset())

const block = (source: string) => `Avant\n\n\`\`\`mermaid\n${source}\n\`\`\`\n\nAprès`

describe('diagrammes Mermaid (fiche 063)', () => {
  it('bloc ```mermaid dessiné ; « Voir le code » et retour', async () => {
    renderMermaid.mockResolvedValue('<svg data-testid="dessin"><text>A</text></svg>')
    render(<Markdown text={block('flowchart LR\n  A --> B')} />)
    // D'abord le code, le temps que le texte se pose.
    expect(screen.getByTestId('mermaid-block').textContent).toContain('A --> B')
    await waitFor(() => expect(screen.getByTestId('dessin')).not.toBeNull())
    expect(renderMermaid).toHaveBeenCalledWith('flowchart LR\n  A --> B')
    fireEvent.click(screen.getByTestId('mermaid-toggle'))
    expect(screen.queryByTestId('dessin')).toBeNull()
    expect(screen.getByTestId('mermaid-block').textContent).toContain('A --> B')
    fireEvent.click(screen.getByTestId('mermaid-toggle'))
    expect(screen.getByTestId('dessin')).not.toBeNull()
    // Les autres blocs de code restent des blocs de code.
    expect(screen.queryByTestId('copy-code')).toBeNull()
  })

  it('invalide : le code reste, avec l’erreur de Mermaid en une ligne', async () => {
    renderMermaid.mockRejectedValue(
      new Error("Parse error on line 2:\n...A -->\n------^\nExpecting 'AMP', got 'EOF'")
    )
    render(<Markdown text={block('flowchart LR\n  A -->')} />)
    await waitFor(
      () =>
        expect(screen.getByTestId('mermaid-error').textContent).toBe(
          "Diagramme Mermaid invalide\u00a0: Parse error on line 2: Expecting 'AMP', got 'EOF'"
        ),
      { timeout: 3000 }
    )
    expect(screen.getByTestId('mermaid-block').textContent).toContain('A -->')
    expect(screen.queryByTestId('mermaid-toggle')).toBeNull()
  })

  it('erreur en une ligne', () => {
    expect(mermaidError(new Error('Lexical error on line 1.'))).toBe('Lexical error on line 1.')
    expect(mermaidError('Parse error on line 3:\n---^')).toBe('Parse error on line 3:')
  })
})
