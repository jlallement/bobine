/**
 * Outils « émulateur Android » (fiche 032) : l'agent compile l'app avec Gradle, l'installe et la
 * lance, prend des captures, lit l'écran, touche, glisse, tape et lit les journaux ; l'utilisateur suit
 * dans l'onglet « Android ».
 */
import { basename, relative } from 'node:path'
import type { AppTool, AppToolModule, ToolContext, ToolResult } from '../mcp/tools'
import { panelToolFactory, pointArg, textResult } from '../mcp/tools'
import type { CommandMemory } from '../approvals'
import { approveCommand } from '../mcp/command-approval'
import { waitAtMost } from '../jobs/command-job'
import type { Run } from '../simulator/run'
import { KEYS } from './adb'
import type { AndroidManager } from './android-manager'
import {
  findAndroidProjects,
  gradleCommand,
  gradleErrors,
  hasAndroidProject,
  type GradleBuilds,
  type GradleJob
} from './gradle'
import type { AndroidSdk } from './sdk'
import { deviceFilmstripTool } from '../filmstrip/device-tool'
import type { ImageCodec } from '../filmstrip/sheet'
import { t } from 'i18next'
import { delay } from '../delay'

/** Attente maximale dans un appel d'outil (Bob abandonne au bout d'environ 60 s). */
export const ANDROID_TOOL_BUDGET_MS = 40_000
const DESCRIBE_MAX_CHARS = 20_000
const LOG_LEVELS = ['V', 'D', 'I', 'W', 'E']
/** Planche contact (fiche 076) : gestes filmables. */
const FILMABLE = ['android_tap', 'android_swipe', 'android_type', 'android_key', 'android_open_url']

export interface AndroidToolsOptions {
  /** Compilations « toujours » lancées dans un dossier (fiche 072). */
  always?: CommandMemory
  manager: AndroidManager
  builds: GradleBuilds
  sdk: AndroidSdk
  run: Run
  budgetMs?: number
  /** Images de la planche contact (fiche 076) ; sans lui, pas de `android_filmstrip`. */
  imageCodec?: ImageCodec
}

export function androidToolsModule(options: AndroidToolsOptions): AppToolModule {
  const approved = new Set<string>()
  return {
    id: 'android-emulator',
    about: {
      title: 'appToolFamilies.android-emulator.title',
      summary: 'appToolFamilies.android-emulator.summary',
      condition: 'appToolFamilies.android-emulator.condition',
      // `android_build` : la première compilation de cette tâche dans ce projet.
      approval: 'appToolFamilies.android-emulator.approval'
    },
    // Chaque outil coûte du contexte : proposés seulement pour un projet Android.
    enabled: (context) => hasAndroidProject(context.workspace),
    tools: (context) => createTools(context, options, approved)
  }
}

