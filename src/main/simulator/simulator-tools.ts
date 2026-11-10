/**
 * Outils « simulateur iOS » (fiche 008) : l'agent compile l'app, l'installe et la lance, prend des
 * captures, lit l'écran, touche, glisse et tape ; l'utilisateur suit dans l'onglet « Simulateur ».
 */
import { basename } from 'node:path'
import type { AppTool, AppToolModule, ToolContext, ToolResult } from '../mcp/tools'
import { panelToolFactory, pointArg, textResult } from '../mcp/tools'
import type { CommandMemory } from '../approvals'
import { approveCommand } from '../mcp/command-approval'
import type { HardwareButton } from './axe'
import type { Run } from './run'
import type { SimulatorManager } from './simulator-manager'
import { deviceFilmstripTool } from '../filmstrip/device-tool'
import type { ImageCodec } from '../filmstrip/sheet'
import {
  buildCommand,
  buildErrors,
  findXcodeProjects,
  hasAppleProject,
  type BuildJob,
  type XcodeBuilds,
  type XcodeProject
} from './xcode'
import { t } from 'i18next'
import { delay } from '../delay'

/** Attente maximale dans un appel d'outil (Bob abandonne au bout d'environ 60 s). */
export const SIM_TOOL_BUDGET_MS = 40_000
const DESCRIBE_MAX_CHARS = 20_000
const BUTTONS: HardwareButton[] = ['home', 'lock', 'siri', 'side-button', 'apple-pay']
/** Planche contact (fiche 075) : gestes filmables. */
const FILMABLE = ['ios_tap', 'ios_swipe', 'ios_type', 'ios_button', 'ios_open_url']

export interface SimulatorToolsOptions {
  /** Compilations « toujours » lancées dans un dossier (fiche 072). */
  always?: CommandMemory
  manager: SimulatorManager
  builds: XcodeBuilds
  run: Run
  budgetMs?: number
  /** Images de la planche contact (fiche 075) ; sans lui, pas de `ios_filmstrip`. */
  imageCodec?: ImageCodec
}

export function simulatorToolsModule(options: SimulatorToolsOptions): AppToolModule {
  const approved = new Set<string>()
  return {
    id: 'ios-simulator',
    about: {
      title: 'appToolFamilies.ios-simulator.title',
      summary: 'appToolFamilies.ios-simulator.summary',
      condition: 'appToolFamilies.ios-simulator.condition',
      // `ios_build` : la première compilation de cette commande dans ce dossier.
      approval: 'appToolFamilies.ios-simulator.approval'
    },
    // Chaque outil coûte du contexte : proposés seulement pour un projet Apple.
    enabled: (context) => hasAppleProject(context.workspace),
    tools: (context) => createTools(context, options, approved)
  }
}

