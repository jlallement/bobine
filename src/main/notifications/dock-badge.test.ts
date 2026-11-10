import { describe, expect, it } from 'vitest'
import { createDockBadge } from './dock-badge'

describe('compteur du Dock (fiche 119)', () => {
  const setup = () => {
    const world = { enabled: true }
    const badges: string[] = []
    const badge = createDockBadge({
      dock: { setBadge: (text) => badges.push(text) },
      enabled: () => world.enabled
    })
    return { world, badges, badge }
  }

  it('le nombre « À traiter », posé seulement quand il change, effacé à zéro', () => {
    const { badge, badges } = setup()
    badge.update(2)
    badge.update(2)
    badge.update(3)
    badge.update(0)
    expect(badges).toEqual(['2', '3', ''])
  })

  it('réglage coupé : effacé, et rien tant qu’il l’est', () => {
    const { world, badge, badges } = setup()
    badge.update(1)
    world.enabled = false
    badge.update(1)
    badge.update(4)
    world.enabled = true
    badge.update(4)
    expect(badges).toEqual(['1', '', '4'])
  })

  it('sans Dock : rien ne casse', () => {
    const badge = createDockBadge({ dock: undefined, enabled: () => true })
    expect(() => badge.update(3)).not.toThrow()
  })
})
