/**
 * Onglet « Navigateur » (fiches 007, 094, 129, 132, 146, 269) sans la vue native : barre, puces,
 * onglets, bandeau de téléchargement, avertissement de certificat et mode Annoter. Ce que la vue
 * native fait d'elle-même (pose, gel, entrées réelles, zoom de Chromium) reste dans les e2e
 * `browser`, `browser-view`, `browser-annotate` et `certificats`.
 */
import * as Tooltip from '@radix-ui/react-tooltip'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { t } from 'i18next'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  BrowserCertificateProblem,
  BrowserCommand,
  BrowserDownload,
  BrowserState
} from '@shared/browser'
import type { PageFreeze, PageLayerEvent } from '@shared/page-notes'
import { pageNotes } from '../../page-notes-store'
import { BrowserTab } from './BrowserTab'

vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
)

const CONV = 'c1'

const base: BrowserState = {
  conversationId: CONV,
  tabs: [{ id: 't1', title: 'Accueil', url: 'http://localhost:5173/' }],
  activeTab: 't1',
  url: 'http://localhost:5173/',
  title: 'Accueil',
  loading: false,
  canGoBack: false,
  canGoForward: false,
  zoom: 1
}

const freeze: PageFreeze = {
  data: 'iVBORw0KGgo=',
  mimeType: 'image/png',
  url: base.url,
  title: 'Accueil',
  width: 800,
  height: 600,
  scrollX: 0,
  scrollY: 0,
  zoom: 1,
  emulated: false
}

let stateListener: ((s: BrowserState) => void) | null
let downloadListener: ((d: BrowserDownload) => void) | null
let annotateListener: ((e: PageLayerEvent) => void) | null
let commandListeners: ((c: BrowserCommand) => void)[]
const api = {
  getState: vi.fn(),
  onState: vi.fn((listener: (s: BrowserState) => void) => {
    stateListener = listener
    return () => {}
  }),
  onDownload: vi.fn((listener: (d: BrowserDownload) => void) => {
    downloadListener = listener
    return () => {}
  }),
  onCommand: vi.fn((listener: (c: BrowserCommand) => void) => {
    commandListeners.push(listener)
    return () => {
      commandListeners = commandListeners.filter((l) => l !== listener)
    }
  }),
  onAnnotate: vi.fn((listener: (e: PageLayerEvent) => void) => {
    annotateListener = listener
    return () => {}
  }),
  show: vi.fn(),
  hide: vi.fn(),
  navigate: vi.fn(),
  go: vi.fn(),
  selectTab: vi.fn(),
  closeTab: vi.fn(),
  zoom: vi.fn(),
  clearEmulation: vi.fn(),
  capture: vi.fn(),
  showDownload: vi.fn(),
  annotate: vi.fn(),
  pagePins: vi.fn(),
  freeze: vi.fn(),
  noteShot: vi.fn()
}
const forgetCertificate = vi.fn()

/** Toutes les fonctions simulées rendent une promesse résolue, sauf réglage contraire. */
beforeEach(() => {
  stateListener = null
  downloadListener = null
  annotateListener = null
  commandListeners = []
  const listeners: unknown[] = [api.onState, api.onDownload, api.onCommand, api.onAnnotate]
  for (const fn of Object.values(api)) {
    if (listeners.includes(fn)) fn.mockClear()
    else fn.mockReset().mockResolvedValue(undefined)
  }
  api.getState.mockResolvedValue(base)
  api.navigate.mockResolvedValue(base.url)
  api.freeze.mockResolvedValue(freeze)
  api.noteShot.mockResolvedValue(freeze)
  forgetCertificate.mockReset().mockResolvedValue(undefined)
  window.api.browser = api as unknown as Window['api']['browser']
  window.api.preview = {
    list: async () => [],
    logs: async () => [],
    onChanged: () => () => {}
  } as unknown as Window['api']['preview']
  window.api.settings = { forgetCertificate } as unknown as Window['api']['settings']
})

afterEach(() => pageNotes.clear(CONV))

function renderTab(props: { onSendNotes?: boolean } = {}) {
  return render(
    <Tooltip.Provider>
      <BrowserTab
        conversationId={CONV}
        onSendNotes={props.onSendNotes === false ? undefined : vi.fn()}
      />
    </Tooltip.Provider>
  )
}

/** L'onglet a lu l'état de la page (première lecture). */
async function shownWith(state: BrowserState, props?: { onSendNotes?: boolean }) {
  api.getState.mockResolvedValue(state)
  renderTab(props)
  await waitFor(() =>
    expect((screen.getByTestId('browser-address') as HTMLInputElement).value).not.toBe('')
  )
}

