import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { applyRestore, planRestore } from './restore-files'

const full = (path: string, oldText: string | null, newText: string) => ({
  path,
  edits: [{ oldText, newText }]
})

describe('remettre les fichiers dans leur état d’alors (fiche 023)', () => {
  it('diffs complets (Bob) : remis, créé → supprimé, modifié depuis → pas touché, hors dossier → refusé', async () => {
    const root = mkdtempSync(join(tmpdir(), 'restore-'))
    writeFileSync(join(root, 'a.txt'), 'après')
    writeFileSync(join(root, 'cree.txt'), 'nouveau')
    writeFileSync(join(root, 'touche.txt'), 'modifié à la main')
    writeFileSync(join(root, 'pareil.txt'), 'avant')
    const changes = [
      full(join(root, 'a.txt'), 'avant', 'après'),
      full(join(root, 'cree.txt'), '', 'nouveau'),
      full(join(root, 'touche.txt'), 'v1', 'v2'),
      full(join(root, 'pareil.txt'), 'avant', 'après'),
      full('/etc/hosts', 'x', 'y')
    ]
    const plan = await planRestore(root, changes)
    expect(plan.map((p) => p.status)).toEqual([
      'restore',
      'restore',
      'conflict',
      'unchanged',
      'outside'
    ])
    expect(plan[1]?.created).toBe(true)
    const { restored, skipped } = await applyRestore(root, changes)
    expect(restored).toEqual([join(root, 'a.txt'), join(root, 'cree.txt')])
    expect(skipped).toEqual([join(root, 'touche.txt'), '/etc/hosts'])
    expect(readFileSync(join(root, 'a.txt'), 'utf8')).toBe('avant')
    expect(existsSync(join(root, 'cree.txt'))).toBe(false)
    expect(readFileSync(join(root, 'touche.txt'), 'utf8')).toBe('modifié à la main')
  })

  it('diffs par extrait (OpenCode) : défaits du dernier au premier', async () => {
    const root = mkdtempSync(join(tmpdir(), 'restore-'))
    const file = join(root, 'notes.txt')
    writeFileSync(file, 'Titre\nVersion 3\nfin\n')
    const change = {
      path: file,
      edits: [
        { oldText: 'Version 1', newText: 'Version 2' },
        { oldText: 'Version 2', newText: 'Version 3' }
      ]
    }
    expect((await planRestore(root, [change]))[0]?.status).toBe('restore')
    await applyRestore(root, [change])
    expect(readFileSync(file, 'utf8')).toBe('Titre\nVersion 1\nfin\n')
    // Extrait introuvable ou ambigu : pas touché.
    writeFileSync(file, 'Version 2 et Version 2\n')
    const ambiguous = { path: file, edits: [{ oldText: 'Version 1', newText: 'Version 2' }] }
    expect((await planRestore(root, [ambiguous]))[0]?.status).toBe('conflict')
  })

  it('chemins relatifs : résolus dans le dossier de la conversation', async () => {
    const root = mkdtempSync(join(tmpdir(), 'restore-'))
    writeFileSync(join(root, 'r.txt'), 'neuf')
    const plan = await planRestore(root, [
      full('r.txt', 'ancien', 'neuf'),
      full('../dehors.txt', 'a', 'b')
    ])
    expect(plan.map((p) => p.status)).toEqual(['restore', 'outside'])
  })
})
