/**
 * Canaux IPC des appareils du panneau : simulateur iOS (fiches 008, 009, 044) et émulateur Android
 * (fiche 081). Le renderer désigne une conversation et des coordonnées, vérifiées ici. Sortis
 * d'`ipc.ts` pour tenir son plafond de lignes (fiche 089).
 */
import type { AndroidState } from '@shared/android'
import type { IpcHandlers } from '@shared/ipc'
import type { SimulatorState } from '@shared/simulator'

/** Touches que l'onglet Android peut envoyer : barre du haut et boutons de la tranche (fiche 081). */
const ANDROID_PANEL_KEYS = ['back', 'home', 'recents', 'power', 'volume_up', 'volume_down'] as const
type AndroidPanelKey = (typeof ANDROID_PANEL_KEYS)[number]

/** Ce que l'IPC demande à l'émulateur Android. */
export interface AndroidController {
  state: (conversationId: string) => Promise<AndroidState>
  screenshot: (
    conversationId: string
  ) => Promise<{ data: string; width: number; height: number } | null>
  tap: (conversationId: string, point: { x: number; y: number }, holdMs?: number) => Promise<void>
  swipe: (
    conversationId: string,
    from: { x: number; y: number },
    to: { x: number; y: number },
    ms: number
  ) => Promise<void>
  key: (conversationId: string, key: AndroidPanelKey) => Promise<void>
  startStream: (conversationId: string) => Promise<boolean>
  stopStream: () => void
}

/** Ce que l'IPC demande au simulateur iOS. */
export interface SimulatorController {
  state: (conversationId: string) => Promise<SimulatorState>
  screenshot: (
    conversationId: string
  ) => Promise<{ data: string; width: number; height: number } | null>
  tap: (conversationId: string, point: { x: number; y: number }) => Promise<void>
  swipe: (
    conversationId: string,
    from: { x: number; y: number },
    to: { x: number; y: number },
    durationSeconds: number
  ) => Promise<void>
  button: (conversationId: string, button: 'home' | 'lock') => Promise<void>
  startStream: (conversationId: string) => Promise<boolean>
  stopStream: () => void
}

type DeviceChannel = Extract<keyof IpcHandlers, `simulator:${string}` | `android:${string}`>

const str = (value: unknown, name: string): string => {
  if (typeof value !== 'string' || !value) throw new Error(`Paramètre invalide : ${name}`)
  return value
}

export function deviceHandlers(
  simulator: SimulatorController,
  android: AndroidController
): Pick<IpcHandlers, DeviceChannel> {
  return {
    'simulator:getState': (id) => simulator.state(str(id, 'id')),
    'simulator:screenshot': (id) => simulator.screenshot(str(id, 'id')),
    'simulator:tap': async (id, x, y) => {
      if (![x, y].every((n) => typeof n === 'number' && Number.isFinite(n))) {
        throw new Error('Paramètre invalide : point')
      }
      await simulator.tap(str(id, 'id'), { x: Math.round(x), y: Math.round(y) })
      return undefined
    },
    'simulator:swipe': async (id, fromX, fromY, toX, toY, duration) => {
      if (![fromX, fromY, toX, toY, duration].every((n) => typeof n === 'number' && isFinite(n))) {
        throw new Error('Paramètre invalide : balayage')
      }
      await simulator.swipe(
        str(id, 'id'),
        { x: Math.round(fromX), y: Math.round(fromY) },
        { x: Math.round(toX), y: Math.round(toY) },
        Math.min(3, Math.max(0.05, duration))
      )
      return undefined
    },
    'android:getState': (id) => android.state(str(id, 'id')),
    'android:screenshot': (id) => android.screenshot(str(id, 'id')),
    'android:tap': async (id, x, y, holdMs) => {
      if (![x, y].every((n) => typeof n === 'number' && Number.isFinite(n))) {
        throw new Error('Paramètre invalide : point')
      }
      if (holdMs !== undefined && (typeof holdMs !== 'number' || !Number.isFinite(holdMs))) {
        throw new Error('Paramètre invalide : holdMs')
      }
      await android.tap(
        str(id, 'id'),
        { x: Math.round(x), y: Math.round(y) },
        holdMs === undefined ? undefined : Math.round(Math.min(5000, Math.max(100, holdMs)))
      )
      return undefined
    },
    'android:swipe': async (id, fromX, fromY, toX, toY, ms) => {
      if (![fromX, fromY, toX, toY, ms].every((n) => typeof n === 'number' && isFinite(n))) {
        throw new Error('Paramètre invalide : balayage')
      }
      await android.swipe(
        str(id, 'id'),
        { x: Math.round(fromX), y: Math.round(fromY) },
        { x: Math.round(toX), y: Math.round(toY) },
        Math.round(Math.min(3000, Math.max(50, ms)))
      )
      return undefined
    },
    'android:key': async (id, key) => {
      const known = ANDROID_PANEL_KEYS.find((k) => k === key)
      if (!known) throw new Error('Paramètre invalide : key')
      await android.key(str(id, 'id'), known)
      return undefined
    },
    'android:startStream': (id) => android.startStream(str(id, 'id')),
    'android:stopStream': async () => {
      android.stopStream()
      return undefined
    },
    'simulator:startStream': (id) => simulator.startStream(str(id, 'id')),
    'simulator:stopStream': async () => {
      simulator.stopStream()
      return undefined
    },
    'simulator:button': async (id, button) => {
      if (button !== 'home' && button !== 'lock') throw new Error('Paramètre invalide : button')
      await simulator.button(str(id, 'id'), button)
      return undefined
    }
  }
}