/** Le main pousse un nouvel état. */
function push(state: BrowserState) {
  act(() => stateListener?.(state))
}

describe('barre du navigateur : puces de la page (fiche 129)', () => {
  it('puce de zoom : affichée hors de 100 %, un clic remet la page à 100 %', async () => {
    await shownWith(base)
    expect(screen.queryByTestId('browser-zoom')).toBeNull()
    push({ ...base, zoom: 1.1 })
    const chip = screen.getByTestId('browser-zoom')
    expect(chip.textContent).toBe(t('browser.zoom.chip', { percent: 110 }))
    fireEvent.click(chip)
    expect(api.zoom).toHaveBeenCalledWith(CONV, 'reset')
    push({ ...base, zoom: 1 })
    expect(screen.queryByTestId('browser-zoom')).toBeNull()
  })

  it('puce de taille imposée : la taille, et un clic rend la largeur du panneau', async () => {
    await shownWith({
      ...base,
      emulation: { width: 375, height: 812, mobile: true, scale: 0.6 }
    })
    const chip = screen.getByTestId('browser-emulation')
    expect(chip.textContent).toBe(t('browser.emulation.chip', { width: 375, height: 812 }))
    expect(chip.getAttribute('aria-label')).toBe(t('browser.emulation.tip', { percent: 60 }))
    fireEvent.click(chip)
    expect(api.clearEmulation).toHaveBeenCalledWith(CONV)
    // L'émulation finie (fin du tour ou clic), la puce part.
    push(base)
    expect(screen.queryByTestId('browser-emulation')).toBeNull()
  })
})

describe('onglets de la page (fiche 007)', () => {
  it('un seul onglet : pas de bandeau ; deux : deux puces, choisir et fermer passent au main', async () => {
    await shownWith(base)
    expect(screen.queryByTestId('browser-tabs')).toBeNull()
    push({
      ...base,
      tabs: [...base.tabs, { id: 't2', title: '', url: 'https://exemple.com/' }],
      activeTab: 't2',
      url: 'https://exemple.com/'
    })
    const chips = screen.getAllByTestId('browser-tab-chip')
    expect(chips).toHaveLength(2)
    // L'onglet actif est marqué ; sans titre, l'adresse.
    expect(chips[1]?.className).toContain('active')
    expect(chips[1]?.querySelector('[role=tab]')?.getAttribute('aria-selected')).toBe('true')
    expect(chips[1]?.querySelector('[role=tab]')?.textContent).toBe('https://exemple.com/')
    fireEvent.click(chips[0]?.querySelector('[role=tab]') as HTMLElement)
    expect(api.selectTab).toHaveBeenCalledWith(CONV, 't1')
    fireEvent.click(chips[1]?.querySelector('.browser-tab-close') as HTMLElement)
    expect(api.closeTab).toHaveBeenCalledWith(CONV, 't2')
    // Fermé par le main : retour au précédent, plus de bandeau.
    push(base)
    expect(screen.queryByTestId('browser-tabs')).toBeNull()
    expect((screen.getByTestId('browser-address') as HTMLInputElement).value).toBe(base.url)
  })
})

describe('téléchargement terminé (fiche 094)', () => {
  it('« Afficher dans le Finder » montre le fichier enregistré ; l’autre conversation ne compte pas', async () => {
    await shownWith(base)
    act(() =>
      downloadListener?.({
        conversationId: 'autre',
        name: 'x.csv',
        state: 'completed',
        path: '/x.csv'
      })
    )
    expect(screen.queryByTestId('browser-download')).toBeNull()
    act(() =>
      downloadListener?.({
        conversationId: CONV,
        name: 'export.csv',
        state: 'completed',
        path: '/Users/moi/Downloads/export.csv'
      })
    )
    expect(screen.getByTestId('browser-download').textContent).toContain(
      t('browser.download.saved', { name: 'export.csv' })
    )
    fireEvent.click(screen.getByTestId('browser-download-show'))
    expect(api.showDownload).toHaveBeenCalledWith(CONV, '/Users/moi/Downloads/export.csv')
  })

  it('échec : dit, sans « Afficher dans le Finder »', async () => {
    await shownWith(base)
    act(() => downloadListener?.({ conversationId: CONV, name: 'gros.zip', state: 'interrupted' }))
    expect(screen.getByTestId('browser-download').textContent).toContain(
      t('browser.download.failed', { name: 'gros.zip' })
    )
    expect(screen.queryByTestId('browser-download-show')).toBeNull()
  })
})

