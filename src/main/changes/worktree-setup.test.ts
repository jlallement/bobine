import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { WorktreeSetup } from '@shared/worktree-setup'
import type { Run } from '../simulator/run'
import {
  fingerprint,
  shellRun,
  WorktreePreparation,
  type CommandResult,
  type ShellRun
} from './worktree-setup'
import type { WorktreeInfo } from './worktrees'

const dirs: string[] = []
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

/** Dossier d'origine avec son `.bobine/worktree.json`, et un « worktree » vide. */
function setup(config: object): WorktreeInfo {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'bob-prep-')))
  const path = realpathSync(mkdtempSync(join(tmpdir(), 'bob-prep-wt-')))
  dirs.push(root, path)
  mkdirSync(join(root, '.bobine'))
  writeFileSync(join(root, '.bobine', 'worktree.json'), JSON.stringify(config))
  return { root, path, branch: 'bobine/essai', base: 'abc' }
}

// Pas de `.worktreeinclude` dans ces dossiers : git n'est jamais appelé.
const noGit: Run = () => Promise.reject(new Error('git'))

function preparation(shell: ShellRun, approved = true) {
  const approvals = { approved: vi.fn(() => approved), approve: vi.fn() }
  const prep = new WorktreePreparation({
    run: noGit,
    approvals,
    env: () => ({ PATH: process.env['PATH'] }),
    log: { info: () => {}, warn: () => {} },
    shell,
    throttleMs: 0
  })
  return { prep, approvals }
}

