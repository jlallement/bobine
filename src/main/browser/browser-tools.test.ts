import { describe, expect, it, vi } from 'vitest'
import type { ToolContext } from '../mcp/tools'
import type { SiteMemory } from '../approvals'
import type { ImageCodec } from '../filmstrip/sheet'
import type { DialogAnswer, PageDialog } from './page-dialogs'
import {
  browserToolsModule,
  parseKeyCombo,
  type BrowserDriver,
  type DownloadNote
} from './browser-tools'

function fakePage(overrides: Partial<BrowserDriver> = {}) {
  let url = 'about:blank'
  const page = {
    navigate: vi.fn(async (next: string) => {
      url = next
    }),
    go: vi.fn(async () => {}),
    current: () => ({ url, title: 'Titre' }),
    viewport: () => ({ width: 800, height: 600 }),
    screenshot: vi.fn(async (scale: number) => ({
      data: 'AA==',
      mimeType: 'image/jpeg',
      width: 800 * scale,
      height: 600 * scale
    })),
    // Film : une image grise différente par appel de `run`, plus celles d'avant et d'après.
    film: vi.fn(async (run: () => Promise<void>) => {
      await run()
      return [0, 40, 80, 400].map((at, i) => ({ at, jpeg: Buffer.from([i * 60]) }))
    }) as BrowserDriver['film'],
    readTree: vi.fn(async () => ({ lines: ['- button "Valider" [ref_1]'], truncated: false })),
    find: vi.fn(async () => ['- button "Valider" [ref_1]']),
    pointOf: vi.fn(async () => null) as BrowserDriver['pointOf'],
    setValue: vi.fn(async () => null) as BrowserDriver['setValue'],
    pageText: vi.fn(async () => 'Bonjour'),
    click: vi.fn(async () => {}),
    move: vi.fn(async () => {}),
    drag: vi.fn(async () => {}),
    wheel: vi.fn(async () => {}),
    insertText: vi.fn(async () => {}),
    key: vi.fn(async () => {}),
    console: vi.fn(() => [
      { level: 'log', text: 'bonjour' },
      { level: 'error', text: 'TypeError: x is undefined', source: 'app.js:3' }
    ]),
    clearConsole: vi.fn(),
    network: vi.fn(() => [
      { id: '1', method: 'GET', url: 'http://localhost/api', type: 'Fetch', status: 500 },
      {
        id: '2',
        method: 'GET',
        url: 'http://localhost/logo.png',
        type: 'Image',
        failed: 'net::ERR'
      }
    ]),
    responseBody: vi.fn(async () => '{"erreur":"boum"}'),
    evaluatePage: vi.fn(async () => ({ total: 3 })),
    emulate: vi.fn(async () => {}),
    colorScheme: vi.fn(async () => {}),
    tabs: vi.fn(() => [{ id: 'onglet-1', title: 'A', url: 'http://localhost/', active: true }]),
    newTab: vi.fn(async () => 'onglet-2'),
    selectTab: vi.fn(),
    closeTab: vi.fn(),
    ...overrides
  }
  return page
}

/** Faux codec : un faux JPEG d'un octet (son gris) devient une image unie. */
const imageCodec: ImageCodec = {
  bitmap: (jpeg, width, height) => {
    const data = new Uint8Array(width * height * 4).fill(jpeg[0] ?? 0)
    return { width, height, data }
  },
  jpeg: () => Buffer.from('planche')
}

