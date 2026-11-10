/**
 * Libellés lisibles des outils de l'app (fiche 047) : l'agent les annonce sous un titre technique
 * (Bob : « Running Browser Type (bobine) ») ; l'app, qui exécute l'appel, connaît l'outil et
 * ses arguments et peut dire ce qui se passe (« Saisit « Ada » »). Générique : ce sont les outils
 * du serveur MCP de l'app, quel que soit l'agent. Le libellé est enregistré en code (ADR-0014).
 */
import type { ParseKeys } from 'i18next'
import { translate, type Message } from './i18n/message'

/** Panneau de l'app concerné par l'outil (sert aussi au résumé d'un groupe d'outils). */
export type AppToolGroup =
  | 'browser'
  | 'ios'
  | 'android'
  | 'terminal'
  | 'preview'
  | 'ask'
  | 'children'
  | 'memory'
  /** Outil de Bobine sans libellé propre : « Outil de Bobine : <nom> ». */
  | 'bobine'

export interface AppToolLabel {
  group: AppToolGroup
  /** Ce que fait l'appel, en code (ADR-0014) : traduit à l'affichage. */
  message?: Message
  /** Libellé en toutes lettres des conversations enregistrées avant la fiche 074. */
  label?: string
}

/** Libellé d'un outil de l'app dans la langue courante. */
export const appToolText = (tool: AppToolLabel): string =>
  tool.message ? translate(tool.message) : (tool.label ?? '')

/**
 * Titre d'une carte qui a appelé un ou plusieurs outils de l'app (du code, fiche 079) : leurs
 * libellés à la suite, dans l'ordre ; `undefined` sans outil de l'app.
 */
export function appToolsText(item: {
  appTool?: AppToolLabel
  appTools?: readonly AppToolLabel[]
}): string | undefined {
  const labels = item.appTools?.length ? item.appTools : item.appTool ? [item.appTool] : []
  return labels.length ? labels.map(appToolText).join(' · ') : undefined
}

type Args = Record<string, unknown>

const MAX_QUOTED = 60

/** Valeur citée dans un libellé : une ligne, raccourcie. */
function quote(value: unknown): string | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined
  const line = String(value).replace(/\s+/g, ' ').trim()
  if (!line) return undefined
  return line.length > MAX_QUOTED ? `${line.slice(0, MAX_QUOTED - 1)}…` : line
}

