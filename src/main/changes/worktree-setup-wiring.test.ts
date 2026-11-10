import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AgentEvent, ConversationEvent } from '@shared/agent'
import type { WorktreeSetup } from '@shared/worktree-setup'
import type { Run } from '../simulator/run'
import { connectWorktreePreparation } from './worktree-setup-wiring'
import { WorktreePreparation, type CommandResult, type ShellRun } from './worktree-setup'
import type { WorktreeInfo } from './worktrees'

const dirs: string[] = []
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

/** Dossier d'origine avec son `.bobine/worktree.json`, et un « worktree » vide. */
function repo(config: object): WorktreeInfo {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'bob-wire-')))
  const path = realpathSync(mkdtempSync(join(tmpdir(), 'bob-wire-wt-')))
  dirs.push(root, path)
  mkdirSync(join(root, '.bobine'))
  writeFileSync(join(root, '.bobine', 'worktree.json'), JSON.stringify(config))
  return { root, path, branch: 'bobine/x', base: 'abc' }
}

/** Shell réduit : chaque commande attend qu'on la finisse (ou qu'on l'arrête). */
function shell() {
  const running = new Map<string, (result: CommandResult) => void>()
  const run: ShellRun = vi.fn(
    (command, { signal }) =>
      new Promise<CommandResult>((resolve) => {
        running.set(command, resolve)
        signal.addEventListener('abort', () => resolve({ code: null, timedOut: false }))
      })
  )
  return {
    run,
    finish: (command: string, code = 0) => running.get(command)?.({ code, timedOut: false })
  }
}

const noGit: Run = () => Promise.reject(new Error('git'))

/**
 * Gestionnaire réduit : `prompt` passe par la garde comme le vrai, `post` est noté ; la vraie
 * préparation, avec un shell réduit.
 */
function host(config: object, kind: 'user' | 'child' | 'scheduled' = 'user', approved = false) {
  const worktree = repo(config)
  const posted: AgentEvent[] = []
  const sent: { text: string; context?: string }[] = []
  let listener: ((payload: ConversationEvent) => void) | undefined
  const summary =
    kind === 'child'
      ? { startedFrom: { id: 'm', title: 'mère' } }
      : kind === 'scheduled'
        ? { scheduled: { taskId: 't', name: 'Tâche' } }
        : {}
  const conversations = {
    promptGate: undefined as ((...args: never[]) => boolean) | undefined,
    subscribe: vi.fn((l: { event?: (payload: ConversationEvent) => void }) => {
      listener = l.event
      return () => {}
    }),
    post: vi.fn((_id: string, event: AgentEvent) => void posted.push(event)),
    worktreeOf: vi.fn(() => ({ id: 'c1', title: 't', workspace: worktree.path, worktree })),
    view: vi.fn(() => ({ summary, transcript: { items: [] } })),
    prompt: vi.fn(
      async (id: string, text: string, _a?: unknown, options: { context?: string } = {}) => {
        const gate = conversations.promptGate as
          ((id: string, text: string, a: unknown[], o: object) => boolean) | undefined
        if (gate?.(id, text, [], options)) return
        sent.push({ text, ...(options.context ? { context: options.context } : {}) })
      }
    )
  }
  const sh = shell()
  const approvals = { approved: vi.fn(() => approved), approve: vi.fn() }
  const preparation = new WorktreePreparation({
    run: noGit,
    approvals,
    env: () => ({}),
    log: { info: () => {}, warn: () => {} },
    shell: sh.run,
    throttleMs: 0
  })
  const control = connectWorktreePreparation(conversations as never, preparation)
  listener?.({ conversationId: 'c1', event: { type: 'worktree-start' } } as never)
  const card = (): WorktreeSetup | undefined => {
    const last = posted.findLast((e) => e.type === 'worktree-setup')
    return last?.type === 'worktree-setup' ? last.setup : undefined
  }
  return { conversations, posted, sent, control, preparation, approvals, shell: sh, worktree, card }
}

