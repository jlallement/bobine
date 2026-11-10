import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ConversationStore, type ConversationRecord } from './store'

const record = (id: string): ConversationRecord => ({
  id,
  title: 'Titre',
  titleSource: 'message',
  profileId: 'mock',
  workspace: '/tmp',
  sessionId: 's-1',
  createdAt: '2026-10-11T10:00:00Z',
  updatedAt: '2026-10-11T10:05:00Z'
})

describe('ConversationStore', () => {
  it('index et fils : aller-retour, sans fichier temporaire résiduel', () => {
    const dir = mkdtempSync(join(tmpdir(), 'conv-store-'))
    const store = new ConversationStore(dir)
    expect(store.loadIndex()).toEqual([])
    store.saveIndex([record('a'), record('b')])
    store.saveTranscript('a', { items: [{ kind: 'user', id: 1, text: 'Salut' }], nextId: 2 })
    expect(store.loadIndex().map((r) => r.id)).toEqual(['a', 'b'])
    expect(store.loadTranscript('a')?.items).toHaveLength(1)
    expect(store.loadTranscript('b')).toBeUndefined()
    expect(readdirSync(dir).some((f) => f.endsWith('.tmp'))).toBe(false)
    store.deleteTranscript('a')
    expect(store.loadTranscript('a')).toBeUndefined()
  })

  it('autres dossiers et ce que l’agent en a lu (fiche 179) : gardés ; abîmés, retirés', () => {
    const dir = mkdtempSync(join(tmpdir(), 'conv-store-'))
    const told = { sessionId: 's-1', folders: ['/lib'] }
    const records = [
      { ...record('a'), additionalDirectories: ['/lib'], toldDirectories: told },
      { ...record('b'), additionalDirectories: [3], toldDirectories: { folders: ['/lib'] } }
    ]
    writeFileSync(join(dir, 'index.json'), JSON.stringify(records))
    const [a, b] = new ConversationStore(dir).loadIndex()
    expect(a).toMatchObject({ additionalDirectories: ['/lib'], toldDirectories: told })
    expect(b && ('additionalDirectories' in b || 'toldDirectories' in b)).toBe(false)
  })

  it('version du format écrite avec le fil, retirée à la lecture (fiche 103)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'conv-store-'))
    const store = new ConversationStore(dir)
    const transcript = { items: [{ kind: 'user' as const, id: 1, text: 'Salut' }], nextId: 2 }
    store.saveTranscript('a', transcript)
    expect(JSON.parse(readFileSync(join(dir, 'a.json'), 'utf8')).version).toBe(1)
    expect(store.loadTranscript('a')).toEqual(transcript)
    expect(await store.readTranscriptAsync('a')).toEqual(transcript)
    // Un fil d'avant la version : lu tel quel.
    writeFileSync(join(dir, 'b.json'), JSON.stringify(transcript))
    expect(store.loadTranscript('b')).toEqual(transcript)
  })

  it('fichiers corrompus ou entrées invalides : ignorés', () => {
    const dir = mkdtempSync(join(tmpdir(), 'conv-store-'))
    writeFileSync(join(dir, 'index.json'), JSON.stringify([record('ok'), { id: '../evil' }, 42]))
    writeFileSync(join(dir, 'ok.json'), '{ pas du json')
    const store = new ConversationStore(dir)
    expect(store.loadIndex().map((r) => r.id)).toEqual(['ok'])
    expect(store.loadTranscript('ok')).toBeUndefined()
  })

  it('index illisible : mis de côté, reprise sur la dernière bonne copie (fiche 041)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'conv-store-'))
    const store = new ConversationStore(dir)
    store.saveIndex([record('a')])
    store.saveIndex([record('a'), record('b')]) // la copie garde [a]
    writeFileSync(join(dir, 'index.json'), '[{"id": "a", tronqu')
    const reopened = new ConversationStore(dir)
    expect(reopened.loadIndex().map((r) => r.id)).toEqual(['a'])
    const kept = readdirSync(dir).find((f) => f.startsWith('index.json.corrupt-'))
    expect(kept).toBeDefined()
    expect(readFileSync(join(dir, kept ?? ''), 'utf8')).toContain('tronqu')
    expect(reopened.damaged).toEqual([join(dir, kept ?? '')])
    // La réécriture ne touche pas à la copie mise de côté.
    reopened.saveIndex([record('a'), record('c')])
    expect(readdirSync(dir).filter((f) => f.includes('corrupt'))).toHaveLength(1)
  })

  it('index JSON valide mais qui n’est pas une liste : mis de côté aussi', () => {
    const dir = mkdtempSync(join(tmpdir(), 'conv-store-'))
    writeFileSync(join(dir, 'index.json'), '{"oups": true}')
    const store = new ConversationStore(dir)
    expect(store.loadIndex()).toEqual([])
    expect(store.damaged).toHaveLength(1)
    expect(readdirSync(dir).some((f) => f.startsWith('index.json.corrupt-'))).toBe(true)
  })

  it('fil illisible : mis de côté au lieu d’être écrasé', () => {
    const dir = mkdtempSync(join(tmpdir(), 'conv-store-'))
    writeFileSync(join(dir, 'abc.json'), '{"items": [')
    const store = new ConversationStore(dir)
    expect(store.loadTranscript('abc')).toBeUndefined()
    expect(readdirSync(dir).some((f) => f.startsWith('abc.json.corrupt-'))).toBe(true)
    expect(store.damaged).toHaveLength(1)
  })

  it('fil JSON valide mais qui n’est pas un fil : mis de côté, jamais écrasé (fiche 187)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'conv-store-'))
    writeFileSync(join(dir, 'abc.json'), '{"version":1,"items":"oups","nextId":3}')
    const store = new ConversationStore(dir)
    expect(store.loadTranscript('abc')).toBeUndefined()
    const kept = readdirSync(dir).find((f) => f.startsWith('abc.json.corrupt-'))
    expect(kept).toBeDefined()
    expect(readFileSync(join(dir, kept ?? ''), 'utf8')).toContain('oups')
    expect(store.damaged).toEqual([join(dir, kept ?? '')])
  })

  it('refuse un identifiant qui sortirait du dossier', () => {
    const store = new ConversationStore(mkdtempSync(join(tmpdir(), 'conv-store-')))
    expect(() => store.saveTranscript('../../x', { items: [], nextId: 1 })).toThrow('invalide')
  })
})

