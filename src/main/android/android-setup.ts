/**
 * L'émulateur Android dans l'app (fiche 089, sorti de `index.ts`) : son gestionnaire et ses outils
 * pour l'agent quand le SDK est sur la machine, et ce que l'interface lui demande par IPC (avec ou
 * sans SDK).
 */
import { t } from 'i18next'
import type { CommandMemory } from '../approvals'
import type { ImageCodec } from '../filmstrip/sheet'
import type { AndroidController, SendEvent } from '../ipc'
import type { AppToolModule } from '../mcp/tools'
import type { EncodeBgra, ResizeJpeg } from '../simulator/simulator-manager'
import { runCommand } from '../simulator/run'
import { AndroidManager } from './android-manager'
import { androidToolsModule } from './android-tools'
import { GradleBuilds } from './gradle'
import type { AndroidSdk } from './sdk'

export interface AndroidSetupOptions {
  /** SDK de la machine ; absent : pas d'émulateur, l'onglet le dit. */
  sdk: AndroidSdk | undefined
  resize: ResizeJpeg
  encodeBgra: EncodeBgra
  /** Commandes « toujours autorisées » (fiche 072). */
  always: CommandMemory
  imageCodec: ImageCodec
  send: SendEvent
}

export interface AndroidSetup {
  manager?: AndroidManager
  tools?: AppToolModule
  controller: AndroidController
}

export function setupAndroid(options: AndroidSetupOptions): AndroidSetup {
  const { sdk } = options
  if (!sdk) return { controller: androidController(undefined, options.send) }
  const manager = new AndroidManager({
    run: runCommand,
    adb: sdk.adb,
    emulator: sdk.emulator,
    resize: options.resize,
    encodeBgra: options.encodeBgra,
    emitState: (state) => options.send('android:state', state)
  })
  return {
    manager,
    tools: androidToolsModule({
      manager,
      builds: new GradleBuilds(sdk),
      sdk,
      run: runCommand,
      always: options.always,
      imageCodec: options.imageCodec
    }),
    controller: androidController(manager, options.send)
  }
}

/** Demandes de l'onglet Android ; sans SDK, un état vide et des actions refusées. */
export function androidController(
  manager:
    | Pick<
        AndroidManager,
        'state' | 'device' | 'screenshot' | 'tap' | 'swipe' | 'key' | 'startStream' | 'stopStream'
      >
    | undefined,
  send: SendEvent
): AndroidController {
  const required = () => {
    if (!manager) throw new Error(t('android.sdkMissing'))
    return manager
  }
  return {
    state: async (id) =>
      manager ? manager.state(id) : { conversationId: id, device: null, screen: null, sdk: false },
    screenshot: async (id) => {
      const device = await manager?.device(id).catch(() => null)
      return manager && device?.state === 'device' ? manager.screenshot(id) : null
    },
    tap: async (id, point, holdMs) => {
      await required().tap(id, point, holdMs)
    },
    swipe: async (id, from, to, ms) => {
      await required().swipe(id, from, to, ms)
    },
    key: async (id, key) => {
      await required().key(id, key)
    },
    startStream: async (id) =>
      manager
        ? manager.startStream(
            id,
            (frame) =>
              send('android:frame', {
                conversationId: id,
                data: frame.data,
                key: frame.key,
                ...(frame.codec ? { codec: frame.codec } : {})
              }),
            (reason) => send('android:streamEnded', { conversationId: id, reason })
          )
        : false,
    stopStream: () => manager?.stopStream()
  }
}