function createTools(
  context: ToolContext,
  options: AndroidToolsOptions,
  approved: Set<string>
): AppTool[] {
  const { manager, builds, sdk, run } = options
  const id = context.conversationId
  const budget = options.budgetMs ?? ANDROID_TOOL_BUDGET_MS

  // Autorisés sans demander : ils n'agissent que sur l'émulateur ; `android_build` montre
  // lui-même sa commande.
  const tool = panelToolFactory('android')

  const approveBuild = (projectDir: string, task: string): Promise<ToolResult | undefined> => {
    const command = gradleCommand(task)
    const where = relative(context.workspace, projectDir) || basename(projectDir)
    return approveCommand(context, {
      workspace: projectDir,
      command,
      question: t('approvals.android.question', { where, command }),
      header: t('approvals.android.header'),
      allow: t('approvals.android.allow'),
      allowDescription: t('approvals.android.allowDescription'),
      session: approved,
      key: `${projectDir}\u0000${command}`,
      ...(options.always ? { always: options.always } : {}),
      texts: {
        retry: 'J’ai autorisé la compilation : relance android_build.',
        refusedByUser: 'Je ne veux pas lancer la compilation.',
        pending:
          'The user has not approved the build yet. End your turn now; their decision will arrive as their next message.',
        refused: 'The user refused the build. Do not try again.'
      }
    })
  }

  const packageOf = async (apk: string): Promise<string> => {
    if (!sdk.aapt2) throw new Error('aapt2 missing in the Android SDK: pass `package` explicitly.')
    const result = await run(sdk.aapt2, ['dump', 'packagename', apk], { timeoutMs: 30_000 })
    const name = result.stdout.toString('utf8').trim()
    if (result.code !== 0 || !name) throw new Error(`Paquet introuvable dans ${apk}`)
    return name
  }

  const buildReport = (job: GradleJob): ToolResult => {
    const seconds = Math.round(((job.finishedAt ?? Date.now()) - job.startedAt) / 1000)
    if (job.status === 'running') {
      return textResult(
        `Build still running (${seconds} s). Call android_build again to keep waiting.\nLast output:\n${job.lines.slice(-8).join('\n')}`
      )
    }
    if (job.status === 'failed') {
      const errors = gradleErrors(job.lines)
      return textResult(
        `Build failed after ${seconds} s.\n${(errors.length ? errors : job.lines.slice(-20)).join('\n')}`,
        true
      )
    }
    if (job.apkSearched) {
      return textResult(
        `Build succeeded in ${seconds} s, but no APK under ${job.apkSearched.join(', ')}. Find the APK the build wrote (for example \`find . -name '*.apk' -newer gradlew\`) and pass it to android_launch as apk_path.`
      )
    }
    return textResult(
      `Build succeeded in ${seconds} s${job.apkPath ? `: ${job.apkPath}.\nCall android_launch with apk_path to install and run it.` : '.'}`
    )
  }

  const tools: AppTool[] = [
    tool(
      'android_devices',
      'List running Android devices/emulators and the installed virtual devices (AVDs).',
      {},
      async () => {
        const [devices, avds, current] = await Promise.all([
          manager.adb.devices(),
          manager.adb.avds().catch(() => []),
          manager.device(id).catch(() => null)
        ])
        const lines = [
          ...devices.map(
            (d) =>
              `${d.serial === current?.serial ? '*' : ' '} ${d.name} — ${d.state} — ${d.serial}`
          ),
          ...avds
            .filter((avd) => !devices.some((d) => d.name === avd))
            .map((avd) => `  ${avd} — not running (android_boot)`)
        ]
        return textResult(
          lines.length ? lines.join('\n') : 'No device and no AVD (create one in Android Studio).'
        )
      }
    ),
    tool(
      'android_boot',
      `Start an Android virtual device (AVD name from android_devices) or select a running one for this conversation. Waits up to ${Math.round(budget / 1000)} s; call again while it boots.`,
      { avd: { type: 'string' } },
      async (args) => {
        const wanted = typeof args['avd'] === 'string' ? args['avd'] : ''
        const running = (await manager.adb.devices()).find(
          (d) => d.name === wanted || d.serial === wanted
        )
        if (!running) {
          const avds = await manager.adb.avds()
          if (!avds.includes(wanted)) {
            return textResult(
              `Unknown AVD "${wanted}". Available: ${avds.join(', ') || 'none'}`,
              true
            )
          }
          manager.adb.startEmulator(wanted)
        }
        const until = Date.now() + budget
        while (Date.now() < until) {
          const device = (await manager.adb.devices()).find(
            (d) => d.name === wanted || d.serial === wanted
          )
          if (device?.state === 'device' && (await manager.adb.booted(device.serial))) {
            manager.select(id, device.serial)
            manager.changed(id)
            return textResult(
              `"${device.name}" (${device.serial}) is ready and used for this conversation.`
            )
          }
          await delay(2000)
        }
        return textResult(`"${wanted}" is still booting. Call android_boot again to keep waiting.`)
      },
      ['avd']
    ),
    tool(
      'android_build',
      `Build the Android app with the project's Gradle wrapper (default task assembleDebug), in the background; waits up to ${Math.round(budget / 1000)} s, call again while it runs. Returns compiler errors, or the APK to pass to android_launch.`,
      {
        task: { type: 'string', description: 'Gradle task, default assembleDebug.' },
        project: { type: 'string', description: 'Folder of the Gradle project if several.' }
      },
      async (args, signal) => {
        const projects = findAndroidProjects(context.workspace)
        const projectDir =
          typeof args['project'] === 'string'
            ? projects.find((p) => p.endsWith(String(args['project'])))
            : projects[0]
        if (!projectDir) {
          return textResult(
            projects.length
              ? `Unknown project. Available: ${projects.join(', ')}`
              : 'No Gradle project with gradlew in this folder.',
            true
          )
        }
        const task =
          typeof args['task'] === 'string' && /^[\w:.-]+$/.test(args['task'])
            ? args['task']
            : 'assembleDebug'
        const running = builds.get(projectDir, task)
        if (running?.status === 'running') {
          await waitAtMost(running, budget, signal)
          return buildReport(running)
        }
        const refused = await approveBuild(projectDir, task)
        if (refused) return refused
        const job = builds.start(projectDir, task)
        await waitAtMost(job, budget, signal)
        return buildReport(job)
      }
    ),
    tool(
      'android_launch',
      'Install an APK (apk_path from android_build) and launch it, or relaunch an installed app by package.',
      { apk_path: { type: 'string' }, package: { type: 'string' } },
      async (args) => {
        const device = await manager.readyDevice(id)
        const apk = typeof args['apk_path'] === 'string' ? args['apk_path'] : undefined
        if (apk) await manager.adb.install(device.serial, apk)
        const packageName =
          typeof args['package'] === 'string'
            ? args['package']
            : apk
              ? await packageOf(apk)
              : undefined
        if (!packageName) return textResult('`apk_path` or `package` is required.', true)
        const component = await manager.adb.launch(device.serial, packageName)
        manager.changed(id)
        const screen = await manager.screen(id)
        return textResult(
          `${component} launched on "${device.name}".${screen ? ` Screen: ${screen.width}×${screen.height} dp (tap coordinates).` : ''} Use android_screenshot / android_describe to check it, android_logcat for crashes.`
        )
      }
    ),
    tool(
      'android_screenshot',
      'Screenshot of the Android screen. Image pixels are dp: the same coordinates as android_tap (unless scaled).',
      { scale: { type: 'number', description: 'Optional 0.1–1 downscale to save context.' } },
      async (args) => {
        const scale =
          typeof args['scale'] === 'number' ? Math.min(1, Math.max(0.1, args['scale'])) : 1
        const shot = await manager.screenshot(id, scale)
        return [
          {
            type: 'text',
            text: `Android screenshot ${shot.width}×${shot.height}${scale === 1 ? ' (dp = tap coordinates)' : `, scaled ×${scale}: divide by ${scale} for tap coordinates`}.`
          },
          { type: 'image', data: shot.data, mimeType: shot.mimeType }
        ]
      }
    ),
    tool(
      'android_describe',
      'Read the Android screen (UI hierarchy): one element per line with its text, id and a ref_N to tap. Cheaper and more precise than a screenshot.',
      { max_chars: { type: 'number' } },
      async (args) => {
        const max =
          typeof args['max_chars'] === 'number'
            ? Math.min(100_000, Math.max(1000, args['max_chars']))
            : DESCRIBE_MAX_CHARS
        const screen = await manager.describe(id, max)
        return textResult(
          `Screen ${screen.screen.width}×${screen.screen.height} dp.\n${screen.lines.join('\n') || '(no element)'}${screen.truncated ? '\n[… truncated]' : ''}`
        )
      }
    ),
    tool(
      'android_tap',
      'Tap the Android screen: an element ref from android_describe, or x/y in dp. duration (ms) = long press.',
      {
        ref: { type: 'string' },
        x: { type: 'number' },
        y: { type: 'number' },
        duration: { type: 'number' }
      },
      async (args) => {
        const hold =
          typeof args['duration'] === 'number'
            ? Math.min(10_000, Math.max(0, args['duration']))
            : undefined
        const point =
          typeof args['ref'] === 'string'
            ? manager.pointOf(id, args['ref'])
            : pointArg([args['x'], args['y']], 'x/y', 'dp')
        await manager.tap(id, point, hold || undefined)
        return textResult(`Tapped (${point.x}, ${point.y}) dp${hold ? ` for ${hold} ms` : ''}.`)
      }
    ),
    tool(
      'android_swipe',
      'Swipe (scroll, drag) from one point to another, in dp.',
      {
        from: { type: 'array', items: { type: 'number' } },
        to: { type: 'array', items: { type: 'number' } },
        duration: { type: 'number', description: 'Milliseconds, default 300.' }
      },
      async (args) => {
        const from = pointArg(args['from'], 'from', 'dp')
        const to = pointArg(args['to'], 'to', 'dp')
        const ms =
          typeof args['duration'] === 'number'
            ? Math.min(5000, Math.max(50, args['duration']))
            : 300
        await manager.swipe(id, from, to, ms)
        return textResult(`Swiped from (${from.x}, ${from.y}) to (${to.x}, ${to.y}) dp.`)
      },
      ['from', 'to']
    ),
    tool(
      'android_type',
      'Type text into the focused field (tap it first). ASCII characters only (Android input limitation).',
      { text: { type: 'string' } },
      async (args) => {
        if (typeof args['text'] !== 'string') return textResult('`text` is required.', true)
        await manager.type(id, args['text'])
        return textResult('Text typed.')
      },
      ['text']
    ),
    tool(
      'android_key',
      `Press a key: ${Object.keys(KEYS).join(', ')}, or any KEYCODE_*.`,
      { key: { type: 'string' } },
      async (args) => {
        if (typeof args['key'] !== 'string') return textResult('`key` is required.', true)
        await manager.key(id, args['key'])
        return textResult(`Key ${args['key']} pressed.`)
      },
      ['key']
    ),
    tool(
      'android_open_url',
      'Open a URL or deep link (myapp://…) on the Android device.',
      { url: { type: 'string' } },
      async (args) => {
        if (typeof args['url'] !== 'string' || !args['url'])
          return textResult('`url` is required.', true)
        const device = await manager.readyDevice(id)
        await manager.adb.openUrl(device.serial, args['url'])
        manager.changed(id)
        return textResult(`Opened ${args['url']}.`)
      },
      ['url']
    ),
    tool(
      'android_logcat',
      'Recent Android log lines (crashes, exceptions), optionally only for one app package and from a minimum level (V, D, I, W, E).',
      {
        package: { type: 'string' },
        level: { type: 'string', enum: LOG_LEVELS },
        lines: { type: 'number' }
      },
      async (args) => {
        const device = await manager.readyDevice(id)
        const level =
          typeof args['level'] === 'string' && LOG_LEVELS.includes(args['level'])
            ? args['level']
            : 'W'
        const lines =
          typeof args['lines'] === 'number' ? Math.min(1000, Math.max(10, args['lines'])) : 200
        const pid =
          typeof args['package'] === 'string'
            ? await manager.adb.pidOf(device.serial, args['package'])
            : undefined
        if (typeof args['package'] === 'string' && !pid) {
          return textResult(
            `${args['package']} is not running (crashed or not launched). Showing nothing; call without package for all logs.`
          )
        }
        const log = await manager.adb.logcat(device.serial, {
          lines,
          level,
          ...(pid ? { pid } : {})
        })
        return textResult(log.trim() || '(no log line)')
      }
    )
  ]
  const codec = options.imageCodec
  if (codec) {
    tools.push(
      deviceFilmstripTool({
        name: 'android_filmstrip',
        description:
          'Film the Android screen while running gestures, then get ONE contact-sheet image: frames taken each time the screen changes, numbered in reading order, with their times. Use it to see what happens DURING a gesture or a transition (scroll, pull to refresh, navigation, keyboard appearing, animation glitches), which separate screenshots cannot show. `actions`: items { "tool": "android_tap" | "android_swipe" | "android_type" | "android_key" | "android_open_url", "args": { … } }, run in order while filming; omit them to just watch (loading, animation).',
        panel: 'android',
        filmable: FILMABLE,
        tools,
        clickTool: 'android_tap',
        noFrame: 'Contact sheet: no frame came from the Android screen.',
        codec,
        film: (run, durationMs) => manager.film(id, run, durationMs),
        screen: () => manager.screen(id)
      })
    )
  }
  return tools
}
