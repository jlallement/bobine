import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { emptyTranscript, type TranscriptState } from '@shared/transcript'
import { translate } from '@shared/i18n/message'
import { HistoryWriter } from './history-writer'
import { ConversationStore } from './store'

describe('HistoryWriter', () => {
  it('échec signalé une fois par type d’écriture, de nouveau après un succès', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const dir = mkdtempSync(join(tmpdir(), 'writer-'))
    const failures: string[] = []
    const blocked = join(dir, 'pas-un-dossier')
    writeFileSync(blocked, '')
    const writer = new HistoryWriter({
      store: new ConversationStore(dir),
      settingsFile: join(blocked, 'settings.json'),
      onFailure: (m) => failures.push(translate(m))
    })
    writer.settings({ recentWorkspaces: [] })
    writer.settings({ recentWorkspaces: [] })
    writer.index([])
    expect(failures).toHaveLength(1)
    expect(failures[0]).toMatch(/^Impossible d’enregistrer les réglages\u00a0: /)
    vi.restoreAllMocks()
  })

  it('fil écrit dans la seconde pendant le streaming, tout de suite en fin de tour', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'writer-'))
    const writer = new HistoryWriter({
      store: new ConversationStore(dir),
      settingsFile: join(dir, 'settings.json'),
      onFailure: () => {}
    })
    let current = { ...emptyTranscript, nextId: 2 }
    writer.transcript('c1', () => current, false)
    current = { ...emptyTranscript, nextId: 3 }
    writer.transcript('c1', () => current, true)
    await writer.settled()
    expect(JSON.parse(readFileSync(join(dir, 'c1.json'), 'utf8'))).toMatchObject({ nextId: 3 })
    // Rien à écrire (conversation supprimée) : aucun fichier.
    writer.transcript('c2', () => undefined, true)
    writer.cancelPending()
    expect(() => readFileSync(join(dir, 'c2.json'))).toThrow()
  })

  it('fil de 20 Mo écrit en asynchrone (fiche 043) : la boucle d’évènements reste disponible', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'writer-'))
    const store = new ConversationStore(dir)
    const writer = new HistoryWriter({
      store,
      settingsFile: join(dir, 'settings.json'),
      onFailure: () => {}
    })
    const big: TranscriptState = {
      items: Array.from({ length: 2000 }, (_, i) => ({
        kind: 'agent' as const,
        id: i + 1,
        text: 'x'.repeat(10_000)
      })),
      nextId: 2001
    }
    expect(JSON.stringify(big).length).toBeGreaterThan(20_000_000)
    let maxGap = 0
    let last = Date.now()
    const probe = setInterval(() => {
      const now = Date.now()
      maxGap = Math.max(maxGap, now - last)
      last = now
    }, 5)
    writer.transcript('c1', () => big, true)
    await writer.settled()
    clearInterval(probe)
    expect(store.loadTranscript('c1')?.items).toHaveLength(2000)
    // La sérialisation reste sur le fil principal ; l'écriture et la synchronisation, non.
    expect(maxGap).toBeLessThan(300)
    expect(readdirSync(dir).some((f) => f.endsWith('.tmp'))).toBe(false)
  })

  it('écriture dépassée par une plus récente : seule la dernière reste, la synchrone de fermeture aussi', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'writer-'))
    const writer = new HistoryWriter({
      store: new ConversationStore(dir),
      settingsFile: join(dir, 'settings.json'),
      onFailure: () => {}
    })
    writer.transcript('c1', () => ({ ...emptyTranscript, nextId: 2 }), true)
    writer.transcript('c1', () => ({ ...emptyTranscript, nextId: 3 }), true)
    writer.transcript('c1', () => ({ ...emptyTranscript, nextId: 4 }), true, { sync: true })
    expect(JSON.parse(readFileSync(join(dir, 'c1.json'), 'utf8'))).toMatchObject({ nextId: 4 })
    await writer.settled()
    expect(JSON.parse(readFileSync(join(dir, 'c1.json'), 'utf8'))).toMatchObject({ nextId: 4 })
    expect(readdirSync(dir).some((f) => f.endsWith('.tmp'))).toBe(false)
  })

  it('fil à jour sur le disque (fiche 046) : pas tant qu’une écriture est prévue, en cours ou en échec', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const dir = mkdtempSync(join(tmpdir(), 'writer-'))
    class FlakyStore extends ConversationStore {
      failing = false
      override saveTranscriptAsync(
        id: string,
        transcript: TranscriptState,
        commit?: () => boolean
      ): Promise<boolean> {
        if (this.failing) return Promise.reject(new Error('disque plein'))
        return super.saveTranscriptAsync(id, transcript, commit)
      }
    }
    const store = new FlakyStore(dir)
    const idle: string[] = []
    const writer = new HistoryWriter({
      store,
      settingsFile: join(dir, 'settings.json'),
      onFailure: () => {},
      onIdle: (id) => idle.push(id)
    })
    const fil = { ...emptyTranscript, nextId: 2 }
    expect(writer.idle('c1')).toBe(true)
    writer.transcript('c1', () => fil, false)
    expect(writer.idle('c1')).toBe(false) // prévue
    writer.transcript('c1', () => fil, true)
    expect(writer.idle('c1')).toBe(false) // en cours
    await writer.settled()
    expect(writer.idle('c1')).toBe(true)
    expect(idle).toEqual(['c1'])

    store.failing = true
    writer.transcript('c1', () => fil, true)
    await writer.settled()
    expect(writer.idle('c1')).toBe(false) // en échec : la mémoire est plus fraîche que le disque
    expect(idle).toEqual(['c1'])

    store.failing = false
    writer.transcript('c1', () => fil, true)
    await writer.settled()
    expect(writer.idle('c1')).toBe(true)
    expect(idle).toEqual(['c1', 'c1'])
    vi.restoreAllMocks()
  })

  it('une seule écriture en cours par fil, la suivante écrit le plus récent (fiche 193)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'writer-'))
    const store = new ConversationStore(dir)
    // Écriture lente : chacune attend qu'on la libère.
    const written: number[] = []
    const releases: (() => void)[] = []
    let running = 0
    let maxRunning = 0
    vi.spyOn(store, 'saveTranscriptAsync').mockImplementation(async (_id, transcript) => {
      running++
      maxRunning = Math.max(maxRunning, running)
      await new Promise<void>((resolve) => releases.push(resolve))
      written.push(transcript.nextId)
      running--
      return true
    })
    const writer = new HistoryWriter({ store, settingsFile: join(dir, 'settings.json') })
    const idle: string[] = []
    writer.onIdle((id) => idle.push(id))
    let current = { ...emptyTranscript, nextId: 1 }
    const read = () => current
    writer.transcript('c1', read, true)
    for (const nextId of [2, 3, 4]) {
      current = { ...emptyTranscript, nextId }
      writer.transcript('c1', read, true)
    }
    expect(releases).toHaveLength(1)
    expect(writer.idle('c1')).toBe(false)
    releases.shift()?.()
    await vi.waitFor(() => expect(releases).toHaveLength(1))
    releases.shift()?.()
    await writer.settled()
    expect(written).toEqual([1, 4])
    expect(maxRunning).toBe(1)
    expect(writer.idle('c1')).toBe(true)
    expect(idle).toEqual(['c1'])
    vi.restoreAllMocks()
  })

  /** Écrivain dont chaque écriture asynchrone attend d'être libérée (ou rejetée). */
  function slowWriter() {
    const dir = mkdtempSync(join(tmpdir(), 'writer-'))
    const store = new ConversationStore(dir)
    const pending: { nextId: number; done: (ok: boolean) => void }[] = []
    vi.spyOn(store, 'saveTranscriptAsync').mockImplementation(
      (_id, transcript, commit) =>
        new Promise<boolean>((resolve, reject) =>
          pending.push({
            nextId: transcript.nextId,
            done: (ok) => (ok ? resolve(commit?.() ?? true) : reject(new Error('disque plein')))
          })
        )
    )
    const sync = vi.spyOn(store, 'saveTranscript').mockImplementation(() => {})
    const failures: string[] = []
    const writer = new HistoryWriter({
      store,
      settingsFile: join(dir, 'settings.json'),
      onFailure: (m) => failures.push(translate(m))
    })
    const state = (nextId: number) => ({ ...emptyTranscript, nextId })
    return { writer, pending, sync, failures, state }
  }

  it('échec puis succès : signalé une fois, le fil redevient à jour (fiche 193)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { writer, pending, failures, state } = slowWriter()
    writer.transcript('c1', () => state(1), true)
    pending.shift()?.done(false)
    await writer.settled()
    expect(failures).toHaveLength(1)
    expect(writer.idle('c1')).toBe(false)
    writer.transcript('c1', () => state(2), true)
    pending.shift()?.done(true)
    await writer.settled()
    expect(writer.idle('c1')).toBe(true)
    vi.restoreAllMocks()
  })

  it('écriture synchrone (fermeture) pendant une en cours : la plus récente gagne', async () => {
    const { writer, pending, sync, state } = slowWriter()
    let current = state(1)
    writer.transcript('c1', () => current, true)
    current = state(2)
    writer.transcript('c1', () => current, true)
    writer.transcript('c1', () => state(3), true, { sync: true })
    expect(sync).toHaveBeenCalledTimes(1)
    // L'écriture en cours, dépassée, ne remplace pas le fichier ; l'attente n'a plus lieu.
    const late = pending.shift()
    late?.done(true)
    await writer.settled()
    expect(pending).toHaveLength(0)
    expect(writer.idle('c1')).toBe(true)
    vi.restoreAllMocks()
  })

  it('conversation supprimée pendant l’attente : plus rien à écrire', async () => {
    const { writer, pending, state } = slowWriter()
    let alive = true
    writer.transcript('c1', () => state(1), true)
    writer.transcript('c1', () => (alive ? state(2) : undefined), true)
    alive = false
    pending.shift()?.done(true)
    await writer.settled()
    expect(pending).toHaveLength(0)
    expect(writer.idle('c1')).toBe(true)
    vi.restoreAllMocks()
  })

  it('cancelPending : l’écriture en attente derrière une en cours n’a pas lieu', async () => {
    const { writer, pending, state } = slowWriter()
    writer.transcript('c1', () => state(1), true)
    writer.transcript('c1', () => state(2), true)
    writer.cancelPending()
    pending.shift()?.done(true)
    await writer.settled()
    expect(pending).toHaveLength(0)
    vi.restoreAllMocks()
  })

  it('disque plein (fiche 197) : dit en clair, fil noté non enregistré, réessai en quittant', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const dir = mkdtempSync(join(tmpdir(), 'writer-'))
    const full = Object.assign(new Error('ENOSPC: no space left on device, write'), {
      code: 'ENOSPC'
    })
    class FullDisk extends ConversationStore {
      full = true
      override saveTranscriptAsync(): Promise<boolean> {
        return Promise.reject(full)
      }
      override saveTranscript(id: string, transcript: TranscriptState): void {
        if (this.full) throw full
        super.saveTranscript(id, transcript)
      }
    }
    const store = new FullDisk(dir)
    const failures: string[] = []
    const writer = new HistoryWriter({
      store,
      settingsFile: join(dir, 'settings.json'),
      onFailure: (m) => failures.push(translate(m))
    })
    const fil = { ...emptyTranscript, nextId: 2 }
    writer.transcript('c1', () => fil, true)
    await writer.settled()
    expect(failures).toEqual([expect.stringContaining('le disque est plein')])
    expect(failures[0]).not.toContain('ENOSPC')
    expect(writer.unsavedIds()).toEqual(['c1'])
    expect(writer.lastError()).toBe(full)
    writer.transcript('c1', () => fil, true, { sync: true })
    expect(writer.unsavedIds()).toEqual(['c1'])
    store.full = false
    writer.transcript('c1', () => fil, true, { sync: true })
    expect(writer.unsavedIds()).toEqual([])
    expect(readdirSync(dir)).toEqual(['c1.json'])
    vi.restoreAllMocks()
  })

  it('conversation oubliée (supprimée) : plus d’écriture prévue, les écritures en vol attendues', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'writer-'))
    const writer = new HistoryWriter({
      store: new ConversationStore(dir),
      settingsFile: join(dir, 'settings.json')
    })
    const fil = { ...emptyTranscript, nextId: 2 }
    writer.transcript('c1', () => fil, false)
    writer.transcript('c2', () => fil, true)
    await writer.forget('c2')
    await writer.forget('c1')
    expect(writer.idle('c1')).toBe(true)
    await new Promise((r) => setTimeout(r, 1100))
    expect(readdirSync(dir)).toEqual(['c2.json'])
  })

  it('avant de quitter, l’écriture en vol finit d’abord : le plus récent est le dernier sur le disque', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'writer-'))
    const store = new ConversationStore(dir)
    const onDisk: number[] = []
    let release = () => {}
    vi.spyOn(store, 'saveTranscriptAsync').mockImplementation(
      (_id, transcript) =>
        new Promise<boolean>((resolve) => {
          // Le renommage de l'ancienne version arrive après coup.
          release = () => {
            onDisk.push(transcript.nextId)
            resolve(true)
          }
        })
    )
    vi.spyOn(store, 'saveTranscript').mockImplementation((_id, transcript) => {
      onDisk.push(transcript.nextId)
    })
    const writer = new HistoryWriter({ store, settingsFile: join(dir, 'settings.json') })
    let current = { ...emptyTranscript, nextId: 1 }
    writer.transcript('c1', () => current, true)
    current = { ...emptyTranscript, nextId: 2 }
    const flushing = writer.flushAll()
    await new Promise((resolve) => setTimeout(resolve, 5))
    expect(onDisk).toEqual([])
    release()
    await flushing
    expect(onDisk).toEqual([1, 2])
    vi.restoreAllMocks()
  })
})