function createTools(
  context: ToolContext,
  options: SimulatorToolsOptions,
  approved: Set<string>
): AppTool[] {
  const { manager, builds, run } = options
  const id = context.conversationId
  const budget = options.budgetMs ?? SIM_TOOL_BUDGET_MS
  // Attente bornée ; l'agent qui raccroche (fiche 195) l'arrête aussi, la compilation continue.
  const wait = <T>(promise: Promise<T>, signal?: AbortSignal) =>
    Promise.race([
      promise.then(() => true),
      delay(budget, { unref: true }).then(() => false),
      new Promise<boolean>((resolve) => {
        if (signal?.aborted) resolve(false)
        signal?.addEventListener('abort', () => resolve(false), { once: true })
      })
    ])

  // Autorisés sans demander : ils n'agissent que sur le simulateur ; `ios_build` montre lui-même
  // sa commande avant de la lancer.
  const tool = panelToolFactory('simulator')

  /** L'utilisateur voit la commande de compilation la première fois. */
  const approveBuild = (command: string[]): Promise<ToolResult | undefined> => {
    const shown = command.filter((a) => !a.startsWith('platform=')).join(' ')
    return approveCommand(context, {
      workspace: context.workspace,
      command: shown,
      question: t('approvals.ios.question', {
        folder: basename(context.workspace),
        command: command.slice(0, 6).join(' ')
      }),
      header: t('approvals.ios.header'),
      allow: t('approvals.ios.allow'),
      allowDescription: t('approvals.ios.allowDescription'),
      session: approved,
      key: `${context.workspace}\u0000${shown}`,
      ...(options.always ? { always: options.always } : {}),
      texts: {
        retry: 'J’ai autorisé la compilation : relance ios_build.',
        refusedByUser: 'Je ne veux pas lancer la compilation.',
        pending:
          'The user has not approved the build yet. End your turn now; their decision will arrive as their next message.',
        refused: 'The user refused the build. Do not try again.'
      }
    })
  }

  const schemesOf = async (project: XcodeProject): Promise<string[]> => {
    const result = await run(
      'xcodebuild',
      ['-list', '-json', project.kind === 'workspace' ? '-workspace' : '-project', project.path],
      { timeoutMs: 60_000, cwd: context.workspace }
    )
    if (result.code !== 0)
      throw new Error(`xcodebuild -list : ${result.stderr.trim().split('\n')[0]}`)
    const data = JSON.parse(result.stdout.toString('utf8')) as {
      project?: { schemes?: string[] }
      workspace?: { schemes?: string[] }
    }
    return data.workspace?.schemes ?? data.project?.schemes ?? []
  }

  const bundleIdOf = async (appPath: string): Promise<string> => {
    const result = await run('plutil', [
      '-extract',
      'CFBundleIdentifier',
      'raw',
      '-o',
      '-',
      `${appPath}/Info.plist`
    ])
    const bundleId = result.stdout.toString('utf8').trim()
    if (result.code !== 0 || !bundleId)
      throw new Error(`Identifiant de bundle introuvable : ${appPath}`)
    return bundleId
  }

  const buildReport = async (job: BuildJob): Promise<ToolResult> => {
    const seconds = Math.round(((job.finishedAt ?? Date.now()) - job.startedAt) / 1000)
    if (job.status === 'running') {
      return textResult(
        `Build still running (${seconds} s). Call ios_build again to keep waiting.\nLast output:\n${job.lines.slice(-8).join('\n')}`
      )
    }
    if (job.status === 'failed') {
      const errors = buildErrors(job.lines)
      return textResult(
        `Build failed after ${seconds} s.\n${(errors.length ? errors : job.lines.slice(-20)).join('\n')}`,
        true
      )
    }
    const bundleId = job.appPath ? await bundleIdOf(job.appPath).catch(() => undefined) : undefined
    return textResult(
      `Build succeeded in ${seconds} s: ${job.appPath}${bundleId ? ` (${bundleId})` : ''}.\nCall ios_launch with app_path to install and run it.`
    )
  }

  const tools: AppTool[] = [
    tool(
      'ios_devices',
      'List the iOS simulators (booted first) and the one used by this conversation.',
      {},
      async () => {
        const devices = await manager.simctl.devices()
        const current = await manager.device(id)
        const lines = devices
          .slice(0, 40)
          .map(
            (d) =>
              `${d.udid === current?.udid ? '*' : ' '} ${d.name} — ${d.runtime} — ${d.state} — ${d.udid}`
          )
        return textResult(
          lines.length
            ? lines.join('\n')
            : 'No simulator available (install an iOS runtime in Xcode).'
        )
      }
    ),
    tool(
      'ios_boot',
      `Boot a simulator (name or UDID from ios_devices) and use it for this conversation. Waits up to ${Math.round(budget / 1000)} s; call again if still booting.`,
      { device: { type: 'string' } },
      async (args) => {
        const wanted = typeof args['device'] === 'string' ? args['device'] : ''
        const devices = await manager.simctl.devices()
        const device =
          devices.find((d) => d.udid === wanted) ??
          devices.find((d) => d.name.toLowerCase() === wanted.toLowerCase()) ??
          (!wanted ? devices.find((d) => d.state === 'Booted') : undefined)
        if (!device) return textResult(`Unknown simulator "${wanted}" (see ios_devices).`, true)
        manager.select(id, device.udid)
        if (device.state !== 'Booted') await manager.simctl.boot(device.udid)
        const ready = await manager.simctl.waitBooted(device.udid, budget)
        manager.changed(id)
        return textResult(
          ready
            ? `"${device.name}" (${device.runtime}) is booted and used for this conversation.`
            : `"${device.name}" is still booting. Call ios_boot again to keep waiting.`
        )
      },
      ['device']
    ),
    tool(
      'ios_build',
      `Build the iOS app of this project for the conversation's simulator with xcodebuild (in the background; waits up to ${Math.round(budget / 1000)} s, call again while it runs). Returns compiler errors, or the .app to pass to ios_launch.`,
      {
        scheme: { type: 'string' },
        project: {
          type: 'string',
          description: 'Path of the .xcodeproj / .xcworkspace if several.'
        },
        configuration: { type: 'string', description: 'Default: Debug.' }
      },
      async (args, signal) => {
        const projects = findXcodeProjects(context.workspace)
        const project =
          typeof args['project'] === 'string'
            ? projects.find((p) => p.path.endsWith(String(args['project'])))
            : projects[0]
        if (!project) {
          return textResult(
            projects.length
              ? `Unknown project. Available: ${projects.map((p) => p.path).join(', ')}`
              : 'No Xcode project (.xcodeproj / .xcworkspace) in this folder.',
            true
          )
        }
        let scheme = typeof args['scheme'] === 'string' ? args['scheme'] : undefined
        if (!scheme) {
          const schemes = await schemesOf(project)
          if (schemes.length !== 1) {
            return textResult(
              schemes.length
                ? `Choose a scheme: ${schemes.join(', ')}`
                : 'No scheme in this project.',
              true
            )
          }
          scheme = schemes[0] as string
        }
        const running = builds.get(context.workspace, scheme)
        if (running?.status === 'running') {
          await wait(running.done, signal)
          return buildReport(running)
        }
        const device = await manager.bootedDevice(id)
        const request = {
          workspace: context.workspace,
          project,
          scheme,
          configuration:
            typeof args['configuration'] === 'string' ? args['configuration'] : 'Debug',
          udid: device.udid
        }
        const refused = await approveBuild(
          buildCommand(request, builds.derivedData(context.workspace))
        )
        if (refused) return refused
        const job = builds.start(request)
        await wait(job.done, signal)
        return buildReport(job)
      }
    ),
    tool(
      'ios_launch',
      'Install (app_path from ios_build) and launch an app on the simulator, or relaunch an installed one by bundle_id.',
      { app_path: { type: 'string' }, bundle_id: { type: 'string' } },
      async (args) => {
        const device = await manager.bootedDevice(id)
        const appPath = typeof args['app_path'] === 'string' ? args['app_path'] : undefined
        if (appPath) await manager.simctl.install(device.udid, appPath)
        const bundleId =
          typeof args['bundle_id'] === 'string'
            ? args['bundle_id']
            : appPath
              ? await bundleIdOf(appPath)
              : undefined
        if (!bundleId) return textResult('`app_path` or `bundle_id` is required.', true)
        const pid = await manager.simctl.launch(device.udid, bundleId)
        manager.changed(id)
        const screen = await manager.screen(id)
        return textResult(
          `${bundleId} launched on "${device.name}"${pid ? ` (pid ${pid})` : ''}.${screen ? ` Screen: ${screen.width}×${screen.height} points (tap coordinates).` : ''} Use ios_screenshot / ios_describe to check it.`
        )
      }
    ),
    tool(
      'ios_screenshot',
      'Screenshot of the simulator screen. Image pixels are points: the same coordinates as ios_tap (unless scaled).',
      { scale: { type: 'number', description: 'Optional 0.1–1 downscale to save context.' } },
      async (args) => {
        const scale =
          typeof args['scale'] === 'number' ? Math.min(1, Math.max(0.1, args['scale'])) : 1
        const shot = await manager.screenshot(id, scale)
        return [
          {
            type: 'text',
            text: `Simulator screenshot ${shot.width}×${shot.height}${scale === 1 ? ' (points = tap coordinates)' : `, scaled ×${scale}: divide by ${scale} for tap coordinates`}.`
          },
          { type: 'image', data: shot.data, mimeType: shot.mimeType }
        ]
      }
    ),
    tool(
      'ios_describe',
      'Read the simulator screen through iOS accessibility: one element per line with a ref_N to tap. Cheaper and more precise than a screenshot to find buttons and read text.',
      { max_chars: { type: 'number' } },
      async (args) => {
        const max =
          typeof args['max_chars'] === 'number'
            ? Math.min(100_000, Math.max(1000, args['max_chars']))
            : DESCRIBE_MAX_CHARS
        const screen = await manager.describe(id, max)
        const header = screen.screen
          ? `Screen ${screen.screen.width}×${screen.screen.height} points.\n`
          : ''
        return textResult(
          `${header}${screen.lines.join('\n') || '(no element)'}${screen.truncated ? '\n[… truncated]' : ''}`
        )
      }
    ),
    tool(
      'ios_tap',
      'Tap the simulator screen: an element ref from ios_describe, its accessibility label, or x/y in points. duration > 0.5 = long press.',
      {
        ref: { type: 'string' },
        label: { type: 'string' },
        x: { type: 'number' },
        y: { type: 'number' },
        duration: { type: 'number', description: 'Seconds held (long press).' }
      },
      async (args) => {
        const hold =
          typeof args['duration'] === 'number'
            ? Math.min(10, Math.max(0, args['duration']))
            : undefined
        if (typeof args['label'] === 'string' && hold === undefined) {
          await manager.tapLabel(id, args['label'])
          return textResult(`Tapped "${args['label']}".`)
        }
        const point =
          typeof args['ref'] === 'string'
            ? manager.pointOf(id, args['ref'])
            : pointArg([args['x'], args['y']], 'x/y', 'points')
        await manager.tap(id, point, hold)
        return textResult(`Tapped (${point.x}, ${point.y})${hold ? ` for ${hold} s` : ''}.`)
      }
    ),
    tool(
      'ios_swipe',
      'Swipe (scroll, drag) on the simulator from one point to another, in points. Start more than a few points away from the screen edges unless you want a system gesture.',
      {
        from: { type: 'array', items: { type: 'number' } },
        to: { type: 'array', items: { type: 'number' } },
        duration: { type: 'number' }
      },
      async (args) => {
        const from = pointArg(args['from'], 'from', 'points')
        const to = pointArg(args['to'], 'to', 'points')
        const duration =
          typeof args['duration'] === 'number' ? Math.min(5, Math.max(0.05, args['duration'])) : 0.3
        await manager.swipe(id, from, to, duration)
        return textResult(`Swiped from (${from.x}, ${from.y}) to (${to.x}, ${to.y}).`)
      },
      ['from', 'to']
    ),
    tool(
      'ios_type',
      'Enter text into the focused field of the simulator (tap the field first). By default the exact text is pasted (accents allowed, no autocorrection). keystrokes: true types key by key instead (US keyboard characters only, iOS autocorrection applies).',
      { text: { type: 'string' }, keystrokes: { type: 'boolean' } },
      async (args) => {
        if (typeof args['text'] !== 'string') return textResult('`text` is required.', true)
        await manager.type(id, args['text'], args['keystrokes'] === true)
        return textResult('Text entered.')
      },
      ['text']
    ),
    tool(
      'ios_button',
      'Press a hardware button: home, lock, siri, side-button, apple-pay.',
      { button: { type: 'string', enum: BUTTONS } },
      async (args) => {
        const button = BUTTONS.find((b) => b === args['button'])
        if (!button) return textResult(`\`button\` : ${BUTTONS.join(', ')}`, true)
        await manager.button(id, button)
        return textResult(`Button ${button} pressed.`)
      },
      ['button']
    ),
    tool(
      'ios_open_url',
      'Open a URL or deep link (myapp://…) on the simulator.',
      { url: { type: 'string' } },
      async (args) => {
        if (typeof args['url'] !== 'string' || !args['url'])
          return textResult('`url` is required.', true)
        const device = await manager.bootedDevice(id)
        await manager.simctl.openUrl(device.udid, args['url'])
        manager.changed(id)
        return textResult(`Opened ${args['url']}.`)
      },
      ['url']
    )
  ]
  const codec = options.imageCodec
  if (codec) {
    tools.push(
      deviceFilmstripTool({
        name: 'ios_filmstrip',
        description:
          'Film the simulator screen while running gestures, then get ONE contact-sheet image: frames from the live video stream, numbered in reading order, with their times. Use it to see what happens DURING a gesture or a transition (scroll, pull to refresh, navigation push, keyboard appearing, animation glitches), which separate screenshots cannot show. `actions`: items { "tool": "ios_tap" | "ios_swipe" | "ios_type" | "ios_button" | "ios_open_url", "args": { … } }, run in order while filming; omit them to just watch (loading, animation). Needs AXe.',
        panel: 'simulator',
        filmable: FILMABLE,
        tools,
        clickTool: 'ios_tap',
        noFrame: 'Contact sheet: no frame came from the simulator stream.',
        codec,
        film: (run, durationMs) => manager.film(id, run, durationMs),
        screen: () => manager.screen(id)
      })
    )
  }
  return tools
}
