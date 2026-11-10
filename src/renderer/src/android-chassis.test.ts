import { describe, expect, it } from 'vitest'
import { androidChassis, type Rect } from './android-chassis'

const center = (r: Rect) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 })

describe('androidChassis', () => {
  it('phone in portrait: rounded screen, thin bezel, camera at the top, buttons on the right', () => {
    const c = androidChassis({ width: 411, height: 914 })
    expect(c).toMatchObject({ kind: 'phone', radius: 35, bezel: 6, rim: 4, overhang: 3 })
    expect(c.width).toBe(411 + 2 * 10)
    expect(c.height).toBe(914 + 2 * 10)
    // Perforation centrée, dans l'écran, sous son bord haut.
    expect(center(c.camera)).toEqual({ x: c.width / 2, y: 10 + 18 })
    expect(c.camera.width).toBe(13)
    // Boutons collés à droite du tour, marche/arrêt au-dessus du volume.
    expect(c.buttons.map((b) => b.key)).toEqual(['power', 'volume_up', 'volume_down'])
    expect(c.buttons.every((b) => b.rect.x === c.width - 1 && b.rect.width === 4)).toBe(true)
    const [power = 0, up = 0, down = 0] = c.buttons.map((b) => b.rect.y)
    expect(power < up && up < down).toBe(true)
  })

  it('phone turned left (ROTATION_90): camera on the left, buttons on top', () => {
    const c = androidChassis({ width: 914, height: 411 }, 1)
    expect(c.kind).toBe('phone')
    expect([c.width, c.height]).toEqual([934, 431])
    expect(center(c.camera)).toEqual({ x: 28, y: c.height / 2 })
    expect(c.buttons.every((b) => b.rect.y === -3 && b.rect.height === 4)).toBe(true)
    // Le haut naturel est à gauche : marche/arrêt plus à gauche que le volume.
    const [power = 0, up = 0] = c.buttons.map((b) => b.rect.x)
    expect(power < up).toBe(true)
  })

  it('phone turned right (ROTATION_270): camera on the right, buttons at the bottom', () => {
    const c = androidChassis({ width: 914, height: 411 }, 3)
    expect(center(c.camera)).toEqual({ x: c.width - 28, y: c.height / 2 })
    expect(c.buttons.every((b) => b.rect.y === c.height - 1)).toBe(true)
    const [power = 0, up = 0] = c.buttons.map((b) => b.rect.x)
    expect(power > up).toBe(true)
  })

  it('upside down: camera at the bottom, buttons on the left', () => {
    const c = androidChassis({ width: 411, height: 914 }, 2)
    expect(center(c.camera)).toEqual({ x: c.width / 2, y: c.height - 28 })
    expect(c.buttons.every((b) => b.rect.x === -3)).toBe(true)
  })

  it('tablet from 600 dp on the short side: camera in the bezel, buttons on the top edge', () => {
    const c = androidChassis({ width: 1280, height: 800 })
    expect(c).toMatchObject({ kind: 'tablet', radius: 32, bezel: 20, rim: 5 })
    // Caméra au milieu du cadre noir, pas sur l'écran.
    expect(center(c.camera)).toEqual({ x: c.width / 2, y: 5 + 10 })
    expect(c.camera.y + c.camera.height).toBeLessThan(25)
    expect(c.buttons.every((b) => b.rect.y < 0)).toBe(true)
    expect(androidChassis({ width: 599, height: 960 }).kind).toBe('phone')
    expect(androidChassis({ width: 800, height: 1280 }, 1).kind).toBe('tablet')
  })

  it('uses the corner radius the device declares', () => {
    expect(androidChassis({ width: 411, height: 914 }, 0, 42).radius).toBe(42)
  })
})
