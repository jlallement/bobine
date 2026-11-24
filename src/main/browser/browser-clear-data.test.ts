import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * « Effacer les données du navigateur » (Réglages › Confidentialité, fiche 072) côté main :
 * remplace la vérification unitaire de l'e2e `settings` (n° 16). La vraie pile de Chromium
 * reste à l'e2e : ici, quelles sessions sont vidées et de quoi.
 */

interface FakeSession {
  partition: string
  cleared: string[]
}

const sessions = new Map<string, FakeSession>()
const userData = mkdtempSync(join(tmpdir(), 'clear-data-'))

function fakeSession(partition: string) {
  const state: FakeSession = { partition, cleared: [] }
  sessions.set(partition, state)
  return {
    setPermissionRequestHandler: () => {},
    setPermissionCheckHandler: () => {},
    on: () => {},
    getUserAgent: () => 'Mozilla/5.0 Chrome/140 Electron/44.0.0 bobine/1.0.0',
    setUserAgent: () => {},
    clearStorageData: async () => void state.cleared.push('storage'),
    clearCache: async () => void state.cleared.push('cache'),
    clearAuthCache: async () => void state.cleared.push('auth')
  }
}

const fakeSessions = new Map<string, ReturnType<typeof fakeSession>>()

vi.mock('electron', () => ({
  app: { getPath: () => userData, on: () => {} },
  dialog: {},
  shell: {},
  WebContentsView: function WebContentsView() {},
  webContents: { getAllWebContents: () => [] },
  session: {
    fromPartition: (partition: string) => {
      const known = fakeSessions.get(partition)
      if (known) return known
      const created = fakeSession(partition)
      fakeSessions.set(partition, created)
      return created
    }
  }
}))

const { BrowserManager } = await import('./browser-manager')

beforeEach(() => {
  sessions.clear()
  fakeSessions.clear()
})

describe('effacer les données du navigateur (fiche 072)', () => {
  it('session gardée sur le disque : cookies, stockage, cache et connexions vidés', async () => {
    const manager = new BrowserManager({ emitState: () => {}, keepCookies: () => true })
    await manager.clearData()
    expect([...sessions.values()]).toEqual([
      { partition: 'persist:bob-browser', cleared: ['storage', 'cache', 'auth'] }
    ])
  })

  it('cookies plus gardés : la partition du disque est vidée aussi, pas seulement celle en mémoire', async () => {
    const manager = new BrowserManager({ emitState: () => {}, keepCookies: () => false })
    await manager.clearData()
    expect(sessions.get('persist:bob-browser')?.cleared).toEqual(['storage', 'cache', 'auth'])
    expect(sessions.get('bob-browser-memoire')?.cleared).toEqual(['storage', 'cache', 'auth'])
  })
})
