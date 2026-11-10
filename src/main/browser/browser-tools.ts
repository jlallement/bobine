/**
 * Outils du navigateur intégré (fiche 007) : l'agent ouvre une page, la lit, agit dessus et prend
 * des captures ; l'utilisateur suit dans l'onglet « Navigateur » du panneau.
 *
 * Écrits contre `BrowserDriver` (une page par conversation) : testables sans Electron.
 */
import { normalizeUrl, siteToApprove } from '@shared/browser'
import {
  dialogAnswerText,
  dialogOpenText,
  type DialogAnswer,
  type PageDialog
} from './page-dialogs'
import type { SiteMemory } from '../approvals'
import type { AppTool, AppToolModule, ToolArgs, ToolContent, ToolContext } from '../mcp/tools'
import { argsOf, pointArg } from '../mcp/tools'
import { contactSheet, sheetText, type FilmFrame, type ImageCodec } from '../filmstrip/sheet'
import { FILM_DURATION, FILM_FRAMES, filmstripProperties } from '../filmstrip/device-tool'
import { t } from 'i18next'
import { messageOf } from '@shared/errors'

export interface Point {
  x: number
  y: number
}

export type MouseButton = 'left' | 'right' | 'middle'

/** Téléchargement lancé par une action de l'agent (fiche 094) : où en est la décision. */
export interface DownloadNote {
  name: string
  state: 'asking' | 'completed' | 'cancelled' | 'interrupted'
  /** Chemin choisi par l'utilisateur (enregistré). */
  path?: string
}

/** Ce que les outils attendent de la page d'une conversation. */
export interface BrowserDriver {
  /** Charge l'adresse ; se résout quand la page est chargée (ou au bout du délai). */
  navigate: (url: string) => Promise<void>
  go: (action: 'back' | 'forward' | 'reload') => Promise<void>
  current: () => { url: string; title: string }
  viewport: () => { width: number; height: number }
  /** Capture de la page visible, en pixels CSS × `scale`. */
  screenshot: (
    scale: number
  ) => Promise<{ data: string; mimeType: string; width: number; height: number }>
  /** Film de la page pendant `run`, au moins `durationMs` (planche contact, fiche 075). */
  film: (run: () => Promise<void>, durationMs: number) => Promise<FilmFrame[]>
  /** Arbre d'accessibilité mis en forme, avec des références `ref_N` (voir `ax-tree.ts`). */
  readTree: (
    filter: 'interactive' | 'all',
    maxChars: number
  ) => Promise<{ lines: string[]; truncated: boolean }>
  find: (query: string) => Promise<string[]>
  /** Centre d'un élément désigné par sa référence, `null` s'il a disparu. */
  pointOf: (ref: string) => Promise<Point | null>
  /** Remplit un champ ; renvoie un message d'erreur, ou `null`. */
  setValue: (ref: string, value: string | number | boolean) => Promise<string | null>
  /** Texte visible de la page (contenu principal d'abord). */
  pageText: (maxChars: number) => Promise<string>
  click: (point: Point, button: MouseButton, clickCount: number) => Promise<void>
  move: (point: Point) => Promise<void>
  drag: (from: Point, to: Point) => Promise<void>
  wheel: (point: Point, deltaX: number, deltaY: number) => Promise<void>
  insertText: (text: string) => Promise<void>
  /** Touche (`Enter`, `a`, `ArrowDown`…) avec modificateurs (`cmd`, `ctrl`, `alt`, `shift`). */
  key: (key: string, modifiers: string[]) => Promise<void>
  /** Console de l'onglet (fiche 031) : `console.*` et exceptions, plus récentes en dernier. */
  console: () => { level: string; text: string; source?: string }[]
  clearConsole: () => void
  /** Requêtes de l'onglet, plus récentes en dernier. */
  network: () => {
    id: string
    method: string
    url: string
    type: string
    status?: number
    mimeType?: string
    failed?: string
  }[]
  responseBody: (id: string) => Promise<string>
  /** Code évalué dans la page (débogage) : `await` permis, dernière expression renvoyée. */
  evaluatePage: (code: string) => Promise<unknown>
  /**
   * Taille d'écran émulée, réduite pour tenir dans le panneau et annulée à la fin du tour (fiche
   * 129) ; `undefined` = taille réelle du panneau.
   */
  emulate: (size: { width: number; height: number; mobile: boolean } | undefined) => Promise<void>
  /** Taille émulée en cours et sa réduction à l'affichage. */
  emulation?: () => { width: number; height: number; scale: number } | undefined
  colorScheme: (scheme: 'light' | 'dark' | undefined) => Promise<void>
  /** Popups demandées par les actions de l'agent et bloquées depuis la dernière fois (fiche 072). */
  blockedPopups?: () => string[]
  /** Téléchargements lancés par les actions de l'agent, depuis la dernière fois (fiche 094). */
  downloads?: () => DownloadNote[]
  /**
   * Boîte JavaScript ouverte par la page, qui la bloque (`page-dialogs.ts`), et réponses de
   * l'utilisateur depuis la dernière fois.
   */
  dialog?: () => PageDialog | undefined
  dialogAnswers?: () => DialogAnswer[]
  tabs: () => { id: string; title: string; url: string; active: boolean }[]
  newTab: () => Promise<string>
  selectTab: (id: string) => void
  closeTab: (id: string) => void
}

