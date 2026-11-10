import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import i18next from 'i18next'
import { describe, expect, it } from 'vitest'
import { i18nOptions, typography } from '@shared/i18n'
import { APP_ONLY_TOOLS, READ_ONLY_TOOLS, withHints } from './tool-hints'
import { AppToolsBridge } from '../agent/app-tools-bridge'
import type { PendingRequests } from '../agent/pending-requests'
import type { AndroidManager } from '../android/android-manager'
import { androidToolsModule } from '../android/android-tools'
import type { GradleBuilds } from '../android/gradle'
import { browserToolsModule, type BrowserDriver } from '../browser/browser-tools'
import type { ImageCodec } from '../filmstrip/sheet'
import type { DevServers } from '../preview/dev-servers'
import { previewToolsModule } from '../preview/preview-tools'
import type { Run } from '../simulator/run'
import type { SimulatorManager } from '../simulator/simulator-manager'
import { simulatorToolsModule } from '../simulator/simulator-tools'
import type { XcodeBuilds } from '../simulator/xcode'
import type { TerminalManager } from '../terminal/terminal-manager'
import { terminalToolsModule } from '../terminal/terminal-tools'
import {
  appToolsCatalog,
  conversationAppTools,
  conversationToolNames,
  definitionsTokens,
  switchedOff
} from './catalog'
import { childrenToolsModule, type ChildTools } from './children-tools'
import type { AppToolModule, ToolContext } from './tools'

const codec: ImageCodec = {
  bitmap: (_jpeg, width, height) => ({ width, height, data: new Uint8Array() }),
  jpeg: () => Buffer.from('')
}
const run: Run = async () => ({ code: 0, stdout: Buffer.from(''), stderr: '' })

/**
 * Les modules de l'app, comme `index.ts` les assemble, sur des faux inertes : décrire les outils
 * ne doit rien appeler. Filles : `mere` est dans un dépôt git, `fille` a été lancée par elle.
 */
function appModules(): AppToolModule[] {
  const host = {
    role: (id: string) => (id === 'mere' ? 'mother' : id === 'fille' ? 'child' : undefined)
  } as ChildTools
  return [
    terminalToolsModule({} as TerminalManager),
    browserToolsModule({ driverFor: () => ({}) as BrowserDriver, imageCodec: codec }),
    previewToolsModule({ servers: {} as DevServers, openInBrowser: async () => {} }),
    simulatorToolsModule({
      manager: {} as SimulatorManager,
      builds: {} as XcodeBuilds,
      run,
      imageCodec: codec
    }),
    androidToolsModule({
      manager: {} as AndroidManager,
      builds: {} as GradleBuilds,
      sdk: { root: '/sdk', adb: '/sdk/adb', emulator: '/sdk/emulator' },
      run,
      imageCodec: codec
    }),
    childrenToolsModule(() => host)
  ]
}

const context = (workspace: string, conversationId: string): ToolContext => ({
  workspace,
  conversationId,
  ask: async () => null,
  proposeChild: async () => ({ action: 'refuse' as const }),
  tellAgent: () => {}
})

const folder = (files: string[] = [], dirs: string[] = []) => {
  const dir = mkdtempSync(join(tmpdir(), 'catalogue-'))
  for (const name of dirs) mkdirSync(join(dir, name))
  for (const name of files) writeFileSync(join(dir, name), '')
  return dir
}

const prefixes = (names: string[]) => [...new Set(names.map((n) => n.split('_')[0]))]

