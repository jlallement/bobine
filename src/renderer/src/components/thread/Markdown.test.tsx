import { act, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { FileExistsContext, FileLinkBase, FileLinksContext, type CheckFileLinks } from './FileLink'
import { Markdown } from './Markdown'

/** Fil d'une conversation dont le dossier contient `files` (vérificateur neuf : rien de retenu). */
function inThread(open: () => void, files: string[], children: ReactNode) {
  const check = vi.fn<CheckFileLinks>((hrefs) =>
    Promise.resolve(hrefs.filter((href) => files.includes(href)))
  )
  const ui = (
    <FileLinksContext.Provider value={open}>
      <FileExistsContext.Provider value={check}>{children}</FileExistsContext.Provider>
    </FileLinksContext.Provider>
  )
  return { check, ui }
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

  it('code vers un fichier qui n’existe pas : pas un lien ; un seul appel groupé par message (rc.3)', async () => {
    const open = vi.fn()
    const text =
      'Crée `package.json`, puis `tests/liste.test.js` qui importe `../liste.js` ; ' +
      'la fonction est dans `liste.js:4`, déjà citée : `liste.js:4`. Lien : [absent](absent.md).'
    const { check, ui } = inThread(open, ['liste.js:4'], <Markdown text={text} />)
    const view = render(ui)
    // Tant qu'on ne sait pas : du code, jamais un lien.
    expect(document.querySelectorAll('[data-testid=file-link] code')).toHaveLength(0)
    await settle()
    expect(check).toHaveBeenCalledTimes(1)
    expect(check.mock.calls[0]?.[0]).toEqual([
      'package.json',
      'tests/liste.test.js',
      '../liste.js',
      'liste.js:4'
    ])
    for (const missing of ['package.json', 'tests/liste.test.js', '../liste.js']) {
      expect(screen.getByText(missing).closest('a'), missing).toBeNull()
    }
    expect(screen.getAllByText('liste.js:4').map((c) => c.closest('a')?.dataset['testid'])).toEqual(
      ['file-link', 'file-link']
    )
    // Un vrai lien Markdown ne change pas : toujours un lien, même vers un fichier absent.
    expect(screen.getByText('absent').dataset['testid']).toBe('file-link')
    // Un nouveau rendu du même message ne redemande rien ; remonté (fil rouvert), seuls les absents
    // sont redemandés : ils ont pu être créés depuis.
    view.rerender(ui)
    await settle()
    expect(check).toHaveBeenCalledTimes(1)
    view.unmount()
    render(ui)
    await settle()
    expect(check.mock.calls[1]?.[0]).toEqual(['package.json', 'tests/liste.test.js', '../liste.js'])
  })

  it('fichier trouvé retenu : le message rendu de nouveau est un lien d’emblée, sans clignoter', async () => {
    const open = vi.fn()
    const { check, ui } = inThread(open, ['src/a.js'], <Markdown text={'Voir `src/a.js`.'} />)
    const first = render(ui)
    await settle()
    first.unmount()
    render(ui)
    // Avant toute réponse : déjà un lien.
    expect(screen.getByText('src/a.js').closest('a')?.dataset['testid']).toBe('file-link')
    await settle()
    expect(check).toHaveBeenCalledTimes(1)
  })

  it('sans personne pour vérifier (aperçu hors d’un fil), ni vérification possible : du code', async () => {
    render(<Markdown text={'Voir `src/a.js`.'} />)
    expect(screen.getByText('src/a.js').closest('a')).toBeNull()
    const failing = vi.fn<CheckFileLinks>(() => Promise.reject(new Error('IPC')))
    render(
      <FileLinksContext.Provider value={vi.fn()}>
        <FileExistsContext.Provider value={failing}>
          <Markdown text={'Voir `src/b.js`.'} />
        </FileExistsContext.Provider>
      </FileLinksContext.Provider>
    )
    await settle()
    expect(failing).toHaveBeenCalledTimes(1)
    expect(screen.getByText('src/b.js').closest('a')).toBeNull()
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
