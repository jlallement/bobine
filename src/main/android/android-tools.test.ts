import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { ToolContext } from '../mcp/tools'
import type { Run } from '../simulator/run'
import { AndroidManager } from './android-manager'
import { androidToolsModule } from './android-tools'
import { GradleBuilds } from './gradle'

const UI = `<?xml version='1.0' encoding='UTF-8' standalone='yes' ?><hierarchy rotation="0"><node text="" class="android.widget.LinearLayout" resource-id="" content-desc="" clickable="false" enabled="true" bounds="[0,0][1080,2400]"><node text="Ajouter un" class="android.widget.Button" resource-id="" content-desc="" clickable="true" enabled="true" bounds="[100,1000][500,1100]" /></node></hierarchy>UI hierchary dumped to: /dev/tty`

/** Faux `adb` / `emulator` / `aapt2` : un émulateur 1080×2400 à 420 ppp. */
function fakeEnvironment() {
  const calls: string[] = []
  /** Réponse à `dumpsys window displays` (vide : orientation illisible, taille physique). */
  const displays = { out: '' }
  const ok = (out = '') => ({ code: 0, stdout: Buffer.from(out), stderr: '' })
  const run: Run = async (file, args) => {
    calls.push([file.split('/').pop(), ...args].join(' '))
    if (file.endsWith('emulator')) return ok('Bob_Test\n')
    if (file.endsWith('aapt2')) return ok('com.demo\n')
    const command = args.slice(2).join(' ')
    if (args[0] === 'devices')
      return ok('List of devices attached\nemulator-5554\tdevice model:sdk\n')
    if (command === 'emu avd name') return ok('Bob_Test\nOK\n')
    if (command.includes('wm size')) return ok('Physical size: 1080x2400\n')
    if (command.includes('wm density')) return ok('Physical density: 420\n')
    if (command.includes('dumpsys window displays')) return ok(displays.out)
    if (command.includes('resolve-activity')) return ok('com.demo/.MainActivity\n')
    if (command.startsWith('exec-out uiautomator')) return ok(UI)
    if (command.startsWith('exec-out screencap')) return ok('PNG-OCTETS')
    if (command.startsWith('shell pidof')) return ok('4242\n')
    if (command.startsWith('logcat')) return ok('E/AndroidRuntime: FATAL EXCEPTION: main\n')
    return ok()
  }
  return { run, calls, displays }
}

