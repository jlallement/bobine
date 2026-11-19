import { describe, expect, it, vi } from 'vitest'
import {
  agentActive,
  guardNavigations,
  type AgentWindow,
  type NavigationSource
} from './navigation-guard'

type Listener = Parameters<NavigationSource['on']>[1]

/** Faux `WebContents` : on déclenche ses deux évènements à la main. */
function fakeContents() {
  const listeners = new Map<string, Listener>()
  const contents: NavigationSource = {
    on: (event, listener) => listeners.set(event, listener)
  }
  const fire = (event: 'will-navigate' | 'will-redirect', url: string, isMainFrame = true) => {
    const preventDefault = vi.fn()
    listeners.get(event)?.({ url, isMainFrame, preventDefault })
    return preventDefault.mock.calls.length > 0
  }
  return { contents, fire }
}

const tab = (over: Partial<AgentWindow> = {}): AgentWindow => ({
  agentUntil: 0,
  agentBusy: 0,
  blockedNavigations: [],
  ...over
})
const allowed = (url: string) => new URL(url).hostname === '127.0.0.1'

describe('garde des navigations pendant une action de l’agent (fiche 249)', () => {
  it('action de l’agent : site non accordé arrêté et noté, site accordé laissé', () => {
    const t = tab({ agentBusy: 1 })
    const { contents, fire } = fakeContents()
    guardNavigations(contents, t, allowed)
    expect(fire('will-navigate', 'https://github.com/settings/tokens')).toBe(true)
    expect(fire('will-redirect', 'https://github.com/login')).toBe(true)
    expect(fire('will-navigate', 'http://127.0.0.1:3000/deux')).toBe(false)
    expect(t.blockedNavigations).toEqual([
      'https://github.com/settings/tokens',
      'https://github.com/login'
    ])
  })

  it('délai après l’action : encore attribué à l’agent', () => {
    const t = tab({ agentUntil: Date.now() + 1000 })
    const { contents, fire } = fakeContents()
    guardNavigations(contents, t, allowed)
    expect(fire('will-navigate', 'https://github.com/')).toBe(true)
  })

  it('hors d’une action de l’agent : l’utilisateur navigue librement', () => {
    const t = tab()
    const { contents, fire } = fakeContents()
    guardNavigations(contents, t, allowed)
    expect(fire('will-navigate', 'https://github.com/')).toBe(false)
    expect(fire('will-redirect', 'https://github.com/login')).toBe(false)
    expect(t.blockedNavigations).toEqual([])
  })

  it('schéma autre que http(s) : toujours refusé ; redirection d’un cadre : laissée', () => {
    const t = tab({ agentBusy: 1 })
    const { contents, fire } = fakeContents()
    guardNavigations(contents, tab(), allowed)
    expect(fire('will-navigate', 'file:///etc/passwd')).toBe(true)
    const other = fakeContents()
    guardNavigations(other.contents, t, allowed)
    expect(other.fire('will-redirect', 'https://pub.exemple.com/', false)).toBe(false)
  })

  it('agentActive : action en cours ou délai qui court', () => {
    expect(agentActive(tab({ agentBusy: 1 }), 0)).toBe(true)
    expect(agentActive(tab({ agentUntil: 100 }), 50)).toBe(true)
    expect(agentActive(tab({ agentUntil: 100 }), 100)).toBe(false)
  })
})
