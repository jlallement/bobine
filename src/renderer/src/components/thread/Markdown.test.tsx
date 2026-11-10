import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FileLinkBase, FileLinksContext } from './FileLink'
import { Markdown } from './Markdown'

describe('Markdown', () => {
  it('liens vers le navigateur système, protocoles dangereux neutralisés', () => {
    render(<Markdown text={'[doc](https://exemple.org/doc) et [piège](javascript:alert(1))'} />)
    const safe = screen.getByText('doc')
    expect(safe.getAttribute('href')).toBe('https://exemple.org/doc')
    expect(safe.getAttribute('target')).toBe('_blank')
    expect(safe.getAttribute('rel')).toBe('noreferrer')
    const trap = screen.getByText('piège')
    expect(trap.getAttribute('href') ?? '').not.toContain('javascript:')
  })

  it('tableaux dans un cadre qui défile, blocs de code avec un bouton « Copier »', () => {
    const text = '| a | b |\n|---|---|\n| 1 | 2 |\n\n```js\nconsole.log(1)\n```\n'
    const { container } = render(<Markdown text={text} />)
    const wrap = screen.getByTestId('markdown-table')
    expect(wrap.querySelector('table')).not.toBeNull()
    expect(wrap.textContent).toContain('2')
    expect(container.querySelector('.code-block pre code')?.textContent).toContain('console')
    expect(screen.getByTestId('copy-code')).not.toBeNull()
  })

  it('GFM : listes de tâches et texte barré', () => {
    const { container } = render(<Markdown text={'- [x] fait\n- [ ] à faire\n\n~~barré~~'} />)
    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(2)
    expect(container.querySelector('del')?.textContent).toBe('barré')
  })

  it('liens de fichiers (fiche 052) : ouverts par l’app, ⌥-clic pour le Finder ; liens web intacts', () => {
    const open = vi.fn()
    const text =
      '[plan](plan.md) [code](src/app.ts:12) [absolu](file:///Users/j/a%20b.md) [site](https://exemple.org)'
    render(
      <FileLinksContext.Provider value={open}>
        <FileLinkBase.Provider value="/projet/docs">
          <Markdown text={text} />
        </FileLinkBase.Provider>
      </FileLinksContext.Provider>
    )
    fireEvent.click(screen.getByText('plan'))
    fireEvent.click(screen.getByText('code'), { altKey: true })
    fireEvent.click(screen.getByText('absolu'))
    expect(open.mock.calls).toEqual([
      ['plan.md', { reveal: false, base: '/projet/docs' }],
      ['src/app.ts:12', { reveal: true, base: '/projet/docs' }],
      ['file:///Users/j/a%20b.md', { reveal: false, base: '/projet/docs' }]
    ])
    expect(screen.getByText('code').getAttribute('title')).toContain('ligne 12')
    // Lien web (fiche 154) : confié à l'app, qui choisit le navigateur ; ⌥-clic : celui du Mac.
    fireEvent.click(screen.getByText('site'))
    fireEvent.click(screen.getByText('site'), { altKey: true })
    expect(open.mock.calls.slice(3)).toEqual([
      ['https://exemple.org', { reveal: false }],
      ['https://exemple.org', { reveal: true }]
    ])
    // Sans personne pour les ouvrir (aperçu d'un message ailleurs), simples liens.
    render(<Markdown text={'[seul](seul.md)'} />)
    expect(screen.getByText('seul').dataset['testid']).toBeUndefined()
  })
})
