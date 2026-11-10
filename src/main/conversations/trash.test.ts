import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { ConversationRecord } from './store'
import { ConversationTrash, TrashLink, TRASH_DAYS } from './trash'
import { ConversationStore } from './store'
import { setReadOnlyProfile } from '../storage'

const record = (id: string): ConversationRecord => ({
  id,
  title: `Titre ${id}`,
  titleSource: 'message',
  profileId: 'mock',
  workspace: '/tmp/projet',
  createdAt: '2026-10-11T10:00:00Z',
  updatedAt: '2026-10-11T10:05:00Z'
})

function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'corbeille-'))
  mkdirSync(dir, { recursive: true })
  return { dir, trash: new ConversationTrash(dir) }
}

describe('corbeille des conversations (fiche 196)', () => {
  it('fil non chargé : le fichier part tel quel (même d’une version plus récente), et revient', () => {
    const { dir, trash } = setup()
    const text = '{"version":7,"items":[],"nextId":1,"futur":true}'
    writeFileSync(join(dir, 'a.json'), text)
    trash.put(record('a'), undefined, join(dir, 'a.json'), {
      now: new Date('2026-11-01T00:00:00Z')
    })
    expect(existsSync(join(dir, 'a.json'))).toBe(false)
    expect(trash.list(new Date('2026-11-07T00:00:00Z'))).toEqual([
      {
        id: 'a',
        title: 'Titre a',
        workspace: '/tmp/projet',
        deletedAt: '2026-11-01T00:00:00.000Z',
        erasedAt: '2026-12-01T00:00:00.000Z'
      }
    ])
    expect(trash.restore('a', join(dir, 'a.json'))).toEqual({
      record: record('a'),
      agentDeleted: false
    })
    expect(readFileSync(join(dir, 'a.json'), 'utf8')).toBe(text)
    expect(readdirSync(trash.dir)).toEqual([])
  })

  it('fil chargé : le plus récent, celui de la mémoire, avec la copie de l’enregistrement', () => {
    const { dir, trash } = setup()
    writeFileSync(join(dir, 'b.json'), '{"items":[],"nextId":1}')
    trash.put(
      record('b'),
      { items: [{ kind: 'user', id: 1, text: 'tard' }], nextId: 2 },
      join(dir, 'b.json'),
      {
        agentDeleted: true
      }
    )
    const kept = JSON.parse(readFileSync(join(trash.dir, 'b.json'), 'utf8'))
    expect(kept).toMatchObject({ nextId: 2, record: { id: 'b' } })
    expect(trash.restore('b', join(dir, 'b.json')).agentDeleted).toBe(true)
  })

  it(`purge après ${TRASH_DAYS} jours, effacement à la demande : plus rien sur le disque`, () => {
    const { dir, trash } = setup()
    for (const id of ['vieux', 'recent', 'efface']) {
      writeFileSync(join(dir, `${id}.json`), '{"items":[],"nextId":1}')
    }
    trash.put(record('vieux'), undefined, join(dir, 'vieux.json'), { now: new Date('2026-09-01') })
    trash.put(record('recent'), undefined, join(dir, 'recent.json'), {
      now: new Date('2026-11-01')
    })
    trash.put(record('efface'), undefined, join(dir, 'efface.json'), {
      now: new Date('2026-11-01')
    })
    expect(trash.purge(new Date('2026-11-07'))).toBe(1)
    trash.erase('efface')
    expect(readdirSync(trash.dir).sort()).toEqual(['recent.json', 'recent.meta.json'])
    expect(() => trash.restore('vieux', join(dir, 'vieux.json'))).toThrow()
    expect(() => trash.erase('../x')).toThrow()
  })
})

describe('corbeille : relecture (fiches 196, 197)', () => {
  it('arrêt brutal pendant la mise à la corbeille : la suppression est finie au lancement', () => {
    const { dir, trash } = setup()
    writeFileSync(join(dir, 'a.json'), '{"items":[],"nextId":1}')
    writeFileSync(join(dir, 'b.json'), '{"items":[],"nextId":1}')
    // La fiche est écrite, le fil est encore là (et dans l'index).
    mkdirSync(trash.dir, { recursive: true })
    writeFileSync(
      join(trash.dir, 'a.meta.json'),
      JSON.stringify({ record: record('a'), deletedAt: new Date().toISOString() })
    )
    const left = trash.settle([record('a'), record('b')], (id) => join(dir, `${id}.json`))
    expect(left.map((r) => r.id)).toEqual(['b'])
    expect(existsSync(join(dir, 'a.json'))).toBe(false)
    expect(existsSync(join(trash.dir, 'a.json'))).toBe(true)
    expect(trash.list().map((e) => e.id)).toEqual(['a'])
  })

  it('effacer définitivement : aussi ses copies abîmées et son titre dans la copie de l’index', () => {
    const { dir, trash } = setup()
    writeFileSync(join(dir, 'a.json'), '{"items":[],"nextId":1}')
    writeFileSync(join(dir, 'a.json.corrupt-2026-11-01T00-00-00-000Z'), '{secret')
    writeFileSync(join(dir, 'index.json.bak'), JSON.stringify([record('a'), record('b')]))
    trash.put(record('a'), undefined, join(dir, 'a.json'))
    trash.erase('a')
    expect(readdirSync(dir).filter((n) => n.startsWith('a.'))).toEqual([])
    expect(readFileSync(join(dir, 'index.json.bak'), 'utf8')).not.toContain('Titre a')
    expect(() => trash.restore('a', join(dir, 'a.json'))).toThrow(/plus dans la corbeille/)
  })

  it('profil en lecture seule : rien n’y entre, rien n’en sort', () => {
    const { dir, trash } = setup()
    writeFileSync(join(dir, 'a.json'), '{"items":[],"nextId":1}')
    setReadOnlyProfile(dir)
    try {
      expect(() => trash.put(record('a'), undefined, join(dir, 'a.json'))).toThrow()
      expect(() => trash.erase('a')).toThrow()
      expect(existsSync(join(dir, 'a.json'))).toBe(true)
      expect(existsSync(trash.dir)).toBe(false)
    } finally {
      setReadOnlyProfile(undefined)
    }
  })

  it('fil d’une version plus récente chargé : part tel quel, pas réécrit dans ce format-ci', async () => {
    const { dir, trash } = setup()
    const text = JSON.stringify({ version: 9, items: [], nextId: 1, futur: { x: 1 } })
    writeFileSync(join(dir, 'a.json'), text)
    const store = new ConversationStore(dir)
    const transcript = store.loadTranscript('a')
    const link = new TrashLink(trash, store, { forget: async () => {} })
    await link.put({ record: record('a'), ...(transcript ? { transcript } : {}) }, false)
    expect(readFileSync(join(trash.dir, 'a.json'), 'utf8')).toBe(text)
  })
})