describe('préparation des worktrees (fiche 175)', () => {
  it('commande autorisée : en cours, sortie, réussie ; rien à dire à l’agent', async () => {
    const info = setup({ setup: 'pnpm install' })
    const shell: ShellRun = vi.fn(async (_command, { onOutput, env, cwd }) => {
      expect(cwd).toBe(info.path)
      expect(env['BOBINE_WORKTREE_SOURCE']).toBe(info.root)
      expect(env['BOBINE_WORKTREE_BRANCH']).toBe('bobine/essai')
      onOutput('\u001b[32mok\u001b[0m\n')
      return { code: 0, timedOut: false }
    })
    const { prep } = preparation(shell)
    const states: WorktreeSetup[] = []
    prep.start('c1', info, (s) => states.push(s))
    expect(prep.awaiting('c1')).toMatchObject({ finished: false })
    const done = await prep.settled('c1')
    expect(done).toMatchObject({ command: 'pnpm install', state: 'done', output: 'ok\n' })
    expect(states[0]).toEqual({ command: 'pnpm install', state: 'running' })
    expect(prep.awaiting('c1')).toMatchObject({ finished: true })
    expect(prep.takeContext('c1')).toBeUndefined()
    expect(prep.awaiting('c1')).toBeUndefined()
  })

  it('pas encore autorisée : les deux commandes montrées, rien lancé ; « Autoriser » garde l’accord (D1)', async () => {
    const config = { setup: 'make deps', archive: 'make clean' }
    const info = setup(config)
    const shell: ShellRun = vi.fn(async () => ({ code: 2, timedOut: false }))
    const { prep, approvals } = preparation(shell, false)
    const states: WorktreeSetup[] = []
    prep.start('c1', info, (s) => states.push(s))
    const signature = fingerprint(config)
    expect(await prep.settled('c1')).toEqual({
      command: 'make deps',
      archive: 'make clean',
      state: 'approval',
      signature
    })
    expect(shell).not.toHaveBeenCalled()
    expect(prep.takeContext('c1')).toContain('awaits the user')
    // Une seule fois.
    expect(prep.takeContext('c1')).toBeUndefined()

    expect(await prep.approve('c1', info, signature)).toBe('approved')
    expect(approvals.approve).toHaveBeenCalledWith(info.root, signature, config)
    expect(states.at(-1)).toMatchObject({ state: 'failed', exitCode: 2, archive: 'make clean' })
    // Déjà autorisée : un second clic ne relance rien.
    expect(await prep.approve('c1', info, signature)).toBe('ignored')
    expect(shell).toHaveBeenCalledTimes(1)
  })

  it('fichier changé entre l’affichage et l’accord : rien ne tourne, accord redemandé (D2)', async () => {
    const info = setup({ setup: 'echo SHOWN' })
    const shell: ShellRun = vi.fn(async () => ({ code: 0, timedOut: false }))
    const { prep, approvals } = preparation(shell, false)
    const states: WorktreeSetup[] = []
    prep.start('c1', info, (s) => states.push(s))
    const shown = (await prep.settled('c1'))?.signature ?? ''
    prep.hold('c1', 1)
    const swapped = { setup: 'echo SWAPPED', archive: 'rm -rf x' }
    writeFileSync(join(info.root, '.bobine', 'worktree.json'), JSON.stringify(swapped))
    expect(await prep.approve('c1', info, shown)).toBe('changed')
    expect(shell).not.toHaveBeenCalled()
    expect(approvals.approve).not.toHaveBeenCalled()
    expect(states.at(-1)).toEqual({
      command: 'echo SWAPPED',
      archive: 'rm -rf x',
      state: 'approval',
      signature: fingerprint(swapped),
      changed: true,
      held: 1
    })
    // L'ancienne empreinte ne vaut plus rien ; la nouvelle, montrée, lance la nouvelle commande.
    expect(await prep.approve('c1', info, shown)).toBe('ignored')
    expect(await prep.approve('c1', info, fingerprint(swapped))).toBe('approved')
    expect(shell).toHaveBeenCalledWith('echo SWAPPED', expect.anything())
  })

  it('`archive` seule : carte à autoriser, rien ne tourne, le message ne l’attend pas (D6)', async () => {
    const config = { archive: 'docker compose down' }
    const info = setup(config)
    const shell: ShellRun = vi.fn(async () => ({ code: 0, timedOut: false }))
    const { prep, approvals } = preparation(shell, false)
    const states: WorktreeSetup[] = []
    prep.start('c1', info, (s) => states.push(s))
    const signature = fingerprint(config)
    expect(await prep.settled('c1')).toEqual({
      archive: 'docker compose down',
      state: 'approval',
      signature
    })
    expect(prep.takeContext('c1')).toBeUndefined()
    expect(await prep.approve('c1', info, signature)).toBe('approved')
    expect(approvals.approve).toHaveBeenCalledWith(info.root, signature, config)
    expect(states.at(-1)).toEqual({ archive: 'docker compose down', state: 'done' })
    expect(shell).not.toHaveBeenCalled()
  })

  it('« Continuer sans préparer » : seulement à autoriser ; la carte et l’agent le savent', async () => {
    const info = setup({ setup: 'make deps' })
    const { prep } = preparation(vi.fn(), false)
    const states: WorktreeSetup[] = []
    prep.start('c1', info, (s) => states.push(s))
    await prep.settled('c1')
    prep.hold('c1', 2)
    expect(states.at(-1)).toMatchObject({ state: 'approval', held: 2 })
    expect(prep.skip('c1')).toBe(true)
    expect(states.at(-1)).toEqual({ command: 'make deps', state: 'skipped' })
    expect(prep.takeContext('c1')).toContain('was not run')
    expect(prep.skip('c1')).toBe(false)
  })

  it('exécution sans surveillance : non lancée, la carte et l’agent le savent (D3)', async () => {
    const info = setup({ setup: 'make deps' })
    const { prep } = preparation(vi.fn(), false)
    const states: WorktreeSetup[] = []
    prep.start('c1', info, (s) => states.push(s))
    await prep.settled('c1')
    expect(prep.skip('c1', true)).toBe(true)
    expect(states.at(-1)).toEqual({ command: 'make deps', state: 'skipped', unattended: true })
    expect(prep.takeContext('c1')).toContain('unattended run')
  })

  it('pendant la commande : message retenu sur la carte, « Arrêter » (D4)', async () => {
    const info = setup({ setup: 'sleep 777' })
    const shell: ShellRun = vi.fn(
      (_command, { signal }) =>
        new Promise<CommandResult>((resolve) =>
          signal.addEventListener('abort', () => resolve({ code: null, timedOut: false }))
        )
    )
    const { prep } = preparation(shell)
    const states: WorktreeSetup[] = []
    prep.start('c1', info, (s) => states.push(s))
    await vi.waitFor(() => expect(shell).toHaveBeenCalled())
    expect(prep.hold('c1', 1)).toBe(true)
    expect(states.at(-1)).toMatchObject({ state: 'running', held: 1 })
    expect(prep.stop('c1')).toBe(true)
    const end = await prep.settled('c1')
    expect(end).toMatchObject({ state: 'failed', stopped: true })
    expect(end?.error).toBeUndefined()
    // Finie : plus de message retenu sur la carte, plus rien à arrêter.
    expect(states.at(-1)?.held).toBeUndefined()
    expect(prep.stop('c1')).toBe(false)
    expect(prep.takeContext('c1')).toContain('stopped by the user')
  })

  it('pendant la commande : « Continuer sans attendre », la commande finit seule (D4)', async () => {
    const info = setup({ setup: 'make deps' })
    let finish: () => void = () => {}
    const shell: ShellRun = vi.fn(
      () =>
        new Promise<CommandResult>(
          (resolve) => (finish = () => resolve({ code: 0, timedOut: false }))
        )
    )
    const { prep } = preparation(shell)
    const states: WorktreeSetup[] = []
    prep.start('c1', info, (s) => states.push(s))
    await vi.waitFor(() => expect(shell).toHaveBeenCalled())
    prep.hold('c1', 1)
    expect(prep.proceed('c1')).toContain('still running')
    expect(states.at(-1)).toMatchObject({ state: 'running', proceeded: true })
    expect(states.at(-1)?.held).toBeUndefined()
    // Les messages suivants ne l'attendent plus.
    expect(prep.awaiting('c1')).toBeUndefined()
    expect(prep.proceed('c1')).toBeUndefined()
    finish()
    expect(await prep.settled('c1')).toMatchObject({ state: 'done' })
  })

  it('échec et délai : dits à l’agent', async () => {
    const info = setup({ setup: 'npm ci' })
    const { prep } = preparation(async () => ({ code: null, timedOut: true }))
    prep.start('c1', info, () => {})
    expect(await prep.settled('c1')).toMatchObject({ state: 'failed', timedOut: true })
    expect(prep.takeContext('c1')).toContain('timing out')
  })

  it('sans commande ni fichier à copier : rien', async () => {
    const info = setup({})
    const emit = vi.fn()
    const { prep } = preparation(vi.fn())
    prep.start('c1', info, emit)
    expect(await prep.settled('c1')).toBeUndefined()
    expect(emit).not.toHaveBeenCalled()
  })

  it('archive : lancée seulement si autorisée, et arrête la préparation en cours', async () => {
    const info = setup({ setup: 'long', archive: 'docker compose down' })
    const signals: AbortSignal[] = []
    const shell: ShellRun = vi.fn(async (command, { signal }) => {
      if (command === 'long') {
        signals.push(signal)
        await new Promise((resolve) => signal.addEventListener('abort', resolve))
        return { code: null, timedOut: false }
      }
      return { code: 0, timedOut: false }
    })
    const { prep } = preparation(shell)
    prep.start('c1', info, () => {})
    await vi.waitFor(() => expect(signals).toHaveLength(1))
    await prep.beforeRemove(info)
    expect(signals[0]?.aborted).toBe(true)
    expect(shell).toHaveBeenLastCalledWith(
      'docker compose down',
      expect.objectContaining({ cwd: info.path })
    )
    const refused = preparation(shell, false)
    vi.mocked(shell).mockClear()
    await refused.prep.beforeRemove(info)
    expect(shell).not.toHaveBeenCalled()
  })

  it('lancement réel par le shell : sortie, code, délai', async () => {
    const cwd = realpathSync(mkdtempSync(join(tmpdir(), 'bob-shell-')))
    dirs.push(cwd)
    let output = ''
    const signal = new AbortController().signal
    const result = await shellRun('echo bonjour; echo erreur >&2; exit 3', {
      cwd,
      env: process.env,
      timeoutMs: 10_000,
      signal,
      onOutput: (chunk) => (output += chunk)
    })
    expect(result).toEqual({ code: 3, timedOut: false })
    expect(output).toContain('bonjour')
    expect(output).toContain('erreur')
    const slow = await shellRun('sleep 5', {
      cwd,
      env: process.env,
      timeoutMs: 200,
      signal,
      onOutput: () => {}
    })
    expect(slow).toEqual({ code: null, timedOut: true })
  })
})
