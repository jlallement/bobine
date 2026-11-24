import { act, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { FileExistsContext, FileLinkBase, FileLinksContext } from './FileLink'
import { FileChecks } from './file-checks'
import { Markdown } from './Markdown'

/** Fil d'une conversation dont le dossier contient `files` (mémoire neuve : rien de retenu). */
function inThread(open: () => void, files: string[], children: ReactNode) {
  const ui = (
    <FileLinksContext.Provider value={open}>
      <FileExistsContext.Provider
        value={
          new FileChecks((hrefs) =>
            Promise.resolve({ existing: hrefs.filter((h) => files.includes(h)), unknown: [] })
          )
        }
      >
        {children}
      </FileExistsContext.Provider>
    </FileLinksContext.Provider>
  )
  return { ui }
}

/** Laisse passer la vérification (minuterie nulle, puis la réponse). */
const settle = () => act(() => new Promise((done) => setTimeout(done, 0)))

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

  it('`fichier:ligne` en code : lien de fichier ; une commande en code reste du texte (fiche 272)', async () => {
    const open = vi.fn()
    const { ui } = inThread(
      open,
      ['src/liste.js:5'],
      <Markdown text={'Voir `src/liste.js:5`, puis lancer `npm test`.\n\n```\nsrc/a.js:1\n```'} />
    )
    render(ui)
    await settle()
    fireEvent.click(screen.getByText('src/liste.js:5'))
    expect(open).toHaveBeenCalledWith('src/liste.js:5', { reveal: false })
    expect(screen.getByText('npm test').closest('a')).toBeNull()
    expect(document.querySelector('pre a')).toBeNull()
  })

  it('`fichier:ligne` sans dossier, en code ou en lien Markdown : le même lien de fichier', async () => {
    const open = vi.fn()
    const { ui } = inThread(
      open,
      ['liste.js:17'],
      <Markdown text={'La ligne modifiée est `liste.js:17`, voir [ici](liste.js:9).'} />
    )
    render(ui)
    await settle()
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

  it('français (Nouveautés, fiche 272) : insécables dans le texte, jamais dans le code ni les adresses', () => {
    const N = '\u00a0'
    const text = [
      '- Marqué « modifié » ; plutôt `code « x » ; y ?` : voir [la « page »](<https://exemple.org/a ?b>).',
      '',
      '```',
      'bloc « z » !',
      '```'
    ].join('\n')
    const { container } = render(<Markdown text={text} french />)
    const item = container.querySelector('li') as HTMLElement
    expect(item.textContent).toContain(`Marqué «${N}modifié${N}»${N}; plutôt`)
    expect(item.textContent).toContain(`${N}: voir la «${N}page${N}».`)
    expect(item.querySelector('code')?.textContent).toBe('code « x » ; y ?')
    expect(container.querySelector('pre')?.textContent).toContain('bloc « z » !')
    const href = container.querySelector('a')?.getAttribute('href') ?? ''
    expect(href).toMatch(/^https:\/\/exemple\.org\/a/)
    expect(href).not.toMatch(/\u00a0|%C2%A0/i)
    // Sans `french` (anglais, fil de la conversation) : rien ne change.
    const plain = render(<Markdown text={'Marqué « modifié » ;'} />)
    expect(plain.container.textContent).toBe('Marqué « modifié » ;')
  })

  // Remplace `e2e/suites/tables.mjs` n° 1 : alignements GFM, gauche par défaut.
  it('tableau : alignements Markdown respectés, rien d’imposé sans alignement', () => {
    const text = '| g | c | d | n |\n|:--|:-:|--:|---|\n| 1 | 2 | 3 | 4 |\n'
    render(<Markdown text={text} />)
    const align = [...screen.getByTestId('markdown-table').querySelectorAll('th')].map(
      (th) => th.style.textAlign || th.getAttribute('align') || ''
    )
    expect(align).toEqual(['left', 'center', 'right', ''])
  })

  // Remplace `e2e/suites/touches.mjs` n° 1 : « Copier » d'un bloc de code met son texte.
  it('« Copier » d’un bloc de code : son texte exact dans le presse-papiers', async () => {
    const writeText = vi.fn(async () => {})
    const clipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    // jsdom n'a pas `innerText` (texte rendu) : le texte du nœud en tient lieu.
    const innerText = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'innerText')
    Object.defineProperty(HTMLElement.prototype, 'innerText', {
      configurable: true,
      get(this: HTMLElement) {
        return this.textContent
      }
    })
    try {
      render(<Markdown text={'```sh\npnpm test\npnpm build\n```\n'} />)
      await act(async () => fireEvent.click(screen.getByTestId('copy-code')))
      expect(writeText).toHaveBeenCalledWith('pnpm test\npnpm build')
    } finally {
      if (innerText) Object.defineProperty(HTMLElement.prototype, 'innerText', innerText)
      else delete (HTMLElement.prototype as unknown as Record<string, unknown>).innerText
      if (clipboard) Object.defineProperty(navigator, 'clipboard', clipboard)
      else delete (navigator as unknown as Record<string, unknown>).clipboard
    }
  })
})
