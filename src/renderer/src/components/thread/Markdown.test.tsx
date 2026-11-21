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

  it('sans coloration au-delà de la borne (Markdown rendu de l’onglet Fichiers)', () => {
    const text = '```js\nconst a = 1\n```\n'
    const colored = render(<Markdown text={text} />)
    expect(colored.container.querySelector('[class*="hljs-"]')).not.toBeNull()
    colored.unmount()
    const plain = render(<Markdown text={text} highlight={false} />)
    expect(plain.container.querySelector('[class*="hljs-"]')).toBeNull()
    expect(plain.container.textContent).toContain('const a = 1')
  })

  it('`fichier:ligne` en code : lien de fichier ; une commande en code reste du texte (fiche 272)', () => {
    const open = vi.fn()
    render(
      <FileLinksContext.Provider value={open}>
        <Markdown text={'Voir `src/liste.js:5`, puis lancer `npm test`.\n\n```\nsrc/a.js:1\n```'} />
      </FileLinksContext.Provider>
    )
    fireEvent.click(screen.getByText('src/liste.js:5'))
    expect(open).toHaveBeenCalledWith('src/liste.js:5', { reveal: false })
    expect(screen.getByText('npm test').closest('a')).toBeNull()
    expect(document.querySelector('pre a')).toBeNull()
  })

  it('`fichier:ligne` sans dossier, en code ou en lien Markdown : le même lien de fichier', () => {
    const open = vi.fn()
    render(
      <FileLinksContext.Provider value={open}>
        <Markdown text={'La ligne modifiée est `liste.js:17`, voir [ici](liste.js:9).'} />
      </FileLinksContext.Provider>
    )
    expect(screen.getByText('liste.js:17').closest('a')?.getAttribute('href')).toBe('liste.js:17')
    fireEvent.click(screen.getByText('liste.js:17'))
    fireEvent.click(screen.getByText('ici'))
    expect(open.mock.calls).toEqual([
      ['liste.js:17', { reveal: false }],
      ['liste.js:9', { reveal: false }]
    ])
  })

  it('pièges de `urlTransform` : un nom de fichier gardé, inerte ; les schémas dangereux vidés', () => {
    const open = vi.fn()
    render(
      <FileLinksContext.Provider value={open}>
        <Markdown
          text={
            '[f](javascript.js:1) [a](javascript:alert(1)) [b](JaVaScRiPt:alert(1)) ' +
            '[c](vbscript:msgbox) [d](data:text/html,x) [e](example.com:8080) [g](127.0.0.1:3000)'
          }
        />
      </FileLinksContext.Provider>
    )
    const href = (text: string) => screen.getByText(text).closest('a')?.getAttribute('href') ?? ''
    // Un fichier qui s'appelle `javascript.js` : un lien de fichier, ouvert par l'app, jamais exécuté.
    expect(href('f')).toBe('javascript.js:1')
    fireEvent.click(screen.getByText('f'))
    expect(open).toHaveBeenCalledWith('javascript.js:1', { reveal: false })
    for (const text of ['a', 'b', 'c', 'd']) expect(href(text), text).toBe('')
    // Une adresse `hôte:port` n'est pas un fichier (ni gardée comme tel, ni dite introuvable).
    for (const text of ['e', 'g']) {
      expect(screen.getByText(text).closest('[data-testid=file-link]'), text).toBeNull()
    }
  })

  it('`C:/…` : un chemin sous Windows (`windowsPaths`), vidé ailleurs', () => {
    const api = window.api
    const text = '[w](C:/projet/a.ts)'
    try {
      const mac = render(<Markdown text={text} />)
      expect(screen.getByText('w').closest('a')?.getAttribute('href')).toBe('')
      mac.unmount()
      window.api = {
        ...api,
        app: { ...(api as Partial<Window['api']>).app, features: { windowsPaths: true } }
      } as unknown as Window['api']
      render(<Markdown text={text} />)
      expect(screen.getByText('w').closest('a')?.getAttribute('href')).toBe('C:/projet/a.ts')
    } finally {
      window.api = api
    }
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
