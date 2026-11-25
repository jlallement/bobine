import { execFileSync } from 'node:child_process'
import { appendFileSync, mkdirSync, mkdtempSync, realpathSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { gitRun } from '../git/git-queue'
import { folderFingerprint } from './folder-fingerprint'

function repo(): string {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'empreinte-')))
  const git = (...args: string[]) =>
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', ...args], {
      cwd: dir
    })
  writeFileSync(join(dir, '.gitignore'), 'node_modules/\n.env\n')
  writeFileSync(join(dir, 'a.txt'), 'a\n')
  git('init', '-q', '-b', 'main')
  git('add', '.')
  git('commit', '-q', '-m', 'init')
  mkdirSync(join(dir, 'node_modules'))
  writeFileSync(join(dir, 'node_modules', 'dep.js'), 'dep\n')
  return dir
}

describe('empreinte du dossier (revue sécurité, fiche 285)', () => {
  it('voit la config git, les crochets, la branche et les ignorés du premier niveau', async () => {
    const dir = repo()
    const print = () => folderFingerprint(gitRun, dir)
    let before = await print()
    appendFileSync(join(dir, '.git', 'config'), '[core]\n\thooksPath = ailleurs\n')
    expect(await print()).not.toBe(before)
    before = await print()
    writeFileSync(join(dir, '.git', 'hooks', 'post-checkout'), '#!/bin/sh\necho pris\n')
    expect(await print()).not.toBe(before)
    before = await print()
    writeFileSync(join(dir, '.env'), 'SECRET=1\n')
    expect(await print()).not.toBe(before)
    before = await print()
    execFileSync('git', ['checkout', '-q', '-b', 'autre'], { cwd: dir })
    expect(await print()).not.toBe(before)
    // Ce qui n'est pas vu, et documenté : le contenu d'un dossier ignoré.
    before = await print()
    writeFileSync(join(dir, 'node_modules', 'x.js'), 'x\n')
    expect(await print()).toBe(before)
  })

  it('voit un crochet ajouté dans le dossier de `core.hooksPath`, même ignoré (contre-revue, N7)', async () => {
    const dir = repo()
    mkdirSync(join(dir, 'node_modules', '.hooks'))
    execFileSync('git', ['config', 'core.hooksPath', 'node_modules/.hooks'], { cwd: dir })
    const before = await folderFingerprint(gitRun, dir)
    writeFileSync(join(dir, 'node_modules', '.hooks', 'pre-commit'), '#!/bin/sh\necho pris\n')
    expect(await folderFingerprint(gitRun, dir)).not.toBe(before)
  })

  it('fichiers non suivis (lus dans `git status -uall`) : dossier non suivi, espaces, non ASCII, sous-dossier de travail', async () => {
    const dir = repo()
    mkdirSync(join(dir, 'notes du jour', 'été'), { recursive: true })
    const untracked = join(dir, 'notes du jour', 'été', 'idée à garder.md')
    writeFileSync(untracked, 'v1\n')
    const print = (cwd: string) => folderFingerprint(gitRun, cwd)
    let before = await print(dir)
    // Contenu changé (le diff ne voit pas un fichier non suivi : seules sa taille et sa date).
    writeFileSync(untracked, 'version 2\n')
    expect(await print(dir)).not.toBe(before)
    // Dossier de travail sous la racine du dépôt : les chemins de `git status` partent de la racine.
    const sub = join(dir, 'notes du jour')
    before = await print(sub)
    writeFileSync(untracked, 'version 3, plus longue\n')
    expect(await print(sub)).not.toBe(before)
    // Rien ne change : même empreinte (aucune entrée instable).
    expect(await print(sub)).toBe(await print(sub))
  })

  it('renommage indexé : vu, puis stable tant que rien ne bouge', async () => {
    const dir = repo()
    writeFileSync(join(dir, 'r.txt'), 'renommé\n')
    execFileSync('git', ['add', 'r.txt'], { cwd: dir })
    execFileSync(
      'git',
      ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', 'commit', '-q', '-m', 'a'],
      { cwd: dir }
    )
    const before = await folderFingerprint(gitRun, dir)
    execFileSync('git', ['mv', 'r.txt', 'b c.txt'], { cwd: dir })
    const renamed = await folderFingerprint(gitRun, dir)
    expect(renamed).not.toBe(before)
    expect(await folderFingerprint(gitRun, dir)).toBe(renamed)
  })
})
