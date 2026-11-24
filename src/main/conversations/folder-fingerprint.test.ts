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
})
