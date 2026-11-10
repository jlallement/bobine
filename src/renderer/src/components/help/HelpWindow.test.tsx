import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { HelpTarget } from '@shared/help-topics'
import { HelpMarkdown } from './HelpMarkdown'
import { createApi, helpViewApi, type Invoke, type Subscribe } from '../../../../preload/api'
import { setLanguage } from '../../i18n'
import { HelpWindow } from './HelpWindow'

const originalApi = window.api
let navigate: ((target: HelpTarget) => void) | undefined
let focusSearch: (() => void) | undefined
let showChangelog: ReturnType<typeof vi.fn>

beforeEach(() => {
  showChangelog = vi.fn(async () => undefined)
  window.api = {
    ...originalApi,
    settings: { get: () => new Promise(() => {}), onChanged: () => () => {} },
    help: {
      target: async () => ({ target: { page: 'worktrees', anchor: 'preparation' }, search: false }),
      showChangelog,
      onNavigate: (l: (t: HelpTarget) => void) => {
        navigate = l
        return () => {}
      },
      onFocusSearch: (l: () => void) => {
        focusSearch = l
        return () => {}
      }
    }
  } as unknown as Window['api']
  Element.prototype.scrollIntoView = vi.fn()
  sessionStorage.clear()
})
afterEach(() => {
  window.api = originalApi
})

describe('fenêtre d’aide (fiche 186)', () => {
  it('s’ouvre à la page et à l’ancre demandées, avec le sommaire et le fil d’Ariane', async () => {
    render(<HelpWindow />)
    const heading = await screen.findByRole('heading', {
      name: /Préparer chaque nouveau worktree|préparation/i
    })
    expect(heading.id).toBe('preparation')
    await waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalled())
    expect(screen.getByTestId('help-toc-worktrees').getAttribute('aria-current')).toBe('page')
    expect(screen.getByTestId('help-crumb').textContent).toContain('Worktrees')
    expect(document.title).toBe('Aide de Bobine')
  })

  it('recherche pendant la frappe, au clavier seul : ↓, ↩ ouvre la section, Échap efface', async () => {
    render(<HelpWindow />)
    await screen.findByTestId('help-toc-worktrees')
    const input = screen.getByTestId('help-search')
    act(() => focusSearch?.())
    expect(document.activeElement).toBe(input)
    fireEvent.change(input, { target: { value: 'quand tout est vert' } })
    const results = await screen.findAllByTestId('help-result')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0]?.querySelector('mark')).not.toBeNull()
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(screen.getByTestId('help-page').dataset['page']).toBe('suivi-pr-ci'))
    fireEvent.keyDown(input, { key: 'Escape' })
    expect((input as HTMLInputElement).value).toBe('')
    expect(screen.getByTestId('help-toc')).toBeTruthy()
    // Retapé aussitôt après Échap : jamais les résultats de la recherche d'avant.
    fireEvent.change(input, { target: { value: 'zzzzqqq' } })
    expect(screen.queryAllByTestId('help-result')).toHaveLength(0)
    expect(await screen.findByTestId('help-no-result')).toBeTruthy()
  })

  it('suit les pages envoyées par l’app ; ⌘[ revient en arrière', async () => {
    render(<HelpWindow />)
    await screen.findByTestId('help-toc-worktrees')
    act(() => navigate?.({ page: 'aparte', anchor: 'poser' }))
    await waitFor(() => expect(screen.getByTestId('help-page').dataset['page']).toBe('aparte'))
    fireEvent.keyDown(window, { key: '[', metaKey: true })
    await waitFor(() => expect(screen.getByTestId('help-page').dataset['page']).toBe('worktrees'))
    fireEvent.keyDown(window, { key: ']', metaKey: true })
    await waitFor(() => expect(screen.getByTestId('help-page').dataset['page']).toBe('aparte'))
  })
})

