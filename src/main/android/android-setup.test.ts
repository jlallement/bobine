import { describe, expect, it, vi } from 'vitest'
import type { SendEvent } from '../ipc'
import { simulatorController } from '../simulator/simulator-setup'
import { androidController } from './android-setup'

describe('demandes des onglets d’appareil (fiche 089)', () => {
  it('Android sans SDK : état vide, pas de capture, actions refusées', async () => {
    const send = vi.fn() as unknown as SendEvent
    const controller = androidController(undefined, send)
    expect(await controller.state('c1')).toEqual({
      conversationId: 'c1',
      device: null,
      screen: null,
      sdk: false
    })
    expect(await controller.screenshot('c1')).toBeNull()
    await expect(controller.tap('c1', { x: 1, y: 1 })).rejects.toThrow('SDK Android introuvable')
    expect(await controller.startStream('c1')).toBe(false)
    expect(() => controller.stopStream()).not.toThrow()
  })

  it('Android : capture d’un appareil branché seulement, images relayées aux fenêtres', async () => {
    const send = vi.fn()
    const manager = {
      state: vi.fn(),
      device: vi.fn(async () => ({ state: 'offline' })),
      screenshot: vi.fn(async () => ({ data: 'x', width: 1, height: 1 })),
      tap: vi.fn(async () => {}),
      swipe: vi.fn(async () => {}),
      key: vi.fn(async () => {}),
      startStream: vi.fn(
        async (
          _id: string,
          onFrame: (frame: { data: string; key: boolean }) => void,
          onEnd: (reason: string) => void
        ) => {
          onFrame({ data: 'image', key: true })
          onEnd('fini')
          return true
        }
      ),
      stopStream: vi.fn()
    }
    const controller = androidController(
      manager as unknown as Parameters<typeof androidController>[0],
      send as unknown as SendEvent
    )
    expect(await controller.screenshot('c1')).toBeNull()
    manager.device.mockResolvedValueOnce({ state: 'device' })
    expect(await controller.screenshot('c1')).toEqual({ data: 'x', width: 1, height: 1 })
    expect(await controller.startStream('c1')).toBe(true)
    expect(send).toHaveBeenCalledWith('android:frame', {
      conversationId: 'c1',
      data: 'image',
      key: true
    })
    expect(send).toHaveBeenCalledWith('android:streamEnded', {
      conversationId: 'c1',
      reason: 'fini'
    })
  })

  it('simulateur : capture d’un appareil démarré seulement', async () => {
    const manager = {
      state: vi.fn(),
      device: vi.fn(async () => ({ state: 'Shutdown' })),
      screenshot: vi.fn(async () => ({ data: 'x', width: 1, height: 1 })),
      tap: vi.fn(),
      swipe: vi.fn(),
      button: vi.fn(),
      startStream: vi.fn(),
      stopStream: vi.fn()
    }
    const controller = simulatorController(
      manager as unknown as Parameters<typeof simulatorController>[0],
      vi.fn() as unknown as SendEvent
    )
    expect(await controller.screenshot('c1')).toBeNull()
    manager.device.mockRejectedValueOnce(new Error('simctl'))
    expect(await controller.screenshot('c1')).toBeNull()
    manager.device.mockResolvedValueOnce({ state: 'Booted' })
    expect(await controller.screenshot('c1')).toEqual({ data: 'x', width: 1, height: 1 })
  })
})
