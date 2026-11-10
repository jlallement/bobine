import { mkdirSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { ToolContext } from '../mcp/tools'
import type { Run } from './run'
import { SimulatorManager } from './simulator-manager'
import { simulatorToolsModule } from './simulator-tools'
import { XcodeBuilds } from './xcode'

const UI = JSON.stringify([
  {
    type: 'Application',
    AXLabel: 'Demo',
    frame: { x: 0, y: 0, width: 402, height: 874 },
    children: [
      { type: 'Button', AXLabel: 'Valider', frame: { x: 100, y: 400, width: 200, height: 50 } }
    ]
  }
])

/** Faux `xcrun simctl`, `axe` et `plutil` : enregistre les appels, simule un iPhone. */
function fakeEnvironment(options: { booted?: boolean; axeVersion?: string } = {}) {
  let booted = options.booted ?? true
  const calls: string[] = []
  const ok = (stdout: string | Buffer = '') => ({
    code: 0,
    stdout: Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout),
    stderr: ''
  })
  const run: Run = async (file, args, opts) => {
    const line = [file.split('/').pop(), ...args].join(' ')
    const input = Buffer.isBuffer(opts?.input) ? opts.input.toString('latin1') : opts?.input
    calls.push(input ? `${line} <<< ${input}` : line)
    if (file === 'xcrun') {
      const [, sub] = args
      if (sub === 'list') {
        return ok(
          JSON.stringify({
            devices: {
              'com.apple.CoreSimulator.SimRuntime.iOS-26-5': [
                { udid: 'U1', name: 'iPhone 17', state: booted ? 'Booted' : 'Shutdown' }
              ]
            }
          })
        )
      }
      if (sub === 'boot') booted = true
      if (sub === 'launch') return ok('com.demo.app: 77')
      if (sub === 'io') return ok(Buffer.from('jpeg'))
      return ok()
    }
    if (file.endsWith('axe')) {
      if (args[0] === '--version') return ok(`${options.axeVersion ?? '1.8.0'}\n`)
      return args[0] === 'describe-ui' ? ok(UI) : ok('✓')
    }
    if (file === 'plutil') return ok('com.demo.app\n')
    return { code: 1, stdout: Buffer.alloc(0), stderr: 'inconnu' }
  }
  return { run, calls }
}

function setup(
  options: { booted?: boolean; axe?: boolean; axeVersion?: string; answer?: string[] | null } = {}
) {
  const env = fakeEnvironment(options)
  const workspace = mkdtempSync(join(tmpdir(), 'ios-'))
  mkdirSync(join(workspace, 'Demo.xcodeproj'))
  const manager = new SimulatorManager({
    run: env.run,
    axeBinary: options.axe === false ? undefined : '/bin/axe',
    resize: (_jpeg, width, height) => ({
      data: 'AA==',
      width,
      height,
      sourceWidth: 1206,
      sourceHeight: 2622
    }),
    emitState: () => {}
  })
  const module = simulatorToolsModule({
    manager,
    builds: new XcodeBuilds(mkdtempSync(join(tmpdir(), 'dd-'))),
    run: env.run,
    budgetMs: 200,
    imageCodec: {
      bitmap: (jpeg, width, height) => ({
        width,
        height,
        data: new Uint8Array(width * height * 4).fill(jpeg[0] ?? 0)
      }),
      jpeg: () => Buffer.from('planche')
    }
  })
  const context: ToolContext = {
    workspace,
    conversationId: 'c1',
    ask: vi.fn(async () => options.answer ?? ['Compiler']),
    proposeChild: async () => ({ action: 'refuse' as const }),
    tellAgent: () => {}
  }
  const tools = module.tools(context)
  const call = async (name: string, args: unknown = {}) => {
    const result = await tools.find((t) => t.definition.name === name)?.call(args)
    const first = result?.content[0]
    return { text: first?.type === 'text' ? first.text : '', result }
  }
  return { ...env, module, context, call, workspace, manager }
}