describe('outils de Bobine par famille (fiche 099)', () => {
  it('toutes les familles, dans l’ordre où l’agent les reçoit, questions en tête', () => {
    expect(appToolsCatalog(appModules()).map((f) => f.id)).toEqual([
      'ask-user',
      'terminal',
      'browser',
      'preview',
      'ios-simulator',
      'android-emulator',
      'children'
    ])
  })

  it('la liste vient des modules : chaque outil, avec la description que lit l’agent', () => {
    const modules = appModules()
    const catalog = appToolsCatalog(modules)
    for (const module of modules.filter((m) => m.id !== 'children')) {
      const tools = module.tools(context('/dossier', 'c1'))
      expect(catalog.find((f) => f.id === module.id)?.tools).toEqual(
        tools.map((tool) => ({
          name: tool.definition.name,
          description: tool.definition.description
        }))
      )
    }
    expect(catalog[0]?.tools.map((tool) => tool.name)).toEqual(['ask_user'])
    // Filles : les outils d'une mère, celui d'une fille et celui d'un relecteur (fiche 177),
    // quelle que soit la conversation.
    expect(catalog.find((f) => f.id === 'children')?.tools.map((tool) => tool.name)).toEqual([
      'start_child',
      'message_child',
      'child_status',
      'recommend_merge',
      'message_parent',
      'report_findings'
    ])
    for (const tool of catalog.flatMap((f) => f.tools)) expect(tool.description).not.toBe('')
  })

  it('un outil ajouté à un module apparaît sans autre changement', () => {
    const extra: AppToolModule = {
      id: 'essai',
      about: {
        title: 'appToolFamilies.terminal.title',
        summary: 'appToolFamilies.terminal.summary',
        condition: 'appToolFamilies.always'
      },
      tools: () =>
        ['un', 'deux'].map((name) => ({
          definition: { name, description: `Outil ${name}`, inputSchema: {} },
          autoAllow: true,
          call: async () => ({ content: [] })
        }))
    }
    expect(
      appToolsCatalog([extra])
        .at(-1)
        ?.tools.map((tool) => tool.name)
    ).toEqual(['un', 'deux'])
  })

  it('textes : une clé française et anglaise pour chaque titre, phrase, condition et accord', () => {
    const catalog = appToolsCatalog(appModules())
    for (const language of ['fr', 'en'] as const) {
      const i18n = i18next.createInstance()
      void i18n.use(typography).init(i18nOptions(language))
      for (const family of catalog) {
        for (const key of [family.title, family.summary, family.condition, family.approval]) {
          if (key) expect([key, i18n.exists(key)]).toEqual([key, true])
        }
      }
    }
    // Les questions ne demandent jamais d'accord ; tout le reste le demande à un moment.
    expect(catalog.filter((f) => !f.approval).map((f) => f.id)).toEqual(['ask-user'])
    expect(
      catalog.filter((f) => f.condition !== 'appToolFamilies.always').map((f) => f.id)
    ).toEqual(['ios-simulator', 'android-emulator', 'children'])
  })
})

describe('outils que reçoit une conversation (menu ⚙, fiche 099)', () => {
  it('dossier quelconque : ni iOS, ni Android, ni filles', () => {
    const names = conversationToolNames(appModules(), folder(), 'autre')
    expect(prefixes(names)).toEqual(['ask', 'terminal', 'browser', 'preview'])
  })

  it('projet Xcode ou Swift : les outils iOS ; projet Gradle : ceux d’Android', () => {
    const ios = conversationToolNames(appModules(), folder([], ['Demo.xcodeproj']), 'autre')
    expect(prefixes(ios)).toContain('ios')
    const swift = conversationToolNames(appModules(), folder(['Package.swift']), 'autre')
    expect(prefixes(swift)).toContain('ios')
    const android = conversationToolNames(
      appModules(),
      folder(['settings.gradle', 'gradlew']),
      'autre'
    )
    expect(prefixes(android)).toContain('android')
    expect(prefixes(android)).not.toContain('ios')
  })

  it('mère (dossier dans un dépôt git, selon `role`) : les outils des filles ; fille : message_parent', () => {
    const mother = conversationToolNames(appModules(), folder(), 'mere')
    expect(mother.filter((n) => n.includes('child'))).toEqual([
      'start_child',
      'message_child',
      'child_status'
    ])
    const child = conversationToolNames(appModules(), folder(), 'fille')
    expect(child.filter((n) => /child|parent/.test(n))).toEqual(['message_parent'])
  })

  it('le même décompte que les outils donnés à la session par le pont', () => {
    const workspace = folder(['Package.swift'])
    const bridge = new AppToolsBridge({
      workspace,
      conversationId: 'mere',
      toolModules: appModules(),
      emit: () => {},
      requests: {} as PendingRequests,
      connected: () => true,
      tellAgent: () => {}
    })
    const given = bridge.sessionTools().map((tool) => tool.definition.name)
    expect(conversationToolNames(appModules(), workspace, 'mere')).toEqual(given)
    expect(bridge.names(true)).toEqual(given)
    // Agent sans MCP par HTTP : la session n'a reçu aucun outil.
    expect(bridge.names(false)).toEqual([])
  })
})