describe('rendu d’une page du guide (fiche 186)', () => {
  const page = (text: string, onLink = vi.fn()) => {
    const { container } = render(
      <HelpMarkdown text={text} lang="fr" page="worktrees" onLink={onLink} />
    )
    return container
  }

  it('aucun HTML brut ni script : seule l’ancre `<a id>` est lue', () => {
    const root = page(
      '<a id="ok"></a>\n\n## Titre\n\n<script>alert(1)</script>\n\n<img src=x onerror="alert(1)">\n\nTexte <b>gras</b> <iframe src="https://x"></iframe>\n'
    )
    expect(root.querySelector('h2')?.id).toBe('ok')
    expect(root.querySelector('script, iframe, img, b')).toBeNull()
    expect(root.innerHTML).not.toContain('onerror')
  })

  it('liens : aide dans l’app, http(s) dans le navigateur, le reste désactivé', () => {
    const onLink = vi.fn()
    const root = page(
      '[a](faire-relire.md#lancer) [b](https://example.com) [c](javascript:alert(1)) [d](../../../CHANGELOG.md)',
      onLink
    )
    const links = root.querySelectorAll('a')
    expect([...links].map((a) => a.getAttribute('href'))).toEqual(['#', 'https://example.com', '#'])
    expect(links[1]?.getAttribute('target')).toBe('_blank')
    expect(root.textContent).toContain('c')
    fireEvent.click(links[0] as Element)
    expect(onLink).toHaveBeenLastCalledWith({
      kind: 'page',
      lang: 'fr',
      page: 'faire-relire',
      anchor: 'lancer'
    })
    fireEvent.click(links[2] as Element)
    expect(onLink).toHaveBeenLastCalledWith({ kind: 'changelog' })
  })

  it('images : celles du guide seulement', () => {
    const root = page('![ok](../images/fr/aparte-carte.png) ![non](https://example.com/x.png)')
    const images = root.querySelectorAll('img')
    expect(images).toHaveLength(1)
    expect(images[0]?.getAttribute('alt')).toBe('ok')
  })
})

describe('fenêtre d’aide : relecture (fiche 186)', () => {
  it('changer de langue garde la page ouverte ; la cible initiale est lue une seule fois', async () => {
    const target = vi.fn(async () => ({ target: { page: 'worktrees' }, search: false }))
    window.api = { ...window.api, help: { ...window.api.help, target } } as unknown as Window['api']
    render(<HelpWindow />)
    await screen.findByTestId('help-toc-worktrees')
    act(() => navigate?.({ page: 'aparte', anchor: 'poser' }))
    await waitFor(() => expect(screen.getByTestId('help-page').dataset['page']).toBe('aparte'))
    await act(async () => setLanguage('en'))
    await waitFor(() => expect(document.title).toBe('Bobine Help'))
    expect(screen.getByTestId('help-page').dataset['page']).toBe('aparte')
    // StrictMode n'est pas là : un seul appel.
    expect(target).toHaveBeenCalledTimes(1)
    await act(async () => setLanguage('fr'))
  })
})

describe('vue d’aide avec la seule API réduite (fiche 186)', () => {
  it('s’ouvre, cherche et navigue sans rien d’autre que helpViewApi', async () => {
    const invoke = vi.fn(async (channel: string) =>
      channel === 'help:target'
        ? { target: { page: 'aparte' }, search: false }
        : new Promise(() => {})
    ) as unknown as Invoke
    const subscribe = (() => () => {}) as unknown as Subscribe
    window.api = helpViewApi(createApi(invoke, subscribe)) as unknown as Window['api']
    render(<HelpWindow />)
    await waitFor(() => expect(screen.getByTestId('help-page').dataset['page']).toBe('aparte'))
    fireEvent.change(screen.getByTestId('help-search'), { target: { value: 'worktree' } })
    expect((await screen.findAllByTestId('help-result')).length).toBeGreaterThan(0)
    const channels = (invoke as unknown as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0])
    expect(new Set(channels)).toEqual(new Set(['help:target', 'settings:get']))
  })

  it('« Recharger » : la vue revient à la page où elle en était, pas à la cible initiale', async () => {
    sessionStorage.clear()
    const first = render(<HelpWindow />)
    await screen.findByTestId('help-toc-worktrees')
    act(() => navigate?.({ page: 'aparte', anchor: 'poser' }))
    await waitFor(() => expect(screen.getByTestId('help-page').dataset['page']).toBe('aparte'))
    first.unmount()
    render(<HelpWindow />)
    await waitFor(() => expect(screen.getByTestId('help-page').dataset['page']).toBe('aparte'))
    sessionStorage.clear()
  })
})
