import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DRAFT_LIMITS } from '@shared/commit-draft'
import { runCommand } from '../simulator/run'
import { draftFiles, redactLines } from './commit-diff'

function repo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'commit-diff-'))
  const git = (...a: string[]) =>
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@x.invalid', ...a], { cwd: dir })
  git('init', '-q', '-b', 'main')
  writeFileSync(join(dir, 'a.js'), 'const a = 1\n')
  writeFileSync(join(dir, 'big.txt'), 'x\n')
  git('add', '.')
  git('commit', '-q', '-m', 'init')
  return dir
}

describe('draftFiles (fiche 246)', () => {
  it('diff des suivis, contenu des nouveaux, secret retenu, binaire, trop long, lignes masquées', async () => {
    const dir = repo()
    writeFileSync(join(dir, 'a.js'), 'const a = 2\npassword = "hunter2-hunter2"\n')
    writeFileSync(join(dir, 'new.js'), 'export const n = 1\n')
    writeFileSync(join(dir, '.env.local'), 'TOKEN=abc\n')
    writeFileSync(join(dir, 'img.bin'), Buffer.from([1, 0, 2, 0]))
    writeFileSync(join(dir, 'big.txt'), 'line\n'.repeat(DRAFT_LIMITS.fileDiffChars))
    const files = await draftFiles(runCommand, dir, [
      { path: 'a.js', status: 'modified' },
      { path: 'new.js', status: 'untracked' },
      { path: '.env.local', status: 'untracked' },
      { path: 'img.bin', status: 'untracked' },
      { path: 'big.txt', status: 'modified' }
    ])
    const [a, created, env, bin, big] = files
    expect(a?.diff).toContain('+const a = 2')
    expect(a?.diff).not.toContain('hunter2')
    expect(a?.diff).toContain('[redacted]')
    expect(created?.diff).toContain('+export const n = 1')
    expect(env).toEqual({ path: '.env.local', status: 'untracked', withheld: 'secret' })
    expect(bin).toMatchObject({ withheld: 'binary' })
    expect(big).toMatchObject({ withheld: 'too-long', removed: 1 })
    expect(big?.diff).toBeUndefined()
  })

  it('au-delà du total, les fichiers suivants sont cités sans leur diff', async () => {
    const dir = repo()
    const paths: string[] = []
    const each = Math.floor(DRAFT_LIMITS.fileDiffChars * 0.9)
    for (let i = 0; i < 8; i++) {
      const path = `f${i}.txt`
      paths.push(path)
      writeFileSync(join(dir, path), 'y'.repeat(each - 40) + '\n')
    }
    const files = await draftFiles(
      runCommand,
      dir,
      paths.map((path) => ({ path, status: 'untracked' as const }))
    )
    const sent = files.filter((f) => f.diff)
    expect(sent.length).toBeGreaterThan(0)
    expect(sent.reduce((n, f) => n + (f.diff?.length ?? 0), 0)).toBeLessThanOrEqual(
      DRAFT_LIMITS.totalDiffChars
    )
    expect(files.at(-1)).toMatchObject({ withheld: 'too-long' })
  })

  it('refuse un chemin hors du dossier', async () => {
    const dir = repo()
    await expect(
      draftFiles(runCommand, dir, [{ path: '../dehors.txt', status: 'untracked' }])
    ).rejects.toThrow()
  })
})

describe('redactLines', () => {
  it('remplace la ligne entière où un secret est reconnu', () => {
    expect(redactLines('a\napi_key = "abcdefgh1234"\nb')).toBe('a\n[redacted]\nb') // gitleaks:allow — fake value for tests
  })
})
