import { describe, expect, it } from 'vitest'
import { createDockBounce, journalDock, type Dock } from './dock-bounce'

function setup(options: { refused?: boolean } = {}) {
  const world = { enabled: true, t: 0 }
  const calls: string[] = []
  let next = 0
  const dock: Dock = {
    bounce: (kind) => {
      if (options.refused) return -1
      calls.push(`${kind} ${++next}`)
      return next
    },
    cancelBounce: (id) => calls.push(`stop ${id}`)
  }
  const bouncer = createDockBounce({ dock, enabled: () => world.enabled, now: () => world.t })
  return { world, calls, bouncer }
}

describe('rebond du Dock (fiche 101)', () => {
  it('un rebond à la fois : un `critical` en cours dure jusqu’au retour, sans rafale', () => {
    const { world, calls, bouncer } = setup()
    bouncer.bounce('critical')
    world.t = 60_000
    bouncer.bounce('critical')
    bouncer.bounce('informational')
    expect(calls).toEqual(['critical 1'])
    bouncer.stop()
    bouncer.stop()
    bouncer.bounce('critical')
    expect(calls).toEqual(['critical 1', 'stop 1', 'critical 2'])
  })

  it('`informational` : rien de plus à moins de 2 s, un autre plus tard', () => {
    const { world, calls, bouncer } = setup()
    bouncer.bounce('informational')
    world.t = 1500
    bouncer.bounce('informational')
    expect(calls).toEqual(['informational 1'])
    world.t = 2100
    bouncer.bounce('informational')
    expect(calls).toEqual(['informational 1', 'stop 1', 'informational 2'])
  })

  it('un `critical` remplace un `informational` qui rebondit encore, jamais l’inverse', () => {
    const { calls, bouncer } = setup()
    bouncer.bounce('informational')
    bouncer.bounce('critical')
    bouncer.bounce('informational')
    expect(calls).toEqual(['informational 1', 'stop 1', 'critical 2'])
  })

  it('réglage coupé : rien', () => {
    const { world, calls, bouncer } = setup()
    world.enabled = false
    bouncer.bounce('critical')
    bouncer.stop()
    expect(calls).toEqual([])
  })

  it('refusé par macOS (app au premier plan) ou sans Dock (hors macOS) : rien en cours', () => {
    const { calls, bouncer } = setup({ refused: true })
    bouncer.bounce('critical')
    bouncer.stop()
    expect(calls).toEqual([])
    const noDock = createDockBounce({ dock: undefined, enabled: () => true })
    expect(() => {
      noDock.bounce('critical')
      noDock.stop()
    }).not.toThrow()
  })

  it('journal d’essai : rebonds et arrêts notés', () => {
    const lines: string[] = []
    const dock = journalDock((line) => lines.push(line))
    const bouncer = createDockBounce({ dock, enabled: () => true })
    bouncer.bounce('critical')
    bouncer.stop()
    bouncer.bounce('informational')
    expect(lines).toEqual(['critical', 'stop', 'informational'])
  })
})