/** Préréglages de `browser_resize`. */
const PRESETS: Record<string, { width: number; height: number; mobile: boolean } | undefined> = {
  mobile: { width: 375, height: 812, mobile: true },
  tablet: { width: 768, height: 1024, mobile: true },
  desktop: undefined
}
const OUTPUT_MAX_CHARS = 20_000

const truncate = (text: string) =>
  text.length > OUTPUT_MAX_CHARS ? `${text.slice(0, OUTPUT_MAX_CHARS)}\n[… tronqué]` : text

const READ_MAX_CHARS = 30_000
const TEXT_MAX_CHARS = 20_000
const SCROLL_STEP = 120

function str(args: ToolArgs, key: string): string {
  const value = args[key]
  if (typeof value !== 'string' || !value.trim()) throw new Error(`\`${key}\` est obligatoire`)
  return value
}

function num(args: ToolArgs, key: string, fallback: number, min: number, max: number): number {
  const value = args[key]
  if (value === undefined) return fallback
  if (typeof value !== 'number' || !Number.isFinite(value))
    throw new Error(`\`${key}\` : nombre attendu`)
  return Math.min(max, Math.max(min, value))
}

/** « cmd+shift+z » → touche `z`, modificateurs `cmd`, `shift`. */
export function parseKeyCombo(combo: string): { key: string; modifiers: string[] } {
  const parts = combo.split('+').map((p) => p.trim())
  const key = parts.pop()
  if (!key) throw new Error('Touche vide')
  const modifiers = parts.map((m) => {
    const lower = m.toLowerCase()
    if (['cmd', 'command', 'meta'].includes(lower)) return 'cmd'
    if (['ctrl', 'control'].includes(lower)) return 'ctrl'
    if (['alt', 'option'].includes(lower)) return 'alt'
    if (lower === 'shift') return 'shift'
    throw new Error(`Modificateur inconnu : ${m}`)
  })
  return { key, modifiers }
}

const POINT_SCHEMA = {
  type: 'array',
  items: { type: 'number' },
  minItems: 2,
  maxItems: 2,
  description: '[x, y] in CSS pixels of the latest screenshot.'
}
const REF_SCHEMA = {
  type: 'string',
  description: 'Element reference (ref_N) from browser_read_page or browser_find.'
}

/** Accord de l'utilisateur pour les sites hors du poste, mémorisé par conversation. */
class SiteApprovals {
  private readonly approved = new Map<string, Set<string>>()

  has(conversationId: string, site: string): boolean {
    return this.approved.get(conversationId)?.has(site) ?? false
  }

  add(conversationId: string, site: string): void {
    const sites = this.approved.get(conversationId) ?? new Set<string>()
    sites.add(site)
    this.approved.set(conversationId, sites)
  }

  forget(conversationId: string): void {
    this.approved.delete(conversationId)
  }
}