describe('poids des outils et familles coupées (fiche 109)', () => {
  it('poids estimé : environ 4 caractères par jeton des définitions envoyées par `tools/list`', () => {
    const definition = { name: 'un', description: 'x'.repeat(80), inputSchema: {} }
    expect(definitionsTokens([definition])).toBe(Math.round(JSON.stringify(definition).length / 4))
    const catalog = appToolsCatalog(appModules())
    for (const family of catalog) expect(family.tokens).toBeGreaterThan(0)
    const browser = catalog.find((f) => f.id === 'browser')
    // Le navigateur, la plus grosse famille : entre 1 000 et 3 000 jetons (relevé de la fiche).
    expect(browser?.tokens).toBeGreaterThan(1000)
    expect(browser?.tokens).toBeLessThan(3000)
  })

  it('familles coupées : signalées au catalogue, les questions jamais', () => {
    const catalog = appToolsCatalog(appModules(), new Set(['browser', 'ask-user']))
    expect(catalog.filter((f) => !f.enabled).map((f) => f.id)).toEqual(['browser'])
    expect(catalog.filter((f) => f.required).map((f) => f.id)).toEqual(['ask-user'])
  })

  it('une famille coupée n’est plus donnée à la session (pont), relue à chaque ouverture', () => {
    const off = new Set<string>()
    const modules = switchedOff(appModules(), () => off)
    const bridge = new AppToolsBridge({
      workspace: folder(),
      conversationId: 'autre',
      toolModules: modules,
      emit: () => {},
      requests: {} as PendingRequests,
      connected: () => true,
      tellAgent: () => {}
    })
    expect(prefixes(bridge.sessionTools().map((t) => t.definition.name))).toContain('browser')
    off.add('browser')
    off.add('terminal')
    expect(prefixes(bridge.sessionTools().map((t) => t.definition.name))).toEqual([
      'ask',
      'preview'
    ])
  })

  it('menu ⚙ : outils et poids de la session, et ce que recevra la prochaine', () => {
    const off = new Set<string>()
    const modules = switchedOff(appModules(), () => off)
    const workspace = folder()
    const now = conversationAppTools(modules, workspace, 'autre', undefined)
    expect(now.names).toEqual(conversationToolNames(appModules(), workspace, 'autre'))
    expect(now.tokens).toBeGreaterThan(2000)
    expect(now.next).toBeUndefined()
    // Session ouverte avec ces outils, puis le navigateur coupé.
    off.add('browser')
    const live = conversationAppTools(modules, workspace, 'autre', now.names)
    expect(live.names).toEqual(now.names)
    expect(live.tokens).toBe(now.tokens)
    expect(live.next).toBe(now.names.filter((n) => !n.startsWith('browser')).length)
    // Agent sans MCP par HTTP : rien reçu, rien à annoncer.
    expect(conversationAppTools(modules, workspace, 'autre', []).next).toBeUndefined()
  })
})

describe('indices MCP des outils (fiche 165)', () => {
  it('chaque outil annoté existe ; une capture est en lecture seule, un clic sans indice', () => {
    const names = new Set(appToolsCatalog(appModules()).flatMap((f) => f.tools.map((t) => t.name)))
    expect([...READ_ONLY_TOOLS, ...APP_ONLY_TOOLS].filter((n) => !names.has(n))).toEqual([])
    const definition = (name: string) => ({ name, description: '', inputSchema: {} })
    expect(withHints(definition('browser_screenshot')).annotations).toEqual({ readOnlyHint: true })
    expect(withHints(definition('start_child')).annotations).toMatchObject({
      readOnlyHint: false,
      destructiveHint: false
    })
    expect(withHints(definition('browser_click')).annotations).toBeUndefined()
    expect(withHints(definition('terminal_run')).annotations).toBeUndefined()
  })
})