const problem: BrowserCertificateProblem = {
  token: 'jeton-1',
  url: 'https://localhost:5173/',
  host: 'localhost',
  port: 5173,
  error: 'net::ERR_CERT_AUTHORITY_INVALID',
  subject: 'localhost',
  issuer: 'localhost',
  fingerprint: `${'AB:'.repeat(31)}AB`,
  bypassable: true,
  rememberable: true
}

describe('certificat refusé et exception (fiche 269)', () => {
  it('adresse tapée, certificat refusé : l’avertissement, sans ligne d’erreur rouge sous la barre', async () => {
    await shownWith(base)
    const address = screen.getByTestId('browser-address')
    fireEvent.focus(address)
    fireEvent.change(address, { target: { value: 'https://localhost:5173' } })
    // Le main rend la main sans erreur (`loadWithin`) et pousse l'état avec l'avertissement.
    await act(async () => {
      fireEvent.submit(address.closest('form') as HTMLFormElement)
    })
    expect(api.navigate).toHaveBeenCalledWith(CONV, 'https://localhost:5173')
    push({ ...base, url: problem.url, certificate: problem })
    expect(screen.getByTestId('certificate-warning')).toBeTruthy()
    expect(document.querySelector('.browser-error')).toBeNull()
    // Rien à joindre ni à annoter sous l'avertissement.
    expect((screen.getByTestId('browser-annotate') as HTMLButtonElement).disabled).toBe(true)
  })

  it('« Revenir en lieu sûr » sans page précédente : page vide, rien d’accordé', async () => {
    window.api.browser = {
      ...api,
      leaveCertificate: vi.fn().mockResolvedValue(undefined),
      allowCertificate: vi.fn()
    } as unknown as Window['api']['browser']
    await shownWith({ ...base, url: problem.url, certificate: problem })
    fireEvent.click(screen.getByTestId('certificate-back'))
    expect(window.api.browser.leaveCertificate).toHaveBeenCalledWith(CONV)
    expect(window.api.browser.allowCertificate).not.toHaveBeenCalled()
    // Le main charge `about:blank` : l'onglet dit qu'il n'y a pas de page.
    push({ ...base, url: 'about:blank', title: '' })
    expect(screen.queryByTestId('certificate-warning')).toBeNull()
    expect(document.querySelector('.browser-page .side-panel-empty')).not.toBeNull()
  })

  it('« Non sécurisé » : hôte et port visibles, menu « Certificat accepté pour… », « Ne plus accepter » révoque', async () => {
    const exception = {
      host: 'localhost',
      port: 5173,
      fingerprint: problem.fingerprint,
      error: problem.error
    }
    await shownWith({ ...base, url: 'https://localhost:5173/app', insecure: exception })
    // « https:// » laisse la place à l'hôte et au port.
    expect((screen.getByTestId('browser-address') as HTMLInputElement).value).toBe(
      'localhost:5173/app'
    )
    const chip = screen.getByTestId('browser-insecure')
    expect(chip.getAttribute('aria-label')).toContain(t('browser.insecure.chip'))
    fireEvent.pointerDown(chip, { button: 0, ctrlKey: false })
    const menu = await screen.findByTestId('browser-insecure-menu')
    expect(menu.textContent).toContain(t('browser.insecure.menuLabel', { site: 'localhost:5173' }))
    fireEvent.click(screen.getByTestId('browser-insecure-revoke'))
    expect(forgetCertificate).toHaveBeenCalledWith(exception)
  })

  it('« Non sécurisé » sur le port 443 : le site sans port', async () => {
    const exception = { host: '192.168.1.20', port: 443, fingerprint: 'AA', error: problem.error }
    await shownWith({ ...base, url: 'https://192.168.1.20/', insecure: exception })
    fireEvent.pointerDown(screen.getByTestId('browser-insecure'), { button: 0, ctrlKey: false })
    expect((await screen.findByTestId('browser-insecure-menu')).textContent).toContain(
      t('browser.insecure.menuLabel', { site: '192.168.1.20' })
    )
  })
})

