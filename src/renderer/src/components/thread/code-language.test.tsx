import { render } from '@testing-library/react'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'
import { describe, expect, it } from 'vitest'
import { fenceClosed } from './code-language'
import { Markdown } from './Markdown'

/** Rendu d'avant la fiche 192 : `rehype-highlight` devine seul chaque bloc. */
function reference(text: string): string {
  const { container } = render(
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
    >
      {text}
    </ReactMarkdown>
  )
  return [...container.querySelectorAll('pre code')].map((c) => c.outerHTML).join('\n')
}

function rendered(text: string, streaming = false): string {
  const { container } = render(<Markdown text={text} streaming={streaming} />)
  return [...container.querySelectorAll('pre code')].map((c) => c.outerHTML).join('\n')
}

const PYTHON = 'def carre(x):\n    return x * x\n\nprint(carre(3))\n'
const PLAIN = 'du texte simple sans rien\n'
const SAMPLES = [
  `Avant\n\n\`\`\`\n${PYTHON}\`\`\`\n\nAprès`,
  `\`\`\`\n${PLAIN}\`\`\`\n`,
  '```ts\nconst x: number = 1\n```\n',
  `~~~\n${PYTHON}~~~\n`,
  '```\n```\n'
]

describe('langage des blocs de code (fiche 192)', () => {
  it('même rendu que la détection seule, au premier rendu comme depuis le cache', () => {
    for (const text of SAMPLES) {
      const expected = reference(text)
      expect(rendered(text)).toBe(expected)
      expect(rendered(text)).toBe(expected)
    }
    expect(reference(SAMPLES[0] ?? '')).toContain('language-python')
  })

  it('réponse en cours : le bloc encore ouvert attend sa clôture, les blocs fermés sont colorés', () => {
    // Texte jamais vu (sinon le langage vient du cache, sans rien deviner : coloré tout de suite).
    const fresh = 'import os\n\ndef lire(chemin):\n    return open(chemin).read()\n'
    const open = `Voici :\n\n\`\`\`\n${fresh}`
    expect(rendered(open, true)).not.toContain('hljs')
    expect(rendered(open, true)).not.toContain('no-highlight')
    const closedThenOpen = `\`\`\`\n${PYTHON}\`\`\`\n\nPuis :\n\n\`\`\`\nencore autre chose\n`
    const { container } = render(<Markdown text={closedThenOpen} streaming />)
    expect([...container.querySelectorAll('pre code')].map((c) => c.className)).toEqual([
      'hljs language-python',
      ''
    ])
    // Réponse finie : coloré comme avant.
    expect(rendered(open, false)).toBe(reference(open))
  })

  it('clôture d’un bloc', () => {
    expect(fenceClosed('```\na\n```', 9)).toBe(true)
    expect(fenceClosed('```\na\n', 6)).toBe(false)
    expect(fenceClosed('  ~~~~\na\n  ~~~~\n', 17)).toBe(true)
    expect(fenceClosed('```\na', undefined)).toBe(true)
  })
})