function setup(
  answer: string[] | null | 'late' = ['Autoriser'],
  page = fakePage(),
  alwaysSites?: SiteMemory
) {
  const module = browserToolsModule({
    driverFor: () => page,
    ...(alwaysSites ? { alwaysSites } : {}),
    imageCodec
  })
  const late: ((choices: string[] | null) => void)[] = []
  const told: string[] = []
  const context: ToolContext = {
    workspace: '/tmp',
    conversationId: 'c1',
    ask: vi.fn(async (_args, onLate) => {
      if (onLate) late.push(onLate)
      return answer
    }),
    proposeChild: async () => ({ action: 'refuse' as const }),
    tellAgent: (text) => told.push(text)
  }
  const tools = module.tools(context)
  const call = async (name: string, args: unknown = {}) => {
    const tool = tools.find((t) => t.definition.name === name)
    if (!tool) throw new Error(`outil absent : ${name}`)
    return tool.call(args)
  }
  const firstText = async (name: string, args: unknown = {}) => {
    const result = await call(name, args)
    const first = result.content[0]
    return first?.type === 'text' ? first.text : ''
  }
  return { module, page, context, call, firstText, late, told }
}

describe('outils du navigateur', () => {
  it('tous autorisés d’office et rattachés à l’onglet « Navigateur »', () => {
    const { module, context } = setup()
    const tools = module.tools(context)
    expect(tools.every((t) => t.autoAllow && t.panel === 'browser')).toBe(true)
    expect(tools.map((t) => t.definition.name)).toContain('browser_batch')
  })

  it('page locale : ouverte sans rien demander', async () => {
    const t = setup()
    expect(await t.firstText('browser_navigate', { url: 'localhost:3000/essai' })).toContain(
      'http://localhost:3000/essai'
    )
    expect(t.context.ask).not.toHaveBeenCalled()
  })

  it('site extérieur : accord demandé une fois par conversation', async () => {
    const t = setup(['Autoriser'])
    await t.call('browser_navigate', { url: 'exemple.com' })
    await t.call('browser_navigate', { url: 'https://exemple.com/autre' })
    expect(t.context.ask).toHaveBeenCalledTimes(1)
    expect(t.page.navigate).toHaveBeenLastCalledWith('https://exemple.com/autre')
  })

  it('popup bloquée pendant une action de l’agent : il est prié de demander à l’utilisateur (fiche 072)', async () => {
    const page = fakePage()
    const blocked = ['https://accounts.example.com/o/oauth2']
    page.blockedPopups = () => blocked.splice(0)
    const t = setup(['Autoriser'], page)
    const result = await t.call('browser_click', { coordinate: [10, 20] })
    const text = result.content.map((c) => (c.type === 'text' ? c.text : '')).join('\n')
    expect(text).toContain('https://accounts.example.com/o/oauth2')
    expect(text).toContain('ask the user to click that button')
    // Dit une seule fois.
    const next = await t.call('browser_click', { coordinate: [10, 20] })
    expect(next.content.some((c) => c.type === 'text' && c.text.includes('popup'))).toBe(false)
  })

  it('téléchargement lancé par l’agent : la décision revient à l’utilisateur, puis son choix (fiche 094)', async () => {
    const page = fakePage()
    const notes: DownloadNote[] = [{ name: 'export.csv', state: 'asking' }]
    page.downloads = () => notes.splice(0)
    const t = setup(['Autoriser'], page)
    const text = async () =>
      (await t.call('browser_click', { coordinate: [10, 20] })).content
        .map((c) => (c.type === 'text' ? c.text : ''))
        .join('\n')
    const asking = await text()
    expect(asking).toContain('started a download (export.csv)')
    expect(asking).toContain('Save dialog')
    expect(await text()).not.toContain('download')
    notes.push({ name: 'export.csv', state: 'completed', path: '/Users/ada/Downloads/export.csv' })
    expect(await text()).toContain('the user saved the download export.csv to /Users/ada/Downloads')
    notes.push({ name: 'rapport.pdf', state: 'cancelled' })
    expect(await text()).toContain('the user cancelled the download rapport.pdf')
  })

  it('boîte de la page (fiche 097) : dite à l’agent, puis la réponse de l’utilisateur', async () => {
    const page = fakePage()
    let dialog: PageDialog | undefined = { type: 'confirm', message: 'Supprimer « Dune » ?' }
    const answers: DialogAnswer[] = []
    page.dialog = () => dialog
    page.dialogAnswers = () => answers.splice(0)
    const t = setup(['Autoriser'], page)
    const text = async () =>
      (await t.call('browser_click', { coordinate: [10, 20] })).content
        .map((c) => (c.type === 'text' ? c.text : ''))
        .join('\n')
    const open = await text()
    expect(open).toContain('The page is showing a confirm dialog: "Supprimer « Dune » ?"')
    dialog = undefined
    answers.push({ type: 'confirm', message: 'Supprimer « Dune » ?', accepted: false })
    const answered = await text()
    expect(answered).toContain("the user answered the page's confirm dialog")
    expect(answered).toContain(': Cancel.')
    expect(answered).not.toContain('is showing')
  })

  it('« Toujours autoriser » (fiche 072) : retenu sur ce Mac, plus de question ailleurs', async () => {
    const remembered = new Set<string>()
    const memory: SiteMemory = { has: (s) => remembered.has(s), add: (s) => remembered.add(s) }
    const t = setup(['Toujours autoriser'], fakePage(), memory)
    await t.call('browser_navigate', { url: 'exemple.com' })
    expect(remembered).toEqual(new Set(['exemple.com']))
    const options = vi.mocked(t.context.ask).mock.calls[0]?.[0].options.map((o) => o.label)
    expect(options).toEqual(['Autoriser', 'Toujours autoriser', 'Refuser'])
    // Une autre conversation n'a rien à demander pour ce site.
    const other = setup(null, fakePage(), memory)
    await other.call('browser_navigate', { url: 'https://exemple.com/autre' })
    expect(other.context.ask).not.toHaveBeenCalled()
    expect(other.page.navigate).toHaveBeenCalledWith('https://exemple.com/autre')
  })

  it('site refusé : rien n’est ouvert, l’agent est prévenu', async () => {
    const t = setup(['Refuser'])
    expect(await t.firstText('browser_navigate', { url: 'exemple.com' })).toContain('refused')
    expect(t.page.navigate).not.toHaveBeenCalled()
  })

  it('réponse tardive : l’agent finit son tour, l’accord arrive ensuite en message', async () => {
    const t = setup('late')
    expect(await t.firstText('browser_navigate', { url: 'exemple.com' })).toContain('End your turn')
    t.late[0]?.(['Autoriser'])
    expect(t.told).toEqual([
      'J’ai autorisé exemple.com : tu peux reprendre (https://exemple.com/).'
    ])
    await t.call('browser_navigate', { url: 'exemple.com' })
    expect(t.page.navigate).toHaveBeenCalledWith('https://exemple.com/')
  })

  it('site ouvert par l’utilisateur lui-même : l’agent peut y revenir sans demande', async () => {
    const t = setup(null)
    t.module.approveSite('c1', 'https://exemple.com/page')
    await t.call('browser_navigate', { url: 'exemple.com' })
    expect(t.context.ask).not.toHaveBeenCalled()
  })

  it('adresses refusées : file:, javascript:', async () => {
    const t = setup()
    await expect(t.call('browser_navigate', { url: 'file:///etc/passwd' })).rejects.toThrow('http')
    await expect(t.call('browser_navigate', { url: 'javascript:alert(1)' })).rejects.toThrow()
  })

  it('capture : texte avec le repère des coordonnées, puis l’image', async () => {
    const t = setup()
    const result = await t.call('browser_screenshot', { scale: 0.5 })
    expect(result.content[0]).toMatchObject({ type: 'text', text: expect.stringContaining('×0.5') })
    expect(result.content[1]).toEqual({ type: 'image', data: 'AA==', mimeType: 'image/jpeg' })
  })

  it('clic par référence (position calculée dans la page) ou par coordonnées', async () => {
    const page = fakePage({ pointOf: vi.fn(async () => ({ x: 10, y: 20 })) })
    const t = setup(['Autoriser'], page)
    await t.call('browser_click', { ref: 'ref_3' })
    expect(page.click).toHaveBeenCalledWith({ x: 10, y: 20 }, 'left', 1)
    await t.call('browser_click', { coordinate: [5.4, 6.6], double: true })
    expect(page.click).toHaveBeenLastCalledWith({ x: 5, y: 7 }, 'left', 2)
    await expect(t.call('browser_click', {})).rejects.toThrow('ref')
  })

  it('référence disparue : erreur claire', async () => {
    const t = setup()
    await expect(t.call('browser_click', { ref: 'ref_9' })).rejects.toThrow('relisez la page')
  })

  it('lot : actions dans l’ordre, arrêt à la première erreur', async () => {
    const t = setup()
    const result = await t.call('browser_batch', {
      actions: [
        { tool: 'browser_type', args: { text: 'bonjour' } },
        { tool: 'browser_key', args: { key: 'Enter' } },
        { tool: 'browser_click', args: {} },
        { tool: 'browser_type', args: { text: 'jamais' } }
      ]
    })
    expect(result.isError).toBe(true)
    expect(t.page.insertText).toHaveBeenCalledTimes(1)
    expect(t.page.key).toHaveBeenCalledWith('Enter', [])
    expect(result.content.at(-1)).toMatchObject({ text: expect.stringContaining('Action 3') })
  })

  it('console : erreurs seulement, motif, vidage', async () => {
    const t = setup()
    expect(await t.firstText('browser_console', { only_errors: true })).toBe(
      '[error] TypeError: x is undefined  (app.js:3)'
    )
    expect(await t.firstText('browser_console', { pattern: 'BONJOUR' })).toBe('[log] bonjour')
    await t.call('browser_console', { clear: true })
    expect(t.page.clearConsole).toHaveBeenCalled()
  })

  it('réseau : liste filtrée, échecs signalés, corps d’une réponse', async () => {
    const t = setup()
    const list = await t.firstText('browser_network', { url_pattern: 'localhost' })
    expect(list).toContain('1  GET 500 Fetch  http://localhost/api')
    expect(list).toContain('ÉCHEC Image  http://localhost/logo.png  (net::ERR)')
    expect(await t.firstText('browser_network', { request_id: '1' })).toBe('{"erreur":"boum"}')
  })

  it('JavaScript de débogage : résultat en JSON', async () => {
    const t = setup()
    expect(await t.firstText('browser_javascript', { code: 'compte()' })).toContain('"total": 3')
    await expect(t.call('browser_javascript', {})).rejects.toThrow('code')
  })

  it('taille d’écran et thème : préréglages, tailles libres, retour au panneau', async () => {
    const t = setup()
    await t.call('browser_resize', { preset: 'mobile', color_scheme: 'dark' })
    expect(t.page.emulate).toHaveBeenLastCalledWith({ width: 375, height: 812, mobile: true })
    expect(t.page.colorScheme).toHaveBeenLastCalledWith('dark')
    await t.call('browser_resize', { width: 1440, height: 900 })
    expect(t.page.emulate).toHaveBeenLastCalledWith({ width: 1440, height: 900, mobile: false })
    await t.call('browser_resize', { preset: 'desktop', color_scheme: 'auto' })
    expect(t.page.emulate).toHaveBeenLastCalledWith(undefined)
    expect(t.page.colorScheme).toHaveBeenLastCalledWith(undefined)
    await expect(t.call('browser_resize', { preset: 'montre' })).rejects.toThrow('preset')
  })

  it('taille imposée : l’agent apprend la réduction à l’affichage et la fin au tour suivant', async () => {
    const t = setup(
      ['Autoriser'],
      fakePage({
        viewport: () => ({ width: 375, height: 812 }),
        emulation: () => ({ width: 375, height: 812, scale: 0.6 })
      })
    )
    const text = await t.firstText('browser_resize', { preset: 'mobile' })
    expect(text).toContain('375×812 px')
    expect(text).toContain('Shown at 60% to fit the panel')
    expect(text).toContain('reset at the end of your turn')
  })

  it('onglets : nouvel onglet vers un site extérieur soumis à l’accord, choisir, fermer', async () => {
    const t = setup(['Refuser'])
    expect(await t.firstText('browser_tabs', { action: 'new', url: 'exemple.com' })).toContain(
      'refused'
    )
    expect(t.page.newTab).not.toHaveBeenCalled()
    await t.call('browser_tabs', { action: 'new', url: 'localhost:5173' })
    expect(t.page.newTab).toHaveBeenCalled()
    expect(t.page.navigate).toHaveBeenLastCalledWith('http://localhost:5173/')
    await t.call('browser_tabs', { action: 'select', tab_id: 'onglet-1' })
    expect(t.page.selectTab).toHaveBeenCalledWith('onglet-1')
    expect(await t.firstText('browser_tabs', { action: 'close', tab_id: 'onglet-2' })).toContain(
      '* onglet-1'
    )
  })

  it('lecture et saisie passent par le pilote (arbre d’accessibilité, références)', async () => {
    const t = setup()
    expect(await t.firstText('browser_read_page', { filter: 'all' })).toContain(
      '- button "Valider" [ref_1]'
    )
    expect(t.page.readTree).toHaveBeenCalledWith('all', 30_000)
    await t.call('browser_form_input', { ref: 'ref_1', value: true })
    expect(t.page.setValue).toHaveBeenCalledWith('ref_1', true)
  })

  it('combinaisons de touches', () => {
    expect(parseKeyCombo('cmd+shift+z')).toEqual({ key: 'z', modifiers: ['cmd', 'shift'] })
    expect(parseKeyCombo('Enter')).toEqual({ key: 'Enter', modifiers: [] })
    expect(() => parseKeyCombo('hyper+a')).toThrow('Modificateur')
  })
})