describe('mode Annoter (fiches 132, 146)', () => {
  // jsdom ne met rien en page : la zone figée doit avoir une taille pour montrer la bulle.
  const width = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth')
  const height = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight')
  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get: () => 800
    })
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      get: () => 600
    })
  })
  afterEach(() => {
    if (width) Object.defineProperty(HTMLElement.prototype, 'clientWidth', width)
    if (height) Object.defineProperty(HTMLElement.prototype, 'clientHeight', height)
  })

  let nextId = 1
  /** Clic dans la page vivante : le script de la page l'envoie, la page se fige, la bulle s'ouvre. */
  async function clickInPage(x = 120, y = 80) {
    const id = `n${nextId++}`
    await act(async () => {
      annotateListener?.({
        kind: 'place',
        id,
        point: { x, y },
        doc: { x, y },
        element: { tag: 'button', selector: 'button#ok', text: 'OK', field: false, label: '' },
        pins: {},
        conversationId: CONV,
        url: base.url
      })
    })
    return screen.findByTestId('page-note-input')
  }

  async function annotating() {
    await shownWith(base)
    const button = screen.getByTestId('browser-annotate')
    expect(button.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(button)
    await waitFor(() => expect(api.annotate).toHaveBeenCalledWith(CONV, true, expect.anything()))
    return button
  }

  async function addNote(text: string) {
    const input = await clickInPage()
    fireEvent.change(input, { target: { value: text } })
    await act(async () => {
      fireEvent.click(screen.getByTestId('page-note-save'))
    })
    await waitFor(() => expect(screen.queryByTestId('page-frozen')).toBeNull())
  }

  it('bouton « Annoter » enfoncé et bandeau d’aide ; second clic : le mode finit, le script part', async () => {
    const button = await annotating()
    expect(button.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByTestId('page-annotate-hint').textContent).toContain(
      t('browser.annotate.hint')
    )
    fireEvent.click(button)
    expect(button.getAttribute('aria-pressed')).toBe('false')
    expect(screen.queryByTestId('page-annotate-hint')).toBeNull()
    expect(api.annotate).toHaveBeenLastCalledWith(CONV, false, null)
  })

  it('Échap dans la bulle : la remarque est abandonnée, le mode continue', async () => {
    const button = await annotating()
    const input = await clickInPage()
    expect(screen.getByTestId('page-frozen')).toBeTruthy()
    fireEvent.change(input, { target: { value: 'à jeter' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByTestId('page-frozen')).toBeNull()
    expect(screen.queryByTestId('page-notes-bar')).toBeNull()
    expect(pageNotes.get(CONV)?.notes ?? []).toHaveLength(0)
    expect(button.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByTestId('page-annotate-hint')).toBeTruthy()
  })

  it('« Ajouter » : la barre compte les remarques ; ⌘↩ aussi', async () => {
    await annotating()
    await addNote('premier')
    expect(screen.getByTestId('page-notes-bar').textContent).toContain(
      t('diffNotes.count', { count: 1 })
    )
    const input = await clickInPage(300, 400)
    // Numéro de la nouvelle épingle : la suivante.
    expect(screen.getByTestId('page-pin').textContent).toBe('2')
    fireEvent.change(input, { target: { value: 'deuxième' } })
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter', metaKey: true })
    })
    await waitFor(() => expect(screen.queryByTestId('page-frozen')).toBeNull())
    await addNote('troisième')
    expect(screen.getByTestId('page-notes-bar').textContent).toContain(
      t('diffNotes.count', { count: 3 })
    )
    // Chaque remarque a pris sa capture propre (page encore masquée).
    expect(api.noteShot).toHaveBeenCalledTimes(3)
  })

  it('fin du mode (bouton, ou Échap tapé dans la page) : les remarques sont gardées', async () => {
    const button = await annotating()
    await addNote('une')
    await addNote('deux')
    fireEvent.click(button)
    expect(button.getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByTestId('page-notes-bar').textContent).toContain(
      t('diffNotes.count', { count: 2 })
    )
    // Repris puis fini par Échap tapé dans la page (commande du main) : toujours là.
    fireEvent.click(button)
    await waitFor(() => expect(button.getAttribute('aria-pressed')).toBe('true'))
    act(() =>
      commandListeners.forEach((l) => l({ conversationId: CONV, command: 'annotate-escape' }))
    )
    expect(button.getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByTestId('page-notes-bar').textContent).toContain(
      t('diffNotes.count', { count: 2 })
    )
  })

  it('hors du mode Annoter, un clic remonté par la page n’ouvre pas de bulle', async () => {
    await shownWith(base)
    await act(async () => {
      annotateListener?.({
        kind: 'place',
        id: 'x',
        point: { x: 1, y: 1 },
        doc: { x: 1, y: 1 },
        element: null,
        pins: {},
        conversationId: CONV,
        url: base.url
      })
    })
    expect(api.freeze).not.toHaveBeenCalled()
    expect(screen.queryByTestId('page-frozen')).toBeNull()
  })
})
