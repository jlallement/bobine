import { afterEach, describe, expect, it, vi } from 'vitest'

// Un partage réseau muet : le chemin réel du dossier ne revient jamais.
const real = vi.hoisted(() => vi.fn(() => new Promise<string>(() => {})))
vi.mock('./file-links', () => ({ real }))

const { existingFileLinks, PAUSE_AFTER_TIMEOUT_MS, resetPausedFolders } =
  await import('./file-exists')

afterEach(() => {
  resetPausedFolders()
  vi.useRealTimers()
})

describe('vérification bornée dans le temps (fiche 272, rc.3)', () => {
  it('chemin réel du dossier muet : rendu au délai, tout « inconnu », jamais « absent »', async () => {
    const started = Date.now()
    expect(
      await existingFileLinks('/partage/muet', ['liste.js', 'absent.js'], { timeoutMs: 50 })
    ).toEqual({ existing: [], unknown: ['liste.js', 'absent.js'] })
    expect(Date.now() - started).toBeLessThan(1000)
  })

  it('après un délai dépassé : plus rien de lancé dans ce dossier pendant 30 s', async () => {
    await existingFileLinks('/partage/muet', ['a.js'], { timeoutMs: 10 })
    const calls = real.mock.calls.length
    expect(await existingFileLinks('/partage/muet', ['b.js'], { timeoutMs: 10 })).toEqual({
      existing: [],
      unknown: ['b.js']
    })
    expect(real.mock.calls.length).toBe(calls)
    // Un autre dossier n'est pas en pause.
    await existingFileLinks('/autre', ['c.js'], { timeoutMs: 10 })
    expect(real.mock.calls.length).toBeGreaterThan(calls)
    // Passé la pause, on revérifie.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(Date.now() + PAUSE_AFTER_TIMEOUT_MS + 1)
    const before = real.mock.calls.length
    await existingFileLinks('/partage/muet', ['d.js'], { timeoutMs: 10 })
    expect(real.mock.calls.length).toBeGreaterThan(before)
  })
})