export interface BrowserToolsOptions {
  /** Page de la conversation (créée à la demande). */
  driverFor: (conversationId: string) => BrowserDriver
  /** Sites « toujours autorisés » sur ce Mac (fiche 072). */
  alwaysSites?: SiteMemory
  /** Images de la planche contact (fiche 075) ; sans lui, pas de `browser_filmstrip`. */
  imageCodec?: ImageCodec
}

/** Module « navigateur » : outils autorisés d'office (ils n'agissent que dans la page du panneau). */
export function browserToolsModule(options: BrowserToolsOptions): AppToolModule & {
  /** L'utilisateur a ouvert ce site lui-même (barre d'adresse) : l'agent peut y revenir. */
  approveSite: (conversationId: string, url: string) => void
  forget: (conversationId: string) => void
} {
  const sites = new SiteApprovals()
  return {
    id: 'browser',
    about: {
      title: 'appToolFamilies.browser.title',
      summary: 'appToolFamilies.browser.summary',
      condition: 'appToolFamilies.always',
      // Un site hors du Mac (`siteToApprove`), sauf déjà autorisé ici ou « toujours ».
      approval: 'appToolFamilies.browser.approval'
    },
    approveSite: (conversationId, url) => {
      const site = siteToApprove(url)
      if (site) sites.add(conversationId, site)
    },
    forget: (conversationId) => sites.forget(conversationId),
    tools: (context) =>
      createTools(
        context,
        options.driverFor(context.conversationId),
        sites,
        options.alwaysSites,
        options.imageCodec
      )
  }
}

