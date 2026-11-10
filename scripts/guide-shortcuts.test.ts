import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import i18next from 'i18next'
import type { MenuItemConstructorOptions } from 'electron'
import { afterAll, describe, expect, it } from 'vitest'
import { buildMenuTemplate } from '../src/main/menu'
import { DEFAULT_QUICK_SHORTCUT, QUICK_SHORTCUTS } from '../src/shared/quick-entry'
import { INTERFACE_SHORTCUTS } from '../src/shared/shortcuts'

/**
 * Page « Raccourcis clavier » du guide (fiche 186) : ses tableaux « Raccourcis des menus » et
 * « Dans la zone de saisie » sont générés depuis le vrai menu (`buildMenuTemplate`) et les
 * raccourcis de l'interface (`INTERFACE_SHORTCUTS`), entre deux commentaires
 * `<!-- raccourcis:… -->`. Cet essai échoue si la page n'est plus à jour ; `pnpm guide-shortcuts`
 * la réécrit (`BOBINE_WRITE_GUIDE=1`). Elle ne peut donc pas mentir, ni sur GitHub ni dans l'app.
 */
const guide = join(resolve(__dirname, '..'), 'docs', 'guide')
const WRITE = process.env['BOBINE_WRITE_GUIDE'] === '1'

/** Raccourcis implicites des rôles d'Electron que le tableau montre. */
const ROLE_ACCELERATORS: Partial<Record<string, string>> = { close: 'CmdOrCtrl+W' }

const MODIFIERS: Record<string, string> = {
  cmdorctrl: '⌘',
  commandorcontrol: '⌘',
  cmd: '⌘',
  command: '⌘',
  shift: '⇧',
  alt: '⌥',
  option: '⌥',
  ctrl: '⌃',
  control: '⌃'
}
/** Ordre des modificateurs sur macOS. */
const ORDER = ['⌃', '⌥', '⇧', '⌘']
const KEYS: Record<string, string> = {
  Up: '↑',
  Down: '↓',
  Left: '←',
  Right: '→',
  Plus: '+',
  '-': '−'
}

/** `CmdOrCtrl+Shift+O` → `⇧⌘O`. */
export function keysOf(accelerator: string): string {
  const parts = accelerator.split(/\+(?!$)/)
  const key = parts.pop() ?? ''
  const mods = parts.map((p) => MODIFIERS[p.toLowerCase()] ?? p)
  mods.sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b))
  return `${mods.join('')}${KEYS[key] ?? key}`
}

const HEADERS = {
  fr: { menus: ['Raccourci', 'Commande', 'Menu'], input: ['Touche', "Ce qu'elle fait"] },
  en: { menus: ['Shortcut', 'Command', 'Menu'], input: ['Key', 'What it does'] }
} as const
type Lang = keyof typeof HEADERS

const row = (cells: string[]) => `| ${cells.map((c) => c.replace(/\|/g, '\\|')).join(' | ')} |`
const table = (header: readonly string[], rows: string[][]) =>
  [row([...header]), `|${header.map(() => '---').join('|')}|`, ...rows.map(row)].join('\n')

function menuTable(lang: Lang): string {
  const template = buildMenuTemplate({
    appName: 'Bobine',
    dev: false,
    send: () => undefined,
    help: () => undefined,
    about: () => undefined,
    showLog: () => undefined,
    zoom: () => undefined,
    presentation: { active: false, toggle: () => undefined },
    quickEntry: {
      open: () => undefined,
      accelerator: QUICK_SHORTCUTS[DEFAULT_QUICK_SHORTCUT].accelerator
    }
  })
  const rows: string[][] = []
  for (const menu of template) {
    const items = Array.isArray(menu.submenu) ? (menu.submenu as MenuItemConstructorOptions[]) : []
    for (const item of items) {
      if (item.visible === false || item.type === 'separator') continue
      const accelerator = item.accelerator ?? (item.role ? ROLE_ACCELERATORS[item.role] : undefined)
      if (typeof accelerator !== 'string' || !item.label) continue
      rows.push([keysOf(accelerator), item.label, menu.label ?? ''])
    }
  }
  return table(HEADERS[lang].menus, rows)
}

const inputTable = (lang: Lang) =>
  table(
    HEADERS[lang].input,
    INTERFACE_SHORTCUTS.map((s) => [s.keys, s.label])
  )

/** Page avec ses tableaux générés à la place de ceux entre les marqueurs. */
function regenerate(page: string, lang: Lang): string {
  const tables = { menus: menuTable(lang), saisie: inputTable(lang) }
  let out = page
  for (const [name, generated] of Object.entries(tables)) {
    const marker = new RegExp(
      `(<!-- raccourcis:${name} -->\\n)[\\s\\S]*?(\\n<!-- /raccourcis:${name} -->)`
    )
    expect(marker.test(out), `marqueurs raccourcis:${name}`).toBe(true)
    out = out.replace(marker, (_m, open: string, close: string) => `${open}${generated}${close}`)
  }
  return out
}

describe('page « Raccourcis clavier » du guide (fiche 186)', () => {
  afterAll(async () => {
    await i18next.changeLanguage('fr')
  })

  for (const lang of ['fr', 'en'] as const) {
    it(`${lang} : générée depuis le menu et les raccourcis de l’interface`, async () => {
      await i18next.changeLanguage(lang)
      const file = join(guide, lang, 'raccourcis.md')
      const page = readFileSync(file, 'utf8')
      const fresh = regenerate(page, lang)
      if (WRITE && fresh !== page) writeFileSync(file, fresh)
      else expect(page, 'pnpm guide-shortcuts pour la remettre à jour').toBe(fresh)
    })
  }

  it('écrit les raccourcis à la manière de macOS', () => {
    expect(keysOf('CmdOrCtrl+Shift+O')).toBe('⇧⌘O')
    expect(keysOf('Alt+CmdOrCtrl+Up')).toBe('⌥⌘↑')
    expect(keysOf('Ctrl+Cmd+F')).toBe('⌃⌘F')
    expect(keysOf('CommandOrControl+Plus')).toBe('⌘+')
    expect(keysOf('CommandOrControl+-')).toBe('⌘−')
    expect(keysOf('Ctrl+`')).toBe('⌃`')
    expect(keysOf('CmdOrCtrl+?')).toBe('⌘?')
  })
})
