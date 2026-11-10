import { describe, expect, it } from 'vitest'
import type { Run } from '../simulator/run'
import { GitRepo, parseStatusV2 } from './repo'

const STATUS = `# branch.oid 1234
# branch.head feat
# branch.upstream origin/feat
# branch.ab +2 -1
1 .M N... 100644 100644 100644 abc def src/a.ts
? notes.txt
2 R. N... 100644 100644 100644 abc def R100 b.ts\told.ts
`

describe('parseStatusV2', () => {
  it('reads the branch headers and counts the entries', () => {
    expect(parseStatusV2(STATUS)).toEqual({
      branch: 'feat',
      upstream: 'origin/feat',
      ahead: 2,
      behind: 1,
      dirty: 3
    })
  })

  it('leaves a detached HEAD without a branch', () => {
    expect(parseStatusV2('# branch.oid 1\n# branch.head (detached)\n')).toEqual({
      ahead: 0,
      behind: 0,
      dirty: 0
    })
  })
})

function fakeRun(answers: Record<string, { code?: number; stdout?: string; stderr?: string }>) {
  const calls: string[] = []
  const run: Run = async (_file, args) => {
    const key = args.join(' ')
    calls.push(key)
    const found = Object.entries(answers).find(([prefix]) => key.startsWith(prefix))?.[1]
    return {
      code: found?.code ?? 0,
      stdout: Buffer.from(found?.stdout ?? ''),
      stderr: found?.stderr ?? ''
    }
  }
  return { run, calls }
}

describe('GitRepo', () => {
  it('returns null outside a repository, but reports a missing git or a refused repository', async () => {
    const outside = fakeRun({
      'rev-parse --show-toplevel': { code: 128, stderr: 'fatal: not a git repository' }
    })
    expect(await new GitRepo(outside.run).status('/x')).toBeNull()
    // Dossier sur un autre système de fichiers (`/tmp` en tmpfs sous Linux, fiche 145).
    const boundary = fakeRun({
      'rev-parse --show-toplevel': {
        code: 128,
        stderr:
          'fatal: not a git repository (or any parent up to mount point /)\nStopping at filesystem boundary (GIT_DISCOVERY_ACROSS_FILESYSTEM not set).'
      }
    })
    expect(await new GitRepo(boundary.run).status('/tmp/x')).toBeNull()
    const missing = fakeRun({
      'rev-parse --show-toplevel': { code: 1, stderr: 'spawn git ENOENT' }
    })
    await expect(new GitRepo(missing.run).status('/x')).rejects.toThrow('git est introuvable')
    const refused = fakeRun({
      'rev-parse --show-toplevel': {
        code: 128,
        stderr: "fatal: detected dubious ownership in repository at '/x'"
      }
    })
    await expect(new GitRepo(refused.run).status('/x')).rejects.toThrow('dubious ownership')
  })

  it('reads the branch, its upstream and the changed files', async () => {
    const { run, calls } = fakeRun({
      'rev-parse --show-toplevel': { stdout: '/repo\n' },
      'status --porcelain=v2': { stdout: STATUS }
    })
    expect(await new GitRepo(run).status('/repo/sub')).toEqual({
      root: '/repo',
      branch: 'feat',
      upstream: 'origin/feat',
      ahead: 2,
      behind: 1,
      dirty: 3
    })
    // Deux commandes seulement : la puce est relue souvent.
    expect(calls).toHaveLength(2)
  })
})