describe('planche contact du navigateur (fiche 075)', () => {
  it('fait les actions pendant le film, rend une planche et ses moments', async () => {
    const t = setup()
    const result = await t.call('browser_filmstrip', {
      actions: [{ tool: 'browser_scroll', args: { direction: 'down' } }],
      duration_ms: 800,
      frames: 3
    })
    expect(t.page.wheel).toHaveBeenCalled()
    expect(t.page.film).toHaveBeenCalledWith(expect.any(Function), 800)
    expect(result.isError).toBeUndefined()
    const [text, image] = result.content
    expect(text?.type === 'text' && text.text).toContain('Contact sheet over 800 ms: 3 frames')
    expect(text?.type === 'text' && text.text).toContain('browser_click')
    expect(image).toEqual({
      type: 'image',
      data: Buffer.from('planche').toString('base64'),
      mimeType: 'image/jpeg'
    })
  })

  it('sans action, regarde seulement ; durée et nombre d’images bornés', async () => {
    const t = setup()
    await t.call('browser_filmstrip', { duration_ms: 60_000, frames: 99 })
    expect(t.page.film).toHaveBeenCalledWith(expect.any(Function), 5000)
    expect(t.page.wheel).not.toHaveBeenCalled()
  })

  it('action inconnue ou capture pendant le film : arrêt, la planche reste, en erreur', async () => {
    const t = setup()
    const result = await t.call('browser_filmstrip', {
      actions: [
        { tool: 'browser_screenshot' },
        { tool: 'browser_scroll', args: { direction: 'down' } }
      ]
    })
    expect(result.isError).toBe(true)
    expect(result.content.some((c) => c.type === 'image')).toBe(true)
    expect(result.content.at(-1)).toMatchObject({ text: expect.stringContaining('Action 1') })
    expect(t.page.wheel).not.toHaveBeenCalled()
  })
})
