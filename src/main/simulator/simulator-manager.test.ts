/**
 * Flux vidéo du simulateur (fiches 009, 044) avec un faux `axe` : remplaçant de la vérification
 * `unitaire-main` de la suite e2e `simulator` (inventaire B, #14) — flux interrompu, l'onglet
 * reçoit la raison et repasse aux captures successives. Le faux `axe` est un vrai processus (un
 * script shell) : la mort du flux est celle d'un enfant réel, pas un évènement simulé.
 */
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Run } from './run'
import { SimulatorManager } from './simulator-manager'

const dirs: string[] = []
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

/**
 * Faux `axe stream-video` : en-tête HTTP, une image MJPEG, puis il meurt en le disant sur sa
 * sortie d'erreur (comme AXe quand l'appareil s'arrête).
 */
function fakeAxe(): string {
  const dir = mkdtempSync(join(tmpdir(), 'axe-'))
  dirs.push(dir)
  const path = join(dir, 'axe')
  writeFileSync(
    path,
    [
      '#!/bin/sh',
      "printf 'HTTP/1.1 200 OK\\r\\nContent-Type: multipart/x-mixed-replace\\r\\n\\r\\n'",
      "printf -- '--frame\\r\\nContent-Type: image/jpeg\\r\\nContent-Length: 4\\r\\n\\r\\njpeg'",
      'sleep 0.2',
      "echo 'Simulator device disconnected' >&2",
      'exit 1',
      ''
    ].join('\n')
  )
  chmodSync(path, 0o755)
  return path
}

/** `xcrun simctl list` : un iPhone démarré ; `axe --version` : une version suffisante. */
const run: Run = async (file, args) => {
  const ok = (stdout: string) => ({ code: 0, stdout: Buffer.from(stdout), stderr: '' })
  if (file === 'xcrun' && args[1] === 'list') {
    return ok(
      JSON.stringify({
        devices: {
          'com.apple.CoreSimulator.SimRuntime.iOS-26-5': [
            { udid: 'U1', name: 'iPhone 17', state: 'Booted' }
          ]
        }
      })
    )
  }
  if (file.endsWith('axe') && args[0] === '--version') return ok('1.8.0\n')
  return ok('')
}

describe.skipIf(process.platform === 'win32')('flux vidéo du simulateur (fiche 009)', () => {
  it('flux interrompu : les images reçues, puis la fin avec la raison d’AXe ; relançable', async () => {
    const manager = new SimulatorManager({
      run,
      axeBinary: fakeAxe(),
      resize: (_jpeg, width, height) => ({
        data: '',
        width,
        height,
        sourceWidth: width,
        sourceHeight: height
      }),
      emitState: () => {}
    })
    const frames: string[] = []
    const ended = vi.fn()
    const done = new Promise<string>((resolve) =>
      ended.mockImplementation((reason: string) => resolve(reason))
    )
    // Sans encodeur BGRA : le flux part en MJPEG, comme sans taille d'écran connue.
    const started = await manager.startStream('c1', (jpeg) => frames.push(jpeg.toString()), ended)
    expect(started).toBe(true)
    expect(await done).toBe('Simulator device disconnected')
    expect(frames).toEqual(['jpeg'])
    expect(ended).toHaveBeenCalledTimes(1)

    // Le flux tombé n'est plus tenu : une nouvelle demande en relance un.
    const again = vi.fn()
    const second = new Promise<void>((resolve) => again.mockImplementation(() => resolve()))
    expect(await manager.startStream('c1', () => {}, again)).toBe(true)
    await second
    manager.stopStream(true)
  })

  it('sans AXe : pas de flux, l’onglet garde les captures successives', async () => {
    const manager = new SimulatorManager({
      run,
      axeBinary: undefined,
      resize: () => ({ data: '', width: 1, height: 1, sourceWidth: 1, sourceHeight: 1 }),
      emitState: () => {}
    })
    expect(
      await manager.startStream(
        'c1',
        () => {},
        () => {}
      )
    ).toBe(false)
  })
})