function setup(answer: string[] | null = ['Compiler'], adb = '/sdk/adb') {
  const env = fakeEnvironment()
  const workspace = mkdtempSync(join(tmpdir(), 'android-'))
  writeFileSync(join(workspace, 'settings.gradle'), '')
  writeFileSync(join(workspace, 'gradlew'), '')
  const sdk = { root: '/sdk', adb, emulator: '/sdk/emulator', aapt2: '/sdk/aapt2' }
  const manager = new AndroidManager({
    run: env.run,
    adb: sdk.adb,
    emulator: sdk.emulator,
    resize: (_png, width, height) => ({
      data: 'AA==',
      width,
      height,
      sourceWidth: 1080,
      sourceHeight: 2400
    }),
    // Faux JPEG : un octet, le bleu du premier pixel.
    encodeBgra: (bgra, width, height) => Buffer.from([bgra[0] ?? 0, width, height]),
    emitState: () => {}
  })
  const module = androidToolsModule({
    manager,
    builds: new GradleBuilds(sdk),
    sdk,
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
    ask: vi.fn(async () => answer),
    proposeChild: async () => ({ action: 'refuse' as const }),
    tellAgent: () => {}
  }
  const tools = module.tools(context)
  const call = async (name: string, args: unknown = {}) => {
    const result = await tools.find((t) => t.definition.name === name)?.call(args)
    const first = result?.content[0]
    return { text: first?.type === 'text' ? first.text : '', result }
  }
  return { ...env, manager, module, context, call }
}

/** Une image de `screenrecord --output-format=frames` : en-tête de 20 octets, pixels RGB. */
function rawFrame(width: number, height: number, blue: number): Buffer {
  const pixels = Buffer.alloc(width * height * 3)
  for (let i = 2; i < pixels.length; i += 3) pixels[i] = blue
  const head = Buffer.alloc(20)
  head.writeUInt32LE(16 + pixels.length, 0)
  head.writeUInt32LE(width, 4)
  head.writeUInt32LE(height, 8)
  head.writeUInt32LE(width * 3, 12)
  head.writeUInt32LE(3, 16)
  return Buffer.concat([head, pixels])
}

/** Faux `adb` pour `screenrecord` : rejoue `script` (shell) et note ses arguments. */
function fakeAdb(script: (dir: string) => string): { adb: string; args: string } {
  const dir = mkdtempSync(join(tmpdir(), 'adb-'))
  const adb = join(dir, 'adb')
  writeFileSync(adb, `#!/bin/sh\necho "$*" > '${dir}/args'\n${script(dir)}\n`)
  chmodSync(adb, 0o755)
  return { adb, args: join(dir, 'args') }
}

describe('outils de l’émulateur Android', () => {
  it('proposés seulement pour un projet Android, autorisés d’office, onglet « Android »', () => {
    const t = setup()
    expect(t.module.enabled?.(t.context)).toBe(true)
    expect(
      t.module.enabled?.({ ...t.context, workspace: mkdtempSync(join(tmpdir(), 'web-')) })
    ).toBe(false)
    expect(
      t.module.tools(t.context).every((tool) => tool.autoAllow && tool.panel === 'android')
    ).toBe(true)
  })

  it('appareils : émulateur en marche nommé par son AVD', async () => {
    expect((await setup().call('android_devices')).text).toContain(
      '* Bob_Test — device — emulator-5554'
    )
  })

  it('installer et lancer un APK : paquet lu par aapt2, écran en dp', async () => {
    const t = setup()
    const { text } = await t.call('android_launch', { apk_path: '/b/app.apk' })
    expect(t.calls).toContain('adb -s emulator-5554 install -r /b/app.apk')
    expect(t.calls).toContain('aapt2 dump packagename /b/app.apk')
    expect(text).toContain('com.demo/.MainActivity launched on "Bob_Test"')
    expect(text).toContain('411×914 dp')
  })

  it('lire l’écran puis toucher par référence : dp convertis en pixels', async () => {
    const t = setup()
    expect((await t.call('android_describe')).text).toContain(
      '- Button "Ajouter un" (cliquable) [ref_1]'
    )
    await t.call('android_tap', { ref: 'ref_1' })
    // Centre (300, 1050) px → (114, 400) dp → (299, 1050) px.
    expect(t.calls).toContain('adb -s emulator-5554 shell input tap 299 1050')
  })

  it('en paysage : écran, capture et touchers dans l’orientation courante (fiche 081)', async () => {
    const t = setup()
    t.displays.out =
      '    init=1080x2400 420dpi cur=2400x1080 app=2400x1080\n      mCurrentRotation=ROTATION_270\n'
    const { text } = await t.call('android_launch', { package: 'com.demo' })
    expect(text).toContain('914×411 dp')
    expect(await t.manager.state('c1')).toMatchObject({
      screen: { width: 914, height: 411 },
      rotation: 3,
      cornerRadius: 0
    })
    await t.call('android_tap', { x: 800, y: 100 })
    expect(t.calls).toContain('adb -s emulator-5554 shell input tap 2100 263')
  })

  it('capture en dp ; saisie ASCII seulement ; touche nommée', async () => {
    const t = setup()
    expect((await t.call('android_screenshot', { scale: 0.5 })).text).toContain('206×457')
    await t.call('android_type', { text: 'Ada Lovelace' })
    expect(t.calls).toContain("adb -s emulator-5554 shell input text 'Ada%sLovelace'")
    await expect(t.call('android_type', { text: 'Zoé' })).rejects.toThrow('ASCII')
    await t.call('android_key', { key: 'back' })
    expect(t.calls).toContain("adb -s emulator-5554 shell input keyevent 'KEYCODE_BACK'")
  })

  it('journaux d’une app : filtrés par son pid', async () => {
    const t = setup()
    expect((await t.call('android_logcat', { package: 'com.demo', level: 'E' })).text).toContain(
      'FATAL EXCEPTION'
    )
    expect(t.calls).toContain('adb -s emulator-5554 logcat -d -t 200 *:E --pid=4242')
  })

  it('Gradle réussi sans APK : « Build succeeded », sans erreur, avec les dossiers cherchés (fiche 122)', async () => {
    const t = setup()
    writeFileSync(join(t.context.workspace, 'gradlew'), '#!/bin/sh\necho "BUILD SUCCESSFUL"\n')
    chmodSync(join(t.context.workspace, 'gradlew'), 0o755)
    let built = await t.call('android_build')
    while (built.text.startsWith('Build still running')) built = await t.call('android_build')
    expect(built.result?.isError).toBeUndefined()
    expect(built.text).toMatch(/^Build succeeded in \d+ s, but no APK under /)
    expect(built.text).toContain('flutter-apk')
  })

  it('compilation refusée : Gradle n’est pas lancé', async () => {
    const t = setup(['Refuser'])
    expect((await t.call('android_build')).text).toContain('refused')
    expect(t.context.ask).toHaveBeenCalledWith(
      expect.objectContaining({ question: expect.stringContaining('./gradlew assembleDebug') }),
      expect.any(Function)
    )
  })
})

describe('planche contact de l’émulateur Android (fiche 076)', () => {
  it('fait le geste pendant le film, rend une planche aux coordonnées de android_tap', async () => {
    const t = setup()
    const film = vi.spyOn(t.manager, 'film').mockImplementation(async (_id, run) => {
      await run()
      return [0, 30, 60, 400].map((at, i) => ({ at, jpeg: Buffer.from([i * 50]) }))
    })
    const { text, result } = await t.call('android_filmstrip', {
      actions: [{ tool: 'android_swipe', args: { from: [200, 600], to: [200, 200] } }],
      duration_ms: 1000,
      frames: 3
    })
    expect(film).toHaveBeenCalledWith('c1', expect.any(Function), 1000)
    expect(t.calls).toContain('adb -s emulator-5554 shell input swipe 525 1575 525 525 300')
    expect(text).toContain('Contact sheet over 1000 ms: 3 frames')
    expect(text).toContain('android_tap')
    expect(result?.isError).toBeUndefined()
    expect(result?.content[1]).toMatchObject({ type: 'image', mimeType: 'image/jpeg' })
    expect(result?.content.at(-1)).toMatchObject({ text: expect.stringContaining('Swiped from') })
  })

  it('seulement des gestes : une compilation pendant le film est refusée', async () => {
    const t = setup()
    vi.spyOn(t.manager, 'film').mockImplementation(async (_id, run) => {
      await run()
      return [{ at: 0, jpeg: Buffer.from([1]) }]
    })
    const { result } = await t.call('android_filmstrip', { actions: [{ tool: 'android_build' }] })
    expect(result?.isError).toBe(true)
    expect(result?.content.at(-1)).toMatchObject({
      text: expect.stringContaining('not filmable (android_build)')
    })
  })

  it('filme avec un second screenrecord en images brutes, à la taille en dp', async () => {
    const fake = fakeAdb((dir) => {
      writeFileSync(join(dir, 'a'), rawFrame(4, 8, 10))
      writeFileSync(join(dir, 'b'), rawFrame(4, 8, 200))
      return `cat '${dir}/a'; sleep 0.1; cat '${dir}/b'; sleep 5`
    })
    const t = setup(undefined, fake.adb)
    const run = vi.fn(async () => {})
    const started = Date.now()
    const frames = await t.manager.film('c1', run, 400)
    expect(Date.now() - started).toBeLessThan(3000)
    expect(run).toHaveBeenCalledOnce()
    expect(readFileSync(fake.args, 'utf8').trim()).toBe(
      '-s emulator-5554 exec-out screenrecord --output-format=frames --size 411x914 -'
    )
    // Pixels RGB devenus BGRA : le bleu en premier ; moments croissants, le premier à 0.
    expect(frames.map((f) => [...f.jpeg])).toEqual([
      [10, 4, 8],
      [200, 4, 8]
    ])
    expect(frames[0]?.at).toBe(0)
    expect(frames[1]?.at).toBeGreaterThan(0)
  })

  it('sans image de l’appareil : rien n’est fait, l’agent sait quoi faire', async () => {
    const fake = fakeAdb(() => `echo "Unknown format 'frames'" >&2; exit 1`)
    const t = setup(undefined, fake.adb)
    const run = vi.fn(async () => {})
    await expect(t.manager.film('c1', run, 400)).rejects.toThrow(
      /No image from the Android screen.*Unknown format 'frames'.*android_screenshot/
    )
    expect(run).not.toHaveBeenCalled()
  })
})
