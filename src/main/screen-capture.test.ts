import { describe, expect, it } from 'vitest'
import { MAX_IMAGE_BYTES } from '@shared/attachments'
import type { Run } from './simulator/run'
import {
  captureName,
  captureScreen,
  encodeCapture,
  screenAccessOf,
  type CaptureImage,
  type ScreenAccess
} from './screen-capture'

/** Image simulée : taille, et contenu PNG / JPEG de la longueur voulue. */
function image(width: number, png: number, jpeg = 1000): CaptureImage & { resizedTo?: number } {
  const self: CaptureImage & { resizedTo?: number } = {
    isEmpty: () => width === 0,
    getSize: () => ({ width, height: Math.round(width / 2) }),
    resize: ({ width: to }) => {
      const scaled = image(to, Math.round((png * to) / width), jpeg)
      self.resizedTo = to
      return scaled
    },
    toPNG: () => Buffer.alloc(png, 1),
    toJPEG: () => Buffer.alloc(jpeg, 2)
  }
  return self
}

const at = new Date(2026, 9, 15, 9, 5, 3)

describe('capture d’écran (fiche 062)', () => {
  it('nommée comme macOS', () => {
    expect(captureName(at, 'png')).toBe('Capture d’écran 2026-10-15 à 09.05.03.png')
  })

  it('PNG tel quel, réduite au-delà de 2 000 px, JPEG si le PNG est trop lourd', () => {
    expect(encodeCapture(image(800, 5000), at)).toMatchObject({
      kind: 'image',
      mimeType: 'image/png',
      name: 'Capture d’écran 2026-10-15 à 09.05.03.png'
    })
    const retina = image(5120, 4_000_000)
    expect(encodeCapture(retina, at)?.mimeType).toBe('image/png')
    expect(retina.resizedTo).toBe(2000)
    expect(encodeCapture(image(1800, MAX_IMAGE_BYTES + 1), at)).toMatchObject({
      mimeType: 'image/jpeg',
      name: 'Capture d’écran 2026-10-15 à 09.05.03.jpg'
    })
    expect(() => encodeCapture(image(1800, MAX_IMAGE_BYTES + 1, MAX_IMAGE_BYTES + 1), at)).toThrow(
      'trop lourde'
    )
    expect(encodeCapture(image(0, 0), at)).toBeNull()
  })

  it('zone choisie : fichier lu, fenêtres masquées puis remises ; Échap : rien', async () => {
    const events: string[] = []
    const hideWindows = () => {
      events.push('masquées')
      return () => events.push('remises')
    }
    const writes: Run = async (_command, args) => {
      events.push(`capture ${args.slice(0, 2).join(' ')}`)
      const { writeFile } = await import('node:fs/promises')
      await writeFile(args.at(-1) ?? '', 'png')
      return { code: 0, stdout: Buffer.from(''), stderr: '' }
    }
    const taken = await captureScreen({
      run: writes,
      command: 'screencapture',
      decode: (data) => image(600, data.length),
      hideWindows,
      now: () => at
    })
    expect(taken).toMatchObject({ kind: 'image', mimeType: 'image/png' })
    expect(events).toEqual(['masquées', 'capture -i -x', 'remises'])

    // Échap : `screencapture -i` sort avec le code 0, sans fichier (essayé sur macOS 27).
    const cancelled: Run = async () => ({ code: 0, stdout: Buffer.from(''), stderr: '' })
    expect(
      await captureScreen({ run: cancelled, command: 'screencapture', decode: () => image(1, 1) })
    ).toBeNull()
  })
})

describe('capture sans l’autorisation « Enregistrement de l’écran » (fiche 124)', () => {
  const ok: Run = async (_command, args) => {
    const { writeFile } = await import('node:fs/promises')
    await writeFile(args.at(-1) ?? '', 'png')
    return { code: 0, stdout: Buffer.from(''), stderr: '' }
  }
  const capture = (run: Run, access: ScreenAccess) =>
    captureScreen({
      run,
      command: 'screencapture',
      decode: (data) => image(600, data.length),
      access: () => access
    })

  it('refusée ou restreinte : indisponible, sans lancer la commande ni masquer les fenêtres', async () => {
    for (const access of ['denied', 'restricted'] as const) {
      const calls: string[] = []
      const hidden: string[] = []
      const result = await captureScreen({
        run: async (command, args) => {
          calls.push(command)
          return ok(command, args)
        },
        command: 'screencapture',
        decode: () => image(600, 10),
        access: () => access,
        hideWindows: () => {
          hidden.push('masquées')
          return () => {}
        }
      })
      expect(result).toEqual({ kind: 'unavailable', reason: access })
      expect(calls).toEqual([])
      expect(hidden).toEqual([])
    }
  })

  it('jamais demandée (ou inconnue) : la capture part, macOS demandera', async () => {
    for (const access of ['not-determined', 'unknown', 'granted'] as const) {
      expect((await capture(ok, access))?.kind).toBe('image')
    }
  })

  it('échec sans annulation : refus de macOS après la sélection, ou fichier vide', async () => {
    // Ce que rend `screencapture -i` sans l'autorisation, une zone choisie (essayé sur macOS 27).
    const refused: Run = async () => ({
      code: 1,
      stdout: Buffer.from(''),
      stderr: 'could not create image from rect'
    })
    expect(await capture(refused, 'not-determined')).toEqual({
      kind: 'unavailable',
      reason: 'failed'
    })
    const empty: Run = async (_command, args) => {
      const { writeFile } = await import('node:fs/promises')
      await writeFile(args.at(-1) ?? '', '')
      return { code: 0, stdout: Buffer.from(''), stderr: '' }
    }
    expect(await capture(empty, 'granted')).toEqual({ kind: 'unavailable', reason: 'failed' })
  })
})

describe('autorisation vue par l’app (fiche 124)', () => {
  const system = { getMediaAccessStatus: () => 'denied' as const }
  it('celle de macOS ; capture simulée : accordée ; `BOBINE_SCREEN_ACCESS` l’emporte', () => {
    expect(screenAccessOf({}, system)).toBe('denied')
    expect(screenAccessOf({ BOBINE_SCREENCAPTURE: '/tmp/capture' }, system)).toBe('granted')
    expect(
      screenAccessOf(
        { BOBINE_SCREENCAPTURE: '/tmp/capture', BOBINE_SCREEN_ACCESS: 'restricted' },
        system
      )
    ).toBe('restricted')
    expect(screenAccessOf({ BOBINE_SCREEN_ACCESS: 'n’importe quoi' }, system)).toBe('denied')
  })
})