describe('ConversationStore (écriture asynchrone, fiche 043)', () => {
  it('fil écrit hors du fil principal ; une écriture dépassée ne remplace pas le fichier', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'conv-store-'))
    const store = new ConversationStore(dir)
    const stale = store.saveTranscriptAsync('a', { items: [], nextId: 2 }, () => false)
    const fresh = store.saveTranscriptAsync('a', { items: [], nextId: 3 })
    expect(await stale).toBe(false)
    expect(await fresh).toBe(true)
    expect(store.loadTranscript('a')?.nextId).toBe(3)
    expect(readdirSync(dir).some((f) => f.endsWith('.tmp'))).toBe(false)
  })

  it('entrées d’index d’une version plus récente : réécrites telles quelles (fiche 196)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'conv-store-'))
    const future = { id: 'f', titre: 'nouveau format', champs: [1] }
    writeFileSync(
      join(dir, 'index.json'),
      JSON.stringify([{ ...record('a'), inconnu: { x: 1 } }, future])
    )
    const store = new ConversationStore(dir)
    const records = store.loadIndex()
    expect(records.map((r) => r.id)).toEqual(['a'])
    store.saveIndex(records)
    expect(JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8'))).toEqual([
      { ...record('a'), inconnu: { x: 1 } },
      future
    ])
  })

  it('fil d’une version plus récente : lu, jamais réécrit (fiche 196)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'conv-store-'))
    const text = JSON.stringify({ version: 2, items: [], nextId: 1, nouveau: true })
    writeFileSync(join(dir, 'a.json'), text)
    const store = new ConversationStore(dir)
    expect(store.loadTranscript('a')).toMatchObject({ items: [], nouveau: true })
    store.saveTranscript('a', { items: [], nextId: 1 })
    expect(await store.saveTranscriptAsync('a', { items: [], nextId: 1 })).toBe(false)
    expect(readFileSync(join(dir, 'a.json'), 'utf8')).toBe(text)
  })

  it('conversation supprimée : plus aucune écriture de son fil, même déjà en vol', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'conv-store-'))
    const store = new ConversationStore(dir)
    let gate = true
    const late = store.saveTranscriptAsync('a', { items: [], nextId: 1 }, () => gate)
    store.setGone('a', true)
    expect(await late).toBe(false)
    store.saveTranscript('a', { items: [], nextId: 1 })
    expect(readdirSync(dir)).toEqual([])
    gate = false
  })

  it('copie de l’enregistrement dans le fil ; index perdu : liste refaite (fiche 197)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'conv-store-'))
    const store = new ConversationStore(dir)
    store.attachRecords((id) => (id === 'a' ? { ...record('a'), title: 'Copie' } : undefined))
    store.saveIndex([record('a')])
    store.saveTranscript('a', { items: [{ kind: 'user', id: 1, text: 'Salut' }], nextId: 2 })
    // Fil d'avant la 0.11, sans copie : revient seulement si l'index est perdu.
    writeFileSync(
      join(dir, 'ancien.json'),
      JSON.stringify({
        items: [{ kind: 'user', id: 1, text: 'Vieille question\nsuite' }],
        nextId: 2
      })
    )
    const again = new ConversationStore(dir)
    expect(again.loadIndex().map((r) => r.id)).toEqual(['a'])
    expect(again.recovered).toBeUndefined()

    rmSync(join(dir, 'index.json'))
    rmSync(join(dir, 'index.json.bak'), { force: true })
    const rebuilt = new ConversationStore(dir)
    const records = rebuilt.loadIndex()
    expect(records.map((r) => [r.id, r.title])).toEqual([
      ['a', 'Copie'],
      ['ancien', 'Vieille question']
    ])
    expect(records[1]).toMatchObject({ profileId: '', workspace: '', titleSource: 'app' })
    expect(rebuilt.recovered).toEqual({ count: 2, rebuilt: true })
    // Le fil se relit sans sa copie ni sa version.
    expect(rebuilt.loadTranscript('a')).toEqual({
      items: [{ kind: 'user', id: 1, text: 'Salut' }],
      nextId: 2
    })
  })

  it('fil avec sa copie mais absent de l’index (écriture de l’index en échec) : retrouvé', () => {
    const dir = mkdtempSync(join(tmpdir(), 'conv-store-'))
    const store = new ConversationStore(dir)
    store.attachRecords(() => record('b'))
    store.saveIndex([])
    store.saveTranscript('b', { items: [], nextId: 1 })
    const again = new ConversationStore(dir)
    expect(again.loadIndex().map((r) => r.id)).toEqual(['b'])
    expect(again.recovered).toEqual({ count: 1, rebuilt: false })
  })
})