function createTools(
  context: ToolContext,
  page: BrowserDriver,
  sites: SiteApprovals,
  alwaysSites?: SiteMemory,
  imageCodec?: ImageCodec
): AppTool[] {
  /** Demande l'accord pour un site extérieur ; `undefined` si on peut y aller. */
  const approve = async (url: string): Promise<string | undefined> => {
    const site = siteToApprove(url)
    if (!site || sites.has(context.conversationId, site) || alwaysSites?.has(site)) {
      return undefined
    }
    const allow = t('approvals.site.allow')
    // Comme Claude Code (fiche 072) : retenu sur ce Mac, révocable dans les Réglages.
    const always = t('approvals.site.always')
    const accept = (choices: string[] | null) => {
      if (choices?.includes(always)) alwaysSites?.add(site)
      else if (choices?.includes(allow)) sites.add(context.conversationId, site)
      else return false
      return true
    }
    const answer = await context.ask(
      {
        question: t('approvals.site.question', { site }),
        header: t('approvals.site.header'),
        options: [
          {
            label: allow,
            description: t('approvals.site.allowDescription', { site })
          },
          ...(alwaysSites
            ? [
                {
                  label: always,
                  description: t('approvals.site.alwaysDescription')
                }
              ]
            : []),
          { label: t('approvals.refuse') }
        ],
        multiSelect: false,
        allowOther: false
      },
      (late) => {
        if (accept(late)) context.tellAgent(`J’ai autorisé ${site} : tu peux reprendre (${url}).`)
        else context.tellAgent(`Je n’autorise pas ${site}.`)
      }
    )
    if (answer === 'late') {
      return `The user has not approved ${site} yet. End your turn now; their decision will arrive as their next message.`
    }
    if (accept(answer)) return undefined
    return `The user refused to open ${site}. Do not try again.`
  }

  const pageInfo = () => {
    const { url, title } = page.current()
    return `Page : ${title || '(sans titre)'} — ${url}`
  }

  const resolvePoint = async (args: ToolArgs): Promise<Point> => {
    if (typeof args['ref'] === 'string') {
      const point = await page.pointOf(args['ref'])
      if (!point)
        throw new Error(`Référence inconnue ou disparue : ${args['ref']} (relisez la page)`)
      return point
    }
    if (args['coordinate'] !== undefined) return pointArg(args['coordinate'], 'coordinate')
    throw new Error('`ref` ou `coordinate` est obligatoire')
  }

  const screenshot = async (args: ToolArgs): Promise<ToolContent[]> => {
    const scale = num(args, 'scale', 1, 0.1, 1)
    const shot = await page.screenshot(scale)
    const { width, height } = page.viewport()
    const frame =
      scale === 1
        ? `${shot.width}×${shot.height} px (same as click coordinates)`
        : `${shot.width}×${shot.height} px, scaled ×${scale}: divide by ${scale} for click coordinates (page ${width}×${height})`
    return [
      { type: 'text', text: `${pageInfo()}\nScreenshot ${frame}.` },
      { type: 'image', data: shot.data, mimeType: shot.mimeType }
    ]
  }

  /** Actions de base, aussi utilisées par `browser_batch`. */
  const actions: Record<string, (args: ToolArgs) => Promise<ToolContent[]>> = {
    browser_navigate: async (args) => {
      const target = str(args, 'url')
      if (target === 'back' || target === 'forward' || target === 'reload') {
        await page.go(target)
        return [{ type: 'text', text: pageInfo() }]
      }
      const url = normalizeUrl(target)
      const refused = await approve(url)
      if (refused) return [{ type: 'text', text: refused }]
      await page.navigate(url)
      return [{ type: 'text', text: pageInfo() }]
    },
    browser_screenshot: screenshot,
    browser_read_page: async (args) => {
      const filter = args['filter'] === 'all' ? 'all' : 'interactive'
      const max = num(args, 'max_chars', READ_MAX_CHARS, 1000, 100_000)
      const tree = await page.readTree(filter, max)
      const body = tree.lines.length ? tree.lines.join('\n') : '(aucun élément)'
      const more = tree.truncated
        ? '\n[… arbre tronqué : augmentez max_chars ou utilisez browser_find]'
        : ''
      return [{ type: 'text', text: `${pageInfo()}\n${body}${more}` }]
    },
    browser_get_page_text: async (args) => {
      const max = num(args, 'max_chars', TEXT_MAX_CHARS, 1000, 100_000)
      const body = await page.pageText(max)
      return [{ type: 'text', text: `${pageInfo()}\n\n${body}` }]
    },
    browser_find: async (args) => {
      const found = await page.find(str(args, 'query'))
      return [{ type: 'text', text: found.length ? found.join('\n') : 'Aucun élément trouvé.' }]
    },
    browser_click: async (args) => {
      const point = await resolvePoint(args)
      const button =
        args['button'] === 'right' || args['button'] === 'middle' ? args['button'] : 'left'
      await page.click(point, button, args['double'] === true ? 2 : 1)
      return [{ type: 'text', text: `Clic en (${point.x}, ${point.y}).` }]
    },
    browser_hover: async (args) => {
      const point = await resolvePoint(args)
      await page.move(point)
      return [{ type: 'text', text: `Souris en (${point.x}, ${point.y}).` }]
    },
    browser_type: async (args) => {
      const value = args['text']
      if (typeof value !== 'string') throw new Error('`text` est obligatoire')
      await page.insertText(value)
      return [{ type: 'text', text: 'Texte saisi.' }]
    },
    browser_key: async (args) => {
      const { key, modifiers } = parseKeyCombo(str(args, 'key'))
      const repeat = num(args, 'repeat', 1, 1, 50)
      for (let i = 0; i < repeat; i++) await page.key(key, modifiers)
      return [
        { type: 'text', text: `Touche ${str(args, 'key')}${repeat > 1 ? ` ×${repeat}` : ''}.` }
      ]
    },
    browser_scroll: async (args) => {
      const { width, height } = page.viewport()
      const point =
        args['coordinate'] !== undefined
          ? pointArg(args['coordinate'], 'coordinate')
          : { x: Math.round(width / 2), y: Math.round(height / 2) }
      const amount = num(args, 'amount', 3, 1, 20) * SCROLL_STEP
      const direction = str(args, 'direction')
      const delta = {
        up: [0, -amount],
        down: [0, amount],
        left: [-amount, 0],
        right: [amount, 0]
      }[direction]
      if (!delta) throw new Error('`direction` : up, down, left ou right')
      await page.wheel(point, delta[0] ?? 0, delta[1] ?? 0)
      return [{ type: 'text', text: `Défilement ${direction}.` }]
    },
    browser_drag: async (args) => {
      const from = pointArg(args['from'], 'from')
      const to = pointArg(args['to'], 'to')
      await page.drag(from, to)
      return [{ type: 'text', text: `Glissé de (${from.x}, ${from.y}) à (${to.x}, ${to.y}).` }]
    },
    browser_form_input: async (args) => {
      const value = args['value']
      if (typeof value !== 'string' && typeof value !== 'boolean' && typeof value !== 'number') {
        throw new Error('`value` : texte, nombre ou booléen attendu')
      }
      const error = await page.setValue(str(args, 'ref'), value)
      if (error) throw new Error(error)
      return [{ type: 'text', text: 'Champ rempli.' }]
    },
    browser_console: async (args) => {
      if (args['clear'] === true) {
        page.clearConsole()
        return [{ type: 'text', text: 'Console vidée.' }]
      }
      const pattern = typeof args['pattern'] === 'string' ? args['pattern'].toLowerCase() : ''
      const entries = page
        .console()
        .filter((e) => args['only_errors'] !== true || e.level === 'error' || e.level === 'assert')
        .filter((e) => !pattern || e.text.toLowerCase().includes(pattern))
        .slice(-num(args, 'limit', 50, 1, 300))
      const lines = entries.map((e) => `[${e.level}] ${e.text}${e.source ? `  (${e.source})` : ''}`)
      return [{ type: 'text', text: lines.length ? lines.join('\n') : 'Aucun message.' }]
    },
    browser_network: async (args) => {
      if (typeof args['request_id'] === 'string') {
        const body = await page.responseBody(args['request_id'])
        return [{ type: 'text', text: truncate(body) }]
      }
      const pattern = typeof args['url_pattern'] === 'string' ? args['url_pattern'] : ''
      const list = page
        .network()
        .filter((r) => !pattern || r.url.includes(pattern))
        .slice(-num(args, 'limit', 50, 1, 300))
      const lines = list.map(
        (r) =>
          `${r.id}  ${r.method} ${r.status ?? (r.failed ? 'ÉCHEC' : '…')} ${r.type}  ${r.url}${r.failed ? `  (${r.failed})` : ''}`
      )
      return [
        {
          type: 'text',
          text: lines.length
            ? `${lines.join('\n')}\n\nCorps d'une réponse : browser_network avec request_id.`
            : 'Aucune requête.'
        }
      ]
    },
    browser_javascript: async (args) => {
      const value = await page.evaluatePage(str(args, 'code'))
      const text =
        value === undefined
          ? 'undefined'
          : typeof value === 'string'
            ? value
            : JSON.stringify(value, null, 2)
      return [{ type: 'text', text: truncate(text ?? String(value)) }]
    },
    browser_resize: async (args) => {
      const preset = typeof args['preset'] === 'string' ? args['preset'] : undefined
      if (preset !== undefined && !(preset in PRESETS)) {
        throw new Error('`preset` : mobile, tablet ou desktop')
      }
      const custom =
        args['width'] !== undefined || args['height'] !== undefined
          ? {
              width: num(args, 'width', 375, 200, 4000),
              height: num(args, 'height', 812, 200, 4000),
              mobile: args['mobile'] === true
            }
          : undefined
      if (preset !== undefined || custom) await page.emulate(custom ?? PRESETS[preset ?? 'desktop'])
      const scheme = args['color_scheme']
      if (scheme === 'light' || scheme === 'dark') await page.colorScheme(scheme)
      else if (scheme === 'auto') await page.colorScheme(undefined)
      const { width, height } = page.viewport()
      const emulation = page.emulation?.()
      const note = emulation
        ? ` Shown at ${Math.round(emulation.scale * 100)}% to fit the panel; screenshots and click coordinates use these ${width}×${height} CSS pixels. The size is reset at the end of your turn.`
        : ''
      return [{ type: 'text', text: `Fenêtre : ${width}×${height} px.${note}` }]
    },
    browser_tabs: async (args) => {
      const action = typeof args['action'] === 'string' ? args['action'] : 'list'
      if (action === 'new') {
        // L'adresse passe par le même accord par site que browser_navigate.
        const target = typeof args['url'] === 'string' ? normalizeUrl(args['url']) : undefined
        if (target) {
          const refused = await approve(target)
          if (refused) return [{ type: 'text', text: refused }]
        }
        await page.newTab()
        if (target) await page.navigate(target)
      } else if (action === 'select') page.selectTab(str(args, 'tab_id'))
      else if (action === 'close') page.closeTab(str(args, 'tab_id'))
      else if (action !== 'list') throw new Error('`action` : list, new, select ou close')
      const lines = page
        .tabs()
        .map((t) => `${t.active ? '*' : ' '} ${t.id}  ${t.title || '(sans titre)'} — ${t.url}`)
      return [{ type: 'text', text: lines.length ? lines.join('\n') : 'Aucun onglet.' }]
    }
  }

  const definitions: {
    name: string
    description: string
    properties: ToolArgs
    required?: string[]
  }[] = [
    {
      name: 'browser_navigate',
      description:
        'Open a URL in the browser panel of the app (the user sees it live), or go "back", "forward", "reload". Use it to check web pages and the app you are building (http://localhost:…).',
      properties: { url: { type: 'string', description: 'URL, or back / forward / reload.' } },
      required: ['url']
    },
    {
      name: 'browser_screenshot',
      description:
        'Screenshot of the browser panel page. Image pixels are the coordinates used by browser_click (unless scaled). Prefer browser_read_page to read text.',
      properties: {
        scale: { type: 'number', description: 'Optional 0.1–1 downscale to save context.' }
      }
    },
    {
      name: 'browser_read_page',
      description:
        'Accessibility tree of the current page, one element per line with a ref_N to use with browser_click / browser_form_input.',
      properties: {
        filter: {
          type: 'string',
          enum: ['interactive', 'all'],
          description: 'Default: interactive.'
        },
        max_chars: { type: 'number' }
      }
    },
    {
      name: 'browser_get_page_text',
      description: 'Visible text of the current page (main content first).',
      properties: { max_chars: { type: 'number' } }
    },
    {
      name: 'browser_find',
      description:
        'Find elements whose role, name or value contains the text; returns their ref_N.',
      properties: { query: { type: 'string' } },
      required: ['query']
    },
    {
      name: 'browser_click',
      description: 'Real mouse click on an element (ref) or at coordinates.',
      properties: {
        ref: REF_SCHEMA,
        coordinate: POINT_SCHEMA,
        button: { type: 'string', enum: ['left', 'right', 'middle'] },
        double: { type: 'boolean' }
      }
    },
    {
      name: 'browser_hover',
      description: 'Move the mouse over an element (ref) or coordinates (menus, tooltips).',
      properties: { ref: REF_SCHEMA, coordinate: POINT_SCHEMA }
    },
    {
      name: 'browser_type',
      description: 'Type text into the focused element (click the field first).',
      properties: { text: { type: 'string' } },
      required: ['text']
    },
    {
      name: 'browser_key',
      description: 'Press a key or combination: "Enter", "Tab", "Escape", "ArrowDown", "cmd+a"…',
      properties: { key: { type: 'string' }, repeat: { type: 'number' } },
      required: ['key']
    },
    {
      name: 'browser_scroll',
      description: 'Scroll the page (mouse wheel) at coordinates (default: centre).',
      properties: {
        direction: { type: 'string', enum: ['up', 'down', 'left', 'right'] },
        amount: { type: 'number', description: 'Wheel ticks, default 3.' },
        coordinate: POINT_SCHEMA
      },
      required: ['direction']
    },
    {
      name: 'browser_drag',
      description: 'Drag with the mouse from one point to another.',
      properties: { from: POINT_SCHEMA, to: POINT_SCHEMA },
      required: ['from', 'to']
    },
    {
      name: 'browser_form_input',
      description:
        'Set the value of a field, checkbox (true/false) or select (value or label) by ref.',
      properties: {
        ref: REF_SCHEMA,
        value: { type: ['string', 'number', 'boolean'] }
      },
      required: ['ref', 'value']
    },
    {
      name: 'browser_console',
      description:
        'Console messages of the current tab (console.log/warn/error, uncaught exceptions), newest last.',
      properties: {
        only_errors: { type: 'boolean' },
        pattern: { type: 'string', description: 'Only messages containing this text.' },
        limit: { type: 'number', description: 'Default 50.' },
        clear: { type: 'boolean', description: 'Empty the console instead of reading it.' }
      }
    },
    {
      name: 'browser_network',
      description:
        'Network requests of the current tab (method, status, type, URL), or the body of one response with request_id.',
      properties: {
        url_pattern: { type: 'string', description: 'Only URLs containing this text.' },
        request_id: { type: 'string' },
        limit: { type: 'number', description: 'Default 50.' }
      }
    },
    {
      name: 'browser_javascript',
      description:
        'Evaluate JavaScript in the page for debugging and inspection (top-level await allowed; the last expression is returned as JSON). Do not use it to change the app: edit the source code instead.',
      properties: { code: { type: 'string' } },
      required: ['code']
    },
    {
      name: 'browser_resize',
      description:
        'Emulate a screen size (preset mobile 375×812, tablet 768×1024, desktop = panel size, or width/height) and/or the color scheme (light, dark, auto). Use it to check responsive layouts and dark mode. The page is scaled down to fit the panel, never cropped; both settings last until the end of your turn.',
      properties: {
        preset: { type: 'string', enum: ['mobile', 'tablet', 'desktop'] },
        width: { type: 'number' },
        height: { type: 'number' },
        mobile: {
          type: 'boolean',
          description: 'With width/height: mobile device (touch, viewport).'
        },
        color_scheme: { type: 'string', enum: ['light', 'dark', 'auto'] }
      }
    },
    {
      name: 'browser_tabs',
      description:
        'Browser tabs: list them, open a new one (optional url), select or close one by tab_id. Other browser_* tools act on the selected tab.',
      properties: {
        action: { type: 'string', enum: ['list', 'new', 'select', 'close'] },
        url: { type: 'string' },
        tab_id: { type: 'string' }
      }
    }
  ]

  /**
   * Ce que la page a fait pendant les actions de l'agent : popups bloquées (fiche 072), il doit
   * demander à l'utilisateur de cliquer lui-même, comme dans Claude Code ; téléchargements
   * (fiche 094), que l'utilisateur seul enregistre.
   */
  const withPageNotes = (content: ToolContent[]): ToolContent[] => {
    const blocked = page.blockedPopups?.() ?? []
    const notes = [
      ...(page.dialogAnswers?.() ?? []).map(dialogAnswerText),
      ...(page.downloads?.() ?? []).map(downloadNote)
    ]
    const dialog = page.dialog?.()
    // Une seule fois : l'erreur d'une action d'un lot peut déjà le dire.
    const open = dialog && dialogOpenText(dialog)
    if (open && !content.some((c) => c.type === 'text' && c.text.includes(open))) notes.push(open)
    if (blocked.length > 0) {
      notes.unshift(
        `Note: the page tried to open a popup window (${blocked.join(', ')}) and Bobine blocked it: popups open only from the user's own clicks, never from your actions, so retrying won't help. If this was a sign-in or authorization step, ask the user to click that button and finish the sign-in in the popup themselves (or to sign in another way), then continue.`
      )
    }
    return [...content, ...notes.map((text): ToolContent => ({ type: 'text', text }))]
  }

  const tools: AppTool[] = definitions
    .flatMap((d) => {
      const run = actions[d.name]
      return run ? [{ d, run }] : []
    })
    .map(({ d, run }) => ({
      definition: {
        name: d.name,
        description: d.description,
        inputSchema: {
          type: 'object',
          properties: d.properties,
          ...(d.required ? { required: d.required } : {})
        }
      },
      autoAllow: true,
      panel: 'browser',
      call: async (args) => ({ content: withPageNotes(await run(argsOf(args))) })
    }))

  tools.push({
    definition: {
      name: 'browser_batch',
      description:
        'Run several browser actions in one call, in order, stopping at the first error. Each item: { "tool": "browser_click", "args": { … } }. Saves round trips.',
      inputSchema: {
        type: 'object',
        properties: {
          actions: {
            type: 'array',
            items: {
              type: 'object',
              properties: { tool: { type: 'string' }, args: { type: 'object' } },
              required: ['tool']
            }
          }
        },
        required: ['actions']
      }
    },
    autoAllow: true,
    panel: 'browser',
    call: async (raw) => {
      const list = argsOf(raw)['actions']
      if (!Array.isArray(list) || list.length === 0) throw new Error('`actions` : liste attendue')
      if (list.length > 30) throw new Error('Au plus 30 actions par lot')
      const content: ToolContent[] = []
      for (const [index, item] of list.entries()) {
        const { tool, args } = argsOf(item)
        const run = typeof tool === 'string' ? actions[tool] : undefined
        if (!run) {
          content.push({
            type: 'text',
            text: `Action ${index + 1} : outil inconnu (${String(tool)}).`
          })
          return { content, isError: true }
        }
        try {
          content.push(...(await run(argsOf(args))))
        } catch (error) {
          const message = messageOf(error)
          content.push({ type: 'text', text: `Action ${index + 1} (${tool}) : ${message}` })
          return { content: withPageNotes(content), isError: true }
        }
      }
      return { content: withPageNotes(content) }
    }
  })

  if (imageCodec) {
    tools.push({
      definition: {
        name: 'browser_filmstrip',
        description:
          'Film the page while running actions, then get ONE contact-sheet image: frames taken each time the screen changes, numbered in reading order, with their times. Use it to see what happens DURING a gesture or a transition (scroll jank, sticky header, layout shift while loading, menu or dialog animation, flicker), which separate screenshots cannot show. `actions`: same items as browser_batch, run in order while filming; omit them to just watch (loading, animation).',
        inputSchema: { type: 'object', properties: filmstripProperties() }
      },
      autoAllow: true,
      panel: 'browser',
      call: async (raw) => {
        const args = argsOf(raw)
        const durationMs = Math.round(
          num(args, 'duration_ms', FILM_DURATION.fallback, FILM_DURATION.min, FILM_DURATION.max)
        )
        const maxFrames = Math.round(
          num(args, 'frames', FILM_FRAMES.fallback, FILM_FRAMES.min, FILM_FRAMES.max)
        )
        const list = args['actions'] ?? []
        if (!Array.isArray(list)) throw new Error('`actions` : liste attendue')
        if (list.length > 30) throw new Error('Au plus 30 actions par lot')
        const notes: ToolContent[] = []
        let failure: string | undefined
        const frames = await page.film(async () => {
          for (const [index, item] of list.entries()) {
            const { tool, args: actionArgs } = argsOf(item)
            // Une capture pendant le film n'apprendrait rien de plus que la planche.
            const run =
              typeof tool === 'string' && tool !== 'browser_screenshot' ? actions[tool] : undefined
            if (!run) {
              failure = `Action ${index + 1} : outil inconnu ou pas filmable (${String(tool)}).`
              return
            }
            try {
              for (const content of await run(argsOf(actionArgs))) {
                if (content.type === 'text') notes.push(content)
              }
            } catch (error) {
              const message = messageOf(error)
              failure = `Action ${index + 1} (${tool}) : ${message}`
              return
            }
          }
        }, durationMs)
        const sheet = contactSheet(frames, { maxFrames, size: page.viewport() }, imageCodec)
        const content: ToolContent[] = sheet
          ? [
              { type: 'text', text: sheetText(sheet, durationMs, 'browser_click') },
              { type: 'image', data: sheet.image.data, mimeType: sheet.image.mimeType }
            ]
          : [{ type: 'text', text: 'Contact sheet: no frame could be read from the page.' }]
        if (failure) content.push({ type: 'text', text: failure })
        return {
          content: withPageNotes([...content, ...notes]),
          ...(failure || !sheet ? { isError: true } : {})
        }
      }
    })
  }

  return tools
}

/** Ce que l'agent apprend d'un téléchargement qu'il a lancé (fiche 094, ADR-0018). */
function downloadNote(note: DownloadNote): string {
  if (note.state === 'asking') {
    return `Note: the page started a download (${note.name}). Bobine shows the user a Save dialog for every download: they decide whether and where to save it, and nothing is saved before they confirm, so retrying won't help. A later browser tool result will tell you what they chose; if you need the file, ask the user.`
  }
  if (note.state === 'completed') {
    return `Note: the user saved the download ${note.name} to ${note.path ?? '(unknown path)'}.`
  }
  if (note.state === 'cancelled') {
    return `Note: the user cancelled the download ${note.name}; nothing was saved.`
  }
  return `Note: the download ${note.name} failed; nothing was saved.`
}