/** Adresse sans le protocole (`https://`), raccourcie. */
function shortUrl(value: unknown): string | undefined {
  const url = quote(value)
  return url?.replace(/^https?:\/\//, '')
}

/** Nom du fichier d'un chemin, pris avant de raccourcir (sinon « … » seul, fiche 122). */
const baseName = (value: unknown) =>
  quote(typeof value === 'string' ? value.split('/').filter(Boolean).at(-1) : value)

/** Phrase avec la valeur (« Ouvre example.com »), ou sa variante sans valeur (« Ouvre une page »). */
function withValue(key: ParseKeys, value: string | undefined, fallback: ParseKeys): Message {
  return value ? { key, params: { value } } : { key: fallback }
}

const DIRECTIONS = ['up', 'down', 'left', 'right'] as const
const PRESETS = ['mobile', 'tablet', 'desktop'] as const
const SCHEMES = ['dark', 'light'] as const
const oneOf = <T extends string>(list: readonly T[], value: unknown): T | undefined =>
  list.find((item) => item === value)

/** Ce que fait chaque outil, d'après ses arguments. */
const LABELS: Record<string, [AppToolGroup, (args: Args) => Message]> = {
  browser_navigate: [
    'browser',
    (a) =>
      withValue(
        'appTools.browser_navigate.value',
        shortUrl(a['url']),
        'appTools.browser_navigate.default'
      )
  ],
  browser_screenshot: ['browser', () => ({ key: 'appTools.browser_screenshot.default' })],
  browser_read_page: ['browser', () => ({ key: 'appTools.browser_read_page.default' })],
  browser_get_page_text: ['browser', () => ({ key: 'appTools.browser_get_page_text.default' })],
  browser_find: [
    'browser',
    (a) =>
      withValue('appTools.browser_find.value', quote(a['query']), 'appTools.browser_find.default')
  ],
  browser_click: [
    'browser',
    (a) => ({
      key: a['double'] ? 'appTools.browser_click.double' : 'appTools.browser_click.default'
    })
  ],
  browser_hover: ['browser', () => ({ key: 'appTools.browser_hover.default' })],
  browser_type: [
    'browser',
    (a) =>
      withValue('appTools.browser_type.value', quote(a['text']), 'appTools.browser_type.default')
  ],
  browser_key: [
    'browser',
    (a) => withValue('appTools.browser_key.value', quote(a['key']), 'appTools.browser_key.default')
  ],
  browser_scroll: [
    'browser',
    (a) => {
      const direction = oneOf(DIRECTIONS, a['direction'])
      return {
        key: direction ? `appTools.browser_scroll.${direction}` : 'appTools.browser_scroll.default'
      }
    }
  ],
  browser_drag: ['browser', () => ({ key: 'appTools.browser_drag.default' })],
  browser_form_input: [
    'browser',
    (a) =>
      withValue(
        'appTools.browser_form_input.value',
        quote(a['value']),
        'appTools.browser_form_input.default'
      )
  ],
  browser_console: ['browser', () => ({ key: 'appTools.browser_console.default' })],
  browser_network: ['browser', () => ({ key: 'appTools.browser_network.default' })],
  browser_javascript: ['browser', () => ({ key: 'appTools.browser_javascript.default' })],
  browser_resize: [
    'browser',
    (a) => {
      const preset = oneOf(PRESETS, a['preset']) ?? 'none'
      const scheme = oneOf(SCHEMES, a['color_scheme']) ?? 'none'
      return { key: `appTools.browser_resize.${preset}.${scheme}` }
    }
  ],
  browser_tabs: [
    'browser',
    (a) =>
      a['action'] === 'new'
        ? withValue(
            'appTools.browser_tabs.newValue',
            shortUrl(a['url']),
            'appTools.browser_tabs.new'
          )
        : {
            key:
              a['action'] === 'select'
                ? 'appTools.browser_tabs.select'
                : a['action'] === 'close'
                  ? 'appTools.browser_tabs.close'
                  : 'appTools.browser_tabs.list'
          }
  ],
  browser_batch: ['browser', () => ({ key: 'appTools.browser_batch.default' })],
  browser_filmstrip: ['browser', () => ({ key: 'appTools.browser_filmstrip.default' })],

  ios_devices: ['ios', () => ({ key: 'appTools.ios_devices.default' })],
  ios_boot: [
    'ios',
    (a) => withValue('appTools.ios_boot.value', quote(a['device']), 'appTools.ios_boot.default')
  ],
  ios_build: [
    'ios',
    (a) => withValue('appTools.ios_build.value', quote(a['scheme']), 'appTools.ios_build.default')
  ],
  ios_launch: [
    'ios',
    (a) =>
      withValue(
        'appTools.ios_launch.value',
        quote(a['bundle_id']) ?? baseName(a['app_path']),
        'appTools.ios_launch.default'
      )
  ],
  ios_screenshot: ['ios', () => ({ key: 'appTools.ios_screenshot.default' })],
  ios_describe: ['ios', () => ({ key: 'appTools.ios_describe.default' })],
  ios_tap: [
    'ios',
    (a) => withValue('appTools.ios_tap.value', quote(a['label']), 'appTools.ios_tap.default')
  ],
  ios_swipe: ['ios', () => ({ key: 'appTools.ios_swipe.default' })],
  ios_filmstrip: ['ios', () => ({ key: 'appTools.ios_filmstrip.default' })],
  ios_type: [
    'ios',
    (a) => withValue('appTools.ios_type.value', quote(a['text']), 'appTools.ios_type.default')
  ],
  ios_button: [
    'ios',
    (a) => withValue('appTools.ios_button.value', quote(a['button']), 'appTools.ios_button.default')
  ],
  ios_open_url: [
    'ios',
    (a) =>
      withValue('appTools.ios_open_url.value', shortUrl(a['url']), 'appTools.ios_open_url.default')
  ],

  android_devices: ['android', () => ({ key: 'appTools.android_devices.default' })],
  android_boot: [
    'android',
    (a) =>
      withValue('appTools.android_boot.value', quote(a['avd']), 'appTools.android_boot.default')
  ],
  android_build: [
    'android',
    (a) =>
      withValue('appTools.android_build.value', quote(a['task']), 'appTools.android_build.default')
  ],
  android_launch: [
    'android',
    (a) =>
      withValue(
        'appTools.android_launch.value',
        quote(a['package']) ?? baseName(a['apk_path']),
        'appTools.android_launch.default'
      )
  ],
  android_screenshot: ['android', () => ({ key: 'appTools.android_screenshot.default' })],
  android_describe: ['android', () => ({ key: 'appTools.android_describe.default' })],
  android_tap: ['android', () => ({ key: 'appTools.android_tap.default' })],
  android_swipe: ['android', () => ({ key: 'appTools.android_swipe.default' })],
  android_filmstrip: ['android', () => ({ key: 'appTools.android_filmstrip.default' })],
  android_type: [
    'android',
    (a) =>
      withValue('appTools.android_type.value', quote(a['text']), 'appTools.android_type.default')
  ],
  android_key: [
    'android',
    (a) => withValue('appTools.android_key.value', quote(a['key']), 'appTools.android_key.default')
  ],
  android_open_url: [
    'android',
    (a) =>
      withValue(
        'appTools.android_open_url.value',
        shortUrl(a['url']),
        'appTools.android_open_url.default'
      )
  ],
  android_logcat: ['android', () => ({ key: 'appTools.android_logcat.default' })],

  terminal_list: ['terminal', () => ({ key: 'appTools.terminal_list.default' })],
  terminal_read: ['terminal', () => ({ key: 'appTools.terminal_read.default' })],
  terminal_run: [
    'terminal',
    (a) =>
      withValue('appTools.terminal_run.value', quote(a['command']), 'appTools.terminal_run.default')
  ],
  terminal_stop: ['terminal', () => ({ key: 'appTools.terminal_stop.default' })],

  preview_list: ['preview', () => ({ key: 'appTools.preview_list.default' })],
  preview_start: [
    'preview',
    (a) =>
      withValue('appTools.preview_start.value', quote(a['name']), 'appTools.preview_start.default')
  ],
  preview_logs: [
    'preview',
    (a) =>
      withValue('appTools.preview_logs.value', quote(a['name']), 'appTools.preview_logs.default')
  ],
  preview_stop: [
    'preview',
    (a) =>
      withValue('appTools.preview_stop.value', quote(a['name']), 'appTools.preview_stop.default')
  ],

  ask_user: [
    'ask',
    (a) => withValue('appTools.ask_user.value', quote(a['question']), 'appTools.ask_user.default')
  ],

  start_child: [
    'children',
    (a) =>
      withValue('appTools.start_child.value', quote(a['title']), 'appTools.start_child.default')
  ],
  message_child: [
    'children',
    (a) =>
      withValue(
        'appTools.message_child.value',
        quote(a['message']),
        'appTools.message_child.default'
      )
  ],
  child_status: ['children', () => ({ key: 'appTools.child_status.default' })],
  message_parent: [
    'children',
    (a) =>
      withValue(
        'appTools.message_parent.value',
        quote(a['message']),
        'appTools.message_parent.default'
      )
  ],
  recommend_merge: [
    'children',
    (a) =>
      withValue(
        a['ready'] === true
          ? 'appTools.recommend_merge.ready'
          : 'appTools.recommend_merge.notReady',
        quote(a['child']),
        'appTools.recommend_merge.default'
      )
  ],
  // Mémoire (fiche 182) : ce que l'agent propose de retenir, relit ou propose d'oublier.
  remember: [
    'memory',
    (a) =>
      withValue('appTools.remember.value', quote(a['description']), 'appTools.remember.default')
  ],
  recall: [
    'memory',
    (a) =>
      Array.isArray(a['names']) && a['names'].length > 0
        ? { key: 'appTools.recall.count', params: { count: a['names'].length } }
        : { key: 'appTools.recall.default' }
  ],
  forget: [
    'memory',
    (a) => withValue('appTools.forget.value', quote(a['name']), 'appTools.forget.default')
  ],
  // Relecture (fiche 177) : le nombre de remarques rendues.
  report_findings: [
    'children',
    (a) => ({
      key: 'appTools.report_findings.count',
      params: { count: Array.isArray(a['findings']) ? a['findings'].length : 0 }
    })
  ]
}

/**
 * Libellé de repli d'un outil de Bobine qui n'en a pas encore (recette 0.11, C1) : son nom, plutôt
 * que le titre de la carte de l'agent (« execute » en Code Mode d'OpenCode).
 */
export function appToolFallback(name: string): AppToolLabel {
  return {
    group: 'bobine',
    message: { key: 'appTools.generic', params: { name: quote(name) ?? '?' } }
  }
}

/** Libellé d'un appel à un outil de l'app ; `undefined` pour un outil inconnu. */
export function appToolLabel(name: string, args: unknown): AppToolLabel | undefined {
  const entry = LABELS[name]
  if (!entry) return undefined
  const [group, describe] = entry
  const record = typeof args === 'object' && args !== null ? (args as Args) : {}
  return { message: describe(record), group }
}
