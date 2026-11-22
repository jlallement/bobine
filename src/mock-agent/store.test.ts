import { mkdtempSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { replaceFile, SessionStore, type StoredSession } from './store.mts'

const busy = (code: string) =>
  Object.assign(new Error(`${code}: operation not permitted, rename`), { code })

/** Renommage qui échoue `failures` fois avec `code`, puis réussit. */
function flakyRename(code: string, failures: number) {
  const calls: [string, string][] = []
  return {
    calls,
    rename: (from: string, to: string) => {
      calls.push([from, to])
      if (calls.length <= failures) throw busy(code)
    }
  }
}

describe('remplacement d’une session enregistrée (CI Windows : rename en EPERM)', () => {
  it('Windows : fichier tenu ouvert un instant (antivirus, lecteur) : nouvel essai, puis remplacé', () => {
    const waits: number[] = []
    const fs = flakyRename('EPERM', 2)
    replaceFile('a.tmp', 'a.json', {
      platform: 'win32',
      rename: fs.rename,
      wait: (ms) => waits.push(ms)
    })
    expect(fs.calls).toHaveLength(3)
    expect(waits).toEqual([10, 20])
  })

  it('Windows : EACCES et EBUSY de même (attente synchrone réelle de 10 ms)', () => {
    for (const code of ['EACCES', 'EBUSY']) {
      const fs = flakyRename(code, 1)
      replaceFile('a.tmp', 'a.json', { platform: 'win32', rename: fs.rename })
      expect(fs.calls).toHaveLength(2)
    }
  })

  it('Windows : fichier qui reste tenu : l’erreur au bout d’un peu plus de 3 s, pas d’attente sans fin', () => {
    const waits: number[] = []
    const fs = flakyRename('EPERM', Infinity)
    expect(() =>
      replaceFile('a.tmp', 'a.json', {
        platform: 'win32',
        rename: fs.rename,
        wait: (ms) => waits.push(ms)
      })
    ).toThrow(/EPERM/)
    expect(fs.calls).toHaveLength(10)
    expect(waits.reduce((a, b) => a + b, 0)).toBe(3270)
  })

  it('ailleurs que sous Windows, ou une autre erreur : rendue tout de suite', () => {
    const linux = flakyRename('EPERM', 1)
    expect(() =>
      replaceFile('a.tmp', 'a.json', { platform: 'linux', rename: linux.rename, wait: () => {} })
    ).toThrow(/EPERM/)
    expect(linux.calls).toHaveLength(1)
    const missing = flakyRename('ENOENT', 1)
    expect(() =>
      replaceFile('a.tmp', 'a.json', { platform: 'win32', rename: missing.rename, wait: () => {} })
    ).toThrow(/ENOENT/)
    expect(missing.calls).toHaveLength(1)
  })

  it('enregistrement réel : relu tel quel, aucun temporaire laissé, réécriture comprise', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mock-store-'))
    const store = new SessionStore(dir)
    const session: StoredSession = {
      sessionId: 'mock-1',
      cwd: '/projet',
      updatedAt: '2026-11-21T10:00:00.000Z',
      modeId: 'default',
      model: 'mock',
      verbose: false,
      history: []
    }
    store.save(session)
    store.save({ ...session, title: 'Deuxième' })
    expect(store.load('mock-1')?.title).toBe('Deuxième')
    expect(readdirSync(dir)).toEqual(['mock-1.json'])
  })
})
