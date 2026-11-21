import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { discussionFolder } from './discussion-space'
import { folderGone, guardSendFolder } from './send-folder'

const failing = (code: string) => () => Promise.reject(Object.assign(new Error(code), { code }))

describe('dossier au moment d’envoyer (fiche 272)', () => {
  it('disparu (ENOENT, ENOTDIR, plus un dossier) : refusé ; autre erreur ou délai : laisse passer', async () => {
    expect(await folderGone('/x', 1000, failing('ENOENT'))).toBe(true)
    expect(await folderGone('/x', 1000, failing('ENOTDIR'))).toBe(true)
    expect(await folderGone('/x', 1000, async () => ({ isDirectory: () => false }))).toBe(true)
    expect(await folderGone('/x', 1000, failing('EACCES'))).toBe(false)
    expect(await folderGone('/x', 1000, failing('ETIMEDOUT'))).toBe(false)
    // Partage réseau muet : la lecture ne répond jamais, l'envoi n'attend pas.
    const started = Date.now()
    expect(await folderGone('/x', 30, () => new Promise(() => {}))).toBe(false)
    expect(Date.now() - started).toBeLessThan(1000)
  })

  it('vrai dossier supprimé : refusé avec le dossier ; discussion : son dossier est recréé', async () => {
    const root = mkdtempSync(join(tmpdir(), 'envoi-dossier-'))
    try {
      const gone = join(root, 'projet')
      await expect(guardSendFolder({ id: 'c1', workspace: gone }, root)).rejects.toThrow(gone)
      const folder = discussionFolder(root, 'd1')
      await guardSendFolder({ id: 'd1', space: 'discussion', workspace: folder }, root)
      expect(existsSync(folder)).toBe(true)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
