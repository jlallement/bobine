import { mkdirSync, realpathSync, rmSync, symlinkSync } from 'node:fs'
import { homedir } from 'node:os'
import path, { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { AgentStatus } from '@shared/agent'
import { addAdditionalDirectory, removeAdditionalDirectory } from './additional-directories'
import { NATIVE_FOLDER_SYSTEM, type FolderSystem } from './extra-folder-check'
import type { ConversationRecord } from './store'
import { tempDir } from '../test-platform'

/**
 * Relevés du testeur de la fiche 290 (essais `zz-testeur-disque`, `zz-testeur-course`), repris
 * ici sur le vrai disque : firmlinks de macOS (D1), sous-dossier en « .. » (D3), délais
 * additionnés (M2), courses et doublons, statut `starting`.
 */
let root = ''
beforeAll(() => {
  root = realpathSync.native(tempDir('bob-extra-disk-'))
})
afterAll(() => rmSync(root, { recursive: true, force: true }))
const mk = (name: string) => {
  const dir = join(root, name)
  mkdirSync(dir, { recursive: true })
  return dir
}

function fakeManager(workspace: string, folders?: string[]) {
  const record = {
    id: 'c1',
    workspace,
    ...(folders ? { additionalDirectories: folders } : {})
  } as ConversationRecord
  const m = {
    record,
    status: 'ready' as AgentStatus,
    restart: vi.fn(async () => {}),
    updateRecord: vi.fn(
      (_id: string, change: (r: ConversationRecord, s: AgentStatus | undefined) => unknown) => {
        change(record, m.status)
        return m.status
      }
    )
  }
  return m
}

describe('fiche 290, relevés du testeur : vrai disque', () => {
  it.skipIf(process.platform !== 'darwin')(
    'D1 : dossier de travail et dossier déjà ajouté écrits par /System/Volumes/Data : reconnus',
    async () => {
      const ws = mk('d1-ws')
      const lib = mk('d1-lib')
      const m = fakeManager(ws, [lib])
      const viaData = (p: string) => `/System/Volumes/Data${p}`
      expect(await addAdditionalDirectory(m, 'c1', viaData(lib))).toMatchObject({
        reason: 'alreadyAdded'
      })
      expect(await addAdditionalDirectory(m, 'c1', viaData(ws))).toMatchObject({
        reason: 'isWorkspace'
      })
      expect(await addAdditionalDirectory(m, 'c1', viaData(join(ws, '..')))).toMatchObject({
        ok: true
      })
      // Dossier de travail enregistré par le firmlink, sous-dossier écrit sans.
      const m2 = fakeManager(viaData(ws))
      mkdirSync(join(ws, 'src'))
      expect(await addAdditionalDirectory(m2, 'c1', join(ws, 'src'))).toMatchObject({
        reason: 'insideWorkspace'
      })
    }
  )

  it('D2 : le parent du dossier personnel, trop large', async () => {
    expect(await addAdditionalDirectory(fakeManager(mk('d2-ws')), 'c1', '~/..')).toMatchObject({
      reason: 'tooBroad'
    })
    expect(
      await addAdditionalDirectory(fakeManager(mk('d2-ws2')), 'c1', path.dirname(homedir()))
    ).toMatchObject({ reason: 'tooBroad' })
  })

  it('D3 : <dossier de travail>/..cache est dans le dossier de travail', async () => {
    const ws = mk('d3-ws')
    mkdirSync(join(ws, '..cache'))
    expect(await addAdditionalDirectory(fakeManager(ws), 'c1', join(ws, '..cache'))).toMatchObject({
      reason: 'insideWorkspace'
    })
  })

  it('même dossier par trois écritures en même temps (chemin, casse, lien) : un seul ajout', async () => {
    const ws = mk('c-ws1')
    const p = mk('Projet')
    symlinkSync(p, join(root, 'lienP'), 'junction')
    const m = fakeManager(ws)
    const variants = [p, join(root, 'lienP') + path.sep]
    // Disque insensible à la casse (macOS, Windows) : le même dossier écrit autrement.
    if (process.platform !== 'linux') variants.push(join(root, 'projet'))
    const results = await Promise.all(variants.map((x) => addAdditionalDirectory(m, 'c1', x)))
    expect(results.filter((r) => r.ok)).toHaveLength(1)
    expect(m.record.additionalDirectories).toEqual([p])
    expect(m.restart).toHaveBeenCalledTimes(1)
  })

  it('deux dossiers différents en même temps : les deux', async () => {
    const m = fakeManager(mk('c-ws2'))
    const [a, b] = [mk('A'), mk('B')]
    const results = await Promise.all([a, b].map((x) => addAdditionalDirectory(m, 'c1', x)))
    expect(results.every((r) => r.ok)).toBe(true)
    expect([...(m.record.additionalDirectories ?? [])].sort()).toEqual([a, b].sort())
  })

  it('ancienne entrée non résolue (lien) : doublon reconnu, retrait par le chemin réel', async () => {
    const a = mk('D')
    symlinkSync(a, join(root, 'lienD'), 'junction')
    const m = fakeManager(mk('c-ws4'), [join(root, 'lienD')])
    expect(await addAdditionalDirectory(m, 'c1', a)).toMatchObject({ reason: 'alreadyAdded' })
    await removeAdditionalDirectory(m, 'c1', a)
    expect(m.record.additionalDirectories).toBeUndefined()
  })

  it('ancienne entrée disparue : retrait par son texte', async () => {
    const m = fakeManager(mk('c-ws5'), [join(root, 'parti') + path.sep, join(root, 'n', 'existe')])
    await removeAdditionalDirectory(m, 'c1', join(root, 'parti') + path.sep)
    await removeAdditionalDirectory(m, 'c1', join(root, 'n', 'existe'))
    expect(m.record.additionalDirectories).toBeUndefined()
  })

  it('M2 : dossier de travail et dossiers déjà là figés : un seul délai pour tout l’ajout', async () => {
    const frozen: FolderSystem = {
      ...NATIVE_FOLDER_SYSTEM,
      home: '/Users/moi',
      timeoutMs: 200,
      realpath: (p) =>
        p.startsWith('/figé') ? new Promise<string>(() => {}) : Promise.resolve(path.resolve(p)),
      stat: async (p) => ({ dir: true, dev: '1', ino: String(p.length) }),
      access: async () => 'ok'
    }
    const m = fakeManager('/figé/ws', ['/figé/a', '/figé/b'])
    const started = Date.now()
    const result = await addAdditionalDirectory(m, 'c1', '/x/projet', frozen)
    const elapsed = Date.now() - started
    expect(result).toMatchObject({ ok: true })
    // Un seul délai de 200 ms, pas trois ; marge pour une machine chargée.
    expect(elapsed).toBeLessThan(450)
  })
})