describe('branchement de la préparation (fiche 175)', () => {
  it('à autoriser : le message attend sur la carte ; « Continuer sans » le libère avec le contexte', async () => {
    const h = host({ setup: 'pnpm i', archive: 'make clean' })
    await vi.waitFor(() => expect(h.card()?.state).toBe('approval'))
    expect(h.card()).toMatchObject({ command: 'pnpm i', archive: 'make clean' })
    await h.conversations.prompt('c1', 'Bonjour')
    expect(h.sent).toEqual([])
    expect(h.card()).toMatchObject({ state: 'approval', held: 1 })
    h.control.skip('c1')
    await vi.waitFor(() => expect(h.sent).toHaveLength(1))
    expect(h.sent[0]?.text).toBe('Bonjour')
    expect(h.sent[0]?.context).toContain('was not run')
  })

  it('« Autoriser » avec l’empreinte montrée : la commande tourne, le message part à sa fin', async () => {
    const h = host({ setup: 'pnpm i' })
    await vi.waitFor(() => expect(h.card()?.state).toBe('approval'))
    await h.conversations.prompt('c1', 'Bonjour')
    h.control.approve('c1', h.card()?.signature ?? '')
    await vi.waitFor(() => expect(h.card()).toMatchObject({ state: 'running', held: 1 }))
    expect(h.sent).toEqual([])
    h.shell.finish('pnpm i')
    await vi.waitFor(() => expect(h.sent).toEqual([{ text: 'Bonjour' }]))
    expect(h.card()?.state).toBe('done')
  })

  it('fichier changé avant « Autoriser » : rien ne tourne, le message attend encore (D2)', async () => {
    const h = host({ setup: 'echo SHOWN' })
    await vi.waitFor(() => expect(h.card()?.state).toBe('approval'))
    await h.conversations.prompt('c1', 'Bonjour')
    const shown = h.card()?.signature ?? ''
    writeFileSync(
      join(h.worktree.root, '.bobine', 'worktree.json'),
      JSON.stringify({ setup: 'echo SWAPPED' })
    )
    h.control.approve('c1', shown)
    await vi.waitFor(() =>
      expect(h.card()).toMatchObject({ command: 'echo SWAPPED', changed: true })
    )
    expect(h.card()).toMatchObject({ state: 'approval', held: 1 })
    expect(h.shell.run).not.toHaveBeenCalled()
    expect(h.approvals.approve).not.toHaveBeenCalled()
    expect(h.sent).toEqual([])
  })

  it('`archive` seule : carte à autoriser, le message part tout de suite (D6)', async () => {
    const h = host({ archive: 'make clean' })
    await vi.waitFor(() => expect(h.card()?.state).toBe('approval'))
    await h.conversations.prompt('c1', 'Bonjour')
    expect(h.sent).toEqual([{ text: 'Bonjour' }])
    h.control.approve('c1', h.card()?.signature ?? '')
    await vi.waitFor(() => expect(h.card()).toEqual({ archive: 'make clean', state: 'done' }))
    expect(h.approvals.approve).toHaveBeenCalled()
    expect(h.shell.run).not.toHaveBeenCalled()
  })

  it('fille : n’attend pas l’accord, son agent est prévenu', async () => {
    const h = host({ setup: 'pnpm i' }, 'child')
    await h.conversations.prompt('c1', 'Consigne')
    await vi.waitFor(() => expect(h.sent).toHaveLength(1))
    expect(h.sent[0]?.context).toContain('awaits the user')
  })

  it('tâche planifiée : n’attend jamais l’accord, part sans la préparation (D3)', async () => {
    const h = host({ setup: 'pnpm i' }, 'scheduled')
    await h.conversations.prompt('c1', 'Consigne')
    await vi.waitFor(() => expect(h.sent).toHaveLength(1))
    expect(h.sent[0]?.context).toContain('unattended run')
    expect(h.card()).toMatchObject({ state: 'skipped', unattended: true })
    expect(h.shell.run).not.toHaveBeenCalled()
  })

  it('commande autorisée en cours : le message attend sur la carte ; « Arrêter » l’envoie avec l’arrêt (D4)', async () => {
    const h = host({ setup: 'sleep 777' }, 'user', true)
    await vi.waitFor(() => expect(h.shell.run).toHaveBeenCalled())
    await h.conversations.prompt('c1', 'Bonjour')
    expect(h.card()).toMatchObject({ state: 'running', held: 1 })
    expect(h.sent).toEqual([])
    h.control.stop('c1')
    await vi.waitFor(() => expect(h.sent).toHaveLength(1))
    expect(h.sent[0]?.context).toContain('stopped by the user')
    expect(h.card()).toMatchObject({ state: 'failed', stopped: true })
  })

  it('commande en cours : « Continuer sans attendre » envoie le message, la commande continue (D4)', async () => {
    const h = host({ setup: 'pnpm i' }, 'user', true)
    await vi.waitFor(() => expect(h.shell.run).toHaveBeenCalled())
    await h.conversations.prompt('c1', 'Un')
    await h.conversations.prompt('c1', 'Deux')
    expect(h.card()).toMatchObject({ held: 2 })
    h.control.skip('c1')
    await vi.waitFor(() => expect(h.sent).toHaveLength(2))
    expect(h.sent[0]?.context).toContain('still running')
    expect(h.sent[1]).toEqual({ text: 'Deux' })
    expect(h.card()).toMatchObject({ state: 'running', proceeded: true })
    // Les messages suivants partent directement ; la fin ne renvoie rien.
    await h.conversations.prompt('c1', 'Trois')
    h.shell.finish('pnpm i')
    await vi.waitFor(() => expect(h.card()?.state).toBe('done'))
    expect(h.sent.map((m) => m.text)).toEqual(['Un', 'Deux', 'Trois'])
  })

  it('pendant la copie, avant toute carte : avis dans le fil, message envoyé à la fin avec l’échec', async () => {
    const h = host({ setup: 'pnpm i' }, 'user', true)
    // Message envoyé avant que la préparation ait lu sa config : pas encore de carte.
    await h.conversations.prompt('c1', 'Bonjour')
    expect(h.posted).toContainEqual({
      type: 'notice',
      level: 'info',
      message: { key: 'worktreeSetup.waiting' }
    })
    await vi.waitFor(() => expect(h.shell.run).toHaveBeenCalled())
    h.shell.finish('pnpm i', 1)
    await vi.waitFor(() => expect(h.sent).toHaveLength(1))
    expect(h.sent[0]?.context).toContain('exit code 1')
  })
})