describe('outils du simulateur iOS', () => {
  it('proposés seulement pour un projet Apple, autorisés d’office, onglet « Simulateur »', () => {
    const t = setup()
    expect(t.module.enabled?.({ ...t.context })).toBe(true)
    expect(
      t.module.enabled?.({ ...t.context, workspace: mkdtempSync(join(tmpdir(), 'web-')) })
    ).toBe(false)
    const tools = t.module.tools(t.context)
    expect(tools.every((tool) => tool.autoAllow && tool.panel === 'simulator')).toBe(true)
  })

  it('démarrage d’un appareil par son nom, puis utilisé par la conversation', async () => {
    const t = setup({ booted: false })
    expect((await t.call('ios_boot', { device: 'iphone 17' })).text).toContain('is booted')
    expect(t.calls).toContain('xcrun simctl boot U1')
    expect((await t.call('ios_devices')).text).toContain('* iPhone 17 — iOS 26.5 — Booted — U1')
  })

  it('installer et lancer un .app : identifiant de bundle lu, taille de l’écran en points', async () => {
    const t = setup()
    const { text } = await t.call('ios_launch', { app_path: '/build/Demo.app' })
    expect(t.calls).toContain('xcrun simctl install U1 /build/Demo.app')
    expect(t.calls).toContain('xcrun simctl launch --terminate-running-process U1 com.demo.app')
    expect(text).toContain('com.demo.app launched on "iPhone 17" (pid 77)')
    expect(text).toContain('402×874 points')
  })

  it('capture à l’échelle des points, puis l’image', async () => {
    const t = setup()
    const { text, result } = await t.call('ios_screenshot', { scale: 0.5 })
    expect(text).toContain('201×437')
    expect(result?.content[1]).toEqual({ type: 'image', data: 'AA==', mimeType: 'image/jpeg' })
  })

  it('lire l’écran puis toucher par référence ; saisie et bouton passent par AXe', async () => {
    const t = setup()
    expect((await t.call('ios_describe')).text).toContain('- Button "Valider" [ref_1]')
    await t.call('ios_tap', { ref: 'ref_1' })
    expect(t.calls).toContain('axe tap -x 200 -y 425 --udid U1')
    await t.call('ios_tap', { x: 10, y: 20, duration: 1 })
    expect(t.calls).toContain('axe touch -x 10 -y 20 --down --up --delay 1 --udid U1')
    await t.call('ios_type', { text: 'Zoé' })
    expect(t.calls).toContain('xcrun simctl pbcopy U1 <<< Zo\u008e')
    expect(t.calls).toContain('axe key-combo --modifiers 227 --key 25 --udid U1')
    await t.call('ios_type', { text: 'Ada', keystrokes: true })
    expect(t.calls).toContain('axe type --stdin --udid U1 <<< Ada')
    await expect(t.call('ios_type', { text: 'é', keystrokes: true })).rejects.toThrow('US keyboard')
    await expect(t.call('ios_type', { text: '🚀' })).rejects.toThrow('🚀')
    await t.call('ios_button', { button: 'home' })
    expect(t.calls).toContain('axe button home --udid U1')
    // Version vérifiée une seule fois, et donnée à l'onglet.
    expect(t.calls.filter((c) => c === 'axe --version')).toHaveLength(1)
    expect(await t.manager.state('c1')).toMatchObject({
      touch: true,
      axe: { version: '1.8.0', path: '/bin/axe' }
    })
  })

  it('sans AXe : touchers refusés avec la marche à suivre, le reste marche', async () => {
    const t = setup({ axe: false })
    await expect(t.call('ios_tap', { x: 1, y: 2 })).rejects.toThrow('AXe')
    expect((await t.call('ios_open_url', { url: 'demo://accueil' })).text).toContain('Opened')
    expect(t.calls).toContain('xcrun simctl openurl U1 demo://accueil')
    expect(await t.manager.state('c1')).toMatchObject({
      touch: false,
      axe: { error: expect.stringContaining('n’est pas installé') }
    })
  })

  it('AXe trop ancien : touchers refusés, version attendue dite à l’agent et à l’onglet', async () => {
    const t = setup({ axeVersion: '1.7.1' })
    await expect(t.call('ios_tap', { x: 1, y: 2 })).rejects.toThrow(
      'AXe 1.8.0 or newer (found 1.7.1)'
    )
    await expect(t.call('ios_describe')).rejects.toThrow('found 1.7.1')
    expect(t.calls).not.toContain('axe tap -x 1 -y 2 --udid U1')
    expect(await t.manager.state('c1')).toMatchObject({
      touch: false,
      axe: { version: '1.7.1', error: expect.stringContaining('trop ancien') }
    })
  })

  it('pas d’appareil démarré : l’agent sait quoi faire', async () => {
    const t = setup({ booted: false })
    await expect(t.call('ios_screenshot')).rejects.toThrow('ios_boot')
  })

  it('compilation refusée par l’utilisateur : xcodebuild n’est pas lancé', async () => {
    const t = setup({ answer: ['Refuser'] })
    const { text } = await t.call('ios_build', { scheme: 'Demo' })
    expect(text).toContain('refused')
    expect(t.context.ask).toHaveBeenCalledWith(
      expect.objectContaining({ question: expect.stringContaining('xcodebuild -project') }),
      expect.any(Function)
    )
  })
})

describe('planche contact du simulateur (fiche 075)', () => {
  it('fait le geste pendant le film du flux, rend une planche aux coordonnées des touchers', async () => {
    const t = setup()
    const film = vi.spyOn(t.manager, 'film').mockImplementation(async (_id, run) => {
      await run()
      return [0, 30, 60, 400].map((at, i) => ({ at, jpeg: Buffer.from([i * 50]) }))
    })
    const { text, result } = await t.call('ios_filmstrip', {
      actions: [{ tool: 'ios_swipe', args: { from: [200, 600], to: [200, 200] } }],
      duration_ms: 1000,
      frames: 3
    })
    expect(film).toHaveBeenCalledWith('c1', expect.any(Function), 1000)
    expect(t.calls.some((c) => c.startsWith('axe swipe --start-x 200 --start-y 600'))).toBe(true)
    expect(text).toContain('Contact sheet over 1000 ms: 3 frames')
    expect(text).toContain('ios_tap')
    expect(result?.isError).toBeUndefined()
    expect(result?.content[1]).toMatchObject({ type: 'image', mimeType: 'image/jpeg' })
    expect(result?.content.at(-1)).toMatchObject({ text: expect.stringContaining('Swiped from') })
  })

  it('seulement des gestes : une capture ou une compilation pendant le film est refusée', async () => {
    const t = setup()
    vi.spyOn(t.manager, 'film').mockImplementation(async (_id, run) => {
      await run()
      return [{ at: 0, jpeg: Buffer.from([1]) }]
    })
    const { result } = await t.call('ios_filmstrip', { actions: [{ tool: 'ios_build' }] })
    expect(result?.isError).toBe(true)
    expect(result?.content.at(-1)).toMatchObject({
      text: expect.stringContaining('not filmable (ios_build)')
    })
  })

  it('sans AXe : pas de film, l’agent sait quoi faire', async () => {
    const t = setup({ axe: false })
    await expect(t.call('ios_filmstrip')).rejects.toThrow(/no video stream to film.*ios_screenshot/)
  })
})
