/**
 * Le simulateur iOS dans l'app (fiche 089, sorti de `index.ts`) : son gestionnaire, ses outils pour
 * l'agent, et ce que l'interface lui demande par IPC.
 */
import type { CommandMemory } from '../approvals'
import type { ImageCodec } from '../filmstrip/sheet'
import type { SendEvent, SimulatorController } from '../ipc'
import type { AppToolModule } from '../mcp/tools'
import { runCommand } from './run'
import { SimulatorManager, type EncodeBgra, type ResizeJpeg } from './simulator-manager'
import { simulatorToolsModule } from './simulator-tools'
import { XcodeBuilds } from './xcode'

export interface SimulatorSetupOptions {
  /** Chemin d'AXe, `undefined` s'il n'est pas installé (pas de touchers). */
  axeBinary: string | undefined
  /** Marche à suivre quand AXe manque (en développement). */
  axeInstallHint?: string | undefined
  xcrun: string
  /** Dossier des compilations Xcode gardées d'un lancement à l'autre. */
  cacheDir: string
  resize: ResizeJpeg
  encodeBgra: EncodeBgra
  /** Commandes « toujours autorisées » (fiche 072). */
  always: CommandMemory
  imageCodec: ImageCodec
  send: SendEvent
}

export interface SimulatorSetup {
  manager: SimulatorManager
  tools: AppToolModule
  controller: SimulatorController
}

export function setupSimulator(options: SimulatorSetupOptions): SimulatorSetup {
  const manager = new SimulatorManager({
    run: runCommand,
    axeBinary: options.axeBinary,
    ...(options.axeInstallHint ? { axeInstallHint: options.axeInstallHint } : {}),
    xcrun: options.xcrun,
    resize: options.resize,
    encodeBgra: options.encodeBgra,
    emitState: (state) => options.send('simulator:state', state)
  })
  return {
    manager,
    tools: simulatorToolsModule({
      manager,
      builds: new XcodeBuilds(options.cacheDir),
      run: runCommand,
      always: options.always,
      imageCodec: options.imageCodec
    }),
    controller: simulatorController(manager, options.send)
  }
}

/** Demandes de l'onglet Simulateur : capture seulement d'un appareil démarré, flux relayé. */
export function simulatorController(
  manager: Pick<
    SimulatorManager,
    'state' | 'device' | 'screenshot' | 'tap' | 'swipe' | 'button' | 'startStream' | 'stopStream'
  >,
  send: SendEvent
): SimulatorController {
  return {
    state: (id) => manager.state(id),
    screenshot: async (id) => {
      const device = await manager.device(id).catch(() => null)
      if (device?.state !== 'Booted') return null
      return manager.screenshot(id)
    },
    tap: (id, point) => manager.tap(id, point),
    swipe: (id, from, to, duration) => manager.swipe(id, from, to, duration),
    button: (id, button) => manager.button(id, button),
    startStream: (id) =>
      manager.startStream(
        id,
        (jpeg) => send('simulator:frame', { conversationId: id, data: jpeg }),
        (reason) => send('simulator:streamEnded', { conversationId: id, reason })
      ),
    stopStream: () => manager.stopStream()
  }
}
