import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { saveDownload, type DownloadEnd, type PendingDownload } from './downloads'

/** Téléchargement simulé : écrit son fichier à l'endroit fixé, puis finit quand on le dit. */
function fakeDownload(name: string) {
  let savePath = ''
  let state = 'progressing'
  let done: ((event: unknown, state: DownloadEnd) => void) | undefined
  let cancelled = false
  const item: PendingDownload = {
    getFilename: () => name,
    setSavePath: (path) => {
      savePath = path
      mkdirSync(dirname(path), { recursive: true })
      writeFileSync(path, 'a;b\n1;2\n')
    },
    getState: () => state,
    cancel: () => {
      cancelled = true
      finish('cancelled')
    },
    once: (_event, listener) => (done = listener)
  }
  const finish = (end: DownloadEnd) => {
    state = end
    queueMicrotask(() => done?.({}, end))
  }
  return { item, finish, savePath: () => savePath, cancelled: () => cancelled }
}

describe('téléchargements du navigateur (fiche 094, ADR-0018)', () => {
  it('rien hors du dossier d’attente avant le choix ; déplacé là où l’utilisateur l’a choisi', async () => {
    const root = mkdtempSync(join(tmpdir(), 'bobine-dl-'))
    const pendingDir = join(root, 'attente')
    const target = join(root, 'choisi', 'export.csv')
    mkdirSync(dirname(target))
    let release: (path: string) => void = () => {}
    const download = fakeDownload('export.csv')
    const outcome = saveDownload(download.item, {
      pendingDir,
      chooseTarget: (name) => {
        expect(name).toBe('export.csv')
        return new Promise((resolve) => (release = resolve))
      }
    })
    download.finish('completed')
    await new Promise((r) => setTimeout(r, 10))
    // Fenêtre encore ouverte : les données attendent dans le dossier de l'app.
    expect(download.savePath().startsWith(pendingDir)).toBe(true)
    expect(readdirSync(dirname(target))).toEqual([])
    release(target)
    expect(await outcome).toEqual({ state: 'completed', path: target })
    expect(readFileSync(target, 'utf8')).toBe('a;b\n1;2\n')
    expect(readdirSync(pendingDir)).toEqual([])
  })

  it('« Annuler » : le téléchargement est arrêté, rien ne reste', async () => {
    const root = mkdtempSync(join(tmpdir(), 'bobine-dl-'))
    const pendingDir = join(root, 'attente')
    const download = fakeDownload('gros.zip')
    const outcome = await saveDownload(download.item, {
      pendingDir,
      chooseTarget: async () => undefined
    })
    expect(outcome).toEqual({ state: 'cancelled' })
    expect(download.cancelled()).toBe(true)
    expect(readdirSync(pendingDir)).toEqual([])
  })

  it('échec du téléchargement après le choix : rien n’est écrit à l’endroit choisi', async () => {
    const root = mkdtempSync(join(tmpdir(), 'bobine-dl-'))
    const target = join(root, 'export.csv')
    const download = fakeDownload('export.csv')
    const outcome = saveDownload(download.item, {
      pendingDir: join(root, 'attente'),
      chooseTarget: async () => target
    })
    download.finish('interrupted')
    expect(await outcome).toEqual({ state: 'interrupted' })
    expect(readdirSync(root)).toEqual(['attente'])
    expect(readdirSync(join(root, 'attente'))).toEqual([])
  })
})
